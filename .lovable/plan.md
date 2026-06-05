
# Integração Pipedrive — sincronização manual

Conectar Pipedrive via **API Token pessoal**, importar **Persons, Organizations, Deals e Activities** sob demanda (botão "Sincronizar agora"). CSV existente continua funcionando sem mudanças.

## Visão geral do fluxo

```text
Settings → Integrações → Card Pipedrive
   ↓
[Conectar]  → dialog pede API Token + domínio da company (ex: minhaempresa.pipedrive.com)
   ↓
Validação: GET /users/me → grava em organization_integrations + integration_credentials
   ↓
Card mostra "Conectado · 1.245 persons disponíveis"
   ↓
[Sincronizar agora] → server fn paginada → upsert em leads/deals/activities
   ↓
Toast: "237 novos, 1.008 atualizados, 12 ignorados" + log em pipedrive_sync_runs
```

## Modelo de dados (1 migration)

**Tabela `pipedrive_sync_runs`** — histórico de execuções (master pode auditar via /master/logs depois).
- `id`, `organization_id`, `started_at`, `finished_at`
- `status` text — `running | success | partial | failed`
- `triggered_by uuid` (usuário que clicou)
- `stats jsonb` — `{ persons: {created, updated, skipped}, deals: {...}, organizations: {...}, activities: {...} }`
- `error text null`

**Colunas novas (idempotência / dedup):**
- `leads.pipedrive_person_id bigint null` + index único parcial `(organization_id, pipedrive_person_id) WHERE pipedrive_person_id IS NOT NULL`
- `deals.pipedrive_deal_id bigint null` + mesmo padrão de índice único parcial
- `lead_activities.pipedrive_activity_id bigint null` + índice único parcial

Organizations do Pipedrive **não viram entidade separada** — preenchem `leads.company_name` e ficam guardadas inteiras em `leads.enrichment_data.pipedrive_org` para referência. Evita criar uma nova tabela só para isso.

**GRANTs + RLS** seguindo padrão do projeto (org members SELECT/manage, master ALL, service_role ALL).

**Provider `pipedrive`** já existe em `integration_providers`. Não cria de novo.

## Server functions (`src/lib/pipedrive.functions.ts`)

Todas com `requireSupabaseAuth` + verificação de org admin.

1. **`getPipedriveConnection()`** — retorna `{ connected, company_domain, has_token, last_sync_at, last_stats }`. Espelha o padrão de `getOrgResendConnection`.
2. **`savePipedriveConnection({ api_token, company_domain })`** — valida `GET https://{domain}/api/v2/users/me` com o token, grava em `organization_integrations` + `integration_credentials.key='api_token'`. Erros amigáveis para 401 ("token inválido") e DNS/timeout ("domínio incorreto").
3. **`disconnectPipedrive()`** — apaga credencial, marca connection `disconnected`. Não toca em `leads/deals` já importados (mantém `pipedrive_*_id` para reativação futura).
4. **`syncPipedriveNow({ since?: 'last_sync' | 'full' })`** — orquestrador. Cria linha em `pipedrive_sync_runs`, chama os 4 fetchers em sequência, atualiza stats, marca finished. Roda em até ~5min (timeout do server fn). Limite: 5.000 registros por entidade por execução; se exceder, retorna `status: 'partial'` e o próximo clique continua de onde parou (usa `update_time` da última linha importada como cursor, salvo em `organization_integrations.config.cursors`).

## Lógica de sync por entidade (`src/lib/pipedrive.server.ts`)

Helper privado server-only — não vai num `.functions.ts` para evitar bundle no client.

### Ordem importa (FKs)
1. **Organizations** — fetch `GET /v2/organizations?updated_since={cursor}&limit=500&cursor=...` paginado. Não cria linha em nenhuma tabela; só cacheia em memória `{ pipedrive_org_id → {name, address, ...} }` para o passo de persons enriquecer `company_name` e `enrichment_data.pipedrive_org`.
2. **Persons** → `leads`. Match por `pipedrive_person_id` (atualiza) ou cria novo. Source padrão: cria lead_source slug `pipedrive` se não existir e usa nele. Mapeamento:
   - `name` → `full_name`
   - `email[0].value` → `email`; resto vai pra `secondary_email`
   - `phone[0].value` → `phone`; resto pra `mobile_phone`
   - `org_id` → resolve via cache do passo 1 para `company_name`
   - `custom_fields` do Pipedrive → `leads.custom_fields.pipedrive` (objeto)
   - `pipedrive_person_id` preenchido
3. **Deals** → `deals`. Match por `pipedrive_deal_id`. `person_id` → busca `leads.id` via `pipedrive_person_id` para preencher `lead_id`. Mapeamento de stage do Pipedrive para o enum `deal_stage` do projeto via tabela de equivalência fixa no código (`new/lead`, `qualified`, `proposal`, `negotiation`, `won/closed_won`, `lost/closed_lost`); fallback `lead` quando não casar. `value`, `currency`, `probability`, `expected_close_date`, `status` (`open/won/lost`) mapeados direto.
4. **Activities** → `lead_activities`. Match por `pipedrive_activity_id`. Liga via `person_id → lead_id`. Tipo do Pipedrive (`call`, `meeting`, `task`, `email`, `lunch`) mapeado para o enum `activity_type` existente (qualquer não mapeado vira `note`). `subject`→`title`, `note`→`description`, payload bruto em `payload.pipedrive`.

### Regras gerais
- **Idempotência**: tudo via `upsert` no índice único `(organization_id, pipedrive_*_id)`.
- **Paginação**: API v2 do Pipedrive usa cursor. Loop até `next_cursor=null` ou limite de 5k.
- **Rate limit**: Pipedrive permite ~80 req/2s no plano padrão. Aguardar 250ms entre páginas (suficiente para ~8 req/s).
- **Erro em uma entidade não derruba o sync inteiro**: cada fetcher é envolto em try/catch, erro vai pra `stats.{entidade}.error` e o run termina como `partial`.
- **Skipped**: persons sem nome E sem email/telefone são ignoradas (motivo: "registro vazio").

## UI

### Card no `_app.dashboard.integrations.tsx` (Pipedrive já listado)
Estados:
- **Não conectado**: botão "Conectar" abre `<PipedriveConnectDialog>` (campos: Company domain, API Token com toggle eye/eye-off, link "Onde encontro?" → docs Pipedrive).
- **Conectado**: badge verde "Conectado", texto "Última sync: há 2h · 1.245 persons", botões "Sincronizar agora" (loading state) e "Desconectar" (confirm dialog).
- Durante sync: spinner + progress textual ("Importando deals... 320/1.500"). Como server fn é uma única chamada bloqueante, só mostramos "Sincronizando..." e ao final um toast com `stats`. Sem progress real nessa fase.

### Botão "Ver histórico" (opcional, pequeno)
Sheet lateral lista últimos 20 `pipedrive_sync_runs` com timestamp, status, stats, erro. Mesma página de integrações.

### Importante: CSV intocado
`ImportLeadsSheet.tsx` continua exatamente como está. Adicionamos só um hint no topo do dialog do Pipedrive: "Esta importação roda em paralelo ao CSV — leads duplicados são deduplicados por email."

Regra de dedup adicional para evitar duplicar com CSV: ao criar lead novo via Pipedrive, se já existir lead na org com mesmo `email` (case-insensitive) **sem** `pipedrive_person_id`, fazer UPDATE preenchendo `pipedrive_person_id` em vez de criar duplicado.

## Detalhes técnicos

- **API base**: `https://{company_domain}/api/v2/{resource}`. Autenticação via query `?api_token=...` (header Bearer não funciona com token pessoal — só com OAuth).
- **Cursor incremental**: salvo em `organization_integrations.config.pipedrive_cursors = { persons_updated_since, deals_updated_since, ... }`. Primeira sync é full (sem cursor); seguintes usam `updated_since` ISO.
- **Modo full re-sync**: dialog "Desconectar" oferece checkbox "Limpar cursores na próxima conexão" para forçar full sync.
- **Token storage**: reutiliza `integration_credentials.value_encrypted` (já é o padrão do Resend). Sem mudança no schema dessa tabela.
- **Verificação de domínio**: aceitar formato com ou sem `https://`, normalizar para `{slug}.pipedrive.com`. Rejeitar se não terminar em `.pipedrive.com` ou `.pipedrive.com.br`.
- **Types**: regenerados automaticamente após migration.

## Fora do escopo (deixa explícito)

- OAuth flow do Pipedrive Marketplace
- Push de mudanças (Leaderei → Pipedrive)
- Webhooks em tempo real
- Sync automático por cron (botão manual só)
- Mapping editor visual de custom fields (vão raw para `custom_fields.pipedrive`)
- Resolução de conflito por timestamp em caso de edição simultânea (last-write-wins do Pipedrive)
- Importação de Notes separadas de Activities
- Multi-conexão (1 organização Leaderei = 1 conta Pipedrive)

## Entregáveis

1. Migration: `pipedrive_sync_runs` + 3 colunas + 3 índices únicos + GRANTs + RLS.
2. `src/lib/pipedrive.functions.ts` (4 server fns).
3. `src/lib/pipedrive.server.ts` (fetchers + mappers + upserts).
4. `src/components/app/PipedriveConnectDialog.tsx` (form de conexão).
5. `src/components/app/PipedriveSyncHistorySheet.tsx` (histórico opcional).
6. Edição cirúrgica em `src/routes/_app.dashboard.integrations.tsx` para tornar o card Pipedrive funcional (hoje só renderiza ícone).

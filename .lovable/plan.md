
# Master · Logs — implementação

Substituir o placeholder atual de `/master/logs` por uma página real, com 4 abas. Acesso restrito a master admin (já garantido pelo layout `_master`). Cada aba lista os **últimos 100 registros** com auto-refresh a cada 30s e botão "Atualizar agora".

## Estrutura da página

```text
/master/logs
├─ Tab: Emails        → tabela email_send_log
├─ Tab: Fluxos        → tabela flow_step_runs
├─ Tab: Webhooks      → tabela nova webhook_events
└─ Tab: Auditoria     → tabela audit_logs
```

Header com filtro de período (1h / 24h / 7d, default 24h) compartilhado pelas abas. Badge de contagem por aba (ex.: "Fluxos · 12 com erro nas últimas 24h").

## Aba 1 — Emails

Fonte: `email_send_log` (já existe, RLS já é master-only).

Colunas: hora, status (badge colorido), purpose, destinatário, assunto, erro (se houver), provider message id.

Filtros locais: status (queued/sent/failed/bounced/delivered) e purpose.

Já existe `listEmailSendLogs` em `src/lib/platform.functions.ts` — reaproveitar, só ajustar default de `page_size` para 100.

## Aba 2 — Fluxos (Builder)

Fonte: `flow_step_runs` (já existe). Join com `flow_steps` (tipo do nó) e `campaign_enrollments` → `leads` (nome do lead) e `campaigns` (nome da campanha) para contexto humano.

Colunas: hora, campanha, lead, tipo do step, status (pending/success/failed), branch tomada, duração (finished_at − started_at), erro (expandível para ver `output` em JSON).

Filtro local: status (todos / só falhas).

Novo server fn: `listFlowStepRuns` em `src/lib/master.functions.ts` (master-only), com paginação.

## Aba 3 — Webhooks

**Não existe tabela de log de webhooks hoje.** Precisa criar.

Nova tabela `webhook_events`:
- `id uuid pk`
- `received_at timestamptz default now()`
- `source text` — `'calcom'` | `'hook7'` | outros
- `event_type text` — ex.: `BOOKING_CREATED`, `Message`
- `organization_id uuid null` (quando der pra inferir)
- `instance_id uuid null` (Hook7) / `cal_booking_uid text null`
- `status text` — `received` | `processed` | `failed` | `ignored`
- `http_status int`
- `error text null`
- `payload jsonb` (corpo recebido, truncado a ~32KB)
- `headers jsonb` (subset seguro: signature, user-agent)

RLS: só master_admin (SELECT/ALL); INSERT permitido também para `service_role` (rotas públicas usam admin client). GRANT `SELECT/INSERT` para `authenticated` e `service_role` conforme padrão do projeto.

Instrumentar as 2 rotas existentes para gravar 1 linha cada chamada:
- `src/routes/api/public/hooks/calcom.ts`
- `supabase/functions/hook7-webhook/index.ts` (existente; gravar usando service role)

Colunas na UI: hora, source (badge), event_type, status, http_status, org (se houver), erro, botão "Ver payload" (dialog com JSON).

Filtros locais: source e status.

## Aba 4 — Auditoria

Fonte: `audit_logs` (já existe, hoje vazia).

Colunas: hora, ator (full_name do profile), ação, entity_type, entity_id, organização, IP. Expandir mostra diff `before`/`after`.

Como hoje quase nada escreve nessa tabela, a aba mostra os 100 últimos registros existentes + `EmptyState` quando vazia, com texto explicativo: *"A captura de eventos administrativos (login, criação de organização, mudanças de plano) ainda não está plugada nas ações — entra junto com a Fase 2."*

Sem instrumentação de novas ações neste passo (escopo fica só na UI de leitura). A instrumentação fica para uma task separada.

## Detalhes técnicos

**Server functions (master-only, em `src/lib/master.functions.ts`):**
- `listEmailLogsForMaster({ since, status?, purpose? })` — usa o `listEmailSendLogs` já existente como base
- `listFlowStepRunsForMaster({ since, onlyFailed? })`
- `listWebhookEventsForMaster({ since, source?, status? })`
- `listAuditLogsForMaster({ since })`

Cada uma protegida por `requireSupabaseAuth` + verificação `has_role(master_admin)` (padrão já usado em `platform.functions.ts`). Retornam no máximo 100 linhas ordenadas por timestamp desc.

**Rota:** atualizar `src/routes/_master.master.logs.tsx` para renderizar `<Tabs>` (shadcn) com 4 `TabsContent`. Cada aba é um componente próprio em `src/components/master/logs/*` para manter o arquivo de rota enxuto.

**Migration única:**
1. `CREATE TABLE public.webhook_events (...)` + GRANTs + RLS + policies (master-only SELECT/ALL, service_role INSERT).
2. Index em `(received_at DESC)` e `(source, received_at DESC)`.

**Instrumentação dos webhooks:** edits surgicais em `src/routes/api/public/hooks/calcom.ts` e em `supabase/functions/hook7-webhook/index.ts` para inserir 1 linha por chamada via `supabaseAdmin` / service role, encapsulada em try/catch para nunca derrubar a rota se o insert falhar.

## Fora do escopo

- Stream em tempo real (Realtime channel) — auto-refresh de 30s basta nesta fase
- Export CSV — fica para depois se você pedir
- Instrumentação ativa do `audit_logs` (login, mudanças de org/plano)
- Retenção / TTL automático — pode rodar como cron job num momento futuro


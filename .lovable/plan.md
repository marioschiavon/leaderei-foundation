# Integração Apollo.io — Plano

Apollo é a "farinha de trigo" da prospecção (escopo §5.3). Hoje é CSV-only. Vamos elevar para **API direta** com 3 capacidades-núcleo: busca de leads, enriquecimento de leads existentes e cache de queries.

Tudo segue o padrão já validado com Pipedrive (`integration_credentials` criptografada + serverFn + dialog em `/dashboard/integrations`).

---

## 1. Escopo desta entrega

### Dentro
1. **Conectar** Apollo via API key (por organização), com validação contra `GET /v1/auth/health`
2. **Status** da conta (créditos restantes, plano, e-mail do dono) via `/v1/users/me`
3. **Busca de pessoas** (`POST /v1/mixed_people/search`) com filtros: cargo, senioridade, indústria, país, tamanho de empresa, palavras-chave
4. **Importar selecionados** da busca → cria/atualiza `leads` (dedup por email + linkedin_url)
5. **Enriquecer lead existente** (`POST /v1/people/match`) — botão no detalhe do lead, atualiza campos vazios e grava em `lead_enrichment`
6. **Telemetria de consumo**: cada chamada gera linha em nova tabela `apollo_api_calls` (endpoint, créditos consumidos, latência, status)
7. **Card "Apollo"** em `/dashboard/integrations` (hoje placeholder) com: status, créditos, botão conectar/desconectar/testar, link para a nova tela de busca
8. **Rota nova `/dashboard/leads/apollo`** com formulário de busca + grid de resultados + ações em massa (importar selecionados)

### Fora (próximas fases)
- Busca de empresas (organizations search) — Fase 3
- Sequência automática "Buscar → Enriquecer → Inscrever em campanha" — depende do executor de fluxos
- Webhooks Apollo (eles não oferecem webhooks padrão de qualquer forma)
- Enriquecimento em lote (batch) — primeiro validar uso 1-a-1

---

## 2. Decisões importantes (assumidas — confirma se algo muda)

| # | Decisão | Padrão assumido | Alternativa |
|---|---|---|---|
| 1 | Chave Apollo por **organização** ou **plataforma** (compartilhada) | **Por org** (cada cliente paga seu Apollo) | Master-key da S7 com cobrança embutida (modelo Neros) — fica para depois |
| 2 | Onde armazenar a chave | `integration_credentials` criptografada (mesmo padrão Pipedrive) | `platform_settings` por org |
| 3 | Limite de resultados por busca | 100 por página, máximo 5 páginas (500 leads) por sessão de busca | Maior = mais risco de queimar créditos sem querer |
| 4 | Dedup ao importar | Email **OU** linkedin_url (qualquer match = update, sem duplicar) | Só email |
| 5 | Enriquecimento sobrescreve campos preenchidos? | **Não** — só preenche o que está vazio. Dados crus completos sempre em `lead_enrichment.payload` | Sim, com confirmação |
| 6 | Rate limit local | 30 req/min por org (Apollo Basic é ~50/min) | Sem limite local (deixa Apollo bloquear) |

---

## 3. Modelo de dados

Tudo novo abaixo segue RLS por org + grant para `authenticated` e `service_role`, igual aos demais.

```sql
-- Histórico de chamadas à API (custo, debug, auditoria)
CREATE TABLE public.apollo_api_calls (
  id uuid PK,
  organization_id uuid FK NOT NULL,
  endpoint text NOT NULL,           -- 'people/search' | 'people/match' | 'auth/health' | 'users/me'
  status_code int,
  credits_consumed int,             -- lido de response headers/body
  latency_ms int,
  request_summary jsonb,            -- filtros usados (NÃO o body inteiro)
  error text,
  triggered_by uuid,                -- auth.uid()
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Cache de buscas (evita refazer mesma query e queimar créditos)
CREATE TABLE public.apollo_search_cache (
  id uuid PK,
  organization_id uuid FK NOT NULL,
  query_hash text NOT NULL,         -- sha256(JSON.stringify(filtros normalizados))
  filters jsonb NOT NULL,
  results jsonb NOT NULL,           -- payload da Apollo (lista de pessoas)
  total_entries int,
  page int NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL,  -- now() + 24h
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, query_hash, page)
);

-- leads ganha rastreio de origem Apollo (campo simples, sem nova tabela)
ALTER TABLE public.leads ADD COLUMN apollo_person_id text;
CREATE UNIQUE INDEX idx_leads_apollo_person
  ON public.leads (organization_id, apollo_person_id)
  WHERE apollo_person_id IS NOT NULL;
```

Reusamos:
- `integration_credentials` (chave API, encrypted)
- `lead_enrichment` (payload completo do match, por enriquecimento)
- `integration_providers` (adicionar/atualizar row "apollo")

---

## 4. Arquitetura de código

```text
src/lib/
├── apollo.functions.ts      # serverFns expostos ao front
├── apollo.server.ts         # cliente HTTP, mapeamento Apollo→lead, dedup, cache
└── apollo.types.ts          # tipos compartilhados (filtros, person, org)

src/components/app/
├── ApolloConnectDialog.tsx  # conectar/desconectar/testar (gêmeo do Pipedrive)
└── ApolloSearchForm.tsx     # form de busca reutilizável

src/routes/
├── _app.dashboard.leads.apollo.tsx   # NOVA rota: busca + resultados + import
└── _app.dashboard.integrations.tsx   # ativar card Apollo (hoje placeholder)
```

### Server functions (todas com `requireSupabaseAuth`)

| Fn | Quem chama | O que faz |
|---|---|---|
| `connectApollo({ apiKey })` | dialog | valida em `/v1/auth/health`, criptografa, salva em `integration_credentials`, marca `organization_integrations.status='connected'` |
| `disconnectApollo()` | dialog | remove credencial, status=`disconnected` |
| `getApolloStatus()` | card integrações | retorna `{ connected, credits_remaining, plan, owner_email, last_check_at }` |
| `searchApolloPeople({ filters, page })` | tela de busca | checa cache 24h → se hit retorna; se miss chama Apollo, grava cache, registra `apollo_api_calls` |
| `importApolloLeads({ apolloPersonIds[] })` | tela de busca | busca dos resultados em cache, mapeia para schema `leads`, dedup por email/linkedin/apollo_person_id, insert/update em lote |
| `enrichLead({ leadId })` | botão no lead | `/v1/people/match`, atualiza campos vazios + grava `lead_enrichment.payload` |

Tudo passa por um helper único `callApollo(endpoint, body, { orgId, userId })` em `apollo.server.ts` que: lê a key, aplica rate-limit local (counter em `apollo_api_calls`), faz fetch, captura headers de crédito (`x-credits-remaining`), registra a chamada, normaliza erros.

---

## 5. UX

### Card em `/dashboard/integrations`
Estados: Não conectado · Conectado (verde, créditos, botão "Abrir busca") · Erro (vermelho, motivo).

### `/dashboard/leads/apollo` — busca
- Topo: form de filtros (cargo, senioridade — multi-select, indústria, país, tamanho empresa, keywords). Botão "Buscar".
- Meio: tabela com checkbox + nome, cargo, empresa, cidade, LinkedIn, email (mascarado se ainda não revelado), badge "Já existe na sua base" quando dedup detecta.
- Rodapé: paginação + "Importar X selecionados" + contador de créditos restantes.
- Toast de aviso antes de cada importação grande: "Isso vai consumir ~N créditos".

### Detalhe do lead (existente, leads page)
Novo botão "Enriquecer com Apollo" → confirma → mostra antes/depois.

---

## 6. Segurança

- **Chave nunca volta pro client** — `integration_credentials.value_encrypted`, decrypt só em `apollo.server.ts`.
- **RLS** em `apollo_api_calls`, `apollo_search_cache`: `is_org_member` para SELECT; INSERT só via service role (serverFn usa `supabaseAdmin`).
- **Rate limit local** evita banimento da chave do cliente.
- **Telemetria** dá ao master_admin visibilidade de uso (matar dívida #6 parcialmente).

---

## 7. Marcos de entrega

```text
M1  Migration (tabelas + ALTER leads + grants + RLS + provider 'apollo')
M2  apollo.server.ts (HTTP client + cache + telemetria + rate-limit)
M3  apollo.functions.ts (6 serverFns) + ApolloConnectDialog
M4  Card Apollo em /dashboard/integrations conectando/testando
M5  Rota /dashboard/leads/apollo (busca + resultados + import)
M6  Botão "Enriquecer com Apollo" no detalhe do lead
M7  Atualizar escopo-leaderei.md §5.3 + §4.8 (Apollo deixa de ser placeholder)
```

Cada marco roda independente e é testável. Posso entregar M1+M2+M3 em uma rodada e o resto em outra, ou tudo de uma vez — sua escolha.

---

## 8. O que NÃO faz parte (para evitar escopo creep)

- OpenAI / módulo de IA (próximo passo após este)
- Templates de mensagem usando dados do Apollo (depende do módulo de IA)
- Enriquecimento automático em background (depende do executor de fluxos)
- Sync bidirecional ou listas salvas no Apollo (raro, fora do MVP)

---

## 9. Pré-requisito do usuário

Você precisa ter uma **conta Apollo paga** (plano Basic já dá acesso à API). A chave fica em **Settings → API Keys** no painel do Apollo. **Não me envie a chave no chat** — quando começarmos a build, vou usar o fluxo seguro do `add_secret`/dialog para você colar.

---

Confirma se as decisões da seção 2 batem com o que tem em mente. Se sim, eu sigo para build.

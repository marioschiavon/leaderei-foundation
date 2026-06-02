
# Plano: Executor de Fluxos (Scheduler/Worker)

## Diagnóstico

O banco já tem **metade da infra** pronta — mas em dois esquemas paralelos que nunca se conversaram:

- **Builder (UI)** escreve em `builder_documents` → `flow_steps` / `flow_transitions`. Tem 5 docs e 19 steps salvos.
- **Runtime (vazio)** tem `flow_definitions` / `flow_nodes` / `flow_edges` + `campaign_enrollments` (com `next_run_at`, `current_node_id`, `context jsonb`) + `scheduled_jobs` (fila genérica com `run_at`, `status`, `attempts`, `locked_at`). Zero linhas nas três.

Ou seja: a fila existe, o estado por lead existe, mas **(a)** o executor referencia tabelas que o Builder não popula, e **(b)** não há worker que drene a fila. É isso que precisa ser construído.

## Decisão de arquitetura

1. **Unificar no schema do Builder** (`flow_steps` / `flow_transitions`). É o que tem dados reais e o que a UI já edita. Apontar `campaign_enrollments` para `builder_documents` (via `campaigns.builder_document_id` que já existe implicitamente pelo `getBuilderDocumentByCampaign`) — depreciar `flow_definitions`/`flow_nodes`/`flow_edges`.
2. **Fila = `scheduled_jobs`** (já existe). O worker = TanStack server route em `/api/public/hooks/run-flow-tick`, disparado por `pg_cron` a cada minuto.
3. **Lock pessimista** via `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED LIMIT N)` para permitir múltiplos ticks concorrentes sem dupla execução.

## Passos

### 1. Migration de reconciliação de schema
- Adicionar `campaign_enrollments.document_id uuid REFERENCES builder_documents(id)` e `current_step_id uuid REFERENCES flow_steps(id)`.
- Marcar `flow_definition_id` / `current_node_id` como deprecated (manter por ora, ninguém usa).
- Adicionar `scheduled_jobs.enrollment_id uuid` + índice parcial em jobs do tipo `flow_step`.
- Criar tabela `flow_step_runs` (id, enrollment_id, step_id, status enum: `pending|running|done|failed|skipped`, output jsonb, error text, started_at, finished_at) — log de auditoria por execução de step. RLS + GRANTs.

### 2. Enrollment: enfileirar leads na campanha
- Server fn `enrollLeadInCampaign({ campaign_id, lead_id })`:
  - Resolve `builder_documents` da campanha (status = published).
  - Cria `campaign_enrollments` com `status=active`, `current_step_id = step is_entry`, `next_run_at = now()`.
  - Insere `scheduled_jobs(kind='flow_step', payload={enrollment_id}, run_at=now())`.
- Gatilho automático: ao mudar `campaigns.status` de `draft` → `active`, enrolla todos os leads do segmento (server fn `activateCampaign`).
- Botão "Adicionar à campanha" na UI de Leads (já existe a tela) chama `enrollLeadInCampaign`.

### 3. Worker: tick endpoint + cron
- `src/routes/api/public/hooks/run-flow-tick.ts` (POST, sem body):
  - `SELECT FOR UPDATE SKIP LOCKED LIMIT 25` em `scheduled_jobs` com `status='pending' AND run_at <= now() AND kind='flow_step'`.
  - Marca `status=running`, `locked_at=now()`, `attempts+=1`.
  - Para cada job, carrega enrollment + step atual + transitions, executa via dispatcher (passo 4), avança `current_step_id`, calcula `next_run_at` do próximo step e re-enfileira.
  - Em erro: se `attempts < max_attempts` → reagenda com backoff exponencial (1m, 5m, 30m, 2h, 12h). Senão: `status=failed`, enrollment `status='failed'`, `last_error`.
  - Sempre retorna 200 com `{processed, failed, skipped}`.
- `pg_cron`: `*/1 * * * *` chamando o endpoint com `apikey` header. Usar URL estável `project--ab6c70f9-…lovable.app`.

### 4. Dispatcher por tipo de step
Função `executeStep(enrollment, step, supabaseAdmin)` retornando `{next_step_id, delay_until, side_effect_log}`:

| Step type | Ação |
|---|---|
| `message_email` | Renderiza template com `lead.*` vars, chama `sendEmail` (já existe), grava `lead_activities`, transição `next` imediato. |
| `message_whatsapp` | Chama `sendWhatsAppMessage` (já existe em hook7.functions), idem. |
| `message_linkedin` | Por ora: marca `skipped` com motivo "não implementado", transição `next`. |
| `wait` | Calcula `delay_until = now() + config.duration`, transição `next` agendada. |
| `condition_replied` | Consulta `lead_activities` (channel + window). Se respondeu → branch `yes`. Se não → agenda re-avaliação até `timeout`; ao estourar → branch `no`. |
| `action` | Aplica `set_status` / `set_temperature` / `add_tag` / `remove_tag` / `move_pipeline` direto no `leads`, transição `next`. |

Sem próximo step (fim do grafo) → `enrollment.status='completed'`, `completed_at=now()`. Grava cada execução em `flow_step_runs`.

### 5. UI mínima de observabilidade
- Aba **"Execuções"** dentro da página da Campanha: lista `campaign_enrollments` com lead, current_step, status, next_run_at, last_error. Filtros por status.
- Botões: **Pausar** (status=paused, remove jobs), **Retomar** (status=active, reenfileira), **Forçar tick agora** (admin only, chama o endpoint).
- Badge no sidebar quando `enrollments.status='failed' > 0`.

## Detalhes técnicos

- **Idempotência**: cada job tem `id`; o lock via `SKIP LOCKED` garante 1 worker por vez. `flow_step_runs` tem unique parcial `(enrollment_id, step_id, started_at)` para detectar dupla execução.
- **Timezone**: tudo em `timestamptz`. `wait` de "business_days" usa função SQL `add_business_days(ts, n)` (criar).
- **Throughput**: 25 jobs/tick × 60 ticks/h = 1.500 steps/h por organização. Suficiente para MVP.
- **Sem Inngest/queue externa**: `pg_cron` + `scheduled_jobs` é o suficiente até ~10k leads ativos/dia. Migrar para Inngest depois é uma troca do worker, não do schema.
- **Segurança**: o endpoint `/api/public/hooks/run-flow-tick` valida o header `apikey` (anon key do Supabase) — padrão da knowledge `schedule-jobs-options`. Usa `supabaseAdmin` para bypass de RLS.

## Fora do escopo desta rodada

- Editor visual de gatilhos de entrada (vai vir junto da UI de Campanha).
- A/B testing, throttling por canal, quiet hours — anotar como follow-up.
- Métricas agregadas (taxa de abertura, resposta) — usar `lead_activities` já existente como base depois.

## Critério de pronto

1. Publico um fluxo `Email → Wait 5min → Email → Wait 5min → Condition replied (24h) → tag "hot"/"cold"`.
2. Enrollo 3 leads.
3. Em 15 min vejo 2 emails enviados por lead, em 24h vejo a tag aplicada de acordo com resposta real, e `flow_step_runs` tem 1 linha por step×lead com status correto.


## Diagnóstico atual (relevante)

- `listCampaigns` (`src/lib/tenant.functions.ts:227`) **não filtra `status='archived'`** — arquivadas aparecem misturadas com ativas.
- Existe `archiveCampaign` (soft, marca `status='archived'`), mas **não há exclusão definitiva** nem rota para listar/restaurar arquivadas.
- Após ativada, **não há tela para adicionar/remover leads** — o `ActivateCampaignDialog` só funciona na ativação inicial. Daí "só o mesmo lead aparece".
- No card de campanha (`CampaignCard` em `_app.dashboard.campaigns.tsx`) mostra-se status/canal/totais, mas **não o nó atual de execução**, mesmo já existindo `current_step` no payload de `listCampaignEnrollments`.

---

## Plano

### 1. Toggle "Ativas | Arquivadas" na faixa de busca

**UI (`src/routes/_app.dashboard.campaigns.tsx`)** — ao lado do campo de busca, segmented control de 2 estados:
- **Ativas** (default) — mostra tudo exceto `archived`.
- **Arquivadas** — mostra apenas `archived`, com contador no botão.

Trocar o scope reseta a query (`queryKey` inclui o scope).

**Backend (`tenant.functions.ts` → `listCampaigns`)** — aceitar `inputValidator` com `{ scope: "active" | "archived" }` (default `"active"`). Filtrar `status != 'archived'` ou `status = 'archived'`. Retornar também `archived_count` para o badge.

### 2. Exclusão definitiva e restauração de arquivadas

**Backend** — em `tenant.functions.ts`:
- `deleteCampaign({ campaign_id })`: exige `status='archived'` (guard). Em transação lógica:
  1. Cancela `scheduled_jobs` pendentes (`status='cancelled'` onde `enrollment_id` pertence à campanha).
  2. Apaga `flow_step_runs` dos enrollments.
  3. Apaga `campaign_enrollments`.
  4. Arquiva `builder_documents` ligados (`archived_at = now()`) — não apaga, preserva auditoria do fluxo.
  5. `DELETE FROM campaigns WHERE id = ...`.
  6. Insere `audit_logs` (`action='campaign.deleted'`).
- `restoreCampaign({ campaign_id })`: `status='archived' → 'draft'`, limpa `started_at/completed_at`.

**UI** — no card quando scope = Arquivadas:
- Botão "Restaurar" (volta para Ativas como `draft`).
- Botão "Excluir definitivamente" → `AlertDialog` com confirmação por digitação do nome da campanha (proteção contra clique acidental).

### 3. Gestão de leads em campanhas ativas

Novo botão "Leads" no `CampaignCard` (ao lado de "Execuções") abre `ManageLeadsDialog` com Tabs:

- **Inscritos**: lista `campaign_enrollments` (reusa `listCampaignEnrollments`) com nome, status, nó atual, próximo `run_at`. Cada linha tem botão **Remover** → chama nova função `cancelEnrollment({ enrollment_id })` que:
  - Seta `status='cancelled'`, `next_run_at=null`.
  - Cancela `scheduled_jobs` pendentes do enrollment.
- **Adicionar leads**: reusa `listEligibleLeadsForCampaign`, filtra excluindo `active_lead_ids` (já retornado pela função), mostra apenas leads ainda não inscritos. Seleção múltipla → `activateCampaign({ campaign_id, lead_ids })` (já idempotente via upsert).

Isso resolve o "só o mesmo lead aparece" — agora você vê todos inscritos e adiciona novos a qualquer momento.

### 4. Mostrar o "Nó atual" no card da campanha

Hoje `listCampaigns` retorna só metadados. Para o card mostrar o nó atual, vamos agregar dados de execução:

**Backend (`tenant.functions.ts` → `listCampaigns`)** — após buscar campanhas, para as que estão `running` ou `paused`:
1. Buscar `campaign_enrollments` ativos agrupados por `current_step_id` (limit razoável, ex: 500 por campanha).
2. Resolver `flow_steps` desses IDs (id, type, config) — para extrair label legível (mesma lógica que o `ExecutionsDialog` usa para gerar `STEP_LABEL`).
3. Retornar em cada campanha um array `current_nodes: [{ step_id, type, label, count }]` ordenado por `count` desc.

**UI (`CampaignCard`)** — abaixo da linha de status/canal, nova seção compacta "Nó atual" só quando a campanha está em execução:
- Se 1 nó: badge único `▶ Aguardando 24h · 12 leads`.
- Se N nós: até 3 chips `Enviar email · 8`, `Aguardando · 4`, `Decisão · 2`, e overflow `+N`.
- Se nenhum enrollment ativo (mas status running): chip cinza `Sem leads em execução`.

A formatação do label do nó (`Enviar email`, `Aguardando 24h`, `Webhook`, `Fim`, etc.) reusa o helper que já existe no `ExecutionsDialog` — vamos extraí-lo para `src/lib/flow-step-label.ts` para reuso.

### Detalhes técnicos resumidos

**Sem migration** — todas as mudanças usam colunas/estruturas existentes (`status='archived'`, `current_step_id`, etc.).

**Server functions a adicionar/alterar** (`tenant.functions.ts` + `campaigns.functions.ts`):
- `listCampaigns` — aceita `scope`, retorna `archived_count` e `current_nodes[]` por campanha.
- `deleteCampaign` — hard delete com guard.
- `restoreCampaign` — archived → draft.
- `cancelEnrollment` — remove lead de campanha ativa.

**Componentes novos / alterados** em `src/routes/_app.dashboard.campaigns.tsx`:
- `ScopeToggle` na faixa de busca.
- `CurrentNodesStrip` dentro de `CampaignCard`.
- `DeleteCampaignDialog` com confirmação textual.
- `ManageLeadsDialog` (Tabs: Inscritos / Adicionar).

**Refator** — extrair `getStepLabel(step)` para `src/lib/flow-step-label.ts`, usado pelo card, pelo `ExecutionsDialog` e pelo novo `ManageLeadsDialog`.

Posso seguir com a implementação?

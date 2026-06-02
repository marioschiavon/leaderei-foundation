## Objetivo

Mostrar, por lead enrolado, em que nó do fluxo ele está, quando o próximo passo vai rodar e por que está parado — direto no diálogo **Execuções** da campanha.

## O que muda na UI (ExecutionsDialog)

Cada linha de lead passa a exibir:

1. **Nó atual** — tipo do passo (`message_whatsapp`, `wait`, `branch`, etc.) + label/preview da config (ex.: "Wait 1 dia", "WhatsApp: Olá, {{nome}}…").
2. **Próximo nó programado** — calculado a partir das `flow_transitions` do passo atual (mostra "→ Wait 3 dias" por exemplo).
3. **next_run_at** — já existe, mas vai ficar visível para **todos** os status (não só `active`), com:
   - "agora" se vencido e ainda `active` (= cron não pegou ainda).
   - "em X min/h/dias" se futuro.
   - "—" se `null`.
4. **Motivo de pausa/impedimento** — badge colorida:
   - `paused` → "Pausado manualmente".
   - `failed` → `last_error` completo (já existe, vai ganhar destaque).
   - `active` + `next_run_at` vencido há > 2 min → badge âmbar "Aguardando worker" (sinal de que o cron não rodou).
   - `active` sem `current_step_id` → "Sem passo atual" (fluxo travou).
   - `completed` → data de conclusão.
5. **Expandir linha** (botão chevron) → abre timeline inline com os `flow_step_runs` do enrollment (passos já executados, branch tomado, erros), usando o `getEnrollmentRuns` que já existe.

## O que muda no backend

`listCampaignEnrollments` (`src/lib/campaigns.functions.ts`) passa a retornar, em cada linha:
- `current_step`: `{ id, type, config, label }` (join em `flow_steps` pelo `current_step_id`).
- `next_step_preview`: `{ id, type, config, label, branch }` — busca a `flow_transitions` com `from_step_id = current_step_id` (pega a transição `next` por padrão; se for `branch`, lista as opções).
- `is_overdue`: boolean (`next_run_at < now() - interval '2 min'` AND `status = 'active'`).

Sem mudar schema, sem nova migration — só consulta adicional. RLS já permite porque `flow_steps` é acessível via `is_org_member` no `builder_documents`.

## Fora de escopo

- Não mexer no executor, scheduler, cron, ou regra de wait/branch.
- Não criar tabela nova nem alterar `campaign_enrollments`.
- Não mudar o fluxo de ativação ou enrollment.

## Detalhes técnicos

**Arquivos a editar:**
- `src/lib/campaigns.functions.ts` — enriquecer `listCampaignEnrollments` com `current_step` + `next_step_preview` + `is_overdue`.
- `src/routes/_app.dashboard.campaigns.tsx` — `ExecutionsDialog`: adicionar coluna "Nó atual → próximo", badge de impedimento, expand com timeline (`getEnrollmentRuns`).

**Helper de label do nó (frontend):**
- `message_whatsapp` → "WhatsApp: <primeiros 40 chars do body>"
- `wait` → "Espera <duration> <unit>" (lê `config.duration` + `config.unit`)
- `branch` / `condition` → "Condição"
- demais tipos → `type`

**Timeline expand:** usa `useQuery` lazy (só dispara quando expand abre), key `["enrollment-runs", enrollment_id]`.

## Pronto quando

- Para o enrollment travado, a linha mostra: "Nó atual: WhatsApp: Olá este é um teste o inicio · Próximo: Wait 1 min · next_run_at: vencido há Xh · badge âmbar 'Aguardando worker'".
- Ao expandir, vejo o `flow_step_runs` com a 1ª mensagem como `completed` e nada depois — confirmando que o wait expirou e o cron não avançou.
- Lead com `failed` mostra `last_error` em destaque.
- Lead `paused` mostra "Pausado manualmente".

## Problema

Hoje o fluxo "termina" implicitamente quando um passo não tem transição de saída — o `campaign_enrollments` fica com `status = active` e `next_run_at = null`, sem indicar visualmente que acabou. Além disso, não há como o usuário reiniciar a jornada de um lead que já passou pelo fluxo (ex.: depois de ajustar mensagens).

## Solução

Introduzir um nó **Fim** no builder e ações de **reiniciar** no diálogo de execuções.

### 1. Novo tipo de passo: `end`

**Backend (`src/lib/builder.functions.ts`):**
- Adicionar `"end"` em `STEP_TYPES`.
- `EndConfig`: `{ reason?: string }` (label opcional tipo "Convertido", "Sem resposta", "Desistiu").
- Validação:
  - Nó `end` **não pode ter saídas** (zero transitions com `from_step_id = end.id`).
  - Fluxo publicado em modo strict precisa de ao menos 1 nó `end` alcançável.
  - Qualquer "folha" (nó linear sem saída que não seja `end`) gera warning de validação: "Passo sem próximo nó. Adicione um nó Fim para encerrar o fluxo."

**Executor (`src/lib/flow-executor.server.ts`):**
- Ao processar passo `end`: marca `campaign_enrollments.status = 'completed'`, `completed_at = now()`, `current_step_id = end.id`, `next_run_at = null`. Grava `flow_step_runs` com `status = completed` e `output.reason = config.reason`.
- Quando um passo linear não tem transição **e não é `end`**: marcar enrollment como `completed` também, mas com `last_error = 'Fluxo sem nó Fim — encerrado automaticamente'` para sinalizar no UI (badge âmbar "Encerrado sem nó Fim").

**Builder UI (`src/components/builder/FlowEditor.tsx`):**
- Adicionar card "Fim" na paleta de nós (ícone `Flag` / `Square`).
- Estilo distinto: fundo neutro, badge "Encerra o fluxo", sem handle de saída.
- Validação visual em tempo real: nós-folha não-`end` ganham aviso amarelo "Sem nó Fim".

### 2. Reiniciar enrollment

**Backend (`src/lib/campaigns.functions.ts`):**
- `resetEnrollment({ enrollment_id })`: permitido para `status ∈ {completed, failed, paused}`. Reseta para o nó de entrada (`is_entry = true` do documento publicado da campanha), `status = active`, `next_run_at = now()`, limpa `last_error`. Não apaga `flow_step_runs` antigos (mantém histórico).
- `resetEnrollmentsBulk({ campaign_id, scope: 'completed' | 'failed' | 'all_finished' })`: mesma lógica em lote.

**UI (`src/routes/_app.dashboard.campaigns.tsx`):**
- No `ExecutionsDialog`, por linha com status `completed`/`failed`/`paused`: botão "Reiniciar" (ícone `RotateCcw`) com `AlertDialog` de confirmação.
- Header do diálogo: botão "Reiniciar todos concluídos" quando houver enrollments completos.
- Timeline expandida mostra um separador "— Reiniciado em DD/MM HH:mm —" entre execuções.

### 3. Indicadores na linha do lead

- Status `completed` mostra:
  - Verde "Concluído" + razão (`output.reason` do último run) se chegou em nó `end`.
  - Âmbar "Encerrado sem Fim" se terminou por falta de transição.
- Botão "Reiniciar" inline.

## Fora de escopo

- Não muda cron, scheduler, nem regras de wait/branch.
- Não muda enrollment inicial (ativação da campanha).
- Sem migration: `end` é só um valor novo em `flow_steps.type` (coluna é `text`, sem CHECK).

## Arquivos

- `src/lib/builder.functions.ts` — tipo `end` + validação.
- `src/components/builder/FlowEditor.tsx` — paleta + render do nó Fim + aviso de folha sem Fim.
- `src/lib/flow-executor.server.ts` — tratar `end` e folha-implícita como `completed`.
- `src/lib/campaigns.functions.ts` — `resetEnrollment` + `resetEnrollmentsBulk`; enriquecer `listCampaignEnrollments` com `end_reason`.
- `src/routes/_app.dashboard.campaigns.tsx` — botões de reiniciar, badges de término.

## Pronto quando

- No builder consigo arrastar um nó **Fim**, conectar ao último passo, publicar.
- Lead que chega no nó Fim aparece como "Concluído · {reason}" no diálogo Execuções.
- Lead que terminou sem nó Fim aparece como "Encerrado sem Fim" (âmbar).
- Posso clicar **Reiniciar** num lead concluído e ele volta para o 1º passo com `next_run_at = agora`, sendo pego pelo próximo tick do cron.
- Histórico antigo (`flow_step_runs`) permanece visível na timeline, separado da nova execução.

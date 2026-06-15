## Causa raiz

O código fonte **já tem** o `case "ai_generate_text"` no executor (`src/lib/flow-executor.server.ts`, linha 732) e está correto. Mas os erros continuam aparecendo a cada minuto no banco (último: 15:13:02) porque o cron `pg_cron` chama duas URLs:

- `https://project--ab6c70f9-…lovable.app/api/public/hooks/run-flow-tick`
- `https://leaderei.lovable.app/api/public/hooks/run-flow-tick`

Ambas servem o **deployment publicado**, não o sandbox de dev nem o build de preview mais recente. Como o `case "ai_generate_text"` foi adicionado depois do último publish, o Worker em produção ainda cai no `default` e grava `tipo de passo desconhecido: ai_generate_text` em `flow_step_runs`.

Nenhuma alteração de código resolve isso — é uma questão de **republicar** o app para o novo executor entrar no ar.

## Plano

1. **Republicar o app** (botão Publish). Isso reconstrói o Worker e o cron passa a executar o `case "ai_generate_text"` na próxima execução (até 60s depois).

2. **Verificar** após o publish: rodar `select status, error, created_at from flow_step_runs where step_id = '8d21af0a-9f81-4571-b900-b12dfa3d2dc7' order by created_at desc limit 3;` — o próximo run deve sair como `succeeded` (e nos logs do servidor deve aparecer `[executor] processando ai_generate_text`).

3. **Opcional — limpar enrollments travados** que já falharam várias vezes nesse step. Se o `runFlowTick` desabilita enrollments após N falhas (precisa confirmar olhando `flow-executor.server.ts`), reativá-los manualmente com `update campaign_enrollments set status='active', next_run_at=now() where id in (...)`.

## Detalhe técnico

- O `case` está bem formado, retorna `advance`, e o switch não tem fall-through.
- Não há cache adicional do Worker além do próprio deployment publicado.
- O sandbox de dev (Vite) já tem o código novo, mas o cron **não** o atinge — ele só fala com as URLs `*.lovable.app`.

## Próximo passo

Clicar em **Publish** abaixo e aguardar ~1 minuto. Se após o publish o erro persistir, aí sim investigamos mais (provavelmente seria uma chave de IA ausente ou validação interna do `ai_generate_text`, não mais "tipo desconhecido").

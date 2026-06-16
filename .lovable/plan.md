## Diagnóstico

Enrollment `9abbdb4f...` da campanha Teste 03 está preso no passo de entrada `ai_generate_text` (label "abertura"). O fluxo atual é só: **AI → WhatsApp → End** (sem Resend).

Linha do tempo:
- 16/jun 22:14 — job falhou em **permanente** com a mensagem antiga "Resend não conectou". Veio de uma versão anterior do fluxo (você removeu o passo de e-mail depois). Esse erro ficou gravado mas não é o problema atual.
- 16/jun 22:19 — você retomou; novo job criado.
- 16/jun 22:20:02 — worker pegou o job, abriu `flow_step_runs` com `status='running'`, travou (`locked_at` setado) e **nunca finalizou**. Já passaram >5 min.

Resultado: `scheduled_jobs.status='running'`, `locked_at` antigo, `flow_step_runs.status='running'`, `finished_at` null. Como o executor não tem watchdog para locks vencidos, ninguém vai pegar de novo — fica preso para sempre.

A causa raiz do hang no passo AI (timeout silencioso da chamada, worker reciclado no meio, etc.) é uma segunda investigação. O imediato é destravar e impedir reincidência.

## O que vou fazer

### 1. Destravar a Teste 03 (dados, sem código)
- `flow_step_runs` `d4b6ae4b...` → `status='failed'`, `finished_at=now()`, `error='lock expirado — reagendado'`.
- `scheduled_jobs` `80bb43d7...` → `status='pending'`, `locked_at=null`, `locked_by=null`, `run_at=now()`, `last_error='lock expirado'`. Assim o próximo tick reprocessa o passo AI.

### 2. Watchdog em `src/lib/flow-executor.server.ts`
No início de cada tick (antes de selecionar jobs pendentes), liberar jobs órfãos:

- Buscar `scheduled_jobs` com `status='running'` E `locked_at < now() - interval '3 minutes'`.
- Para cada um: setar `status='pending'`, `locked_at=null`, `locked_by=null`, `run_at=now()`, incrementar `attempts` e gravar `last_error='lock expirado após 3min, reagendado'`. Se já passou de `max_attempts`, marcar `failed` em vez de `pending`.
- Também fechar o `flow_step_runs` correspondente (mais recente, `status='running'`) com `status='failed'`, `finished_at=now()`, mesma mensagem.

Limite: até 50 jobs por tick para não estourar a janela.

### 3. Não mexer
- Lógica do `executeStep`, dos handlers de cada tipo de passo (ai_generate_text, whatsapp, email, condition, cal.com).
- Número de tentativas (5).
- Lógica de `permanent_fail` (continua imediata, sem retry).
- Nada de UI.

## Como verificar depois
1. Confirmar via SQL que o enrollment voltou a `next_run_at` próximo de agora e job `pending`.
2. Aguardar o próximo tick (`/api/public/hooks/run-flow-tick`) e checar `flow_step_runs` — deve aparecer novo run com status `done` ou erro real (não "running" eterno).
3. Se a chamada AI travar de novo, o watchdog libera em 3min e o retry de 5 tentativas eventualmente marca falha real com mensagem útil.

## Escopo
- Edição apenas em `src/lib/flow-executor.server.ts`.
- Uma operação manual no banco para destravar a Teste 03 (via insert tool).

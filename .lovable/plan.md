# Diagnóstico

Levantei o estado real no banco. Resultados (últimos 7 dias):

| O que deveria existir | O que existe |
|---|---|
| `scheduled_jobs` kind=`agent_respond` | **0 linhas (nunca)** |
| `lead_memory_items` | **0 linhas (nunca)** |
| `lead_website_cache` | **0 linhas (nunca)** |
| `ai_actions` kind=`auto_reply` | **0** (só `reply_draft` antigos) |
| `messages` inbound | 26 (chegando normal) |
| `webhook_events` hook7 Message inbound | OK, todos `processed`/200 |

**Tudo a IA faz hoje (auto-reply, extração de memória, scrape do site) acontece dentro de `processAgentJob` (e `flow-executor` no caso de campanhas).** Como `processAgentJob` nunca rodou para nenhum lead inbound, nenhuma das três coisas aconteceu.

## Causa raiz

O fluxo correto é:
```
inbound WhatsApp → hook7-webhook → insere messages → chama RPC schedule_agent_response
  → cria scheduled_jobs(kind='agent_respond', run_at=+25s)
→ pg_cron chama /api/public/hooks/agent-tick a cada minuto
→ runAgentTick() pega o job → processAgentJob()
   ├─ fetchWebsiteContent(lead.website_url)   ← scrape
   ├─ decideAction() via OpenAI tool calling   ← responder
   └─ extractAndSaveMemory()                   ← memória
```

O código-fonte em `supabase/functions/hook7-webhook/index.ts` (linhas 265–282) chama `supabase.rpc("schedule_agent_response", ...)` corretamente em todo inbound com `agent_paused=false` e `ai_enabled!=false`. Conversas estão com esses dois flags OK. Mensagens inbound foram inseridas. **Mesmo assim a RPC nunca produziu uma linha em `scheduled_jobs`.**

Hipóteses ranqueadas:
1. **Mais provável — a edge function `hook7-webhook` rodando em produção é uma versão mais antiga, anterior à introdução do bloco `schedule_agent_response`.** Os logs do edge function não retornam nada (`No logs found`), reforçando que o build deployado pode ser stale.
2. Menos provável — RPC rejeita a chamada por algum motivo silencioso. A RPC só barra se `current_setting('request.jwt.claim.role')` não for `service_role`; o webhook usa `SERVICE_ROLE_KEY`, então isso passa.
3. Cron de `agent-tick` não está agendado. Não consigo ler `cron.job` por permissão, mas isso só importa **depois** de termos jobs criados — hoje a fila está vazia, então o cron rodando ou não não muda o sintoma atual.

# Plano

## Passo 1 — Redeploy do edge function `hook7-webhook`
Forçar deploy da versão atual do arquivo via `supabase--deploy_edge_functions`. Sem mudança de código.

## Passo 2 — Backfill manual de um job de teste
Inserir 1 linha em `scheduled_jobs` apontando para a conversa mais recente com inbound (`153eed0f-...`, último inbound 20/06 14:55), `run_at = now()`. Isso permite validar o pipeline ponta-a-ponta sem esperar novo inbound.

## Passo 3 — Disparar o tick uma vez manualmente
`curl` em `https://app.leaderei.com.br/api/public/hooks/agent-tick` (rota pública). Confere logs via `stack_modern--server-function-logs` se houver falha. Espera-se ver:
- nova linha em `ai_actions` (kind=auto_reply, status=succeeded)
- nova linha em `messages` outbound com `sent_by_ai=true`
- nova(s) linha(s) em `lead_memory_items`
- nova linha em `lead_website_cache` se o lead tiver `website_url`

## Passo 4 — Verificar/instalar cron do `agent-tick`
Migration que cria/garante `cron.schedule('agent-tick','* * * * *', ...)` apontando para a URL `https://project--medlvgeyneaqokupqoye.lovable.app/api/public/hooks/agent-tick`. Idempotente (DROP IF EXISTS antes). Sem isso, o ciclo automático não roda mesmo com a RPC funcionando.

## Passo 5 — Enviar um inbound de teste e validar o ciclo completo
Pedir você (Renan) para mandar uma mensagem de WhatsApp pra um número da instância conectada. Em até ~90s:
- webhook insere message inbound
- RPC cria job `agent_respond` com run_at +25s
- cron pega o job
- IA decide ação, responde, salva memória, faz scrape (se houver site)

Eu então leio o banco e te mostro as 4 evidências acima.

## Fora do escopo
- **Scraper em si**: a função `fetchWebsiteContent` está correta. Só não foi exercitada. Só vou tocar se o passo 5 mostrar que ela falha — então abrimos rodada separada.
- **Memória / extrator**: idem. Código de `extractAndSaveMemory` em `conversation-agent.server.ts` existe e roda dentro de `processAgentJob` após cada ação executada com sucesso ou enfileirada.
- **Filas de aprovação (`agent_action_queue`)**: regra `agent_action_rules` está vazia → todas ações executam direto (sem aprovação). Sem mudar.
- **Não vou mexer em UI nem em outros server fns.**

## Riscos
- Se a deploy do webhook resolver a RPC mas `agent-tick` não tiver cron, jobs vão se acumular sem serem processados. Por isso o passo 4 é obrigatório.
- O lead da conversa de teste (`153eed0f-...`) é a primeira que o agente vai responder de fato. Validar primeiro num lead "seguro" antes de habilitar para todos.

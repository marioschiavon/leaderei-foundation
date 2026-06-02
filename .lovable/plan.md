
## Diagnóstico (o que aconteceu de verdade)

Olhando o estado real no banco, achei 4 problemas distintos:

### 1. Por que o fluxo parou após o 1º nó
- Os 3 enrollments ativos disparam o 1º WhatsApp com sucesso (3 `flow_step_runs` `done`, com `external_message_id`).
- Depois avançam para o `wait` e ficam com `next_run_at` no futuro.
- **Não existe nenhum `cron.job` agendado chamando `/api/public/hooks/run-flow-tick`.** O endpoint existe e funciona (foi por isso que o 1º envio rolou — disparado manualmente no teste anterior), mas nada chama ele automaticamente. Por isso o fluxo congela depois do primeiro envio.

### 2. Por que recebeu 2 mensagens (e não 3)
- Os 3 envios foram para 3 leads ativos. Dois deles têm o seu número (`5544991274980` e `554491274980`, que normalizam para o mesmo Whats), e o terceiro foi para `554195472941` (lead "Hook7", número diferente). Daí 2 no seu celular.

### 3. Por que mandou para 8 leads sem você selecionar nada
- `activateCampaign` em `src/lib/campaigns.functions.ts:111-116` faz `select` de **todos** os leads não-arquivados da org (`limit 5000`) e enrolla cada um. Não há tela de seleção, nem filtro por canal, nem confirmação.

### 4. Por que enrolla leads sem WhatsApp / com telefone fake
- O executor (`flow-executor.server.ts` no case `message_whatsapp`) só checa `if (!phone)`. Telefones como `11111` ou `11999990000` passam — não há validação de E.164 nem checagem de canal antes do enroll.

Status atual: 3 enrollments ainda estão `active` com jobs `pending` esperando alguém girar a manivela. 6 foram pausados manualmente.

---

## Como o `wait` realmente funciona (esclarecimento)

A boa notícia: o executor **já respeita o tempo configurado no nó**. No `flow-executor.server.ts` o case `wait` faz:

```ts
const resume = addDuration(now, cfg.duration_value ?? 1, cfg.duration_unit ?? "days");
```

`addDuration` suporta `minutes`, `hours`, `days` e `business_days`. O `wait` grava `next_run_at = resume` e o job fica `pending` até essa hora. O cron a cada minuto só acorda o job quando `run_at <= now()`.

Ou seja:
- Wait de 1 min → job acorda no próximo tick (1 min depois).
- Wait de 1 dia → job dorme 24h e acorda quando o tick rodar depois.
- Wait de 3 dias úteis → `addDuration` pula sábado/domingo e marca a data certa.

**Não há mudança a fazer no executor** — só precisamos do cron rodando para que o tick exista. O minuto do cron é só a **resolução de polling** (margem de até 1 min de atraso ao acordar), não o intervalo do wait.

---

## Plano de correção (passo a passo)

### Passo A — Agendar o tick (destrava o fluxo)
Criar `pg_cron` rodando **a cada minuto** chamando `https://project--ab6c70f9-73eb-4b65-bdb9-b5d8d0971ed1.lovable.app/api/public/hooks/run-flow-tick` com header `apikey = <ANON_KEY>`.

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule(
  'run-flow-tick-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://project--ab6c70f9-73eb-4b65-bdb9-b5d8d0971ed1.lovable.app/api/public/hooks/run-flow-tick',
    headers := jsonb_build_object('Content-Type','application/json','apikey','<ANON_KEY>'),
    body := '{}'::jsonb
  );
  $$
);
```

O cron de 1 min é só o ritmo do worker. Quem decide quando o passo acorda é o `next_run_at` que o próprio nó `wait` gravou (1 min, 1 dia, 3 dias úteis, etc.).

### Passo B — Modal de seleção antes de ativar
Em `_app.dashboard.campaigns.tsx`, antes de chamar `activateCampaign`, abrir um diálogo:
- Conta leads elegíveis para o canal da campanha (WhatsApp → tem `phone` válido; Email → tem `email`).
- Duas opções: **"Todos os elegíveis (N)"** ou **"Selecionar manualmente"** (lista com checkboxes filtrada por canal).
- Dispara o enroll só depois da confirmação.

### Passo C — Filtro por canal + validação E.164 no enroll
Trocar `activateCampaign` para aceitar `lead_ids?: string[]`. Quando não vier, aplicar filtro automático:
- `campaign.channel = 'whatsapp'` → normaliza `phone` para dígitos, exige ≥ 12 (DDI + DDD + número).
- `campaign.channel = 'email'` → `email is not null` e bate regex básica.

Leads filtrados não geram enrollment.

### Passo D — Pré-flight defensivo no executor
Manter defesa no `message_whatsapp`: se o phone normalizado tiver < 12 dígitos, marcar o run como `skipped: invalid_phone` e avançar (sem falhar a enrollment).

### Passo E — Visibilidade na UI de campanhas
Aba "Execução" na página da campanha:
- Lista de enrollments com lead, step atual, `next_run_at`, último erro.
- Botão "Forçar tick agora" (útil para teste — chama o endpoint manualmente).
- Contadores: ativos / pausados / completos / falhos.

### Passo F — Limpeza do teste atual
Antes de testar de novo: cancelar os 9 enrollments existentes e voltar a campanha para `draft`, pra não duplicar disparos quando o cron entrar.

---

## Como vai funcionar depois das correções

1. Usuário abre **Teste Whats**, clica "Ativar".
2. Modal: "9 leads na org, **2 elegíveis para WhatsApp**. Enrollar todos ou escolher?".
3. Escolhe → `activateCampaign({ campaign_id, lead_ids })`.
4. Para cada lead: cria 1 enrollment (`active`, current_step = entry) e 1 `scheduled_job` (`run_at = now`).
5. `pg_cron` chama o tick a cada minuto. O tick pega até 25 jobs com `run_at ≤ now` e `status = pending`.
6. Para cada job, o executor roda o step:
   - **message_whatsapp** → envia via Hook7, agenda próximo job com `run_at = now`.
   - **wait** → agenda próximo com `run_at = now + (duration_value × duration_unit)`. **O tempo é exatamente o configurado no nó.**
   - Último step → marca enrollment `completed`.
7. Usuário acompanha tudo na aba "Execução".

---

## Fora de escopo (depois)

- Segmentação avançada (tags, status, score).
- Janela de envio / horário comercial.
- Retry policy customizável por step.
- Dashboard agregado.

---

## Pronto quando

- `cron.job` agendado e visível em `cron.job_run_details` (1 execução/min).
- Ativar campanha WhatsApp NÃO enrolla leads só-email.
- Ativar abre modal de confirmação com contagem de elegíveis.
- Os 3 enrollments de teste já existentes terminam até o 3º WhatsApp sem intervenção manual, respeitando os waits de 1 min e 5 min.
- Aba "Execução" mostra o estado dos enrollments.

## Problema

O secret do webhook é gerado e gravado em `integration_credentials`, mas a UI nunca mostra o valor — só exibe "gerado/ausente". Sem o valor, não há como colar no campo "Secret" do Cal.com, então a verificação HMAC (`verifyCalcomSignature`) falha e o webhook não funciona.

O comentário atual ("Por segurança, o secret só é exibido na primeira configuração") é falso — ele nunca foi exibido.

## Correção

### 1. `src/lib/calcom.functions.ts` — `getCalcomConnection`
- Retornar o valor do `webhook_secret` junto com `has_webhook_secret`.
- Continua atrás de `requireSupabaseAuth` + filtro por org ativa, então só membros da organização leem.

### 2. Nova server function `regenerateCalcomWebhookSecret`
- Gera novo secret (`makeWebhookSecret()`), faz upsert em `integration_credentials` (`key = webhook_secret`).
- Útil quando o usuário suspeita que o atual vazou ou quando o webhook nunca foi configurado no Cal.com.

### 3. `CalcomConnectionDialog` (`src/routes/_app.dashboard.integrations.tsx`)
- Trocar o bloco "gerado/ausente" por um campo real:
  - `Input` readOnly com `type="password"` e botão olho para revelar.
  - Botão de copiar (clipboard) ao lado.
  - Botão "Gerar novo" chamando `regenerateCalcomWebhookSecret` (com `confirm()` avisando que invalida o atual).
- Atualizar o texto de ajuda: explicar passo a passo (Cal.com → Settings → Developer → Webhooks → New Webhook → cola URL, cola Secret, marca os 3 eventos `BOOKING_CREATED/RESCHEDULED/CANCELLED`).
- Se `has_webhook_secret` for false logo após salvar a API key (caso raro), mostrar botão "Gerar secret agora".

### 4. Sem mudanças em
- `src/routes/api/public/hooks/calcom.ts` — verificação HMAC já está correta (hex, timing-safe).
- Migration / RLS — `integration_credentials` já está protegido por org.
- Fluxo de salvar a API key — secret continua sendo gerado automaticamente na primeira conexão.

## Fora deste plano

O erro `Cal.com [404] /v2/event-types` na sincronização é um bug separado do endpoint v2 (path/headers do `syncCalcomEventTypes`). Posso tratar em seguida; me avise se quer incluir agora.

## Arquivos tocados
- `src/lib/calcom.functions.ts` (modificado)
- `src/routes/_app.dashboard.integrations.tsx` (modificado, só o `CalcomConnectionDialog`)

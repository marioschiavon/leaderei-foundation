## Contexto

O domínio primário foi alterado para `https://app.leaderei.com.br` (já ativo, custom domain do projeto). No código existem três pontos onde a URL pública importa — principalmente para **webhooks externos** que precisam de URL estável e para **links em e-mails transacionais** (convites, etc).

Hoje o sistema já tem:
- `platform_settings.app_public_url` (registro existe, mas **valor está vazio**)
- env var opcional `PUBLIC_APP_URL` / `VITE_PUBLIC_APP_URL` (não definidas)
- fallback hardcoded `https://leaderei.lovable.app` em 2 lugares no `calcom.functions.ts`

Resultado atual: o webhook do Cal.com mostrado na UI para o cliente colar lá usa `leaderei.lovable.app`, não o domínio novo.

## O que muda

### 1. Definir o domínio oficial no banco
Atualizar `platform_settings.app_public_url` para `https://app.leaderei.com.br`. Isto já é consumido por `src/lib/settings.functions.ts` (linhas 197–204) na geração de links de convite.

### 2. Webhook do Cal.com passar a usar o domínio oficial
Em `src/lib/calcom.functions.ts`:
- A função `webhookUrlFor(org)` (linha 136) e a função `testWebhookSignature` (linha 340) hoje só leem `process.env.PUBLIC_APP_URL` → caem no fallback `leaderei.lovable.app`.
- Mudança: passar a ler também `platform_settings.app_public_url` (via `supabaseAdmin`), com prioridade:
  `app_public_url (DB) → PUBLIC_APP_URL (env) → https://app.leaderei.com.br (novo fallback)`.
- Trocar o fallback hardcoded de `leaderei.lovable.app` por `app.leaderei.com.br`.

### 3. Placeholder da UI master
`src/routes/_master.master.platform.tsx` linha 295 já mostra `https://app.leaderei.com.br` como placeholder — sem alteração de código, apenas confirmar que o valor salvo agora é esse.

### 4. O que NÃO muda
- **Hook7 webhook** (`src/lib/hook7.functions.ts`): usa `SUPABASE_URL/functions/v1/hook7-webhook/...` — não depende do domínio do app, segue igual.
- **Endpoints `/api/public/hooks/run-flow-tick`** (pg_cron): hoje são chamados via URL estável `project--{id}.lovable.app`, que continua válida. Sem mudança.
- **Cal.com já configurado em clientes existentes**: como o webhook atual aponta para `leaderei.lovable.app` (que continua publicado e roteando para o mesmo backend), **continua funcionando**. Mas novos clientes / regenerações usarão a URL nova. Recomendo, depois do deploy, os clientes que já configuraram o Cal.com **copiarem a nova URL** e atualizarem lá — vou deixar isso destacado na UI da integração com um aviso.
- `src/routes/__root.tsx` og:image: aponta para R2 (preview), é só imagem social — fora de escopo.

## Passos de implementação

1. Migração SQL atualizando `platform_settings.app_public_url` para `https://app.leaderei.com.br`.
2. Editar `src/lib/calcom.functions.ts`:
   - Criar helper `async function resolveAppBaseUrl()` que consulta `platform_settings` via `supabaseAdmin` e cacheia em memória por request.
   - `webhookUrlFor` vira `async`; ajustar os 2 call sites (`getCalcomConnection`, `saveCalcomConnection` retorno) para `await`.
   - `testWebhookSignature` passa a usar o mesmo helper.
   - Trocar fallback string.
3. Adicionar pequeno aviso (`<p className="text-xs text-muted-foreground">`) abaixo do campo "Webhook URL" em `_app.dashboard.integrations.tsx` lembrando de atualizar no Cal.com se a URL mudou.

## Verificação

- `psql` para confirmar `app_public_url`.
- Abrir `/dashboard/integrations` → card Cal.com → URL exibida deve começar com `https://app.leaderei.com.br/api/public/hooks/calcom?org=...`.
- Botão "Testar webhook" deve responder 200 contra o domínio novo.
- Enviar um convite (settings → membros) e conferir que o link do e-mail usa o domínio novo.

Sem mudanças em RLS, schema, rotas ou fluxos.
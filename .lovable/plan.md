
# Migrar envio de email: Resend → Lovable Emails

Replicar a arquitetura de email do `lead-automate`: infra nativa Lovable (Mailgun via NS delegation), fila pgmq com retry/DLQ, templates React Email, suppression list e unsubscribe automáticos. Subdomínio: **`notify.leaderei.com.br`**.

## Etapas

### 1. Provisionar domínio + infraestrutura
- Abrir diálogo de setup (`<presentation-open-email-setup>`) para `notify.leaderei.com.br`. Usuário adiciona NS records (`ns3/ns4.lovable.cloud`) no registrador do `leaderei.com.br`. Lovable gerencia SPF/DKIM/MX automaticamente.
- Rodar `email_domain--setup_email_infra`: cria pgmq (`auth_emails`, `transactional_emails`), RPCs (`enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`), tabelas (`email_send_state`, `suppressed_emails`, `email_unsubscribe_tokens`), atualiza `email_send_log`, pg_cron 5s em `/lovable/email/queue/process`.

### 2. Scaffold app emails (transacional)
- Rodar `email_domain--scaffold_transactional_email`: cria rotas `/lovable/email/transactional/send`, `/preview`, `/email/unsubscribe`, `/lovable/email/suppression` e `src/lib/email-templates/registry.ts`.
- Criar `src/lib/email-templates/invitation.tsx` em React Email (`Html`, `Head`, `Body`, `Container`, `Heading`, `Text`, `Button`, `Preview`) usando paleta atual: laranja `#e04e01`, fundo `#ffffff`, fonte system. Sem footer de unsubscribe manual — o sistema injeta.
- Registrar `invitation` no `registry.ts` com props tipadas (`org_name`, `inviter_name`, `role_label`, `invite_url`, `expires_at`).

### 3. Scaffold auth emails (auth)
- Rodar `email_domain--scaffold_auth_email_templates`: cria webhook `/lovable/email/auth/webhook` e 6 templates (`signup`, `magiclink`, `recovery`, `invite`, `email-change`, `reauthentication`).
- Estilizar os 6 com identidade Leaderei (logo, laranja, footer S7).
- Substitui automaticamente os emails padrão do Supabase (reset de senha, confirmação).

### 4. Substituir sender atual
- Reescrever `src/lib/email.functions.ts`: `sendEmailInternal` passa a POSTar `/lovable/email/transactional/send` com `{ templateName, recipientEmail, idempotencyKey, templateData }`. Eliminar fetch a `api.resend.com`, `getGlobalConfig`, `getOrgConfig`, leitura de `resend_global_api_key`.
- Atualizar call sites (`tenant.functions.ts` etc.) para passar `templateName: 'invitation'` + `templateData`, em vez de HTML pronto. Idempotency key: `invitation-${invitation_id}`.
- Apagar `src/lib/email-templates/base.ts` e `invitation.ts` (HTML antigo).

### 5. Página de unsubscribe brandada
- Scaffold devolve um path sugerido (ex.: `/descadastrar`). Criar `src/routes/descadastrar.tsx` que lê `?token=`, faz GET em `/email/unsubscribe` para validar, POST para confirmar, com visual Leaderei (estados: confirmar, já cancelado, inválido, sucesso).

### 6. Remover Resend
- Tirar UI "Resend Global API Key" / "From Email/Name" de `_master.master.platform.tsx`.
- Tirar card Resend por organização em `dashboard/integrations`; remover `src/lib/integrations.functions.ts` (`getOrgResendConnection`, `saveOrgResendConnection`, `disconnectOrgResend`).
- Migration: `DELETE` provider `resend` em `integration_providers` + cleanup de `organization_integrations` e `integration_credentials` órfãos.
- Manter por enquanto a chave `resend_global_api_key` em `platform_settings` (rollback seguro), mas parar de ler.

### 7. Documentação
- Atualizar `docs/user/UPDATES.md` (v0.6) explicando: emails agora nativos Lovable, zero chave externa, retry/DLQ automático, suppression, unsubscribe e templates de auth + convite brandados.

## O que NÃO muda
- `email_send_log` (compatível com `setup_email_infra`).
- Convites de organização (`organization_invitations`, `accept_invitation`) — só muda o canal.
- Login/signup Supabase — só os templates ficam brandados.

## Detalhes técnicos
- `SENDER_DOMAIN` = `notify.leaderei.com.br`; `FROM_DOMAIN` pode ser exibido como `leaderei.com.br` se ativar `display_from_root`.
- Throughput padrão ~120/min, ajustável em `email_send_state`.
- Bounces/queixas entram em `suppressed_emails` via webhook Mailgun; `/transactional/send` checa antes de enfileirar.
- Auth emails só ativam após DNS verificar (monitorar em **Cloud → Emails**); app emails podem ser scaffoldados antes.
- TTL auth 15min, app 60min.

## Ordem de execução (no build mode)
1. Diálogo de domínio (espera DNS do usuário).
2. `setup_email_infra` → `scaffold_transactional_email` → `scaffold_auth_email_templates`.
3. Templates React Email + registry.
4. Rewrite `email.functions.ts` + call sites.
5. Página `/descadastrar`.
6. Limpeza Resend + migration.
7. UPDATES.md.


# Resend híbrido + envio real de convites

## Decisão de arquitetura: encryption

Vou usar **Supabase Vault + pgcrypto** (não pgsodium):

- `pgsodium` está **deprecado** no Supabase managed (já não é instalado em projetos novos desde 2024). Usar agora cria dívida.
- **Vault** é o cofre nativo do Supabase para segredos. Guarda a passphrase de encryption (gerada randomicamente na migration) criptografada com a master key gerenciada pela infra do Supabase. Nunca vai pro código nem pra migration em plaintext.
- `platform_settings.value_encrypted` guarda os segredos cifrados com `pgp_sym_encrypt(value, passphrase)`. A passphrase é lida via `vault.read_secret('platform_encryption_key')` dentro das funções SECURITY DEFINER.
- Resultado: rotacionar a master key não exige redeploy; ninguém com acesso só ao Postgres consegue ler os segredos sem ser `master_admin`.

## Entregas (ordem de execução)

### 1. Migration única
- `CREATE EXTENSION pgcrypto`
- Insere `vault.create_secret(gen_random_uuid()::text, 'platform_encryption_key', 'Resend keys encryption')`
- Tabela `platform_settings` (key, value_encrypted bytea, value_plain jsonb, is_secret, description, updated_by, updated_at) com RLS exclusiva pra `master_admin`
- Tabela `email_send_log` (organization_id, purpose, provider, from_email, to_email, subject, template_key, provider_message_id, status, error_message, triggered_by, metadata) com RLS leitura só `master_admin`, índices
- Funções SECURITY DEFINER: `set_platform_secret(key, value)`, `get_platform_secret(key)`, `get_platform_plain(key)`, `set_platform_plain(key, jsonb)`, `log_email_send(...)`, `update_email_send_status(id, status, message_id, error)`
- Seed: linhas iniciais para `resend_global_api_key`, `resend_global_from_email='leaderei@s7cloud.com.br'`, `resend_global_from_name='Leaderei'`, `app_public_url`, `logo_public_url`
- `organization_invitations` ganha coluna `last_sent_at timestamptz`
- Storage bucket público `public-assets`

### 2. Backend
- `src/lib/email.functions.ts` — função roteadora `sendEmail({to, subject, html, text, purpose, organization_id?, template_key?, metadata?, reply_to?})`:
  - Roteia pra chave global se `purpose ∈ {invitation, welcome, password_reset, system_alert}`, lendo via service-role + `get_platform_secret`
  - Pra `campaign`/`inbox_reply` busca `organization_integrations` + `integration_credentials`, erro claro se ausente (sem fallback)
  - `fetch` direto pra `api.resend.com/emails`, timeout 10s, log antes/depois, nunca logga apiKey
- `src/lib/platform.functions.ts` — funções master-only: `getPlatformSettings`, `setPlatformResendKey` (valida contra `api.resend.com/domains`), `setPlatformPlain`, `sendTestEmail`, `listEmailSendLogs({filters, page})`, `uploadProjectLogoToStorage`
- `src/lib/settings.functions.ts` — `sendInvitationEmail` agora monta payload de convite e chama `sendEmail`, marca `last_sent_at`

### 3. Templates de email
- `src/lib/email-templates/base.ts` — `renderBaseTemplate({preheader, content, ctaUrl?, ctaLabel?})` retornando `{html, text}`. HTML 100% inline, tabela-based, max 600px, system fonts, hex literais extraídos do styles.css, footer com endereço fictício "S7 — Curitiba, PR, Brasil"
- `src/lib/email-templates/invitation.ts` — `renderInvitationEmail({org_name, inviter_name, role_label, invite_url, expires_at})`

### 4. UI
- Nova rota `src/routes/_master.master.platform.tsx` com 3 seções:
  - **Email transacional global**: badge status, input chave Resend (mascarada), botão Salvar (com confirm se substituir), botão "Enviar email de teste"
  - **Branding em emails**: input `logo_public_url` + botão "Usar logo do projeto" (faz upload de `/public/logo` pro bucket)
  - **Logs recentes**: tabela paginada com filtros (status, purpose, data), drawer de detalhes
- Tab "Plataforma" adicionada em `_master.master.tsx`
- `_app.dashboard.settings.tsx` (aba Membros): botão "Enviar por email" no dialog vira ação primária funcional, com toast verde no sucesso e mensagem clara + link "Configurar agora" (só master) no erro de chave não configurada
- `_app.dashboard.integrations.tsx`: banner explicativo "Resend por-org é pra campanhas. Pra emails do sistema o Leaderei já cuida." + card Resend com form que persiste em `integration_credentials` (sem usar ainda em campanhas)

### 5. Docs
- `docs/user/README.md`: nova seção "Email transacional" explicando híbrido
- `.lovable/plan.md`: marcar critérios fechados

## Fora do escopo desta rodada
- Envio real de campanhas / inbox reply (Fase 3)
- Webhooks de bounce/delivered do Resend (Fase 3)
- Templates welcome / password reset (não pedidos)

## Riscos conhecidos
- **Deliverability do `leaderei@s7cloud.com.br`**: requer que o domínio `s7cloud.com.br` esteja verificado na conta Resend cuja chave o master vai colar. Se não estiver, todo send retorna 403. Vou tratar o erro do Resend e mostrar mensagem clara apontando pra "verifique o domínio em resend.com/domains".
- **Vault**: requer extensão habilitada. Se a migration falhar nisso, fallback é passphrase em env var `PLATFORM_ENCRYPTION_KEY` (documento qual caminho ficou no commit).

Posso seguir?

## Rodada — Email híbrido (Resend global + per-org)

- [x] `platform_settings` + Vault/pgcrypto para chave global criptografada
- [x] `email_send_log` (audit master-only)
- [x] Router `sendEmailInternal` com separação system/org purposes
- [x] Templates HTML email-safe (`base.ts`, `invitation.ts`)
- [x] Página Master → Plataforma (chave, branding, teste, logs)
- [x] Convites realmente enviam por email via chave global
- [x] Banner explicativo em Integrações
- [ ] Form de conexão Resend por-org em Integrações (próxima rodada)

## Falta para fechar Fase 1

1. Builder persistido em `builder_documents` com versão/publish.
2. Form de conexão Resend por-organização em Integrações (campanhas/inbox).
3. Auditoria final de empty states e mensagens de erro em todas as telas.

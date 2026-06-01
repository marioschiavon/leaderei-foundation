## Problema

A tabela `public.user_roles` hoje só tem duas policies:
- `SELECT` permitindo o usuário ver suas próprias roles (`user_id = auth.uid()`)
- `ALL` para `master_admin`

Não existe nenhuma policy de `INSERT/UPDATE/DELETE` para usuários comuns — e como RLS é permissiva por padrão, isso **não bloqueia** escrita: qualquer usuário autenticado pode rodar um `INSERT` atribuindo a si mesmo a role `master_admin` e ganhar acesso global.

## Correção

Migração SQL adicionando policies de escrita restritivas em `public.user_roles`:

1. **`INSERT` apenas para `master_admin`**
   ```sql
   CREATE POLICY "Only master_admin can insert roles"
   ON public.user_roles FOR INSERT TO authenticated
   WITH CHECK (public.has_role(auth.uid(), 'master_admin'));
   ```
2. **`UPDATE` apenas para `master_admin`**
   ```sql
   CREATE POLICY "Only master_admin can update roles"
   ON public.user_roles FOR UPDATE TO authenticated
   USING (public.has_role(auth.uid(), 'master_admin'))
   WITH CHECK (public.has_role(auth.uid(), 'master_admin'));
   ```
3. **`DELETE` apenas para `master_admin`**
   ```sql
   CREATE POLICY "Only master_admin can delete roles"
   ON public.user_roles FOR DELETE TO authenticated
   USING (public.has_role(auth.uid(), 'master_admin'));
   ```

A policy `ALL` de `master_admin` já existente continua funcionando (policies permissivas são unidas por OR). A nova explicitação fecha o buraco para usuários comuns.

## Por que isso não quebra signup/convites

Os fluxos que hoje inserem em `user_roles` rodam via funções `SECURITY DEFINER` (executam como dono da função, ignorando RLS):
- `public.provision_user_account` — usada por `handle_new_user` no signup → insere `company_admin`.
- `public.accept_invitation` — usada na aceitação de convite → insere `company_admin`/`user`.

Nenhum código cliente faz `supabase.from('user_roles').insert(...)` diretamente, então a restrição não afeta a aplicação.

## Verificação após aplicar

- Re-rodar o scanner de segurança — finding `user_roles_self_assignment` deve sumir.
- Signup novo continua provisionando role corretamente.
- Aceite de convite continua atribuindo role corretamente.

## Escopo

Apenas 1 migração SQL. Sem mudanças em código TypeScript. Os outros findings do painel (tokens de convite, hashes de api_keys, funções SECURITY DEFINER executáveis, bucket público) ficam fora desta rodada — posso tratar em seguida se quiser.
---

## Rodada — Onboarding + signup sem confirmação + auto-link Builder (28/05/2026)

Critérios fechados:

1. ✅ Signup auto-confirma email e redireciona pra `/onboarding`.
2. ✅ Tela `/onboarding` com 5 cards (3 ativos + 2 "Em breve") e botão funcional.
3. ✅ "Começar a usar" seta `onboarding_completed_at = now()` e leva pra `/dashboard`.
4. ✅ Login subsequente NÃO mostra `/onboarding` (vai direto pra `/dashboard`).
5. ✅ Rota `/onboarding` acessível manualmente após conclusão.
6. ✅ Builder auto-conecta novo Email ao último nó.
7. ✅ Sequência horizontal Email → Wait (position.x = last.x + 280).
8. ✅ Auto-link em Condição com `yes` ocupado conecta em `no`.
9. ✅ Condição com `yes` e `no` ocupados → nó solto.
10. ✅ Save + F5 mantém conexões criadas pelo auto-link (mesmo caminho de save).
11. ✅ Build passa.

Mudanças:
- Migration: `profiles.onboarding_completed_at timestamptz`.
- Auth: `auto_confirm_email = true`.
- Server fn: `markOnboardingCompleted` + `getMyContext` expõe `profile` e `onboardingCompleted`.
- Rota nova: `/onboarding`.
- `_app.tsx` redireciona pra `/onboarding` se `!onboardingCompleted`.
- `signup.tsx` redireciona pra `/onboarding` quando `data.session` existe (fallback pra `/login` se confirmação for reativada).
- `FlowEditor.tsx`: hidratação ordena steps por `created_at` ASC; `onDrop` implementa auto-link + `fitView`.

## Rodada 1A — WhatsApp via Hook7 (criar + conectar instâncias)

- Migrations: `hook7_instances` (org, owner_user_id, external_id/name, status, token criptografado), `organizations.whatsapp_mode`, `platform_settings.hook7_*`.
- RPCs: `set_hook7_instance_token` / `get_hook7_instance_token` (pgp_sym_encrypt, SECURITY DEFINER).
- `src/lib/hook7.functions.ts`: helper `hook7Fetch`, master config (apikey global + base_url), mode org-level, CRUD de instâncias (create, connect, qr, status, disconnect, reconnect, delete, rename).
- UI: `WhatsAppManagerDialog` com fluxo QR (polling 3s, timeout 2min), wired em **Integrações** (card WhatsApp → "Gerenciar instâncias").
- Master → Plataforma: seção "WhatsApp via Hook7" para salvar apikey global e base URL.
- Configurações: nova aba **WhatsApp** para alternar `shared` ↔ `per_user`.
- Docs: seção "WhatsApp via Hook7" em `docs/user/README.md`.

## Rodada 1A-fix — Chave global Hook7 sai do banco e vai para env var

- Migration: `DELETE FROM platform_settings WHERE key = 'hook7_global_apikey'` (entrada removida, `hook7_base_url` permanece).
- `src/lib/hook7.functions.ts`: `getHook7GlobalApiKey()` agora é síncrona e lê apenas `process.env.HOOK7_GLOBAL_APIKEY`. Server fn `setHook7GlobalApiKey` removida. Adicionadas `getHook7GlobalApiKeyStatus` (retorna `{ configured }`) e `testHook7Connection` (cria+deleta instância de healthcheck).
- Master → Plataforma → "WhatsApp · Hook7": apenas leitura (status da apikey + URL base editável + prefixo read-only + botão "Testar conexão" + aviso explicando que a chave é segredo de infra).
- `.env.example`: documenta `HOOK7_GLOBAL_APIKEY` e `HOOK7_INSTANCE_PREFIX`.
- Docs: `docs/user/README.md` atualizado.

### Dívida técnica registrada
- Migrar `resend_global_api_key` de `platform_settings` para variável de ambiente, alinhando padrão de chaves de infraestrutura (mesma motivação de separação de responsabilidades entre operação e infraestrutura).

## Rodada 1A-fix2 — Mapeamento Hook7 (Connected/Qrcode/Name) + cancelamento seguro

- Migration: `hook7_instances.connected_profile_name text`.
- `getHook7InstanceQR`: lê `data.Qrcode` (capitalização exata).
- `getHook7InstanceStatus`: lê `data.Connected`/`LoggedIn`/`Name`; só vira `connected` quando ambos `true`; nunca regride automaticamente para `disconnected`; grava `connected_profile_name` e `last_connected_at`. Erro de fetch → status `error`.
- `createHook7Instance`: audita o mapeamento `data.id → external_id`, `data.name → external_name`, `data.token → token_encrypted`; warning se o nome devolvido divergir do enviado.
- `deleteHook7Instance`: aceita `reason` (`user_delete`/`cancel`/`timeout`). Defensivo: nunca arquiva uma instância `connected` em rollback de cancel/timeout.
- `WhatsAppManagerDialog`: `handleCancel(reason)` propaga motivo; auto-arquiva no timeout 2min; passo 2 mostra "Conectado como {Name}" + nota "O número será detectado em breve"; lista usa `connected_profile_name` como fallback quando `phone_number` é NULL.

---

## Rodada 1B — Webhook Hook7 (FECHADA)

- Migration: campos `external_message_id`, `source_channel`, `whatsapp_status`, `whatsapp_status_at` em `messages`; `needs_review`/`review_reason` em `leads`; índice único parcial em `external_message_id`; realtime habilitado em `messages`.
- Edge Function `hook7-webhook` (Deno, service_role) recebe eventos Hook7, valida secret de path + `instanceToken`, e roteia `Message` / `Receipt` / `Connected` / `LoggedOut`. Sempre retorna 200.
- `connectHook7Instance` / `reconnectHook7Instance` agora registram o `webhookUrl` automaticamente no Hook7 (graceful degradation se `HOOK7_WEBHOOK_SECRET` ausente).
- Master → Plataforma → WhatsApp · Hook7 mostra status do webhook (URL com secret mascarado).

### Próxima — Rodada 1B.2

UI do Inbox consumindo `messages` em tempo real (canal realtime client-side) + filtro de leads `needs_review = true` ("Caixa de entrada órfã").

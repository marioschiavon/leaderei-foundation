## Entendimento

- O menu **Master** é o único espaço de configurações globais — só master_admin acessa.
- O menu **Integrações** (em `/dashboard/integrations`) é sempre da empresa do usuário atual, independente do papel global. Master_admin nessa tela age como qualquer membro da própria org.
- O bloqueio atual acontece porque a policy de `integration_credentials` exige `has_role(uid, 'company_admin')` (papel global em `user_roles`), e o master_admin não tem esse papel global — embora seja `company_admin` da sua org via `organization_members`.

Não vamos misturar master com company: nada de dar acesso global a integrações da empresa via policy de master. A correção fica restrita ao caminho da própria org.

## Correção (mínima e cirúrgica)

### Server functions de integração — usar `supabaseAdmin` após validar membership da org

Em `src/lib/integrations.functions.ts`:

- `saveOrgResendConnection` e `disconnectOrgResend` hoje escrevem com o cliente autenticado (sujeito ao RLS que falha).
- O `getActiveOrgId` (já chamado nessas funções) garante que o usuário é **membro ativo** da org atual — essa é a autorização de negócio que importa nessa tela.
- Após essa validação, trocar a escrita para `supabaseAdmin` (`await import('@/integrations/supabase/client.server')` dentro do handler), aplicada aos upserts em `organization_integrations` e `integration_credentials` (save) e ao delete/update correspondentes (disconnect).
- A leitura (`getOrgResendConnection`) já usa `supabaseAdmin` — só está sendo alinhado o caminho de escrita.

Resultado:
- Master_admin que é membro da sua própria org salva integrações sem fricção.
- Company_admin comum continua funcionando exatamente igual.
- Usuário que não é membro ativo da org → `getActiveOrgId` falha antes de qualquer escrita.
- As policies de `integration_credentials` e `organization_integrations` permanecem **inalteradas** — master continua sem acesso global a integrações de outras empresas a partir do menu da company.

## Auditoria

O `audit_logs` continua registrando `actor_user_id` = `context.userId`, então a autoria do master fica preservada mesmo com a escrita por `supabaseAdmin`. Nenhuma mudança extra de logging nesta rodada.

## Fora do escopo

- Sem mudança em RLS.
- Sem mudança em UI.
- Pipedrive/Apollo/Hook7 só serão revistos se exibirem o mesmo sintoma — varredura separada depois.
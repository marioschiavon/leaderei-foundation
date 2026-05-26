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
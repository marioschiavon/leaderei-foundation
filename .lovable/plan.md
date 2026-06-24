## Causa
A policy `Org admins manage ai_org_profile` checa `has_role(auth.uid(), 'company_admin')` na tabela `user_roles`. O usuário atual tem `master_admin` em `user_roles` e é `company_admin` apenas em `organization_members` — por isso INSERT/UPDATE da base de conhecimento falha com "new row violates row-level security policy".

## Regra desejada
- `master_admin` → pode alterar `ai_org_profile` de qualquer organização.
- `company_admin` → pode alterar apenas o registro da própria organização.

## Migration
```sql
DROP POLICY "Org admins manage ai_org_profile" ON public.ai_org_profile;

CREATE POLICY "Org admins manage ai_org_profile"
ON public.ai_org_profile
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'master_admin')
  OR EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = ai_org_profile.organization_id
      AND m.status = 'active'
      AND m.role = 'company_admin'
  )
)
WITH CHECK (
  has_role(auth.uid(), 'master_admin')
  OR EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = ai_org_profile.organization_id
      AND m.status = 'active'
      AND m.role = 'company_admin'
  )
);
```

## Escopo
- Apenas a policy de `ai_org_profile`. Sem alterações de código.
## Por que o aviso aparece

O scanner de segurança roda automaticamente e revisa **todas** as policies do banco — não só as que mexemos nesta rodada. Esta vulnerabilidade **já existia** desde quando a tabela `organization_members` foi criada; o scanner só passou a sinalizá-la agora.

Confirmei direto no banco — a policy atual é:

```
INSERT "Org admins insert own org members"
WITH CHECK (is_org_member(auth.uid(), organization_id)
            AND has_role(auth.uid(), 'company_admin'))
```

Não há nenhuma restrição sobre o valor da coluna `role` no INSERT. Ou seja, um `company_admin` pode inserir uma linha com `role = 'master_admin'` e escalar privilégios para a plataforma inteira. O risco é real e independente das mudanças recentes.

## Correção proposta (1 migration, mínima)

Recriar a policy de INSERT adicionando `AND role <> 'master_admin'`:

```sql
DROP POLICY "Org admins insert own org members" ON public.organization_members;

CREATE POLICY "Org admins insert own org members"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  is_org_member(auth.uid(), organization_id)
  AND has_role(auth.uid(), 'company_admin')
  AND role <> 'master_admin'
);
```

Master admin continua podendo criar qualquer role pela policy `Master admins manage all org members` (que usa `has_role(... 'master_admin')`), então nenhum fluxo legítimo quebra.

## Escopo

- 1 arquivo novo: `supabase/migrations/<timestamp>_fix_org_members_role_escalation.sql`
- Nenhuma mudança em código de aplicação
- Não toco em outras policies, nem na finding de `organization_invitations` (separada, posso tratar depois se quiser)
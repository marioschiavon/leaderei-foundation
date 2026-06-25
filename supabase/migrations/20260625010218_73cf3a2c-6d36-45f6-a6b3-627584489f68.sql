DROP POLICY IF EXISTS "Org admins insert own org members" ON public.organization_members;

CREATE POLICY "Org admins insert own org members"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  is_org_member(auth.uid(), organization_id)
  AND has_role(auth.uid(), 'company_admin')
  AND role <> 'master_admin'
);
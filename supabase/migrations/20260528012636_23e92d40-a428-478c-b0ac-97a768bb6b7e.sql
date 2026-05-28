DROP POLICY IF EXISTS "Org members view api_keys" ON public.api_keys;

CREATE POLICY "Only org admins view api_keys" ON public.api_keys
FOR SELECT TO authenticated
USING (
  is_org_member(auth.uid(), organization_id)
  AND has_role(auth.uid(), 'company_admin'::app_role)
);
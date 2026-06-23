
DROP POLICY IF EXISTS "Org admins manage integration credentials" ON public.integration_credentials;
CREATE POLICY "Org admins manage integration credentials"
ON public.integration_credentials
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'master_admin'::app_role)
  OR (is_org_member(auth.uid(), organization_id) AND has_role(auth.uid(), 'company_admin'::app_role))
)
WITH CHECK (
  has_role(auth.uid(), 'master_admin'::app_role)
  OR (is_org_member(auth.uid(), organization_id) AND has_role(auth.uid(), 'company_admin'::app_role))
);

DROP POLICY IF EXISTS "Org admins manage pipedrive_sync_runs" ON public.pipedrive_sync_runs;
CREATE POLICY "Org admins manage pipedrive_sync_runs"
ON public.pipedrive_sync_runs
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'master_admin'::app_role)
  OR (is_org_member(auth.uid(), organization_id) AND has_role(auth.uid(), 'company_admin'::app_role))
)
WITH CHECK (
  has_role(auth.uid(), 'master_admin'::app_role)
  OR (is_org_member(auth.uid(), organization_id) AND has_role(auth.uid(), 'company_admin'::app_role))
);

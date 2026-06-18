
-- Hide sensitive columns from PostgREST (Data API)
REVOKE SELECT (token_encrypted) ON public.hook7_instances FROM authenticated, anon;
REVOKE SELECT (value_encrypted) ON public.integration_credentials FROM authenticated, anon;
REVOKE SELECT (token) ON public.organization_invitations FROM authenticated, anon;

-- Restrict scheduled_jobs SELECT to company_admin / master_admin
DROP POLICY IF EXISTS "View scheduled_jobs" ON public.scheduled_jobs;
CREATE POLICY "View scheduled_jobs"
ON public.scheduled_jobs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'master_admin'::app_role)
  OR (
    organization_id IS NOT NULL
    AND is_org_member(auth.uid(), organization_id)
    AND has_role(auth.uid(), 'company_admin'::app_role)
  )
);

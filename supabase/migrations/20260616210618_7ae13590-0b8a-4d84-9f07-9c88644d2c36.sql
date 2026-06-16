
-- =========================================================
-- organization_invitations: hide raw token from clients
-- =========================================================
-- Re-grant SELECT on every column EXCEPT token. INSERT/UPDATE/DELETE unchanged.
REVOKE SELECT ON public.organization_invitations FROM authenticated, anon;
GRANT SELECT (
  id, organization_id, email, role, invited_by, expires_at,
  accepted_at, revoked_at, created_at, last_sent_at
) ON public.organization_invitations TO authenticated;
-- service_role keeps full access (bypasses RLS + has ALL grants).
GRANT ALL ON public.organization_invitations TO service_role;

-- =========================================================
-- scheduled_jobs: restrict writes; keep org-member reads
-- =========================================================
DROP POLICY IF EXISTS "Manage scheduled_jobs" ON public.scheduled_jobs;

-- Master admins can write to any scheduled job (org-scoped or platform-scoped).
CREATE POLICY "Master admins manage scheduled_jobs"
ON public.scheduled_jobs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'master_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'master_admin'::app_role));

-- service_role bypasses RLS; org members keep read access via the existing
-- "View scheduled_jobs" SELECT policy. No INSERT/UPDATE/DELETE for regular
-- org members — background jobs must be created server-side.

DROP POLICY IF EXISTS "Org members view scheduled_jobs" ON public.scheduled_jobs;
DROP POLICY IF EXISTS "Org members manage scheduled_jobs" ON public.scheduled_jobs;

CREATE POLICY "View scheduled_jobs"
ON public.scheduled_jobs
FOR SELECT
TO authenticated
USING (
  (organization_id IS NULL AND public.has_role(auth.uid(), 'master_admin'::public.app_role))
  OR public.is_org_member(auth.uid(), organization_id)
);

CREATE POLICY "Manage scheduled_jobs"
ON public.scheduled_jobs
FOR ALL
TO authenticated
USING (
  (organization_id IS NULL AND public.has_role(auth.uid(), 'master_admin'::public.app_role))
  OR public.is_org_member(auth.uid(), organization_id)
)
WITH CHECK (
  (organization_id IS NULL AND public.has_role(auth.uid(), 'master_admin'::public.app_role))
  OR public.is_org_member(auth.uid(), organization_id)
);

CREATE POLICY "Master admins read email_send_log"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'master_admin'::public.app_role));
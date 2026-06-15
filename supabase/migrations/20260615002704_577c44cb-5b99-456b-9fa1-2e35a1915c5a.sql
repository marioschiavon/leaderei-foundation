
-- ============================================================
-- PARTE 1: Remover 5 policies de master restantes
-- ============================================================

DROP POLICY IF EXISTS "Master admins manage all api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Master admins read all apollo calls" ON public.apollo_api_calls;
DROP POLICY IF EXISTS "Master admins manage cal_event_types_cache" ON public.cal_event_types_cache;
DROP POLICY IF EXISTS "Master only — email_send_log" ON public.email_send_log;
DROP POLICY IF EXISTS "Master admins manage all subscriptions" ON public.subscriptions;

-- ============================================================
-- PARTE 2: Adicionar RLS em scheduled_jobs (ainda sem policy)
-- ============================================================

ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view scheduled_jobs" ON public.scheduled_jobs
  FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR public.is_org_member(auth.uid(), organization_id)
  );

CREATE POLICY "Org members manage scheduled_jobs" ON public.scheduled_jobs
  FOR ALL TO authenticated
  USING (
    organization_id IS NULL
    OR public.is_org_member(auth.uid(), organization_id)
  )
  WITH CHECK (
    organization_id IS NULL
    OR public.is_org_member(auth.uid(), organization_id)
  );

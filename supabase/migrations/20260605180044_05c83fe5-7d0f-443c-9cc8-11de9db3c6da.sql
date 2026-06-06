
-- Pipedrive sync support
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS pipedrive_person_id bigint;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS pipedrive_deal_id bigint;
ALTER TABLE public.lead_activities ADD COLUMN IF NOT EXISTS pipedrive_activity_id bigint;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_leads_pipedrive_person
  ON public.leads (organization_id, pipedrive_person_id)
  WHERE pipedrive_person_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_deals_pipedrive_deal
  ON public.deals (organization_id, pipedrive_deal_id)
  WHERE pipedrive_deal_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_lead_activities_pipedrive_activity
  ON public.lead_activities (organization_id, pipedrive_activity_id)
  WHERE pipedrive_activity_id IS NOT NULL;

CREATE TABLE public.pipedrive_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'running',
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipedrive_sync_runs TO authenticated;
GRANT ALL ON public.pipedrive_sync_runs TO service_role;

ALTER TABLE public.pipedrive_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master admins manage all pipedrive_sync_runs"
  ON public.pipedrive_sync_runs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master_admin'::app_role));

CREATE POLICY "Org members view pipedrive_sync_runs"
  ON public.pipedrive_sync_runs FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins manage pipedrive_sync_runs"
  ON public.pipedrive_sync_runs FOR ALL TO authenticated
  USING (is_org_member(auth.uid(), organization_id) AND has_role(auth.uid(), 'company_admin'::app_role))
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND has_role(auth.uid(), 'company_admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_pipedrive_sync_runs_org_started
  ON public.pipedrive_sync_runs (organization_id, started_at DESC);

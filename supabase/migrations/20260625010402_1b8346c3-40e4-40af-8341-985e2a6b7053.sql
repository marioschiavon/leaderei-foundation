CREATE TABLE IF NOT EXISTS public.lead_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  website_url text,
  insights jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_summary text,
  analyzed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_insights_org ON public.lead_insights (organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_insights TO authenticated;
GRANT ALL ON public.lead_insights TO service_role;

ALTER TABLE public.lead_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view lead_insights" ON public.lead_insights
  FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members manage lead_insights" ON public.lead_insights
  FOR ALL TO authenticated
  USING (is_org_member(auth.uid(), organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id));
-- 1) apollo_api_calls
CREATE TABLE public.apollo_api_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  status_code integer,
  credits_consumed integer,
  latency_ms integer,
  request_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_apollo_calls_org_created ON public.apollo_api_calls (organization_id, created_at DESC);
CREATE INDEX idx_apollo_calls_org_endpoint ON public.apollo_api_calls (organization_id, endpoint);

GRANT SELECT ON public.apollo_api_calls TO authenticated;
GRANT ALL ON public.apollo_api_calls TO service_role;

ALTER TABLE public.apollo_api_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read apollo calls"
  ON public.apollo_api_calls FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Master admins read all apollo calls"
  ON public.apollo_api_calls FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'master_admin'::app_role));

-- 2) apollo_search_cache
CREATE TABLE public.apollo_search_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  query_hash text NOT NULL,
  filters jsonb NOT NULL,
  results jsonb NOT NULL,
  total_entries integer,
  page integer NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, query_hash, page)
);
CREATE INDEX idx_apollo_cache_expires ON public.apollo_search_cache (expires_at);
CREATE INDEX idx_apollo_cache_org ON public.apollo_search_cache (organization_id);

GRANT SELECT ON public.apollo_search_cache TO authenticated;
GRANT ALL ON public.apollo_search_cache TO service_role;

ALTER TABLE public.apollo_search_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read apollo cache"
  ON public.apollo_search_cache FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

-- 3) leads: vínculo com Apollo
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS apollo_person_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_apollo_person
  ON public.leads (organization_id, apollo_person_id)
  WHERE apollo_person_id IS NOT NULL;

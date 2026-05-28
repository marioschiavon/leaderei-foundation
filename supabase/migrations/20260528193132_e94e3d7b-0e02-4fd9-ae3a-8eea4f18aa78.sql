
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS employee_count integer,
  ADD COLUMN IF NOT EXISTS seniority text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS mobile_phone text,
  ADD COLUMN IF NOT EXISTS corporate_phone text,
  ADD COLUMN IF NOT EXISTS secondary_email text,
  ADD COLUMN IF NOT EXISTS personal_email text,
  ADD COLUMN IF NOT EXISTS enrichment_data jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_leads_org_industry
  ON public.leads (organization_id, industry)
  WHERE industry IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_org_country
  ON public.leads (organization_id, country)
  WHERE country IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_enrichment_gin
  ON public.leads USING GIN (enrichment_data);

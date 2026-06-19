CREATE TABLE public.lead_website_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL UNIQUE,
  content text NOT NULL,
  content_length int NOT NULL,
  scraped_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX idx_lead_website_cache_url ON public.lead_website_cache (url);
CREATE INDEX idx_lead_website_cache_expires ON public.lead_website_cache (expires_at);

GRANT ALL ON public.lead_website_cache TO service_role;

ALTER TABLE public.lead_website_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access lead_website_cache"
  ON public.lead_website_cache FOR ALL TO authenticated USING (false) WITH CHECK (false);

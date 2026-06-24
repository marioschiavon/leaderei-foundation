ALTER TABLE public.ai_org_profile
  ADD COLUMN IF NOT EXISTS website_indexed_at timestamptz,
  ADD COLUMN IF NOT EXISTS website_index_status text,
  ADD COLUMN IF NOT EXISTS website_index_error text,
  ADD COLUMN IF NOT EXISTS website_content_length integer,
  ADD COLUMN IF NOT EXISTS website_preview text;
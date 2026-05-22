ALTER TABLE public.builder_documents RENAME COLUMN document TO schema;
ALTER TABLE public.builder_documents ADD COLUMN IF NOT EXISTS campaign_id uuid NULL;
CREATE INDEX IF NOT EXISTS idx_builder_documents_campaign_id ON public.builder_documents(campaign_id);
CREATE INDEX IF NOT EXISTS idx_builder_documents_org_id ON public.builder_documents(organization_id);
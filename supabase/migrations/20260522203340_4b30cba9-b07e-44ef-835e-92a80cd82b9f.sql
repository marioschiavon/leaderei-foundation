-- Pipeline deals
CREATE TYPE public.deal_stage AS ENUM ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost');
CREATE TYPE public.deal_status AS ENUM ('open', 'won', 'lost');

CREATE TABLE public.deals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  owner_user_id uuid,
  title text NOT NULL,
  stage public.deal_stage NOT NULL DEFAULT 'lead',
  status public.deal_status NOT NULL DEFAULT 'open',
  value numeric DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  probability integer NOT NULL DEFAULT 0,
  expected_close_at timestamptz,
  closed_at timestamptz,
  notes text,
  position integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_deals_org_stage ON public.deals(organization_id, stage);
CREATE INDEX idx_deals_lead ON public.deals(lead_id);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master admins manage all deals" ON public.deals
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master_admin'::app_role));

CREATE POLICY "Org members view deals" ON public.deals
  FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members manage deals" ON public.deals
  FOR ALL TO authenticated
  USING (is_org_member(auth.uid(), organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- API keys
CREATE TABLE public.api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_org ON public.api_keys(organization_id);
CREATE UNIQUE INDEX idx_api_keys_hash ON public.api_keys(key_hash);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master admins manage all api_keys" ON public.api_keys
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master_admin'::app_role));

CREATE POLICY "Org members view api_keys" ON public.api_keys
  FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins manage api_keys" ON public.api_keys
  FOR ALL TO authenticated
  USING (is_org_member(auth.uid(), organization_id) AND has_role(auth.uid(), 'company_admin'::app_role))
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND has_role(auth.uid(), 'company_admin'::app_role));

CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Builder documents
CREATE TABLE public.builder_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  document jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_builder_documents_org ON public.builder_documents(organization_id);

ALTER TABLE public.builder_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master admins manage all builder_documents" ON public.builder_documents
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master_admin'::app_role));

CREATE POLICY "Org members view builder_documents" ON public.builder_documents
  FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members manage builder_documents" ON public.builder_documents
  FOR ALL TO authenticated
  USING (is_org_member(auth.uid(), organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE TRIGGER update_builder_documents_updated_at
  BEFORE UPDATE ON public.builder_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
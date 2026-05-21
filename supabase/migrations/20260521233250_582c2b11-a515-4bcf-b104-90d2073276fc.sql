
-- =========================================================================
-- MIGRATION 1/3: Foundation (multi-tenant rename) + CRM domain
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Rename companies -> organizations
-- -------------------------------------------------------------------------
ALTER TABLE public.companies RENAME TO organizations;
ALTER TYPE public.company_status RENAME TO organization_status;

-- Extend organizations
ALTER TABLE public.organizations
  ADD COLUMN owner_user_id uuid,
  ADD COLUMN billing_email text,
  ADD COLUMN industry text,
  ADD COLUMN country text,
  ADD COLUMN timezone text NOT NULL DEFAULT 'UTC',
  ADD COLUMN default_locale text NOT NULL DEFAULT 'pt-BR',
  ADD COLUMN trial_ends_at timestamptz,
  ADD COLUMN deleted_at timestamptz;

-- -------------------------------------------------------------------------
-- 2. Rename company_members -> organization_members
-- -------------------------------------------------------------------------
ALTER TABLE public.company_members RENAME TO organization_members;
ALTER TABLE public.organization_members RENAME COLUMN company_id TO organization_id;

-- Drop old policies (we'll recreate with new names)
DROP POLICY IF EXISTS "Company admins manage own company members" ON public.organization_members;
DROP POLICY IF EXISTS "Master admins manage all members" ON public.organization_members;
DROP POLICY IF EXISTS "Members view own company members" ON public.organization_members;
DROP POLICY IF EXISTS "Master admins manage companies" ON public.organizations;
DROP POLICY IF EXISTS "Members view own company" ON public.organizations;

-- New member_status enum
CREATE TYPE public.member_status AS ENUM ('active', 'invited', 'suspended');

ALTER TABLE public.organization_members
  ADD COLUMN status public.member_status NOT NULL DEFAULT 'active',
  ADD COLUMN invited_by uuid,
  ADD COLUMN joined_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- Foreign key + uniqueness
ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_org_fk
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_unique_user_per_org
    UNIQUE (organization_id, user_id);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);

-- -------------------------------------------------------------------------
-- 3. Rename helper function
-- -------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_user_company_id(uuid);

CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members
  WHERE user_id = _user_id AND status = 'active'
  ORDER BY joined_at ASC
  LIMIT 1
$$;

-- Helper: is user member of given org?
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id AND status = 'active'
  )
$$;

-- -------------------------------------------------------------------------
-- 4. Recreate RLS policies on organizations + organization_members
-- -------------------------------------------------------------------------
CREATE POLICY "Members view own organization"
  ON public.organizations FOR SELECT TO authenticated
  USING (id = public.get_user_org_id(auth.uid()) OR public.is_org_member(auth.uid(), id));

CREATE POLICY "Master admins manage organizations"
  ON public.organizations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'master_admin'));

CREATE POLICY "Members view own organization members"
  ON public.organization_members FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins manage own org members"
  ON public.organization_members FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) AND public.has_role(auth.uid(), 'company_admin'))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id) AND public.has_role(auth.uid(), 'company_admin'));

CREATE POLICY "Master admins manage all org members"
  ON public.organization_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'master_admin'));

-- updated_at trigger for organization_members
CREATE TRIGGER trg_org_members_updated_at
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -------------------------------------------------------------------------
-- 5. CRM enums
-- -------------------------------------------------------------------------
CREATE TYPE public.lead_status AS ENUM (
  'new', 'contacted', 'qualified', 'proposal', 'won', 'lost', 'archived'
);

CREATE TYPE public.lead_temperature AS ENUM ('cold', 'warm', 'hot');

CREATE TYPE public.lead_activity_type AS ENUM (
  'note', 'status_change', 'email_sent', 'email_received',
  'call', 'meeting', 'message_sent', 'message_received',
  'enrichment', 'system'
);

-- -------------------------------------------------------------------------
-- 6. lead_sources
-- -------------------------------------------------------------------------
CREATE TABLE public.lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  color text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);

CREATE INDEX idx_lead_sources_org ON public.lead_sources(organization_id);

ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view lead sources"
  ON public.lead_sources FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members manage lead sources"
  ON public.lead_sources FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Master admins manage all lead sources"
  ON public.lead_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'master_admin'));

CREATE TRIGGER trg_lead_sources_updated_at
  BEFORE UPDATE ON public.lead_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -------------------------------------------------------------------------
-- 7. leads
-- -------------------------------------------------------------------------
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.lead_sources(id) ON DELETE SET NULL,
  owner_user_id uuid,
  full_name text NOT NULL,
  email text,
  phone text,
  company_name text,
  job_title text,
  linkedin_url text,
  website_url text,
  city text,
  country text,
  status public.lead_status NOT NULL DEFAULT 'new',
  temperature public.lead_temperature NOT NULL DEFAULT 'cold',
  score integer NOT NULL DEFAULT 0,
  estimated_value numeric(14,2),
  currency text NOT NULL DEFAULT 'BRL',
  tags text[] NOT NULL DEFAULT '{}',
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_contact_at timestamptz,
  next_followup_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX idx_leads_org ON public.leads(organization_id);
CREATE INDEX idx_leads_status ON public.leads(organization_id, status);
CREATE INDEX idx_leads_owner ON public.leads(owner_user_id);
CREATE INDEX idx_leads_email ON public.leads(organization_id, email);
CREATE INDEX idx_leads_tags ON public.leads USING gin(tags);
CREATE INDEX idx_leads_custom ON public.leads USING gin(custom_fields);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view leads"
  ON public.leads FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members manage leads"
  ON public.leads FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Master admins manage all leads"
  ON public.leads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'master_admin'));

CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -------------------------------------------------------------------------
-- 8. lead_activities
-- -------------------------------------------------------------------------
CREATE TABLE public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  author_user_id uuid,
  type public.lead_activity_type NOT NULL,
  title text NOT NULL,
  description text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_activities_lead ON public.lead_activities(lead_id, created_at DESC);
CREATE INDEX idx_lead_activities_org ON public.lead_activities(organization_id);

ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view lead activities"
  ON public.lead_activities FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members manage lead activities"
  ON public.lead_activities FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Master admins manage all lead activities"
  ON public.lead_activities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'master_admin'));

-- -------------------------------------------------------------------------
-- 9. lead_enrichment
-- -------------------------------------------------------------------------
CREATE TABLE public.lead_enrichment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  provider text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric(5,2),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_enrichment_lead ON public.lead_enrichment(lead_id);
CREATE INDEX idx_lead_enrichment_org ON public.lead_enrichment(organization_id);

ALTER TABLE public.lead_enrichment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view lead enrichment"
  ON public.lead_enrichment FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members manage lead enrichment"
  ON public.lead_enrichment FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Master admins manage all lead enrichment"
  ON public.lead_enrichment FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'master_admin'));

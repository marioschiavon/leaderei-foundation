
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.campaign_status AS ENUM ('draft','scheduled','running','paused','completed','archived');
CREATE TYPE public.campaign_channel AS ENUM ('whatsapp','email','linkedin','sms','multi');
CREATE TYPE public.flow_node_type AS ENUM (
  'trigger','send_message','wait','condition','action','ai_step','enrich','tag','end'
);
CREATE TYPE public.enrollment_status AS ENUM ('pending','active','paused','completed','failed','cancelled');
CREATE TYPE public.conversation_status AS ENUM ('open','pending','snoozed','closed');
CREATE TYPE public.message_direction AS ENUM ('inbound','outbound');
CREATE TYPE public.message_status AS ENUM ('queued','sending','sent','delivered','read','failed');
CREATE TYPE public.message_channel AS ENUM ('whatsapp','email','linkedin','sms','internal');
CREATE TYPE public.integration_status AS ENUM ('disconnected','connected','error','pending');

-- ============================================================
-- CAMPAIGNS
-- ============================================================
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  objective text,
  channel public.campaign_channel NOT NULL DEFAULT 'whatsapp',
  status public.campaign_status NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  daily_send_limit integer,
  total_enrolled integer NOT NULL DEFAULT 0,
  total_sent integer NOT NULL DEFAULT 0,
  total_replied integer NOT NULL DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaigns_org ON public.campaigns(organization_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(organization_id, status);

-- ============================================================
-- FLOW DEFINITIONS / NODES / EDGES
-- ============================================================
CREATE TABLE public.flow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  version integer NOT NULL DEFAULT 1,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  graph jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_flow_def_org ON public.flow_definitions(organization_id);
CREATE INDEX idx_flow_def_campaign ON public.flow_definitions(campaign_id);

CREATE TABLE public.flow_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  flow_definition_id uuid NOT NULL REFERENCES public.flow_definitions(id) ON DELETE CASCADE,
  node_key text NOT NULL,
  type public.flow_node_type NOT NULL,
  label text,
  position_x numeric NOT NULL DEFAULT 0,
  position_y numeric NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flow_definition_id, node_key)
);
CREATE INDEX idx_flow_nodes_flow ON public.flow_nodes(flow_definition_id);

CREATE TABLE public.flow_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  flow_definition_id uuid NOT NULL REFERENCES public.flow_definitions(id) ON DELETE CASCADE,
  source_node_id uuid NOT NULL REFERENCES public.flow_nodes(id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL REFERENCES public.flow_nodes(id) ON DELETE CASCADE,
  condition_label text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_flow_edges_flow ON public.flow_edges(flow_definition_id);

-- ============================================================
-- CAMPAIGN ENROLLMENTS
-- ============================================================
CREATE TABLE public.campaign_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  flow_definition_id uuid REFERENCES public.flow_definitions(id) ON DELETE SET NULL,
  current_node_id uuid REFERENCES public.flow_nodes(id) ON DELETE SET NULL,
  status public.enrollment_status NOT NULL DEFAULT 'pending',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  next_run_at timestamptz,
  completed_at timestamptz,
  last_error text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, lead_id)
);
CREATE INDEX idx_enrollments_org ON public.campaign_enrollments(organization_id);
CREATE INDEX idx_enrollments_status ON public.campaign_enrollments(organization_id, status);
CREATE INDEX idx_enrollments_next_run ON public.campaign_enrollments(next_run_at) WHERE status = 'active';

-- ============================================================
-- CONVERSATIONS / MESSAGES / HANDOFF
-- ============================================================
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  channel public.message_channel NOT NULL,
  external_thread_id text,
  subject text,
  status public.conversation_status NOT NULL DEFAULT 'open',
  assigned_user_id uuid,
  ai_enabled boolean NOT NULL DEFAULT true,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_conv_org ON public.conversations(organization_id);
CREATE INDEX idx_conv_lead ON public.conversations(lead_id);
CREATE INDEX idx_conv_status ON public.conversations(organization_id, status);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  channel public.message_channel NOT NULL,
  direction public.message_direction NOT NULL,
  status public.message_status NOT NULL DEFAULT 'queued',
  body text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  external_message_id text,
  sender_user_id uuid,
  sent_by_ai boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conv ON public.messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_org ON public.messages(organization_id);

CREATE TABLE public.handoff_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  from_mode text NOT NULL,
  to_mode text NOT NULL,
  reason text,
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_handoff_conv ON public.handoff_events(conversation_id);

-- ============================================================
-- INTEGRATIONS
-- ============================================================
CREATE TABLE public.integration_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  description text,
  logo_url text,
  is_active boolean NOT NULL DEFAULT true,
  config_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.organization_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.integration_providers(id) ON DELETE RESTRICT,
  display_name text,
  status public.integration_status NOT NULL DEFAULT 'pending',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz,
  last_error text,
  connected_by uuid,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider_id, display_name)
);
CREATE INDEX idx_org_integrations_org ON public.organization_integrations(organization_id);

CREATE TABLE public.integration_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.organization_integrations(id) ON DELETE CASCADE,
  key text NOT NULL,
  value_encrypted text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, key)
);
CREATE INDEX idx_integration_creds_org ON public.integration_credentials(organization_id);

-- ============================================================
-- TRIGGERS (updated_at)
-- ============================================================
CREATE TRIGGER tg_campaigns_updated BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tg_flow_def_updated BEFORE UPDATE ON public.flow_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tg_flow_nodes_updated BEFORE UPDATE ON public.flow_nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tg_enrollments_updated BEFORE UPDATE ON public.campaign_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tg_conv_updated BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tg_org_integrations_updated BEFORE UPDATE ON public.organization_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tg_integration_creds_updated BEFORE UPDATE ON public.integration_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tg_integration_providers_updated BEFORE UPDATE ON public.integration_providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handoff_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;

-- Generic org-scoped policies (members manage own org rows; master admin manages all)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'campaigns','flow_definitions','flow_nodes','flow_edges',
    'campaign_enrollments','conversations','messages','handoff_events',
    'organization_integrations'
  ]
  LOOP
    EXECUTE format($f$
      CREATE POLICY "Org members view %1$s" ON public.%1$I
        FOR SELECT TO authenticated
        USING (public.is_org_member(auth.uid(), organization_id));
      CREATE POLICY "Org members manage %1$s" ON public.%1$I
        FOR ALL TO authenticated
        USING (public.is_org_member(auth.uid(), organization_id))
        WITH CHECK (public.is_org_member(auth.uid(), organization_id));
      CREATE POLICY "Master admins manage all %1$s" ON public.%1$I
        FOR ALL TO authenticated
        USING (public.has_role(auth.uid(), 'master_admin'::public.app_role))
        WITH CHECK (public.has_role(auth.uid(), 'master_admin'::public.app_role));
    $f$, t);
  END LOOP;
END $$;

-- integration_providers: global catalog
CREATE POLICY "Authenticated read providers" ON public.integration_providers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Master admins manage providers" ON public.integration_providers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'master_admin'::public.app_role));

-- integration_credentials: admin-only within org
CREATE POLICY "Org admins manage integration credentials" ON public.integration_credentials
  FOR ALL TO authenticated
  USING (
    public.is_org_member(auth.uid(), organization_id)
    AND public.has_role(auth.uid(), 'company_admin'::public.app_role)
  )
  WITH CHECK (
    public.is_org_member(auth.uid(), organization_id)
    AND public.has_role(auth.uid(), 'company_admin'::public.app_role)
  );
CREATE POLICY "Master admins manage all integration credentials" ON public.integration_credentials
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'master_admin'::public.app_role));

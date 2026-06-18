
CREATE TABLE public.agent_action_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  auto_execute boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_action_rules_action_type_check CHECK (
    action_type IN ('responder','oferecer_horarios','confirmar_agendamento','marcar_quente_humano','encerrar_cadencia','ignorar')
  )
);

CREATE UNIQUE INDEX agent_action_rules_org_action_unique
  ON public.agent_action_rules (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), action_type);

GRANT ALL ON public.agent_action_rules TO service_role;
ALTER TABLE public.agent_action_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct client access agent_action_rules"
  ON public.agent_action_rules FOR ALL TO authenticated USING (false) WITH CHECK (false);

INSERT INTO public.agent_action_rules (organization_id, action_type, auto_execute) VALUES
  (NULL, 'responder',              true),
  (NULL, 'oferecer_horarios',      false),
  (NULL, 'confirmar_agendamento',  false),
  (NULL, 'marcar_quente_humano',   true),
  (NULL, 'encerrar_cadencia',      false),
  (NULL, 'ignorar',                true);

CREATE TABLE public.agent_action_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  action_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  executed_at timestamptz,
  CONSTRAINT agent_action_queue_status_check
    CHECK (status IN ('pending','approved','cancelled','executed','failed'))
);

CREATE INDEX idx_agent_action_queue_pending
  ON public.agent_action_queue (organization_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX idx_agent_action_queue_org
  ON public.agent_action_queue (organization_id, created_at DESC);

GRANT ALL ON public.agent_action_queue TO service_role;
ALTER TABLE public.agent_action_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct client access agent_action_queue"
  ON public.agent_action_queue FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE TRIGGER update_agent_action_rules_updated_at
  BEFORE UPDATE ON public.agent_action_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

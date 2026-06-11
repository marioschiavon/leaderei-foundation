
-- 1) Novo campo no perfil de IA: objetivo do agente de conversa
ALTER TABLE public.ai_org_profile
  ADD COLUMN IF NOT EXISTS conversation_agent_goal text;

-- 2) Flags do agente em conversations
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS needs_human boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_human_reason text,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agent_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agent_context jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_conversations_needs_human
  ON public.conversations (organization_id) WHERE needs_human = true;

-- 3) Marcador opcional de origem em messages (humano vs agente).
-- Reaproveita sent_by_ai (boolean já existente). Sem nova coluna.

-- 4) Função de debounce para agendar resposta do agente.
CREATE OR REPLACE FUNCTION public.schedule_agent_response(
  _organization_id uuid,
  _conversation_id uuid,
  _lead_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  -- somente service_role pode chamar (webhook hook7 usa service role)
  IF v_role <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.scheduled_jobs
  SET run_at = now() + interval '25 seconds',
      updated_at = now()
  WHERE kind = 'agent_respond'
    AND status = 'pending'
    AND payload->>'conversation_id' = _conversation_id::text;

  IF NOT FOUND THEN
    INSERT INTO public.scheduled_jobs (organization_id, kind, payload, run_at, status, scope, max_attempts)
    VALUES (
      _organization_id,
      'agent_respond',
      jsonb_build_object(
        'conversation_id', _conversation_id,
        'lead_id', _lead_id,
        'organization_id', _organization_id
      ),
      now() + interval '25 seconds',
      'pending',
      'org',
      3
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.schedule_agent_response(uuid, uuid, uuid) TO service_role;

-- 5) Agenda o pg_cron para chamar o endpoint agent-tick a cada minuto.
DO $$
DECLARE
  v_url text := 'https://leaderei.lovable.app/api/public/hooks/agent-tick';
  v_apikey text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lZGx2Z2V5bmVhcW9rdXBxb3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzAzMDMsImV4cCI6MjA5NDk0NjMwM30.Y14MFAm7kQoigxkCGykRoinQXtxt4jWoApYgAkIKpyk';
BEGIN
  PERFORM cron.unschedule('leaderei-agent-tick') FROM cron.job WHERE jobname = 'leaderei-agent-tick';

  PERFORM cron.schedule(
    'leaderei-agent-tick',
    '* * * * *',
    format(
      $f$ select net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb); $f$,
      v_url,
      jsonb_build_object('Content-Type','application/json','apikey', v_apikey)::text
    )
  );
END $$;

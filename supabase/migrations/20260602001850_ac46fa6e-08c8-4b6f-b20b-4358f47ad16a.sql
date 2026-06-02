
-- 1) campaign_enrollments: apontar para o schema do Builder
ALTER TABLE public.campaign_enrollments
  ADD COLUMN IF NOT EXISTS document_id uuid REFERENCES public.builder_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_step_id uuid REFERENCES public.flow_steps(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_doc ON public.campaign_enrollments(document_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_due ON public.campaign_enrollments(next_run_at) WHERE status = 'active';

-- 2) scheduled_jobs: ligar com enrollment + identificar jobs do executor
ALTER TABLE public.scheduled_jobs
  ADD COLUMN IF NOT EXISTS enrollment_id uuid REFERENCES public.campaign_enrollments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_flow ON public.scheduled_jobs(run_at)
  WHERE status = 'pending' AND kind = 'flow_step';

-- 3) tabela de auditoria das execuções
DO $$ BEGIN
  CREATE TYPE public.flow_step_run_status AS ENUM ('pending','running','done','failed','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.flow_step_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enrollment_id   uuid NOT NULL REFERENCES public.campaign_enrollments(id) ON DELETE CASCADE,
  step_id         uuid NOT NULL REFERENCES public.flow_steps(id) ON DELETE CASCADE,
  status          public.flow_step_run_status NOT NULL DEFAULT 'pending',
  branch_taken    text,
  output          jsonb NOT NULL DEFAULT '{}'::jsonb,
  error           text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_step_runs_enrollment ON public.flow_step_runs(enrollment_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_step_runs_org ON public.flow_step_runs(organization_id, started_at DESC);

GRANT SELECT ON public.flow_step_runs TO authenticated;
GRANT ALL ON public.flow_step_runs TO service_role;

ALTER TABLE public.flow_step_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master admins manage all flow_step_runs"
  ON public.flow_step_runs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master_admin'::app_role));

CREATE POLICY "Org members view flow_step_runs"
  ON public.flow_step_runs FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

-- 4) helper: dias úteis
CREATE OR REPLACE FUNCTION public.add_business_days(_ts timestamptz, _days int)
RETURNS timestamptz
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v timestamptz := _ts;
  remaining int := _days;
BEGIN
  WHILE remaining > 0 LOOP
    v := v + interval '1 day';
    -- 1=Mon..7=Sun (ISODOW). Pula sáb (6) e dom (7)
    IF extract(isodow from v) < 6 THEN
      remaining := remaining - 1;
    END IF;
  END LOOP;
  RETURN v;
END;
$$;

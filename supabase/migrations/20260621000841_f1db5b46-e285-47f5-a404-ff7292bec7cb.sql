
-- Add organization_id to flow_steps
ALTER TABLE public.flow_steps ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE public.flow_steps fs
SET organization_id = d.organization_id
FROM public.builder_documents d
WHERE fs.document_id = d.id AND fs.organization_id IS NULL;
ALTER TABLE public.flow_steps ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.flow_steps
  ADD CONSTRAINT flow_steps_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS flow_steps_org_idx ON public.flow_steps(organization_id);

DROP POLICY IF EXISTS "Org members manage flow_steps" ON public.flow_steps;
CREATE POLICY "Org members manage flow_steps" ON public.flow_steps
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- Add organization_id to flow_transitions
ALTER TABLE public.flow_transitions ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE public.flow_transitions ft
SET organization_id = d.organization_id
FROM public.builder_documents d
WHERE ft.document_id = d.id AND ft.organization_id IS NULL;
ALTER TABLE public.flow_transitions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.flow_transitions
  ADD CONSTRAINT flow_transitions_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS flow_transitions_org_idx ON public.flow_transitions(organization_id);

DROP POLICY IF EXISTS "Org members manage flow_transitions" ON public.flow_transitions;
CREATE POLICY "Org members manage flow_transitions" ON public.flow_transitions
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- Triggers to keep organization_id consistent with parent builder_documents
CREATE OR REPLACE FUNCTION public.set_flow_child_org_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.builder_documents WHERE id = NEW.document_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'builder_documents % not found', NEW.document_id;
  END IF;
  NEW.organization_id := v_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS flow_steps_set_org_id ON public.flow_steps;
CREATE TRIGGER flow_steps_set_org_id
  BEFORE INSERT OR UPDATE OF document_id ON public.flow_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_flow_child_org_id();

DROP TRIGGER IF EXISTS flow_transitions_set_org_id ON public.flow_transitions;
CREATE TRIGGER flow_transitions_set_org_id
  BEFORE INSERT OR UPDATE OF document_id ON public.flow_transitions
  FOR EACH ROW EXECUTE FUNCTION public.set_flow_child_org_id();

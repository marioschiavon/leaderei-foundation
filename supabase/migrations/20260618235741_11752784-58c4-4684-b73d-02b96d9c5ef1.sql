
CREATE TABLE public.lead_memory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  category text NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  source text NOT NULL DEFAULT 'agente',
  confidence float,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_memory_items_category_check
    CHECK (category IN ('contato','empresa','intencao','nota_manual')),
  CONSTRAINT lead_memory_items_source_check
    CHECK (source IN ('agente','master_manual'))
);

CREATE INDEX idx_lead_memory_lead
  ON public.lead_memory_items (lead_id, category)
  WHERE archived_at IS NULL;

CREATE INDEX idx_lead_memory_org
  ON public.lead_memory_items (organization_id, created_at DESC)
  WHERE archived_at IS NULL;

GRANT SELECT ON public.lead_memory_items TO authenticated;
GRANT ALL ON public.lead_memory_items TO service_role;

ALTER TABLE public.lead_memory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read lead_memory_items"
  ON public.lead_memory_items FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "No direct insert lead_memory_items"
  ON public.lead_memory_items FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No direct update lead_memory_items"
  ON public.lead_memory_items FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "No direct delete lead_memory_items"
  ON public.lead_memory_items FOR DELETE TO authenticated
  USING (false);

CREATE TRIGGER update_lead_memory_items_updated_at
  BEFORE UPDATE ON public.lead_memory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

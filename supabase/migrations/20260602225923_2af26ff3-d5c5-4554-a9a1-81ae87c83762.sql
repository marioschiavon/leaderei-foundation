-- Provider seed
INSERT INTO public.integration_providers (slug, name, category, description, is_active, config_schema)
VALUES ('cal_com', 'Cal.com', 'scheduling', 'Agendamento de reuniões via Cal.com API v2', true, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description, is_active = true;

-- Enum status
DO $$ BEGIN
  CREATE TYPE public.lead_booking_status AS ENUM ('confirmed','rescheduled','cancelled','no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- lead_bookings
CREATE TABLE IF NOT EXISTS public.lead_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  campaign_id uuid,
  enrollment_id uuid,
  cal_booking_id text,
  cal_booking_uid text NOT NULL,
  event_type_id bigint,
  event_type_slug text,
  title text,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  attendee_email text,
  attendee_name text,
  organizer_email text,
  meeting_url text,
  location text,
  status public.lead_booking_status NOT NULL DEFAULT 'confirmed',
  reschedule_count integer NOT NULL DEFAULT 0,
  cancellation_reason text,
  rescheduled_from_uid text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lead_bookings_cal_uid_uniq ON public.lead_bookings(cal_booking_uid);
CREATE INDEX IF NOT EXISTS lead_bookings_org_status_idx ON public.lead_bookings(organization_id, status);
CREATE INDEX IF NOT EXISTS lead_bookings_lead_idx ON public.lead_bookings(lead_id);
CREATE INDEX IF NOT EXISTS lead_bookings_campaign_idx ON public.lead_bookings(campaign_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_bookings TO authenticated;
GRANT ALL ON public.lead_bookings TO service_role;

ALTER TABLE public.lead_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master admins manage all lead_bookings"
  ON public.lead_bookings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master_admin'::app_role));

CREATE POLICY "Org members view lead_bookings"
  ON public.lead_bookings FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members manage lead_bookings"
  ON public.lead_bookings FOR ALL TO authenticated
  USING (is_org_member(auth.uid(), organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE TRIGGER update_lead_bookings_updated_at
  BEFORE UPDATE ON public.lead_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- cal_event_types_cache
CREATE TABLE IF NOT EXISTS public.cal_event_types_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  cal_event_type_id bigint NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  length_minutes integer,
  scheduling_type text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cal_event_types_org_eventtype_uniq
  ON public.cal_event_types_cache(organization_id, cal_event_type_id);
CREATE INDEX IF NOT EXISTS cal_event_types_org_idx ON public.cal_event_types_cache(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cal_event_types_cache TO authenticated;
GRANT ALL ON public.cal_event_types_cache TO service_role;

ALTER TABLE public.cal_event_types_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master admins manage cal_event_types_cache"
  ON public.cal_event_types_cache FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master_admin'::app_role));

CREATE POLICY "Org members view cal_event_types_cache"
  ON public.cal_event_types_cache FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members manage cal_event_types_cache"
  ON public.cal_event_types_cache FOR ALL TO authenticated
  USING (is_org_member(auth.uid(), organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id));
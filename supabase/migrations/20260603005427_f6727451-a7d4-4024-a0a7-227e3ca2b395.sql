CREATE TABLE public.webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  event_type text,
  organization_id uuid,
  instance_id uuid,
  cal_booking_uid text,
  status text NOT NULL DEFAULT 'received',
  http_status integer,
  error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master admins manage webhook_events"
  ON public.webhook_events
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'master_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master_admin'::app_role));

CREATE INDEX idx_webhook_events_received_at ON public.webhook_events (received_at DESC);
CREATE INDEX idx_webhook_events_source_received_at ON public.webhook_events (source, received_at DESC);
CREATE INDEX idx_webhook_events_status ON public.webhook_events (status, received_at DESC);
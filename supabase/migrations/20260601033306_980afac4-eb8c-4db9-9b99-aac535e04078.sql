ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS external_message_id text,
  ADD COLUMN IF NOT EXISTS source_channel text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS whatsapp_status text,
  ADD COLUMN IF NOT EXISTS whatsapp_status_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_source_channel_check') THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_source_channel_check
      CHECK (source_channel IN ('email','whatsapp','manual','linkedin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_whatsapp_status_check') THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_whatsapp_status_check
      CHECK (whatsapp_status IN ('sent','delivered','read','failed') OR whatsapp_status IS NULL);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_external_message_id
  ON public.messages (external_message_id)
  WHERE external_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_channel
  ON public.messages (conversation_id, source_channel);

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_reason text;

CREATE INDEX IF NOT EXISTS idx_leads_needs_review
  ON public.leads (organization_id) WHERE needs_review = true;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;
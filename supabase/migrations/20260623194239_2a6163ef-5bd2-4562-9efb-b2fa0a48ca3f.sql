-- ai_org_profile: instructions, highlights, website
ALTER TABLE public.ai_org_profile
  ADD COLUMN IF NOT EXISTS ai_instructions text,
  ADD COLUMN IF NOT EXISTS highlights text,
  ADD COLUMN IF NOT EXISTS website_url text;

-- knowledge_sources: content/file_path/title for direct injection
ALTER TABLE public.knowledge_sources
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS title text;

-- Enum values: text and file already exist; add 'document' for completeness if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'document'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'knowledge_source_kind')
  ) THEN
    ALTER TYPE public.knowledge_source_kind ADD VALUE 'document';
  END IF;
END $$;

-- Storage policies for knowledge-docs bucket (org-scoped folder: {org_id}/...)
CREATE POLICY "Org members read knowledge docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'knowledge-docs'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Org members write knowledge docs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'knowledge-docs'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Org members update knowledge docs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'knowledge-docs'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Org members delete knowledge docs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'knowledge-docs'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
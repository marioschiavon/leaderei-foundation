
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Vault secret for encryption passphrase (idempotent)
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'platform_encryption_key') INTO v_exists;
  IF NOT v_exists THEN
    PERFORM vault.create_secret(
      encode(gen_random_bytes(32), 'base64'),
      'platform_encryption_key',
      'Passphrase used to encrypt platform_settings.value_encrypted'
    );
  END IF;
END $$;

-- platform_settings
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value_encrypted bytea,
  value_plain jsonb,
  is_secret boolean NOT NULL DEFAULT false,
  description text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master only — platform_settings"
  ON public.platform_settings
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'master_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master_admin'::app_role));

-- email_send_log
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  purpose text NOT NULL CHECK (purpose IN ('invitation','welcome','password_reset','system_alert','campaign','inbox_reply')),
  provider text NOT NULL DEFAULT 'resend',
  from_email text NOT NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  template_key text,
  provider_message_id text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','bounced','delivered')),
  error_message text,
  triggered_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_log_org ON public.email_send_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_log_to ON public.email_send_log(to_email);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON public.email_send_log(status);
CREATE INDEX IF NOT EXISTS idx_email_log_created ON public.email_send_log(created_at DESC);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master only — email_send_log"
  ON public.email_send_log
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'master_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master_admin'::app_role));

-- Invitation last_sent_at
ALTER TABLE public.organization_invitations
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz;

-- Helper: read vault passphrase
CREATE OR REPLACE FUNCTION public._platform_passphrase()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE v text;
BEGIN
  SELECT decrypted_secret INTO v FROM vault.decrypted_secrets WHERE name = 'platform_encryption_key' LIMIT 1;
  IF v IS NULL THEN RAISE EXCEPTION 'platform_encryption_key not in vault'; END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public._platform_passphrase() FROM public, anon, authenticated;

-- set_platform_secret
CREATE OR REPLACE FUNCTION public.set_platform_secret(_key text, _value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'master_admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.platform_settings (key, value_encrypted, value_plain, is_secret, updated_by, updated_at)
  VALUES (_key, pgp_sym_encrypt(_value, public._platform_passphrase()), NULL, true, auth.uid(), now())
  ON CONFLICT (key) DO UPDATE SET
    value_encrypted = EXCLUDED.value_encrypted,
    value_plain = NULL,
    is_secret = true,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();
END;
$$;

-- get_platform_secret (master only OR service role calling via supabaseAdmin)
CREATE OR REPLACE FUNCTION public.get_platform_secret(_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_enc bytea;
  v_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  -- Allow if caller is master_admin (authenticated user) OR service_role
  IF NOT (
    (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'master_admin'::app_role))
    OR v_role = 'service_role'
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT value_encrypted INTO v_enc FROM public.platform_settings WHERE key = _key;
  IF v_enc IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_decrypt(v_enc, public._platform_passphrase());
END;
$$;

-- set_platform_plain
CREATE OR REPLACE FUNCTION public.set_platform_plain(_key text, _value jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'master_admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.platform_settings (key, value_plain, is_secret, updated_by, updated_at)
  VALUES (_key, _value, false, auth.uid(), now())
  ON CONFLICT (key) DO UPDATE SET
    value_plain = EXCLUDED.value_plain,
    is_secret = false,
    value_encrypted = NULL,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();
END;
$$;

-- get_platform_plain — readable by master OR service role
CREATE OR REPLACE FUNCTION public.get_platform_plain(_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
  v_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  IF NOT (
    (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'master_admin'::app_role))
    OR v_role = 'service_role'
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT value_plain INTO v FROM public.platform_settings WHERE key = _key;
  RETURN v;
END;
$$;

-- log_email_send
CREATE OR REPLACE FUNCTION public.log_email_send(
  _organization_id uuid,
  _purpose text,
  _from_email text,
  _to_email text,
  _subject text,
  _template_key text,
  _triggered_by uuid,
  _metadata jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := current_setting('request.jwt.claim.role', true);
  v_id uuid;
BEGIN
  -- Only service role (server) can write logs
  IF v_role <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.email_send_log (
    organization_id, purpose, from_email, to_email, subject,
    template_key, triggered_by, metadata, status
  ) VALUES (
    _organization_id, _purpose, _from_email, _to_email, _subject,
    _template_key, _triggered_by, COALESCE(_metadata, '{}'::jsonb), 'queued'
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- update_email_send_status
CREATE OR REPLACE FUNCTION public.update_email_send_status(
  _id uuid,
  _status text,
  _provider_message_id text,
  _error_message text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  IF v_role <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.email_send_log
  SET status = _status,
      provider_message_id = COALESCE(_provider_message_id, provider_message_id),
      error_message = _error_message
  WHERE id = _id;
END;
$$;

-- Seed initial settings (idempotent)
INSERT INTO public.platform_settings (key, value_plain, is_secret, description) VALUES
  ('resend_global_api_key', NULL, true, 'Resend API key para emails transacionais do produto')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.platform_settings (key, value_plain, is_secret, description) VALUES
  ('resend_global_from_email', '"leaderei@s7cloud.com.br"'::jsonb, false, 'Remetente dos emails transacionais'),
  ('resend_global_from_name', '"Leaderei"'::jsonb, false, 'Nome do remetente'),
  ('app_public_url', '""'::jsonb, false, 'URL base para links em emails'),
  ('logo_public_url', 'null'::jsonb, false, 'URL pública do logo para emails')
ON CONFLICT (key) DO NOTHING;

-- Storage bucket public-assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-assets', 'public-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read public-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'public-assets');

CREATE POLICY "Master write public-assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'public-assets' AND has_role(auth.uid(), 'master_admin'::app_role));

CREATE POLICY "Master update public-assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'public-assets' AND has_role(auth.uid(), 'master_admin'::app_role));


-- 1. platform_settings entries for Hook7
INSERT INTO public.platform_settings (key, value_plain, is_secret, description)
VALUES
  ('hook7_global_apikey', NULL, true, 'Apikey global do Hook7 (S7) para provisionar instâncias'),
  ('hook7_base_url', '"https://api.hook7.com.br"'::jsonb, false, 'Base URL da API Hook7')
ON CONFLICT (key) DO NOTHING;

-- 2. whatsapp_mode on organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS whatsapp_mode text NOT NULL DEFAULT 'shared';

DO $$ BEGIN
  ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_whatsapp_mode_check
    CHECK (whatsapp_mode IN ('shared', 'per_user'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. hook7_instances table
CREATE TABLE IF NOT EXISTS public.hook7_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  external_id text NOT NULL UNIQUE,
  external_name text NOT NULL UNIQUE,
  token_encrypted bytea NOT NULL,
  phone_number text,
  status text NOT NULL DEFAULT 'pending_qr',
  last_qr_at timestamptz,
  last_connected_at timestamptz,
  last_disconnected_at timestamptz,
  last_status_check_at timestamptz,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CONSTRAINT hook7_instances_status_check CHECK (
    status IN ('pending_qr','qr_ready','pairing','connected','disconnected','banned','error')
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hook7_instances TO authenticated;
GRANT ALL ON public.hook7_instances TO service_role;

ALTER TABLE public.hook7_instances ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_hook7_instances_org
  ON public.hook7_instances(organization_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hook7_instances_owner
  ON public.hook7_instances(owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hook7_instances_status
  ON public.hook7_instances(organization_id, status) WHERE archived_at IS NULL;

-- RLS
CREATE POLICY "Org members view hook7_instances"
  ON public.hook7_instances FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Master admins manage all hook7_instances"
  ON public.hook7_instances FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master_admin'::app_role));

CREATE POLICY "Org admins manage hook7_instances"
  ON public.hook7_instances FOR ALL TO authenticated
  USING (is_org_member(auth.uid(), organization_id) AND has_role(auth.uid(), 'company_admin'::app_role))
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND has_role(auth.uid(), 'company_admin'::app_role));

-- updated_at trigger
CREATE TRIGGER trg_hook7_instances_updated_at
  BEFORE UPDATE ON public.hook7_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Token encryption helpers (reuse platform passphrase pattern)
CREATE OR REPLACE FUNCTION public.set_hook7_instance_token(_instance_id uuid, _token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role text := current_setting('request.jwt.claim.role', true);
  v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.hook7_instances WHERE id = _instance_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'instance not found';
  END IF;

  IF NOT (
    v_role = 'service_role'
    OR has_role(auth.uid(), 'master_admin'::app_role)
    OR (is_org_member(auth.uid(), v_org) AND has_role(auth.uid(), 'company_admin'::app_role))
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.hook7_instances
  SET token_encrypted = pgp_sym_encrypt(_token, public._platform_passphrase()),
      updated_at = now()
  WHERE id = _instance_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_hook7_instance_token(_instance_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role text := current_setting('request.jwt.claim.role', true);
  v_org uuid;
  v_enc bytea;
BEGIN
  SELECT organization_id, token_encrypted INTO v_org, v_enc
  FROM public.hook7_instances WHERE id = _instance_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'instance not found';
  END IF;

  IF NOT (
    v_role = 'service_role'
    OR has_role(auth.uid(), 'master_admin'::app_role)
    OR (is_org_member(auth.uid(), v_org) AND has_role(auth.uid(), 'company_admin'::app_role))
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_enc IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_decrypt(v_enc, public._platform_passphrase());
END;
$$;


-- pgcrypto for api key hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============ organization_invitations ============
CREATE TABLE public.organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  token text NOT NULL UNIQUE,
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_invitations_org ON public.organization_invitations(organization_id);
CREATE INDEX idx_org_invitations_token ON public.organization_invitations(token);
CREATE INDEX idx_org_invitations_email ON public.organization_invitations(lower(email));

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master admins manage all invitations"
ON public.organization_invitations FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master_admin'))
WITH CHECK (has_role(auth.uid(), 'master_admin'));

CREATE POLICY "Org admins manage invitations"
ON public.organization_invitations FOR ALL TO authenticated
USING (is_org_member(auth.uid(), organization_id) AND has_role(auth.uid(), 'company_admin'))
WITH CHECK (is_org_member(auth.uid(), organization_id) AND has_role(auth.uid(), 'company_admin'));

-- ============ get_invitation_by_token ============
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token text)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  organization_name text,
  email text,
  role app_role,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.organization_id, o.name, i.email, i.role, i.expires_at
  FROM public.organization_invitations i
  JOIN public.organizations o ON o.id = i.organization_id
  WHERE i.token = _token
    AND i.accepted_at IS NULL
    AND i.revoked_at IS NULL
    AND i.expires_at > now()
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;

-- ============ accept_invitation ============
CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv record;
  v_email text;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_inv
  FROM public.organization_invitations
  WHERE token = _token
  LIMIT 1;

  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;
  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation already accepted';
  END IF;
  IF v_inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation revoked';
  END IF;
  IF v_inv.expires_at <= now() THEN
    RAISE EXCEPTION 'Invitation expired';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  IF lower(v_email) <> lower(v_inv.email) THEN
    RAISE EXCEPTION 'Invitation email mismatch';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (v_inv.organization_id, v_user_id, v_inv.role, 'active')
  ON CONFLICT DO NOTHING;

  IF v_inv.role = 'company_admin' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'company_admin')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'user')
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.organization_invitations
  SET accepted_at = now()
  WHERE id = v_inv.id;

  RETURN v_inv.organization_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

-- ============ list_org_members ============
CREATE OR REPLACE FUNCTION public.list_org_members(_org_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  email text,
  role app_role,
  status member_status,
  joined_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.user_id,
    p.full_name,
    u.email::text,
    m.role,
    m.status,
    m.joined_at
  FROM public.organization_members m
  LEFT JOIN public.profiles p ON p.user_id = m.user_id
  LEFT JOIN auth.users u ON u.id = m.user_id
  WHERE m.organization_id = _org_id
    AND (
      public.is_org_member(auth.uid(), _org_id)
      OR public.has_role(auth.uid(), 'master_admin')
    )
  ORDER BY m.joined_at ASC
$$;

GRANT EXECUTE ON FUNCTION public.list_org_members(uuid) TO authenticated;

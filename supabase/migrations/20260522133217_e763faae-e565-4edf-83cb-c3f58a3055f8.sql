
CREATE OR REPLACE FUNCTION public.slugify(_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(both '-' from
    regexp_replace(lower(coalesce(_input, '')), '[^a-z0-9]+', '-', 'g')
  );
$$;

CREATE OR REPLACE FUNCTION public.provision_user_account(
  _user_id uuid,
  _email text,
  _full_name text,
  _org_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_base_slug text;
  v_slug text;
  v_suffix int := 0;
  v_org_name text;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (_user_id, _full_name)
  ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;

  SELECT organization_id INTO v_org_id
  FROM public.organization_members
  WHERE user_id = _user_id AND status = 'active'
  ORDER BY joined_at ASC
  LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'company_admin')
    ON CONFLICT DO NOTHING;
    RETURN v_org_id;
  END IF;

  v_org_name := NULLIF(trim(coalesce(_org_name, '')), '');
  IF v_org_name IS NULL THEN
    v_org_name := coalesce(NULLIF(trim(_full_name), ''), split_part(coalesce(_email,''), '@', 1), 'Minha organização');
  END IF;

  v_base_slug := NULLIF(public.slugify(v_org_name), '');
  IF v_base_slug IS NULL THEN
    v_base_slug := 'org-' || substr(_user_id::text, 1, 8);
  END IF;
  v_slug := v_base_slug;

  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_slug) LOOP
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  END LOOP;

  INSERT INTO public.organizations (name, slug, owner_user_id, billing_email, status)
  VALUES (v_org_name, v_slug, _user_id, _email, 'trial')
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (v_org_id, _user_id, 'company_admin', 'active');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'company_admin')
  ON CONFLICT DO NOTHING;

  RETURN v_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.provision_user_account(
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'org_name'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error for %: % %', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    LEFT JOIN public.organization_members m
      ON m.user_id = u.id AND m.status = 'active'
    WHERE m.id IS NULL
  LOOP
    PERFORM public.provision_user_account(
      r.id,
      r.email,
      r.raw_user_meta_data ->> 'full_name',
      r.raw_user_meta_data ->> 'org_name'
    );
  END LOOP;
END $$;

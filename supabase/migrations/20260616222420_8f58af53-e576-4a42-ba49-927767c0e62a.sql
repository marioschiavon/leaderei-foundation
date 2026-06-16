
-- 1) Hook7: revoke column-level SELECT on token_encrypted so org members cannot read raw encrypted bytes.
--    Decryption already happens via SECURITY DEFINER function get_hook7_instance_token.
REVOKE SELECT (token_encrypted) ON public.hook7_instances FROM authenticated;
REVOKE SELECT (token_encrypted) ON public.hook7_instances FROM anon;

-- 2) Integration credentials: revoke column-level SELECT on value_encrypted from authenticated.
--    Server-side reads must use supabaseAdmin (service_role bypasses column grants).
REVOKE SELECT (value_encrypted) ON public.integration_credentials FROM authenticated;
REVOKE SELECT (value_encrypted) ON public.integration_credentials FROM anon;

-- 3) Realtime: convert permissive deny policy to restrictive deny so future permissive policies cannot override it.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT polname FROM pg_policy WHERE polrelid = 'realtime.messages'::regclass
  LOOP
    EXECUTE format('DROP POLICY %I ON realtime.messages', r.polname);
  END LOOP;
  EXECUTE 'CREATE POLICY "deny_all_messages" ON realtime.messages AS RESTRICTIVE FOR ALL TO public USING (false) WITH CHECK (false)';
END$$;

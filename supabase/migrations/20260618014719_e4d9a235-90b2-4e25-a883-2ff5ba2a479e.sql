REVOKE SELECT (token_encrypted) ON public.hook7_instances FROM authenticated, anon;
REVOKE SELECT (value_encrypted) ON public.integration_credentials FROM authenticated, anon;
REVOKE SELECT (token) ON public.organization_invitations FROM authenticated, anon;
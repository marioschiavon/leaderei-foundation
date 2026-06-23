GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_credentials TO authenticated;
GRANT ALL ON public.integration_credentials TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipedrive_sync_runs TO authenticated;
GRANT ALL ON public.pipedrive_sync_runs TO service_role;
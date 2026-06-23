UPDATE public.organization_integrations oi
SET status = 'disconnected', updated_at = now()
FROM public.integration_providers p
WHERE p.id = oi.provider_id
  AND p.slug IN ('apollo','pipedrive','resend','cal_com','hubspot','linkedin')
  AND oi.status <> 'disconnected'
  AND NOT EXISTS (
    SELECT 1 FROM public.integration_credentials ic
    WHERE ic.integration_id = oi.id
  );
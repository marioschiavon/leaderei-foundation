-- Completar políticas RLS para tabelas Apollo (telemetria + cache)
-- apollo_api_calls: permitir INSERT por membros da org e service_role
CREATE POLICY "Org members insert apollo calls"
ON public.apollo_api_calls
FOR INSERT
TO authenticated
WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Service role manage apollo calls"
ON public.apollo_api_calls
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- apollo_search_cache: INSERT/UPDATE/DELETE por membros da org e service_role
CREATE POLICY "Org members insert apollo cache"
ON public.apollo_search_cache
FOR INSERT
TO authenticated
WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members update apollo cache"
ON public.apollo_search_cache
FOR UPDATE
TO authenticated
USING (public.is_org_member(auth.uid(), organization_id))
WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members delete apollo cache"
ON public.apollo_search_cache
FOR DELETE
TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Service role manage apollo cache"
ON public.apollo_search_cache
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
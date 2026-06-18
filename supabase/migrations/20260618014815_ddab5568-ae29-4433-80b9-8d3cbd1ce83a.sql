-- hook7_instances: remove table-level SELECT, grant per-column SELECT excluding token_encrypted
REVOKE SELECT ON public.hook7_instances FROM authenticated, anon;
GRANT SELECT (id, organization_id, owner_user_id, display_name, external_id, external_name, phone_number, status, last_qr_at, last_connected_at, last_disconnected_at, last_status_check_at, config, created_by, created_at, updated_at, archived_at, connected_profile_name) ON public.hook7_instances TO authenticated;

-- integration_credentials: same pattern, excluding value_encrypted
REVOKE SELECT ON public.integration_credentials FROM authenticated, anon;
GRANT SELECT (id, organization_id, integration_id, key, metadata, created_at, updated_at) ON public.integration_credentials TO authenticated;
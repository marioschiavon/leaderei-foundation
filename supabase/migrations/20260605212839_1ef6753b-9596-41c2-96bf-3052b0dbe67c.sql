INSERT INTO public.platform_settings (key, value_plain, is_secret, updated_at)
VALUES ('app_public_url', '"https://app.leaderei.com.br"'::jsonb, false, now())
ON CONFLICT (key) DO UPDATE
SET value_plain = EXCLUDED.value_plain,
    is_secret = false,
    value_encrypted = NULL,
    updated_at = now();
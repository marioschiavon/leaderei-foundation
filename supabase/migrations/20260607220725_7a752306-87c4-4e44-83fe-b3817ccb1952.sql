
-- 1) Storage: allow master_admin to delete public-assets objects
CREATE POLICY "Master delete public-assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'public-assets' AND public.has_role(auth.uid(), 'master_admin'::app_role));

-- 2) Realtime broadcast/presence: deny by default, no policy allows access.
-- This does NOT affect Postgres Changes subscriptions, which run through
-- the realtime replication slot and continue to honor RLS on public.messages.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Block all direct broadcast/presence access from anon and authenticated users.
-- (Service role bypasses RLS, so server-side publishing still works.)
CREATE POLICY "Deny all broadcast/presence to clients"
ON realtime.messages
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

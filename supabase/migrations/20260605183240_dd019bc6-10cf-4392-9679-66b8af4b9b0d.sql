DROP POLICY IF EXISTS "Authenticated read profiles" ON public.profiles;

CREATE POLICY "Users read own and same-org profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'master_admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.organization_members om1
    JOIN public.organization_members om2
      ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
      AND om2.user_id = public.profiles.user_id
  )
);
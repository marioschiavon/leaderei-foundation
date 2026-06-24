DROP POLICY IF EXISTS "Org admins manage ai_org_profile" ON public.ai_org_profile;

CREATE POLICY "Org admins manage ai_org_profile"
ON public.ai_org_profile
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'master_admin')
  OR EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = ai_org_profile.organization_id
      AND m.status = 'active'
      AND m.role = 'company_admin'
  )
)
WITH CHECK (
  has_role(auth.uid(), 'master_admin')
  OR EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = ai_org_profile.organization_id
      AND m.status = 'active'
      AND m.role = 'company_admin'
  )
);
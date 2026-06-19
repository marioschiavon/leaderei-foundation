-- Fix: revoke token column from authenticated/anon on organization_invitations
REVOKE SELECT (token) ON public.organization_invitations FROM authenticated;
REVOKE SELECT (token) ON public.organization_invitations FROM anon;

-- Fix: prevent privilege escalation by company admins.
-- Replace the broad ALL policy with INSERT-only; SELECTs are covered by
-- "Members view own organization members"; UPDATE/DELETE go through
-- server functions using the service role (which bypasses RLS) after
-- authorization checks.
DROP POLICY IF EXISTS "Org admins manage own org members" ON public.organization_members;

CREATE POLICY "Org admins insert own org members"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  is_org_member(auth.uid(), organization_id)
  AND has_role(auth.uid(), 'company_admin'::app_role)
);
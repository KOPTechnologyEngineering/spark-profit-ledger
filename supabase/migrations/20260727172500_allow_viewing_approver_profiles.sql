-- tbl_profiles RLS only had two SELECT policies: an admin can see everyone,
-- and any user can see their own row. A non-users-module-admin creating an
-- invoice or transaction has no policy letting them see anyone ELSE's
-- profile, so ApproverSelect's query (src/components/ApproverSelect.tsx)
-- silently returns just their own row -- which it then excludes as "self" --
-- leaving zero candidates. Every non-admin user hit "No approver could be
-- found" on every invoice/transaction, not just one account.
--
-- Fix: let any authenticated user see the subset of profiles that are
-- actually eligible to be picked as an approver -- the same three columns
-- (is_approver, is_hidden, approval_status) ApproverSelect already filters
-- on client-side, so this exposes nothing beyond what the picker already
-- displays. It does not widen access to non-approver profiles.

CREATE POLICY "Users can view approver-eligible profiles"
ON public.tbl_profiles
FOR SELECT
USING (
  is_approver = true
  AND is_hidden = false
  AND approval_status = 'approved'
);

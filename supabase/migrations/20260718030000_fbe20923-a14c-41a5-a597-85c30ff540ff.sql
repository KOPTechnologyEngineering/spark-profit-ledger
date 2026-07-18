-- Admins can approve/reject other users' sign-ups, change their session
-- timeout, and toggle their approver status. Without this policy, only the
-- row owner could UPDATE tbl_profiles (see "Users can update own profile"),
-- so an admin's UPDATE against another user's row silently matched zero
-- rows (no RLS error is raised) -- e.g. the "Approve" button on the pending
-- sign-up queue in User Management appeared to succeed (toast + audit log
-- entry) but never actually changed approval_status, leaving the user stuck
-- pending. The same gap silently no-op'd updateTimeout/updateApprover for
-- other users too.
CREATE POLICY "Admins can update all profiles"
  ON public.tbl_profiles
  FOR UPDATE
  USING (public.is_user_admin(auth.uid()))
  WITH CHECK (public.is_user_admin(auth.uid()));

CREATE POLICY "Admins can update all profiles"
  ON public.tbl_profiles
  FOR UPDATE
  USING (public.is_user_admin(auth.uid()))
  WITH CHECK (public.is_user_admin(auth.uid()));
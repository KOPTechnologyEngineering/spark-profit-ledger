-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles"
ON public.tbl_profiles
FOR DELETE
TO authenticated
USING (public.is_user_admin(auth.uid()));

-- Allow admins to delete user roles
CREATE POLICY "Admins can delete roles"
ON public.tbl_user_roles
FOR DELETE
TO authenticated
USING (public.is_user_admin(auth.uid()));
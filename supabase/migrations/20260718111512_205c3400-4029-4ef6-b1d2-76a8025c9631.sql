
-- tbl_profiles: re-scope to authenticated
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.tbl_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.tbl_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.tbl_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.tbl_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.tbl_profiles;

CREATE POLICY "Admins can update all profiles" ON public.tbl_profiles
  FOR UPDATE TO authenticated
  USING (public.is_user_admin(auth.uid()))
  WITH CHECK (public.is_user_admin(auth.uid()));

CREATE POLICY "Admins can view all profiles" ON public.tbl_profiles
  FOR SELECT TO authenticated
  USING (public.is_user_admin(auth.uid()));

CREATE POLICY "Users can insert own profile" ON public.tbl_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.tbl_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own profile" ON public.tbl_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- tbl_user_roles: re-scope to authenticated
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.tbl_user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.tbl_user_roles;

CREATE POLICY "Admins can manage all roles" ON public.tbl_user_roles
  FOR ALL TO authenticated
  USING (public.is_user_admin(auth.uid()))
  WITH CHECK (public.is_user_admin(auth.uid()));

CREATE POLICY "Users can view own roles" ON public.tbl_user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- tbl_notifications: re-scope to authenticated
DROP POLICY IF EXISTS "Users can update own notifications" ON public.tbl_notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.tbl_notifications;

CREATE POLICY "Users can update own notifications" ON public.tbl_notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own notifications" ON public.tbl_notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Email/service tables: re-scope service_role policies from public to service_role
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('email_send_log','email_send_state','suppressed_emails','email_unsubscribe_tokens')
      AND 'public' = ANY(roles)
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO service_role', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Signatures bucket: restrict RLS so users read only their own signature; admins can read all
DROP POLICY IF EXISTS "Users can view own signatures" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all signatures" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own signature" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own signature" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own signature" ON storage.objects;

CREATE POLICY "Users can view own signatures" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'signatures' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all signatures" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'signatures' AND public.is_user_admin(auth.uid()));

CREATE POLICY "Users can upload own signature" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signatures' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own signature" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'signatures' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own signature" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'signatures' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- Revoke EXECUTE on SECURITY DEFINER functions that should only run from triggers/cron
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

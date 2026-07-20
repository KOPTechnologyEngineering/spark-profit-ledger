
-- 1) Gate has_module_access and is_user_admin on approval_status = 'approved'
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module app_module, _min_access access_level)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.tbl_user_roles ur
    JOIN public.tbl_profiles p ON p.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.module = _module
      AND p.approval_status = 'approved'
      AND CASE
        WHEN _min_access = 'view' THEN ur.access IN ('view', 'edit', 'admin')
        WHEN _min_access = 'edit' THEN ur.access IN ('edit', 'admin')
        WHEN _min_access = 'admin' THEN ur.access = 'admin'
        ELSE true
      END
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_user_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.tbl_user_roles ur
    JOIN public.tbl_profiles p ON p.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.module = 'users'
      AND ur.access = 'admin'
      AND p.approval_status = 'approved'
  )
$function$;

-- 2) Add INSERT/UPDATE policies for tbl_recurring_run_log so the record is explicit.
--    Writes happen from the edge function (service_role, bypasses RLS). Deny by default
--    for authenticated users by not granting any policy — but the linter wants an
--    explicit stance. Add a restrictive policy that always denies non-admin writes
--    and allows admin writes for completeness / manual admin correction.
DROP POLICY IF EXISTS "Transaction admins can insert run logs" ON public.tbl_recurring_run_log;
CREATE POLICY "Transaction admins can insert run logs"
  ON public.tbl_recurring_run_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_module_access(auth.uid(), 'transactions'::app_module, 'admin'::access_level));

DROP POLICY IF EXISTS "Transaction admins can update run logs" ON public.tbl_recurring_run_log;
CREATE POLICY "Transaction admins can update run logs"
  ON public.tbl_recurring_run_log
  FOR UPDATE
  TO authenticated
  USING (public.has_module_access(auth.uid(), 'transactions'::app_module, 'admin'::access_level))
  WITH CHECK (public.has_module_access(auth.uid(), 'transactions'::app_module, 'admin'::access_level));

-- 3) Revoke EXECUTE on SECURITY DEFINER functions from PUBLIC/anon/authenticated.
--    These are called only from triggers or from edge functions via service_role.
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_default_roles_on_approval() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_user_approved(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_user_approved(uuid) TO service_role;

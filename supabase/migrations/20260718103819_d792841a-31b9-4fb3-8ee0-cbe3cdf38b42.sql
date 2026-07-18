
-- =========================================================
-- 1. Replace overly-permissive SELECT policies (USING true)
-- =========================================================

-- tbl_invoices
DROP POLICY IF EXISTS "All authenticated can view invoices" ON public.tbl_invoices;
CREATE POLICY "Invoice module viewers can view invoices"
  ON public.tbl_invoices FOR SELECT TO authenticated
  USING (
    public.has_module_access(auth.uid(), 'invoices', 'view')
    OR user_id = auth.uid()
    OR approver1_id = auth.uid()
    OR approver2_id = auth.uid()
  );

-- tbl_transactions
DROP POLICY IF EXISTS "All authenticated can view transactions" ON public.tbl_transactions;
CREATE POLICY "Transaction module viewers can view transactions"
  ON public.tbl_transactions FOR SELECT TO authenticated
  USING (
    public.has_module_access(auth.uid(), 'transactions', 'view')
    OR user_id = auth.uid()
    OR approver1_id = auth.uid()
    OR approver2_id = auth.uid()
  );

-- tbl_paye_employees
DROP POLICY IF EXISTS "All authenticated can view paye employees" ON public.tbl_paye_employees;
CREATE POLICY "PAYE module viewers can view employees"
  ON public.tbl_paye_employees FOR SELECT TO authenticated
  USING (
    public.has_module_access(auth.uid(), 'paye', 'view')
    OR user_id = auth.uid()
  );

-- Collection tables (all invoice-scoped)
DROP POLICY IF EXISTS "all auth can view tbl_collection_activity_logs" ON public.tbl_collection_activity_logs;
CREATE POLICY "invoice viewers can view collection activity logs"
  ON public.tbl_collection_activity_logs FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'invoices', 'view') OR user_id = auth.uid());

DROP POLICY IF EXISTS "all auth can view tbl_collection_chase_items" ON public.tbl_collection_chase_items;
CREATE POLICY "invoice viewers can view collection chase items"
  ON public.tbl_collection_chase_items FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'invoices', 'view') OR user_id = auth.uid());

DROP POLICY IF EXISTS "all auth can view tbl_collection_disputes" ON public.tbl_collection_disputes;
CREATE POLICY "invoice viewers can view collection disputes"
  ON public.tbl_collection_disputes FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'invoices', 'view') OR user_id = auth.uid());

DROP POLICY IF EXISTS "all auth can view tbl_collection_email_templates" ON public.tbl_collection_email_templates;
CREATE POLICY "invoice viewers can view collection email templates"
  ON public.tbl_collection_email_templates FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'invoices', 'view') OR user_id = auth.uid());

DROP POLICY IF EXISTS "all auth can view tbl_collection_escalations" ON public.tbl_collection_escalations;
CREATE POLICY "invoice viewers can view collection escalations"
  ON public.tbl_collection_escalations FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'invoices', 'view') OR user_id = auth.uid());

DROP POLICY IF EXISTS "all auth can view tbl_collection_payment_promises" ON public.tbl_collection_payment_promises;
CREATE POLICY "invoice viewers can view collection payment promises"
  ON public.tbl_collection_payment_promises FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'invoices', 'view') OR user_id = auth.uid());

DROP POLICY IF EXISTS "all auth can view tbl_collection_reminders" ON public.tbl_collection_reminders;
CREATE POLICY "invoice viewers can view collection reminders"
  ON public.tbl_collection_reminders FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'invoices', 'view') OR user_id = auth.uid());

DROP POLICY IF EXISTS "all auth can view tbl_collection_rules" ON public.tbl_collection_rules;
CREATE POLICY "invoice viewers can view collection rules"
  ON public.tbl_collection_rules FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'invoices', 'view') OR user_id = auth.uid());

-- =========================================================
-- 2. tbl_notifications: prevent spoofed inserts
-- =========================================================
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.tbl_notifications;
CREATE POLICY "Users can create notifications for self or approvers"
  ON public.tbl_notifications FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.tbl_profiles p
        WHERE p.user_id = tbl_notifications.user_id
          AND p.is_approver = true
      )
    )
  );

-- =========================================================
-- 3. Storage: signatures bucket - stop broad listing
-- =========================================================
DROP POLICY IF EXISTS "Signatures are publicly accessible" ON storage.objects;
CREATE POLICY "Users can list own signature files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'signatures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =========================================================
-- 4. Storage: transaction-attachments - scope to owner folder
-- =========================================================
DROP POLICY IF EXISTS "Authenticated can view transaction attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload transaction attachments" ON storage.objects;

CREATE POLICY "Users read own transaction attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'transaction-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_module_access(auth.uid(), 'transactions', 'admin')
    )
  );

CREATE POLICY "Users upload own transaction attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'transaction-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own transaction attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'transaction-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_module_access(auth.uid(), 'transactions', 'admin')
    )
  );

-- =========================================================
-- 5. SECURITY DEFINER functions: fix search_path + revoke public execute
-- =========================================================

-- Add fixed search_path to functions missing it
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

-- Revoke execute from anon/authenticated for functions that must not be publicly callable.
-- Keep public.has_module_access and public.is_user_admin executable by authenticated
-- (they are invoked from RLS policies and must run as the calling role).
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_user_admin(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_module_access(uuid, app_module, access_level) FROM anon, PUBLIC;

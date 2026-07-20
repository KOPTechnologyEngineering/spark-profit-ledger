-- Consolidated pending migrations

DROP POLICY IF EXISTS "Users view own organizations" ON public.tbl_organizations;
CREATE POLICY "View organizations"
  ON public.tbl_organizations FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'transactions'::app_module, 'view'::access_level) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own organizations" ON public.tbl_organizations;
CREATE POLICY "Update organizations"
  ON public.tbl_organizations FOR UPDATE TO authenticated
  USING (public.has_module_access(auth.uid(), 'transactions'::app_module, 'edit'::access_level) OR user_id = auth.uid())
  WITH CHECK (public.has_module_access(auth.uid(), 'transactions'::app_module, 'edit'::access_level) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own organizations" ON public.tbl_organizations;
CREATE POLICY "Delete organizations"
  ON public.tbl_organizations FOR DELETE TO authenticated
  USING (public.has_module_access(auth.uid(), 'transactions'::app_module, 'admin'::access_level) OR user_id = auth.uid());

ALTER TABLE public.tbl_paye_employees
  ADD COLUMN IF NOT EXISTS pension_employee NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pension_employer NUMERIC(12,2) NOT NULL DEFAULT 0;

UPDATE public.tbl_paye_employees
SET
  pension_employee = ROUND((GREATEST(0, LEAST(gross_annual, 50270) - 6240) * 0.05 / 12)::numeric, 2),
  pension_employer = ROUND((GREATEST(0, LEAST(gross_annual, 50270) - 6240) * 0.03 / 12)::numeric, 2);

UPDATE public.tbl_paye_employees
SET net_pay = ROUND((gross_pay - tax - ni - pension_employee)::numeric, 2);

DROP FUNCTION IF EXISTS public.read_email_batch(TEXT, INT, INT);

CREATE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB, enqueued_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message, r.enqueued_at FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) TO service_role;
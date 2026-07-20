-- Consolidated script combining three migrations that were authored via
-- Claude Code (no direct Supabase connection from that session) and were
-- never applied to the live database. Run this once via Lovable (or the
-- Supabase Studio SQL Editor) to bring production in line with the
-- individual migration files already committed to this repo:
--   - 20260718150000_de7ce4ad-fde9-4624-a1ee-0629754c378d.sql
--   - 20260718193859_add_pension_contributions_to_paye.sql
--   - 20260718214920_fix_read_email_batch_enqueued_at.sql
-- Everything below is idempotent (IF NOT EXISTS / DROP ... IF EXISTS /
-- CREATE OR REPLACE-style guards), so it's safe to run even if one or two
-- of the three have already been applied by some other means.

-- ============================================================
-- 1. tbl_organizations RLS fix
-- Previously scoped to "auth.uid() = user_id" only on SELECT/UPDATE/DELETE,
-- so each user could only ever see/edit/delete organizations they personally
-- created -- a teammate got an empty or partial customer/vendor list and
-- would duplicate records without knowing why. Mirrors the pattern already
-- used for tbl_recurring_transactions, which references the same rows.
-- INSERT stays owner-only: creating a row always sets your own user_id.
-- ============================================================

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

-- ============================================================
-- 2. PAYE pension columns + backfill
-- Adds employee/employer pension contribution columns and backfills
-- existing employee rows so their pension figures and net_pay reflect the
-- standard UK auto-enrolment formula (5% employee / 3% employer on
-- qualifying earnings, £6,240-£50,270 band) immediately, rather than only
-- after each employee's next edit. Mirrors calcUKDeductions in
-- src/pages/PAYE.tsx.
-- ============================================================

ALTER TABLE public.tbl_paye_employees
  ADD COLUMN IF NOT EXISTS pension_employee NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pension_employer NUMERIC(12,2) NOT NULL DEFAULT 0;

UPDATE public.tbl_paye_employees
SET
  pension_employee = ROUND((GREATEST(0, LEAST(gross_annual, 50270) - 6240) * 0.05 / 12)::numeric, 2),
  pension_employer = ROUND((GREATEST(0, LEAST(gross_annual, 50270) - 6240) * 0.03 / 12)::numeric, 2);

UPDATE public.tbl_paye_employees
SET net_pay = ROUND((gross_pay - tax - ni - pension_employee)::numeric, 2);

-- ============================================================
-- 3. read_email_batch RPC fix
-- The RPC wrapper dropped pgmq's enqueued_at column, but
-- process-email-queue relies on msg.enqueued_at as its TTL fallback
-- whenever a queued message's own JSON payload lacks queued_at ("PGMQ's
-- enqueued_at which is always set by the queue"). CREATE OR REPLACE can't
-- change a function's return column list, so this drops and recreates it.
-- ============================================================

DROP FUNCTION IF EXISTS public.read_email_batch(TEXT, INT, INT);

CREATE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB, enqueued_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER
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

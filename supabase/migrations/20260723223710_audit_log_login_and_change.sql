-- Audit logging: two streams.
--  1) tbl_login_audit  -- every login/logout attempt with success/failed status
--  2) tbl_change_audit -- every INSERT/UPDATE/DELETE on core tables, old + new values
-- Both are readable only by users-module admins.

-- ============================================================
-- 1. LOGIN / LOGOUT AUDIT
-- ============================================================
CREATE TABLE public.tbl_login_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text NOT NULL DEFAULT '',
  event text NOT NULL CHECK (event IN ('login', 'logout')),
  status text NOT NULL CHECK (status IN ('success', 'failed')),
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tbl_login_audit TO authenticated;
GRANT ALL ON public.tbl_login_audit TO service_role;

ALTER TABLE public.tbl_login_audit ENABLE ROW LEVEL SECURITY;

-- Only users-module admins may read. Inserts happen exclusively via the
-- record-login-event edge function (service role), so no INSERT policy for
-- authenticated users -- they can't forge audit rows.
CREATE POLICY "Users admins can view login audit"
  ON public.tbl_login_audit FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'users', 'admin'));

CREATE INDEX idx_login_audit_created ON public.tbl_login_audit(created_at DESC);
CREATE INDEX idx_login_audit_email ON public.tbl_login_audit(lower(email), created_at DESC);

-- ============================================================
-- 2. DATA CHANGE AUDIT
-- ============================================================
CREATE TABLE public.tbl_change_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text,
  operation text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values jsonb,
  new_values jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tbl_change_audit TO authenticated;
GRANT ALL ON public.tbl_change_audit TO service_role;

ALTER TABLE public.tbl_change_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users admins can view change audit"
  ON public.tbl_change_audit FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'users', 'admin'));

CREATE INDEX idx_change_audit_changed_at ON public.tbl_change_audit(changed_at DESC);
CREATE INDEX idx_change_audit_table ON public.tbl_change_audit(table_name, changed_at DESC);

-- Generic row-change capture. AFTER trigger so it sees the committed values.
-- SECURITY DEFINER so it can always write the audit row regardless of the
-- caller's RLS; runs as owner. auth.uid() is the acting user (NULL for
-- service-role / cron writes, which is correct -- those are system actions).
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_record_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD); v_new := NULL; v_record_id := OLD.id::text;
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL; v_new := to_jsonb(NEW); v_record_id := NEW.id::text;
  ELSE
    v_old := to_jsonb(OLD); v_new := to_jsonb(NEW); v_record_id := NEW.id::text;
  END IF;

  INSERT INTO public.tbl_change_audit(table_name, record_id, operation, old_values, new_values, changed_by)
  VALUES (TG_TABLE_NAME, v_record_id, TG_OP, v_old, v_new, auth.uid());

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;

-- Attach to the core business + security tables.
CREATE TRIGGER trg_audit_transactions AFTER INSERT OR UPDATE OR DELETE ON public.tbl_transactions FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_invoices AFTER INSERT OR UPDATE OR DELETE ON public.tbl_invoices FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_organizations AFTER INSERT OR UPDATE OR DELETE ON public.tbl_organizations FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_paye_employees AFTER INSERT OR UPDATE OR DELETE ON public.tbl_paye_employees FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_vat_returns AFTER INSERT OR UPDATE OR DELETE ON public.tbl_vat_returns FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_recurring_transactions AFTER INSERT OR UPDATE OR DELETE ON public.tbl_recurring_transactions FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_profiles AFTER INSERT OR UPDATE OR DELETE ON public.tbl_profiles FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.tbl_user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

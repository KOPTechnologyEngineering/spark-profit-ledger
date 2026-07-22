-- H-1: the "Approvers can update ... assigned to them" RLS policies on
-- tbl_transactions/tbl_invoices only have USING, no WITH CHECK, so Postgres
-- reuses USING for the post-update state -- an assigned approver can change
-- ANY column (amount, category, vat_treatment, the other approver's id) as
-- long as they remain listed as an approver afterward. RLS policies can't
-- express column-level restrictions on their own, so this is enforced with
-- a BEFORE UPDATE trigger instead.
--
-- M-1: same trigger also blocks any edits (by anyone but an admin) once a
-- record has been fully approved by both approvers, so vat_treatment/amount
-- etc. can't silently change after the fact.

CREATE OR REPLACE FUNCTION public.enforce_transaction_update_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin BOOLEAN;
  is_approver BOOLEAN;
  is_owner BOOLEAN;
BEGIN
  -- No JWT claims means a trusted server-side context (service role / migration),
  -- not an end-user request -- nothing to restrict here.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  is_owner := auth.uid() = OLD.user_id;
  is_approver := auth.uid() = OLD.approver1_id OR auth.uid() = OLD.approver2_id;
  is_admin := EXISTS (
    SELECT 1 FROM public.tbl_user_roles
    WHERE user_id = auth.uid() AND module = 'transactions' AND access = 'admin'
  );

  IF OLD.approver1_status = 'approved' AND OLD.approver2_status = 'approved' AND NOT is_admin THEN
    RAISE EXCEPTION 'This transaction has been fully approved and can no longer be edited';
  END IF;

  IF is_approver AND NOT is_owner AND NOT is_admin THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount
      OR NEW.description IS DISTINCT FROM OLD.description
      OR NEW.type IS DISTINCT FROM OLD.type
      OR NEW.category IS DISTINCT FROM OLD.category
      OR NEW.date IS DISTINCT FROM OLD.date
      OR NEW.vat_treatment IS DISTINCT FROM OLD.vat_treatment
      OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
      OR NEW.attachments IS DISTINCT FROM OLD.attachments
      OR NEW.recurring_transaction_id IS DISTINCT FROM OLD.recurring_transaction_id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.approver1_id IS DISTINCT FROM OLD.approver1_id
      OR NEW.approver2_id IS DISTINCT FROM OLD.approver2_id
    THEN
      RAISE EXCEPTION 'Approvers may only record their approval decision, not edit transaction content';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_transaction_update_rules ON public.tbl_transactions;
CREATE TRIGGER trg_enforce_transaction_update_rules
  BEFORE UPDATE ON public.tbl_transactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_transaction_update_rules();

CREATE OR REPLACE FUNCTION public.enforce_invoice_update_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin BOOLEAN;
  is_approver BOOLEAN;
  is_owner BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  is_owner := auth.uid() = OLD.user_id;
  is_approver := auth.uid() = OLD.approver1_id OR auth.uid() = OLD.approver2_id;
  is_admin := EXISTS (
    SELECT 1 FROM public.tbl_user_roles
    WHERE user_id = auth.uid() AND module = 'invoices' AND access = 'admin'
  );

  IF OLD.approver1_status = 'approved' AND OLD.approver2_status = 'approved' AND NOT is_admin THEN
    RAISE EXCEPTION 'This invoice has been fully approved and can no longer be edited';
  END IF;

  IF is_approver AND NOT is_owner AND NOT is_admin THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount
      OR NEW.client IS DISTINCT FROM OLD.client
      OR NEW.discount_percentage IS DISTINCT FROM OLD.discount_percentage
      OR NEW.due_date IS DISTINCT FROM OLD.due_date
      OR NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
      OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
      OR NEW.items IS DISTINCT FROM OLD.items
      OR NEW.notes IS DISTINCT FROM OLD.notes
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.approver1_id IS DISTINCT FROM OLD.approver1_id
      OR NEW.approver2_id IS DISTINCT FROM OLD.approver2_id
    THEN
      RAISE EXCEPTION 'Approvers may only record their approval decision, not edit invoice content';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_invoice_update_rules ON public.tbl_invoices;
CREATE TRIGGER trg_enforce_invoice_update_rules
  BEFORE UPDATE ON public.tbl_invoices
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invoice_update_rules();


-- 1) Profile: protect privileged columns from self-edit
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins may change anything
  IF public.is_user_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  -- Non-admin (including the profile owner) cannot change privileged columns
  NEW.approval_status  := OLD.approval_status;
  NEW.rejection_reason := OLD.rejection_reason;
  NEW.approved_at      := OLD.approved_at;
  NEW.approved_by      := OLD.approved_by;
  NEW.is_approver      := OLD.is_approver;
  NEW.is_active        := OLD.is_active;
  NEW.is_hidden        := OLD.is_hidden;
  NEW.email            := OLD.email;
  NEW.user_id          := OLD.user_id;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_profile_privileges() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.tbl_profiles;
CREATE TRIGGER trg_protect_profile_privileges
BEFORE UPDATE ON public.tbl_profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

-- 2) Approver-only updates on invoices: restrict which columns may change
CREATE OR REPLACE FUNCTION public.restrict_invoice_approver_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  -- Owners and module editors/admins can freely edit; also allow service_role/no-auth internal callers
  IF uid IS NULL
     OR uid = OLD.user_id
     OR public.has_module_access(uid, 'invoices'::app_module, 'edit'::access_level) THEN
    RETURN NEW;
  END IF;

  -- Otherwise caller is an approver-only. Force all non-approval columns to remain unchanged.
  NEW.user_id             := OLD.user_id;
  NEW.invoice_number      := OLD.invoice_number;
  NEW.client              := OLD.client;
  NEW.amount              := OLD.amount;
  NEW.due_date            := OLD.due_date;
  NEW.items               := OLD.items;
  NEW.discount_percentage := OLD.discount_percentage;
  NEW.approver1_id        := OLD.approver1_id;
  NEW.approver2_id        := OLD.approver2_id;
  NEW.created_at          := OLD.created_at;
  -- Allowed to change: approver1_status, approver2_status, status, updated_at
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restrict_invoice_approver_updates() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_restrict_invoice_approver_updates ON public.tbl_invoices;
CREATE TRIGGER trg_restrict_invoice_approver_updates
BEFORE UPDATE ON public.tbl_invoices
FOR EACH ROW EXECUTE FUNCTION public.restrict_invoice_approver_updates();

-- 3) Approver-only updates on transactions: restrict which columns may change
CREATE OR REPLACE FUNCTION public.restrict_transaction_approver_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL
     OR uid = OLD.user_id
     OR public.has_module_access(uid, 'transactions'::app_module, 'edit'::access_level) THEN
    RETURN NEW;
  END IF;

  NEW.user_id                 := OLD.user_id;
  NEW.description             := OLD.description;
  NEW.amount                  := OLD.amount;
  NEW.type                    := OLD.type;
  NEW.category                := OLD.category;
  NEW.date                    := OLD.date;
  NEW.attachment_url          := OLD.attachment_url;
  NEW.vat_treatment           := OLD.vat_treatment;
  NEW.organization_id         := OLD.organization_id;
  NEW.recurring_transaction_id:= OLD.recurring_transaction_id;
  NEW.approver1_id            := OLD.approver1_id;
  NEW.approver2_id            := OLD.approver2_id;
  NEW.created_at              := OLD.created_at;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restrict_transaction_approver_updates() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_restrict_transaction_approver_updates ON public.tbl_transactions;
CREATE TRIGGER trg_restrict_transaction_approver_updates
BEFORE UPDATE ON public.tbl_transactions
FOR EACH ROW EXECUTE FUNCTION public.restrict_transaction_approver_updates();

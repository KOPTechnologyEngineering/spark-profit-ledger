-- 1) REQUIRED NOW -- transaction save is broken without this column.
ALTER TABLE public.tbl_transactions
  ADD COLUMN IF NOT EXISTS vat_treatment TEXT NOT NULL DEFAULT 'standard'
    CHECK (vat_treatment IN ('standard', 'zero_rated', 'exempt', 'out_of_scope'));

-- 2) Closes a maker-checker gap (self-approval). Safe even if already applied.
DO $$
BEGIN
  ALTER TABLE public.tbl_transactions
    ADD CONSTRAINT tbl_transactions_approver_not_creator
    CHECK (approver1_id IS DISTINCT FROM user_id AND approver2_id IS DISTINCT FROM user_id)
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'tbl_transactions_approver_not_creator already exists, skipping';
END $$;

DO $$
BEGIN
  ALTER TABLE public.tbl_invoices
    ADD CONSTRAINT tbl_invoices_approver_not_creator
    CHECK (approver1_id IS DISTINCT FROM user_id AND approver2_id IS DISTINCT FROM user_id)
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'tbl_invoices_approver_not_creator already exists, skipping';
END $$;
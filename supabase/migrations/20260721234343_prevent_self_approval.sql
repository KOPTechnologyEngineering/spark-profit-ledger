-- M-10: the transaction/invoice creator could not select themselves as an
-- approver via the app's own UI (ApproverSelect.tsx already excludes the
-- current user from both dropdowns), but nothing enforced this server-side
-- -- a direct API call could still set approver1_id/approver2_id to the
-- creator's own user_id, defeating the two-approver maker-checker control
-- entirely. Adds a CHECK constraint so this is enforced regardless of caller.
--
-- NOT VALID skips validating existing rows (some may already violate this
-- from before the client-side guard existed) so the migration can't fail on
-- historical data; it still applies to every new insert/update from here on.
-- Existing rows can be validated and cleaned up separately with
-- ALTER TABLE ... VALIDATE CONSTRAINT once confirmed clean.
ALTER TABLE public.tbl_transactions
  ADD CONSTRAINT tbl_transactions_approver_not_creator
  CHECK (approver1_id IS DISTINCT FROM user_id AND approver2_id IS DISTINCT FROM user_id)
  NOT VALID;

ALTER TABLE public.tbl_invoices
  ADD CONSTRAINT tbl_invoices_approver_not_creator
  CHECK (approver1_id IS DISTINCT FROM user_id AND approver2_id IS DISTINCT FROM user_id)
  NOT VALID;

-- The frontend has assumed 'rejected' is a valid tbl_invoices/tbl_transactions
-- status since at least the CSV import enum values (Invoices.tsx, Transactions.tsx
-- statusFilters/enumValues) and RecordDetailDialog.handleApprove(), which sets
-- updates.status = 'rejected' when either approver rejects a record. But the
-- CHECK constraints on both tables were never updated to allow it -- meaning
-- every reject action on an invoice or transaction has been failing outright
-- with a CHECK constraint violation (surfaced to the user as a generic
-- "Couldn't reject" toast), and any CSV import row with status=rejected would
-- fail the same way.

ALTER TABLE public.tbl_invoices DROP CONSTRAINT tbl_invoices_status_check;
ALTER TABLE public.tbl_invoices ADD CONSTRAINT tbl_invoices_status_check
  CHECK (status = ANY (ARRAY['paid'::text, 'pending'::text, 'overdue'::text, 'draft'::text, 'rejected'::text]));

ALTER TABLE public.tbl_transactions DROP CONSTRAINT tbl_transactions_status_check;
ALTER TABLE public.tbl_transactions ADD CONSTRAINT tbl_transactions_status_check
  CHECK (status = ANY (ARRAY['completed'::text, 'pending'::text, 'overdue'::text, 'rejected'::text]));

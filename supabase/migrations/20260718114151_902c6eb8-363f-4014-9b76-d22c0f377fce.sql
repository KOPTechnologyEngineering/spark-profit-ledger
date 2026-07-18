CREATE UNIQUE INDEX IF NOT EXISTS uniq_tbl_transactions_recurring_date
  ON public.tbl_transactions (recurring_transaction_id, date)
  WHERE recurring_transaction_id IS NOT NULL;
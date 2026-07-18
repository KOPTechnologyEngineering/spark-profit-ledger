
CREATE TABLE public.tbl_recurring_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  type text NOT NULL CHECK (type IN ('inflow','outflow')),
  category text NOT NULL DEFAULT 'Uncategorized',
  frequency text NOT NULL CHECK (frequency IN ('daily','weekly','monthly','quarterly','yearly')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  next_run_date date NOT NULL,
  end_date date,
  last_run_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tbl_recurring_transactions TO authenticated;
GRANT ALL ON public.tbl_recurring_transactions TO service_role;

ALTER TABLE public.tbl_recurring_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View recurring transactions"
  ON public.tbl_recurring_transactions FOR SELECT TO authenticated
  USING (has_module_access(auth.uid(), 'transactions'::app_module, 'view'::access_level) OR user_id = auth.uid());

CREATE POLICY "Insert recurring transactions"
  ON public.tbl_recurring_transactions FOR INSERT TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'transactions'::app_module, 'edit'::access_level) AND user_id = auth.uid());

CREATE POLICY "Update recurring transactions"
  ON public.tbl_recurring_transactions FOR UPDATE TO authenticated
  USING (has_module_access(auth.uid(), 'transactions'::app_module, 'edit'::access_level) OR user_id = auth.uid())
  WITH CHECK (has_module_access(auth.uid(), 'transactions'::app_module, 'edit'::access_level) OR user_id = auth.uid());

CREATE POLICY "Delete recurring transactions"
  ON public.tbl_recurring_transactions FOR DELETE TO authenticated
  USING (has_module_access(auth.uid(), 'transactions'::app_module, 'admin'::access_level) OR user_id = auth.uid());

CREATE TRIGGER update_recurring_transactions_updated_at
  BEFORE UPDATE ON public.tbl_recurring_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

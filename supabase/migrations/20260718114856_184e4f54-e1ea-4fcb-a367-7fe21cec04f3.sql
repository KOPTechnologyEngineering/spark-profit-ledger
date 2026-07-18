CREATE TABLE public.tbl_recurring_run_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_log_id UUID NOT NULL REFERENCES public.tbl_recurring_run_log(id) ON DELETE CASCADE,
  recurring_transaction_id UUID NOT NULL REFERENCES public.tbl_recurring_transactions(id) ON DELETE CASCADE,
  created_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tbl_recurring_run_details TO authenticated;
GRANT ALL ON public.tbl_recurring_run_details TO service_role;

ALTER TABLE public.tbl_recurring_run_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view recurring run details"
ON public.tbl_recurring_run_details
FOR SELECT
TO authenticated
USING (public.has_module_access(auth.uid(), 'transactions'::public.app_module, 'admin'::public.access_level));
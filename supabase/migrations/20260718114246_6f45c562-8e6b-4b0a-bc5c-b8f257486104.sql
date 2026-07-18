CREATE TABLE IF NOT EXISTS public.tbl_recurring_run_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  triggered_by TEXT NOT NULL DEFAULT 'cron',
  processed INT NOT NULL DEFAULT 0,
  created INT NOT NULL DEFAULT 0,
  error TEXT
);

GRANT SELECT ON public.tbl_recurring_run_log TO authenticated;
GRANT ALL ON public.tbl_recurring_run_log TO service_role;

ALTER TABLE public.tbl_recurring_run_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view recurring run log"
  ON public.tbl_recurring_run_log
  FOR SELECT
  TO authenticated
  USING (public.has_module_access(auth.uid(), 'transactions', 'admin'));

CREATE INDEX IF NOT EXISTS idx_recurring_run_log_run_at ON public.tbl_recurring_run_log(run_at DESC);
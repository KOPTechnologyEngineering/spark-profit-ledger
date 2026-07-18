
ALTER TABLE public.tbl_transactions
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.tbl_organizations(id) ON DELETE SET NULL;

ALTER TABLE public.tbl_recurring_transactions
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.tbl_organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tbl_transactions_organization_id ON public.tbl_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_tbl_recurring_transactions_organization_id ON public.tbl_recurring_transactions(organization_id);

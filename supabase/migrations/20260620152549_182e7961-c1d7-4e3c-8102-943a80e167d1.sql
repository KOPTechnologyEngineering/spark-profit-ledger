ALTER TABLE public.tbl_invoices ADD COLUMN discount_percentage numeric DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100);

COMMENT ON COLUMN public.tbl_invoices.discount_percentage IS 'Percentage discount applied to the invoice subtotal (0-100)';

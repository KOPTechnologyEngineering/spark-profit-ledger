ALTER TABLE public.tbl_paye_employees
  ADD COLUMN IF NOT EXISTS pension_employee NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pension_employer NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Backfill existing rows so pension figures and net_pay reflect the new
-- formula immediately, rather than staying at 0 / the old net_pay until
-- each employee is next edited. Mirrors calcUKDeductions in src/pages/PAYE.tsx:
-- qualifying earnings are gross_annual clamped to the 6,240-50,270 band,
-- employee 5% / employer 3%, divided by 12 for the monthly figures shown.
UPDATE public.tbl_paye_employees
SET
  pension_employee = ROUND((GREATEST(0, LEAST(gross_annual, 50270) - 6240) * 0.05 / 12)::numeric, 2),
  pension_employer = ROUND((GREATEST(0, LEAST(gross_annual, 50270) - 6240) * 0.03 / 12)::numeric, 2);

UPDATE public.tbl_paye_employees
SET net_pay = ROUND((gross_pay - tax - ni - pension_employee)::numeric, 2);

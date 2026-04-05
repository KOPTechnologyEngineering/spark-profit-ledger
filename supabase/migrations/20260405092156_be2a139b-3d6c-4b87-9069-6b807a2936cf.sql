
ALTER TABLE public.tbl_paye_employees
ADD COLUMN IF NOT EXISTS designation text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS grade text NOT NULL DEFAULT '';

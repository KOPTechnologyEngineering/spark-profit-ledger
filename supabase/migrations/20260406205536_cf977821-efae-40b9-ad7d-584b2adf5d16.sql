
ALTER TABLE public.tbl_profiles ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.tbl_profiles ADD COLUMN IF NOT EXISTS is_approver boolean NOT NULL DEFAULT false;

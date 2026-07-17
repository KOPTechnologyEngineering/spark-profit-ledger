
-- Add approval status to profiles
ALTER TABLE public.tbl_profiles
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (approval_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID;

-- Existing users become approved so nobody gets locked out
UPDATE public.tbl_profiles SET approval_status = 'approved', approved_at = COALESCE(approved_at, now()) WHERE approval_status = 'pending';

-- Update handle_new_user: first user auto-approved+admin, others pending with view-only defaults
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_count INT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.tbl_profiles;

  INSERT INTO public.tbl_profiles (user_id, full_name, email, approval_status, approved_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    CASE WHEN user_count = 0 THEN 'approved' ELSE 'pending' END,
    CASE WHEN user_count = 0 THEN now() ELSE NULL END
  );

  IF user_count = 0 THEN
    INSERT INTO public.tbl_user_roles (user_id, module, access)
    VALUES
      (NEW.id, 'invoices', 'admin'),
      (NEW.id, 'transactions', 'admin'),
      (NEW.id, 'pnl', 'admin'),
      (NEW.id, 'vat', 'admin'),
      (NEW.id, 'paye', 'admin'),
      (NEW.id, 'reports', 'admin'),
      (NEW.id, 'users', 'admin');
  ELSE
    INSERT INTO public.tbl_user_roles (user_id, module, access)
    VALUES
      (NEW.id, 'invoices', 'view'),
      (NEW.id, 'transactions', 'view'),
      (NEW.id, 'pnl', 'view'),
      (NEW.id, 'vat', 'view'),
      (NEW.id, 'paye', 'view'),
      (NEW.id, 'reports', 'view'),
      (NEW.id, 'users', 'none');
  END IF;

  RETURN NEW;
END;
$function$;

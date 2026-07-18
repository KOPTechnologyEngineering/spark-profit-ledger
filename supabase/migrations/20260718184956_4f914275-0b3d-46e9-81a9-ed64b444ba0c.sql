-- Fix pending_user_data_access: new signups get 'none' access until approved.
-- On approval, grant default 'view' roles (unless already customized).

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
    -- Pending users get NO data access until an admin approves them.
    INSERT INTO public.tbl_user_roles (user_id, module, access)
    VALUES
      (NEW.id, 'invoices', 'none'),
      (NEW.id, 'transactions', 'none'),
      (NEW.id, 'pnl', 'none'),
      (NEW.id, 'vat', 'none'),
      (NEW.id, 'paye', 'none'),
      (NEW.id, 'reports', 'none'),
      (NEW.id, 'users', 'none');
  END IF;

  RETURN NEW;
END;
$function$;

-- On approval transition, grant default 'view' access to any modules still at 'none'.
CREATE OR REPLACE FUNCTION public.grant_default_roles_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.approval_status = 'approved'
     AND (OLD.approval_status IS DISTINCT FROM 'approved') THEN
    UPDATE public.tbl_user_roles
       SET access = 'view'
     WHERE user_id = NEW.user_id
       AND module IN ('invoices','transactions','pnl','vat','paye','reports')
       AND access = 'none';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_default_roles_on_approval ON public.tbl_profiles;
CREATE TRIGGER trg_grant_default_roles_on_approval
AFTER UPDATE OF approval_status ON public.tbl_profiles
FOR EACH ROW
EXECUTE FUNCTION public.grant_default_roles_on_approval();

-- Add approval gate helper used to harden RLS on sensitive tables.
CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tbl_profiles
    WHERE user_id = _user_id AND approval_status = 'approved'
  )
$$;

-- Belt-and-braces: revoke any 'view'+ access currently held by pending/rejected users
-- so previously-signed-up accounts also lose direct API access until approved.
UPDATE public.tbl_user_roles ur
   SET access = 'none'
  FROM public.tbl_profiles p
 WHERE ur.user_id = p.user_id
   AND p.approval_status <> 'approved'
   AND ur.module IN ('invoices','transactions','pnl','vat','paye','reports','users')
   AND ur.access <> 'none';

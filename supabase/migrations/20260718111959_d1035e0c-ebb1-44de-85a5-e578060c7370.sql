-- Convert helper role-check functions to SECURITY INVOKER so signed-in users
-- no longer execute a SECURITY DEFINER function. They only read the caller's
-- own rows from tbl_user_roles, which the "select own roles" RLS policy already
-- permits under invoker rights.

CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module app_module, _min_access access_level)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.tbl_user_roles
    WHERE user_id = _user_id
      AND module = _module
      AND CASE
        WHEN _min_access = 'view' THEN access IN ('view', 'edit', 'admin')
        WHEN _min_access = 'edit' THEN access IN ('edit', 'admin')
        WHEN _min_access = 'admin' THEN access = 'admin'
        ELSE true
      END
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_user_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.tbl_user_roles
    WHERE user_id = _user_id
      AND module = 'users'
      AND access = 'admin'
  )
$function$;
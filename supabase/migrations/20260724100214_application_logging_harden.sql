-- Advisor follow-ups from the application_logging migration.

-- 1. Pin search_path on the level helper.
CREATE OR REPLACE FUNCTION public.log_level_num(_level text)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE upper(coalesce(_level, ''))
    WHEN 'TRACE' THEN 10
    WHEN 'DEBUG' THEN 20
    WHEN 'INFO'  THEN 30
    WHEN 'EVENT' THEN 40
    WHEN 'WARN'  THEN 50
    WHEN 'ERROR' THEN 60
    WHEN 'FATAL' THEN 70
    WHEN 'OFF'   THEN 99
    ELSE 30
  END::smallint
$$;

-- 2. Let a signed-in user read the global row and their OWN override, so the
--    effective-level lookup no longer needs SECURITY DEFINER. Operational
--    config only (level / retention / enabled) -- no other user's data.
CREATE POLICY "Users can view their own log level"
  ON public.tbl_log_settings FOR SELECT TO authenticated
  USING (scope = 'global' OR (scope = 'user' AND user_id = auth.uid()));

-- 3. Drop SECURITY DEFINER; RLS above now provides the needed visibility.
--    Not granted to anon -- the client simply defaults to WARN pre-auth, and
--    ingest-log re-resolves the level server-side regardless.
CREATE OR REPLACE FUNCTION public.get_effective_log_level()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT COALESCE((SELECT enabled FROM public.tbl_log_settings WHERE scope = 'global'), true)
      THEN 'OFF'
    ELSE COALESCE(
      (SELECT level FROM public.tbl_log_settings WHERE scope = 'user' AND user_id = auth.uid()),
      (SELECT level FROM public.tbl_log_settings WHERE scope = 'global'),
      'WARN'
    )
  END
$$;

REVOKE EXECUTE ON FUNCTION public.get_effective_log_level() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_effective_log_level() TO authenticated, service_role;

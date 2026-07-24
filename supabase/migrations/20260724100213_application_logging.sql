-- Application logging subsystem.
--   tbl_log_settings -- global + per-user log level configuration
--   tbl_app_log      -- structured log entries (IIS/WAS/Finacle-inspired fields)
-- Both readable only by users-module admins. tbl_app_log has no INSERT policy:
-- entries are written exclusively by the service role (ingest-log edge
-- function / _shared/logger), so they cannot be forged by clients.

-- Ordered severity: TRACE 10 < DEBUG 20 < INFO 30 < EVENT 40 < WARN 50
--                 < ERROR 60 < FATAL 70 ; OFF 99 (settings-only).
CREATE OR REPLACE FUNCTION public.log_level_num(_level text)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
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

-- ============================================================
-- 1. LOG SETTINGS (global + per-user)
-- ============================================================
CREATE TABLE public.tbl_log_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('global', 'user')),
  user_id uuid,
  level text NOT NULL DEFAULT 'WARN'
    CHECK (upper(level) IN ('TRACE','DEBUG','INFO','EVENT','WARN','ERROR','FATAL','OFF')),
  retention_days int NOT NULL DEFAULT 30 CHECK (retention_days BETWEEN 1 AND 3650),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT log_settings_scope_shape CHECK (
    (scope = 'global' AND user_id IS NULL) OR (scope = 'user' AND user_id IS NOT NULL)
  )
);

-- Exactly one global row; at most one override per user.
CREATE UNIQUE INDEX uniq_log_settings_global ON public.tbl_log_settings ((scope)) WHERE scope = 'global';
CREATE UNIQUE INDEX uniq_log_settings_user ON public.tbl_log_settings (user_id) WHERE scope = 'user';

INSERT INTO public.tbl_log_settings (scope, user_id, level, retention_days, enabled)
VALUES ('global', NULL, 'WARN', 30, true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tbl_log_settings TO authenticated;
GRANT ALL ON public.tbl_log_settings TO service_role;

ALTER TABLE public.tbl_log_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users admins can view log settings"
  ON public.tbl_log_settings FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'users', 'admin'));

CREATE POLICY "Users admins can insert log settings"
  ON public.tbl_log_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_module_access(auth.uid(), 'users', 'admin'));

CREATE POLICY "Users admins can update log settings"
  ON public.tbl_log_settings FOR UPDATE TO authenticated
  USING (public.has_module_access(auth.uid(), 'users', 'admin'))
  WITH CHECK (public.has_module_access(auth.uid(), 'users', 'admin'));

CREATE POLICY "Users admins can delete log settings"
  ON public.tbl_log_settings FOR DELETE TO authenticated
  USING (public.has_module_access(auth.uid(), 'users', 'admin'));

-- ============================================================
-- 2. LOG ENTRIES
-- ============================================================
CREATE TABLE public.tbl_app_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  level text NOT NULL,
  level_num smallint NOT NULL,
  source text NOT NULL CHECK (source IN ('client', 'edge', 'db')),
  logger text,
  message text NOT NULL DEFAULT '',
  correlation_id text,
  session_id text,
  user_id uuid,
  user_email text,
  -- IIS W3C extended style request fields
  http_method text,
  endpoint text,
  query text,
  status_code int,
  duration_ms int,
  cs_bytes int,
  sc_bytes int,
  request_at timestamptz,
  response_at timestamptz,
  client_ip text,
  user_agent text,
  -- diagnostics
  error_code text,
  error_detail text,
  context jsonb,
  app_version text,
  environment text
);

CREATE INDEX idx_app_log_ts ON public.tbl_app_log (ts DESC);
CREATE INDEX idx_app_log_level_ts ON public.tbl_app_log (level_num, ts DESC);
CREATE INDEX idx_app_log_user_ts ON public.tbl_app_log (user_id, ts DESC);
CREATE INDEX idx_app_log_source_ts ON public.tbl_app_log (source, ts DESC);
CREATE INDEX idx_app_log_correlation ON public.tbl_app_log (correlation_id);

GRANT SELECT ON public.tbl_app_log TO authenticated;
GRANT ALL ON public.tbl_app_log TO service_role;

ALTER TABLE public.tbl_app_log ENABLE ROW LEVEL SECURITY;

-- Read-only for admins; no INSERT policy (service role only).
CREATE POLICY "Users admins can view app log"
  ON public.tbl_app_log FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'users', 'admin'));

-- ============================================================
-- 3. EFFECTIVE LEVEL RESOLUTION (callable by the app)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_effective_log_level()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION public.get_effective_log_level() TO authenticated, anon, service_role;

-- ============================================================
-- 4. RETENTION PURGE (nightly via pg_cron)
-- ============================================================
CREATE OR REPLACE FUNCTION public.purge_app_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days int;
  v_deleted int;
BEGIN
  SELECT retention_days INTO v_days FROM public.tbl_log_settings WHERE scope = 'global';
  v_days := COALESCE(v_days, 30);
  DELETE FROM public.tbl_app_log WHERE ts < now() - make_interval(days => v_days);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_app_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_app_logs() TO service_role;

DO $$ BEGIN
  PERFORM cron.unschedule('purge-app-logs-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('purge-app-logs-daily', '30 3 * * *', $cron$ SELECT public.purge_app_logs(); $cron$);

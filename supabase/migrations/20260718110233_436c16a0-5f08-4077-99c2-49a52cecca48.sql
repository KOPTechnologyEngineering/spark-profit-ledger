
CREATE TABLE public.tbl_password_reset_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pwreset_email_time ON public.tbl_password_reset_attempts (lower(email), attempted_at DESC);
CREATE INDEX idx_pwreset_ip_time ON public.tbl_password_reset_attempts (ip, attempted_at DESC);

GRANT ALL ON public.tbl_password_reset_attempts TO service_role;

ALTER TABLE public.tbl_password_reset_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only" ON public.tbl_password_reset_attempts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

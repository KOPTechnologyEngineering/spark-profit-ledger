
CREATE TABLE public.tbl_user_approval_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_user_id UUID NOT NULL,
  actor_user_id UUID,
  action TEXT NOT NULL CHECK (action IN ('approved','rejected')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.tbl_user_approval_audit TO authenticated;
GRANT ALL ON public.tbl_user_approval_audit TO service_role;

ALTER TABLE public.tbl_user_approval_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users admins can view approval audit"
  ON public.tbl_user_approval_audit
  FOR SELECT
  TO authenticated
  USING (public.has_module_access(auth.uid(), 'users', 'admin'));

CREATE POLICY "Users admins can insert approval audit"
  ON public.tbl_user_approval_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_module_access(auth.uid(), 'users', 'admin')
    AND actor_user_id = auth.uid()
  );

CREATE INDEX idx_user_approval_audit_target ON public.tbl_user_approval_audit(target_user_id, created_at DESC);

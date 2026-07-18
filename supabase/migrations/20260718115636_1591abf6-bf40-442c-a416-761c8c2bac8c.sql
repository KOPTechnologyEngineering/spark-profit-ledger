
CREATE TABLE public.tbl_organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  org_type TEXT NOT NULL DEFAULT 'customer' CHECK (org_type IN ('customer','vendor','both')),
  email TEXT,
  phone TEXT,
  address TEXT,
  vat_number TEXT,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tbl_organizations TO authenticated;
GRANT ALL ON public.tbl_organizations TO service_role;

ALTER TABLE public.tbl_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own organizations"
  ON public.tbl_organizations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own organizations"
  ON public.tbl_organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own organizations"
  ON public.tbl_organizations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own organizations"
  ON public.tbl_organizations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_tbl_organizations_updated_at
  BEFORE UPDATE ON public.tbl_organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_tbl_organizations_user ON public.tbl_organizations(user_id) WHERE deleted_at IS NULL;


-- Recreate trigger so handle_new_user runs on every signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill missing profile + roles for any auth user without a profile
INSERT INTO public.tbl_profiles (user_id, full_name, email)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'full_name', ''),
       u.email
FROM auth.users u
LEFT JOIN public.tbl_profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;

INSERT INTO public.tbl_user_roles (user_id, module, access)
SELECT u.id, m.module, 'view'::access_level
FROM auth.users u
CROSS JOIN (VALUES
  ('invoices'::app_module),
  ('transactions'::app_module),
  ('pnl'::app_module),
  ('vat'::app_module),
  ('paye'::app_module),
  ('reports'::app_module),
  ('users'::app_module)
) AS m(module)
WHERE NOT EXISTS (
  SELECT 1 FROM public.tbl_user_roles r
  WHERE r.user_id = u.id AND r.module = m.module
)
ON CONFLICT DO NOTHING;

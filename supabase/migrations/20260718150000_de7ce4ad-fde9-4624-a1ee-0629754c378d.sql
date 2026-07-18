-- tbl_organizations had no admin/module-access bypass on SELECT/UPDATE/DELETE
-- (only "auth.uid() = user_id"), so each user could only ever see/edit/delete
-- organizations they personally created -- a teammate got an empty or
-- partial customer/vendor list and would duplicate records without knowing
-- why. Only tbl_transactions and tbl_recurring_transactions reference
-- organization_id (both under the 'transactions' module; tbl_invoices does
-- not), so 'transactions' is the correct anchor module. Mirrors the exact
-- pattern already used for tbl_recurring_transactions, which references the
-- same tbl_organizations rows. INSERT is left as owner-only: creating a row
-- always sets your own user_id, so there's no "can't see a teammate's data"
-- problem on insert the way there is for the other three operations.

DROP POLICY IF EXISTS "Users view own organizations" ON public.tbl_organizations;
CREATE POLICY "View organizations"
  ON public.tbl_organizations FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'transactions'::app_module, 'view'::access_level) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own organizations" ON public.tbl_organizations;
CREATE POLICY "Update organizations"
  ON public.tbl_organizations FOR UPDATE TO authenticated
  USING (public.has_module_access(auth.uid(), 'transactions'::app_module, 'edit'::access_level) OR user_id = auth.uid())
  WITH CHECK (public.has_module_access(auth.uid(), 'transactions'::app_module, 'edit'::access_level) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own organizations" ON public.tbl_organizations;
CREATE POLICY "Delete organizations"
  ON public.tbl_organizations FOR DELETE TO authenticated
  USING (public.has_module_access(auth.uid(), 'transactions'::app_module, 'admin'::access_level) OR user_id = auth.uid());

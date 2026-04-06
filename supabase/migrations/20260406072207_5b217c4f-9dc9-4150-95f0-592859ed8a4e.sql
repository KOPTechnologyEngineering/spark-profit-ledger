
-- Drop the overly restrictive ALL policy
DROP POLICY IF EXISTS "Users can manage own employees" ON public.tbl_paye_employees;

-- Authenticated users can view all employees
CREATE POLICY "All authenticated can view paye employees"
ON public.tbl_paye_employees FOR SELECT TO authenticated
USING (true);

-- Users can insert own employees
CREATE POLICY "Users can insert own paye employees"
ON public.tbl_paye_employees FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update own OR admin can update any
CREATE POLICY "Users or admins can update paye employees"
ON public.tbl_paye_employees FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR has_module_access(auth.uid(), 'paye'::app_module, 'admin'::access_level));

-- Users can delete own OR admin can delete any
CREATE POLICY "Users or admins can delete paye employees"
ON public.tbl_paye_employees FOR DELETE TO authenticated
USING (auth.uid() = user_id OR has_module_access(auth.uid(), 'paye'::app_module, 'admin'::access_level));

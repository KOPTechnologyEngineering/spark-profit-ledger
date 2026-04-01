
-- Add approver columns to tbl_invoices
ALTER TABLE public.tbl_invoices ADD COLUMN approver1_id uuid;
ALTER TABLE public.tbl_invoices ADD COLUMN approver2_id uuid;
ALTER TABLE public.tbl_invoices ADD COLUMN approver1_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.tbl_invoices ADD COLUMN approver2_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.tbl_invoices ADD COLUMN created_by_name text NOT NULL DEFAULT '';

-- Add approver columns to tbl_transactions
ALTER TABLE public.tbl_transactions ADD COLUMN approver1_id uuid;
ALTER TABLE public.tbl_transactions ADD COLUMN approver2_id uuid;
ALTER TABLE public.tbl_transactions ADD COLUMN approver1_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.tbl_transactions ADD COLUMN approver2_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.tbl_transactions ADD COLUMN created_by_name text NOT NULL DEFAULT '';

-- Create notifications table
CREATE TABLE public.tbl_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  link text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tbl_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.tbl_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.tbl_notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.tbl_notifications FOR INSERT
  WITH CHECK (true);

-- Update RLS on tbl_invoices: all authenticated can SELECT, owner can INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Users can manage own invoices" ON public.tbl_invoices;

CREATE POLICY "All authenticated can view invoices"
  ON public.tbl_invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own invoices"
  ON public.tbl_invoices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoices"
  ON public.tbl_invoices FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Approvers can update invoices assigned to them"
  ON public.tbl_invoices FOR UPDATE
  TO authenticated
  USING (auth.uid() = approver1_id OR auth.uid() = approver2_id);

CREATE POLICY "Users can delete own invoices"
  ON public.tbl_invoices FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update RLS on tbl_transactions: all authenticated can SELECT, owner can INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Users can manage own transactions" ON public.tbl_transactions;

CREATE POLICY "All authenticated can view transactions"
  ON public.tbl_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own transactions"
  ON public.tbl_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON public.tbl_transactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Approvers can update transactions assigned to them"
  ON public.tbl_transactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = approver1_id OR auth.uid() = approver2_id);

CREATE POLICY "Users can delete own transactions"
  ON public.tbl_transactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.tbl_notifications;

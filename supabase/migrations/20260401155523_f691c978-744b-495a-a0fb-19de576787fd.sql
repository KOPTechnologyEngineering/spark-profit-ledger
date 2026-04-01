
DROP POLICY IF EXISTS "System can insert notifications" ON public.tbl_notifications;

CREATE POLICY "Authenticated can insert notifications"
  ON public.tbl_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete own notifications"
  ON public.tbl_notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

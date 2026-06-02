ALTER TABLE public.tbl_collection_reminders
  ADD COLUMN IF NOT EXISTS message_id text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tbl_collection_reminders_chase_item
  ON public.tbl_collection_reminders(chase_item_id);
CREATE INDEX IF NOT EXISTS idx_tbl_collection_reminders_message_id
  ON public.tbl_collection_reminders(message_id);
-- tbl_user_approval_audit's action column only allowed 'approved'/'rejected'.
-- The new delete-user edge function needs to log its two possible outcomes
-- ('deleted' when a user has no linked financial records and their auth
-- record is fully removed, 'anonymized' when they do and only their
-- identifying details are scrubbed) into this same admin-actions audit
-- trail, rather than inventing a second table for it.

ALTER TABLE public.tbl_user_approval_audit DROP CONSTRAINT IF EXISTS tbl_user_approval_audit_action_check;
ALTER TABLE public.tbl_user_approval_audit ADD CONSTRAINT tbl_user_approval_audit_action_check
  CHECK (action IN ('approved', 'rejected', 'deleted', 'anonymized'));

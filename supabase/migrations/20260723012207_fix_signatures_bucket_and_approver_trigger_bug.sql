-- Two real bugs found while replaying this project's migration history onto
-- a fresh database for the Supabase-project migration:
--
-- 1) The signatures storage bucket was created with public=true back in
--    20260402095624_aa9e7c01-....sql and never corrected, despite later
--    migrations adding owner-scoped RLS policies on storage.objects for it.
--    Since the bucket itself is public, anyone with a direct object URL can
--    still fetch a signature image regardless of those RLS policies (public
--    buckets serve objects via an unauthenticated URL that bypasses RLS).
--    The app already only ever uses short-lived signed URLs to display
--    signatures (src/lib/signatures.ts), so nothing in the app depends on
--    the bucket being public.
--
-- 2) restrict_transaction_approver_updates() (added in
--    20260722002016_2cef7a17-....sql) references NEW.attachment_url /
--    OLD.attachment_url, but tbl_transactions has no such column -- the
--    real column is `attachments` (jsonb). This would raise
--    "record ... has no field \"attachment_url\"" the first time an
--    approver (not the owner) updates a transaction, since that's the one
--    branch of the trigger that touches the field.

UPDATE storage.buckets SET public = false WHERE id = 'signatures';

CREATE OR REPLACE FUNCTION public.restrict_transaction_approver_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL
     OR uid = OLD.user_id
     OR public.has_module_access(uid, 'transactions'::app_module, 'edit'::access_level) THEN
    RETURN NEW;
  END IF;

  NEW.user_id                 := OLD.user_id;
  NEW.description             := OLD.description;
  NEW.amount                  := OLD.amount;
  NEW.type                    := OLD.type;
  NEW.category                := OLD.category;
  NEW.date                    := OLD.date;
  NEW.attachments             := OLD.attachments;
  NEW.vat_treatment           := OLD.vat_treatment;
  NEW.organization_id         := OLD.organization_id;
  NEW.recurring_transaction_id:= OLD.recurring_transaction_id;
  NEW.approver1_id            := OLD.approver1_id;
  NEW.approver2_id            := OLD.approver2_id;
  NEW.created_at              := OLD.created_at;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restrict_transaction_approver_updates() FROM PUBLIC, anon, authenticated;

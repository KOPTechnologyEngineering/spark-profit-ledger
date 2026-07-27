-- RecordDetailDialog needs the creator's email to send the record-authorized
-- / record-rejected outcome email, but the approver-eligible-profiles policy
-- added earlier (PR #54) only exposes profiles where is_approver = true --
-- most record creators are NOT themselves approvers, so an approver's
-- useProfiles() query can't see the creator's row at all under that policy,
-- and the email would silently never send for the common case.
--
-- The edge function (send-transactional-email) already resolves the
-- creator's email server-side via the service-role client regardless of this
-- policy -- this fix is purely so the CLIENT can look up the right address
-- to pass as recipientEmail, which the edge function then verifies matches.
--
-- Scope is deliberately narrow: an approver can see a profile ONLY if that
-- person created an invoice/transaction the approver is actually assigned
-- to approve -- not any arbitrary profile. The approver already sees the
-- creator's name via created_by_name (plain text on the record itself); this
-- just extends that to email/full_name/designation via the profiles join.

CREATE POLICY "Approvers can view creator profiles for their assigned records"
ON public.tbl_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tbl_invoices i
    WHERE i.user_id = tbl_profiles.user_id
      AND (i.approver1_id = auth.uid() OR i.approver2_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.tbl_transactions t
    WHERE t.user_id = tbl_profiles.user_id
      AND (t.approver1_id = auth.uid() OR t.approver2_id = auth.uid())
  )
);

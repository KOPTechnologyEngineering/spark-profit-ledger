-- Adds "Investor" as a selectable counterparty relationship type, alongside
-- the existing Customer/Vendor/Both.
ALTER TABLE public.tbl_organizations DROP CONSTRAINT tbl_organizations_org_type_check;
ALTER TABLE public.tbl_organizations ADD CONSTRAINT tbl_organizations_org_type_check
  CHECK (org_type = ANY (ARRAY['customer'::text, 'vendor'::text, 'both'::text, 'investor'::text]));

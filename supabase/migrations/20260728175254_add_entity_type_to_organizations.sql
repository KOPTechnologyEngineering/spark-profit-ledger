-- Adds the individual/organization counterparty-type flag requested alongside
-- the Organizations -> Counterparties rename. Existing rows are backfilled to
-- 'organization' so they aren't retroactively flagged as needing review --
-- only rows auto-created by the transaction CSV import (which leaves this
-- column null) should show up as "needs review" in the UI.
ALTER TABLE public.tbl_organizations ADD COLUMN entity_type text CHECK (entity_type IN ('individual', 'organization'));
UPDATE public.tbl_organizations SET entity_type = 'organization' WHERE entity_type IS NULL;

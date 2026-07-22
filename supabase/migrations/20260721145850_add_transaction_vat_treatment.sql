-- H-2: VAT calculation applied a flat 20% to every transaction with no way
-- to mark a transaction zero-rated, exempt, or outside the scope of VAT.
-- Adds a per-transaction VAT treatment so output/input VAT can be computed
-- only on standard-rated amounts. Defaults to 'standard' so existing rows
-- keep their current (20%-on-everything) VAT treatment unchanged.
ALTER TABLE public.tbl_transactions
  ADD COLUMN vat_treatment TEXT NOT NULL DEFAULT 'standard'
    CHECK (vat_treatment IN ('standard', 'zero_rated', 'exempt', 'out_of_scope'));

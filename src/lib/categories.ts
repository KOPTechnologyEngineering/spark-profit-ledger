/** Seed list shown even before any transactions exist. */
export const DEFAULT_CATEGORIES = ["Revenue", "Rent", "Software", "Contractors", "Marketing", "Insurance", "Payroll", "Utilities", "Other"];

/**
 * Category picker options: the seed list plus any category already in use on
 * an existing transaction that isn't already covered. A CSV import or manual
 * entry can introduce a category name that was never in the seed list (e.g.
 * "Legal Fees") -- rather than requiring a separate "add this category"
 * step, it just shows up here automatically the next time the picker is
 * rendered, since the option list is derived from live transaction data
 * (`invalidateTransactions()` after an import refreshes it immediately).
 * "Other" is kept last as the catch-all.
 */
export function categoryOptions(existingCategories: (string | null | undefined)[]): string[] {
  const base = DEFAULT_CATEGORIES.filter((c) => c !== "Other");
  const known = new Set(DEFAULT_CATEGORIES);
  const extra = Array.from(
    new Set(existingCategories.filter((c): c is string => !!c && !known.has(c))),
  ).sort((a, b) => a.localeCompare(b));
  return [...base, ...extra, "Other"];
}

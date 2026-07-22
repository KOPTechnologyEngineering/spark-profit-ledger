// UK 2026/27 tax-year constants and calculations, shared so both PAYE and
// Reports use the same figures and so the boundary cases can be unit tested
// directly (these are exactly the kind of off-by-one/cliff-edge bugs a
// calculation test suite exists to catch).

const CORPORATION_TAX_SMALL_PROFITS_LIMIT = 50000;
const CORPORATION_TAX_MAIN_RATE_LIMIT = 250000;
const CORPORATION_TAX_SMALL_PROFITS_RATE = 0.19;
const CORPORATION_TAX_MAIN_RATE = 0.25;
// Standard marginal relief fraction for a single company with no associated
// companies. Marginal Relief = (Upper Limit - Profit) x (3/200).
const CORPORATION_TAX_MARGINAL_RELIEF_FRACTION = 3 / 200;

/**
 * UK Corporation Tax: 19% up to £50,000, marginal relief tapering the
 * effective rate up to 25% between £50,000-£250,000, 25% flat above.
 */
export function calcCorporationTax(profit: number): number {
  if (profit <= 0) return 0;
  if (profit <= CORPORATION_TAX_SMALL_PROFITS_LIMIT) {
    return Math.round(profit * CORPORATION_TAX_SMALL_PROFITS_RATE);
  }
  if (profit > CORPORATION_TAX_MAIN_RATE_LIMIT) {
    return Math.round(profit * CORPORATION_TAX_MAIN_RATE);
  }
  const mainRateTax = profit * CORPORATION_TAX_MAIN_RATE;
  const marginalRelief = (CORPORATION_TAX_MAIN_RATE_LIMIT - profit) * CORPORATION_TAX_MARGINAL_RELIEF_FRACTION;
  return Math.round(mainRateTax - marginalRelief);
}

const PERSONAL_ALLOWANCE = 12570;
const PERSONAL_ALLOWANCE_TAPER_THRESHOLD = 100000;
const PERSONAL_ALLOWANCE_FULLY_WITHDRAWN_AT = 125140;

const PENSION_QUALIFYING_LOWER = 6240;
const PENSION_QUALIFYING_UPPER = 50270;
const PENSION_EMPLOYEE_RATE = 0.05;
const PENSION_EMPLOYER_RATE = 0.03;

/**
 * The £12,570 personal allowance reduces £1 for every £2 earned above
 * £100,000, reaching exactly £0 at £125,140 -- a taper, not a cliff-edge.
 */
function calcPersonalAllowance(grossAnnual: number): number {
  if (grossAnnual >= PERSONAL_ALLOWANCE_FULLY_WITHDRAWN_AT) return 0;
  const reduction = Math.max(0, grossAnnual - PERSONAL_ALLOWANCE_TAPER_THRESHOLD) / 2;
  return Math.max(0, PERSONAL_ALLOWANCE - reduction);
}

// A transaction's VAT treatment, distinct from its category -- a category
// picks a sensible default (see below) but stays user-editable, since real
// businesses have exceptions (e.g. an otherwise-standard-rated category with
// one export sale that's actually zero-rated).
export const VAT_TREATMENTS = [
  { value: "standard", label: "Standard-rated (20%)" },
  { value: "zero_rated", label: "Zero-rated (0%)" },
  { value: "exempt", label: "Exempt" },
  { value: "out_of_scope", label: "Outside the scope of VAT" },
] as const;

export type VatTreatment = (typeof VAT_TREATMENTS)[number]["value"];

// UK VAT-notable defaults: insurance is VAT-exempt, wages/payroll are
// outside the scope of VAT entirely. Everything else defaults to
// standard-rated, matching the app's behaviour before this field existed.
const CATEGORY_DEFAULT_VAT_TREATMENT: Partial<Record<string, VatTreatment>> = {
  Insurance: "exempt",
  Payroll: "out_of_scope",
};

export function defaultVatTreatmentForCategory(category: string): VatTreatment {
  return CATEGORY_DEFAULT_VAT_TREATMENT[category] ?? "standard";
}

export function calcUKDeductions(grossAnnual: number) {
  const personalAllowance = calcPersonalAllowance(grossAnnual);
  const taxable = Math.max(0, grossAnnual - personalAllowance);
  let tax = 0;
  if (taxable > 0) tax += Math.min(taxable, 37700) * 0.2;
  if (taxable > 37700) tax += Math.min(taxable - 37700, 87440) * 0.4;
  if (taxable > 125140) tax += (taxable - 125140) * 0.45;

  const niLower = 12570;
  const niUpper = 50270;
  let ni = 0;
  if (grossAnnual > niLower) ni += Math.min(grossAnnual - niLower, niUpper - niLower) * 0.08;
  if (grossAnnual > niUpper) ni += (grossAnnual - niUpper) * 0.02;

  const qualifyingEarnings = Math.max(0, Math.min(grossAnnual, PENSION_QUALIFYING_UPPER) - PENSION_QUALIFYING_LOWER);
  const pensionEmployee = qualifyingEarnings * PENSION_EMPLOYEE_RATE;
  const pensionEmployer = qualifyingEarnings * PENSION_EMPLOYER_RATE;

  const monthlyGross = grossAnnual / 12;
  const monthlyTax = tax / 12;
  const monthlyNI = ni / 12;
  const monthlyPensionEmployee = pensionEmployee / 12;
  const monthlyPensionEmployer = pensionEmployer / 12;
  const monthlyNet = monthlyGross - monthlyTax - monthlyNI - monthlyPensionEmployee;

  return {
    gross_pay: Math.round(monthlyGross * 100) / 100,
    tax: Math.round(monthlyTax * 100) / 100,
    ni: Math.round(monthlyNI * 100) / 100,
    pension_employee: Math.round(monthlyPensionEmployee * 100) / 100,
    pension_employer: Math.round(monthlyPensionEmployer * 100) / 100,
    net_pay: Math.round(monthlyNet * 100) / 100,
  };
}

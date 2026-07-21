import { describe, it, expect } from "vitest";
import { formatGBP, sumAmounts } from "@/lib/format";
import { toCSV, parseCSV } from "@/lib/csv";
import { parseImportRows, type ImportColumn } from "@/lib/import";
import { calcCorporationTax, calcUKDeductions, defaultVatTreatmentForCategory } from "@/lib/tax";

describe("formatGBP", () => {
  it("formats numbers with thousands separators", () => {
    expect(formatGBP(15000)).toBe("£15,000");
  });

  it("handles numeric strings from Supabase numeric columns", () => {
    expect(formatGBP("1234.5")).toBe("£1,234.5");
  });

  it("treats null and undefined as zero", () => {
    expect(formatGBP(null)).toBe("£0");
    expect(formatGBP(undefined)).toBe("£0");
  });
});

describe("sumAmounts", () => {
  it("sums a numeric field, coercing strings", () => {
    const items = [{ amount: 10 }, { amount: "20.5" }, { amount: 5 }];
    expect(sumAmounts(items, "amount")).toBe(35.5);
  });

  it("treats missing values as zero", () => {
    const items = [{ amount: 10 }, { amount: null }];
    expect(sumAmounts(items, "amount")).toBe(10);
  });

  it("returns 0 for an empty list", () => {
    expect(sumAmounts([], "amount" as never)).toBe(0);
  });
});

describe("toCSV", () => {
  it("joins header and rows with commas and newlines", () => {
    expect(toCSV(["A", "B"], [[1, 2], [3, 4]])).toBe("A,B\n1,2\n3,4");
  });

  it("quotes cells containing commas and escapes embedded quotes", () => {
    expect(toCSV(["Description"], [['Rent, office "HQ"']])).toBe('Description\n"Rent, office ""HQ"""');
  });

  it("renders null and undefined as empty cells", () => {
    expect(toCSV(["A", "B"], [[null, undefined]])).toBe("A,B\n,");
  });

  it("neutralizes cells that could be interpreted as spreadsheet formulas", () => {
    expect(toCSV(["Description"], [["=1+1"]])).toBe('Description\n\'=1+1');
    expect(toCSV(["Description"], [["+1+1"]])).toBe('Description\n\'+1+1');
    expect(toCSV(["Description"], [["-1+1"]])).toBe('Description\n\'-1+1');
    expect(toCSV(["Description"], [["@SUM(A1)"]])).toBe('Description\n\'@SUM(A1)');
  });

  it("still quotes a neutralized formula-like cell that also contains a comma", () => {
    expect(toCSV(["Note"], [["=cmd,arg"]])).toBe('Note\n"\'=cmd,arg"');
  });

  it("leaves ordinary text and numbers alone", () => {
    expect(toCSV(["Description"], [["Client payment"]])).toBe("Description\nClient payment");
  });
});

describe("parseCSV", () => {
  it("parses a simple header + rows", () => {
    expect(parseCSV("A,B\n1,2\n3,4")).toEqual({
      headers: ["A", "B"],
      rows: [["1", "2"], ["3", "4"]],
    });
  });

  it("handles quoted fields with embedded commas and escaped quotes", () => {
    const { headers, rows } = parseCSV('Description\n"Rent, office ""HQ"""');
    expect(headers).toEqual(["Description"]);
    expect(rows).toEqual([['Rent, office "HQ"']]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCSV("A,B\r\n1,2\r\n")).toEqual({
      headers: ["A", "B"],
      rows: [["1", "2"]],
    });
  });

  it("ignores trailing blank lines", () => {
    expect(parseCSV("A,B\n1,2\n\n")).toEqual({
      headers: ["A", "B"],
      rows: [["1", "2"]],
    });
  });

  it("round-trips through toCSV for values needing escaping", () => {
    const csv = toCSV(["Name", "Note"], [["Acme, Ltd", 'Says "hi"\nline2']]);
    const { headers, rows } = parseCSV(csv);
    expect(headers).toEqual(["Name", "Note"]);
    expect(rows).toEqual([["Acme, Ltd", 'Says "hi"\nline2']]);
  });
});

describe("calcCorporationTax", () => {
  it("applies the flat 19% small-profits rate up to and including £50,000", () => {
    expect(calcCorporationTax(30000)).toBe(5700);
    expect(calcCorporationTax(50000)).toBe(9500);
  });

  it("matches HMRC's own published marginal relief example (£100,000 profit -> £22,750 tax)", () => {
    // HMRC's worked example: £100,000 x 25% = £25,000 main-rate tax;
    // marginal relief = (£250,000 - £100,000) x 3/200 = £2,250;
    // £25,000 - £2,250 = £22,750 payable.
    expect(calcCorporationTax(100000)).toBe(22750);
  });

  it("applies marginal relief between £50,000 and £250,000", () => {
    expect(calcCorporationTax(200000)).toBe(49250);
  });

  it("is continuous across the £50,000 boundary (no cliff-edge jump)", () => {
    expect(calcCorporationTax(50001)).toBe(9500);
  });

  it("applies the flat 25% main rate above £250,000, continuous at the boundary", () => {
    expect(calcCorporationTax(250000)).toBe(62500);
    expect(calcCorporationTax(300000)).toBe(75000);
  });

  it("returns 0 for zero or negative profit", () => {
    expect(calcCorporationTax(0)).toBe(0);
    expect(calcCorporationTax(-5000)).toBe(0);
  });
});

describe("calcUKDeductions", () => {
  it("applies the full £12,570 personal allowance below the £100,000 taper threshold", () => {
    // £50,000: allowance 12,570 untouched, taxable 37,430, all at 20%.
    expect(calcUKDeductions(50000).tax).toBeCloseTo(37430 * 0.2 / 12, 2);
  });

  it("tapers the personal allowance £1 per £2 earned between £100,000 and £125,140", () => {
    // Allowance at £105,000 should be £10,070 (not the full £12,570), giving
    // monthly tax of £2,536 -- the pre-fix cliff-edge code gave £2,452.67 here.
    expect(calcUKDeductions(105000).tax).toBeCloseTo(2536, 2);
    // Allowance at £120,000 should be £2,570, giving monthly tax of £3,286.
    expect(calcUKDeductions(120000).tax).toBeCloseTo(3286, 2);
  });

  it("fully withdraws the personal allowance at exactly £125,140", () => {
    expect(calcUKDeductions(125140).tax).toBeCloseTo(3543, 2);
  });

  it("keeps the allowance at zero just above the £125,140 withdrawal point", () => {
    expect(calcUKDeductions(125141).tax).toBeCloseTo(3543.04, 2);
  });
});

describe("defaultVatTreatmentForCategory", () => {
  it("defaults Insurance to exempt and Payroll to out of scope", () => {
    expect(defaultVatTreatmentForCategory("Insurance")).toBe("exempt");
    expect(defaultVatTreatmentForCategory("Payroll")).toBe("out_of_scope");
  });

  it("defaults everything else to standard-rated", () => {
    expect(defaultVatTreatmentForCategory("Revenue")).toBe("standard");
    expect(defaultVatTreatmentForCategory("Some Unknown Category")).toBe("standard");
  });
});

describe("parseImportRows", () => {
  const columns: ImportColumn[] = [
    { key: "description", label: "Description", required: true, type: "string" },
    { key: "amount", label: "Amount", required: true, type: "number" },
    { key: "type", label: "Type", required: true, type: "enum", enumValues: ["inflow", "outflow"] },
    { key: "category", label: "Category", type: "string", defaultValue: "Other" },
    { key: "date", label: "Date", type: "date", defaultValue: "2026-01-01" },
  ];

  it("parses a fully valid row with no errors", () => {
    const csv = "Description,Amount,Type,Category,Date\nClient payment,1500,inflow,Revenue,2026-03-01";
    const [row] = parseImportRows(csv, columns);
    expect(row.errors).toEqual([]);
    expect(row.data).toEqual({
      description: "Client payment",
      amount: 1500,
      type: "inflow",
      category: "Revenue",
      date: "2026-03-01",
    });
  });

  it("flags a missing required field", () => {
    const csv = "Description,Amount,Type,Category,Date\n,1500,inflow,Revenue,2026-03-01";
    const [row] = parseImportRows(csv, columns);
    expect(row.errors).toContain("Description is required");
  });

  it("applies the default value when an optional cell is blank", () => {
    const csv = "Description,Amount,Type,Category,Date\nRent,900,outflow,,";
    const [row] = parseImportRows(csv, columns);
    expect(row.errors).toEqual([]);
    expect(row.data.category).toBe("Other");
    expect(row.data.date).toBe("2026-01-01");
  });

  it("rejects a non-numeric amount but tolerates currency formatting", () => {
    const csv = "Description,Amount,Type,Category,Date\nA,not-a-number,inflow,,\nB,\"£1,250.50\",inflow,,";
    const [bad, good] = parseImportRows(csv, columns);
    expect(bad.errors).toContain("Amount must be a number");
    expect(good.errors).toEqual([]);
    expect(good.data.amount).toBe(1250.5);
  });

  it("rejects a date that isn't YYYY-MM-DD", () => {
    const csv = "Description,Amount,Type,Category,Date\nA,10,inflow,,15/03/2026";
    const [row] = parseImportRows(csv, columns);
    expect(row.errors).toContain("Date must be in YYYY-MM-DD format");
  });

  it("matches an enum case-insensitively and stores the canonical value", () => {
    const csv = "Description,Amount,Type,Category,Date\nA,10,INFLOW,,2026-01-01";
    const [row] = parseImportRows(csv, columns);
    expect(row.errors).toEqual([]);
    expect(row.data.type).toBe("inflow");
  });

  it("rejects a value not in the enum list", () => {
    const csv = "Description,Amount,Type,Category,Date\nA,10,sideways,,2026-01-01";
    const [row] = parseImportRows(csv, columns);
    expect(row.errors.some((e) => e.startsWith("Type must be one of"))).toBe(true);
  });

  it("matches headers independent of case, spacing, and punctuation", () => {
    const csv = "description,  AMOUNT ,type,category,date\nA,10,inflow,Other,2026-01-01";
    const [row] = parseImportRows(csv, columns);
    expect(row.errors).toEqual([]);
    expect(row.data.amount).toBe(10);
  });

  it("treats a column missing from the CSV header as blank for validation", () => {
    const csv = "Description,Amount,Type\nA,10,inflow";
    const [row] = parseImportRows(csv, columns);
    expect(row.errors).toEqual([]);
    expect(row.data.category).toBe("Other");
  });
});

import { describe, it, expect } from "vitest";
import { formatGBP, sumAmounts } from "@/lib/format";
import { toCSV } from "@/lib/csv";

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
});

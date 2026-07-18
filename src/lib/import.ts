import { parseCSV } from "@/lib/csv";

export type ImportColumnType = "string" | "number" | "date" | "enum";

export interface ImportColumn {
  /** Property name set on the row object returned to the caller. */
  key: string;
  /** CSV header label — also used as the template's column header. */
  label: string;
  required?: boolean;
  type?: ImportColumnType;
  /** Allowed values for type "enum" (case-insensitive match, stored as the canonical value listed here). */
  enumValues?: string[];
  /** Used when the cell is blank and the column isn't required. */
  defaultValue?: string | number;
}

export interface ParsedImportRow {
  index: number;
  data: Record<string, string | number>;
  errors: string[];
}

export const normalizeHeader = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function validateImportCell(raw: string, col: ImportColumn): { value?: string | number; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    if (col.required) return { error: `${col.label} is required` };
    return { value: col.defaultValue };
  }
  switch (col.type) {
    case "number": {
      const n = Number(trimmed.replace(/[^0-9.-]/g, ""));
      if (Number.isNaN(n)) return { error: `${col.label} must be a number` };
      return { value: n };
    }
    case "date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || Number.isNaN(Date.parse(trimmed))) {
        return { error: `${col.label} must be in YYYY-MM-DD format` };
      }
      return { value: trimmed };
    }
    case "enum": {
      const match = col.enumValues?.find((v) => v.toLowerCase() === trimmed.toLowerCase());
      if (!match) {
        const list = col.enumValues && col.enumValues.length <= 5 ? ` (${col.enumValues.join(", ")})` : "";
        return { error: `${col.label} must be one of the template's allowed values${list}` };
      }
      return { value: match };
    }
    default:
      return { value: trimmed };
  }
}

/** Parses CSV text, matches headers to `columns` by label (order/case/punctuation independent), and validates each cell. */
export function parseImportRows(csvText: string, columns: ImportColumn[]): ParsedImportRow[] {
  const { headers, rows } = parseCSV(csvText);
  const headerIndex = new Map(headers.map((h, i) => [normalizeHeader(h), i]));

  return rows.map((row, i) => {
    const data: Record<string, string | number> = {};
    const errors: string[] = [];
    for (const col of columns) {
      const idx = headerIndex.get(normalizeHeader(col.label));
      const raw = idx !== undefined ? row[idx] ?? "" : "";
      const { value, error } = validateImportCell(raw, col);
      if (error) errors.push(error);
      else if (value !== undefined) data[col.key] = value;
    }
    return { index: i + 1, data, errors };
  });
}

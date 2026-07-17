import { startOfDay, startOfWeek, startOfMonth, startOfYear, isAfter } from "date-fns";

export type Period = "Daily" | "Weekly" | "Monthly" | "Yearly" | "All";

export function getStartDate(period: Period): Date | null {
  const now = new Date();
  switch (period) {
    case "Daily": return startOfDay(now);
    case "Weekly": return startOfWeek(now, { weekStartsOn: 1 });
    case "Monthly": return startOfMonth(now);
    case "Yearly": return startOfYear(now);
    default: return null;
  }
}

export function filterByPeriod<T extends { date?: string; created_at?: string }>(items: T[], period: Period): T[] {
  const start = getStartDate(period);
  if (!start) return items;
  return items.filter((item) => {
    const d = new Date(item.date || item.created_at || "");
    return isAfter(d, start) || d.getTime() === start.getTime();
  });
}

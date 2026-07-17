export function formatGBP(amount: number | string | null | undefined): string {
  return `£${Number(amount ?? 0).toLocaleString()}`;
}

export function sumAmounts<T>(items: T[], key: keyof T): number {
  return items.reduce((sum, item) => sum + Number(item[key] ?? 0), 0);
}

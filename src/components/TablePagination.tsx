import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const;
export const DEFAULT_PAGE_SIZE = 20;

// Build a compact page-number window with ellipses, e.g. 1 … 4 5 6 … 20.
// `current` is 1-indexed.
function pageWindow(current: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: (number | "ellipsis")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  if (start > 2) pages.push("ellipsis");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < totalPages - 1) pages.push("ellipsis");
  pages.push(totalPages);
  return pages;
}

interface TablePaginationProps {
  /** 0-indexed current page. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

/**
 * Shared pagination footer: a rows-per-page selector (20/50/100/200),
 * numbered page buttons, and Previous/Next. Pages are 0-indexed in the API
 * but shown 1-indexed.
 */
export default function TablePagination({ page, pageSize, total, onPageChange, onPageSizeChange }: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = page + 1;
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);
  const windowPages = pageWindow(current, totalPages);

  return (
    <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {total === 0 ? "No results" : `Showing ${from}–${to} of ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Rows</span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page === 0}>
          Previous
        </Button>
        {windowPages.map((p, i) =>
          p === "ellipsis" ? (
            <span key={`e${i}`} className="px-2 text-xs text-muted-foreground">…</span>
          ) : (
            <Button
              key={p}
              variant={p === current ? "default" : "outline"}
              size="sm"
              className="min-w-9"
              onClick={() => onPageChange(p - 1)}
              aria-current={p === current ? "page" : undefined}
            >
              {p}
            </Button>
          ),
        )}
        <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={to >= total}>
          Next
        </Button>
      </div>
    </div>
  );
}

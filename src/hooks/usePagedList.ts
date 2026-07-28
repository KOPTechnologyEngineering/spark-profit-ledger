import { useEffect, useState } from "react";
import { DEFAULT_PAGE_SIZE } from "@/components/TablePagination";

/**
 * Client-side pagination over an already-filtered in-memory array. These
 * pages already load their full table into React Query for summary tiles /
 * CSV export, so there's no server round-trip to page against -- this just
 * slices what's already in memory, using the same page/pageSize/total
 * contract TablePagination expects.
 *
 * `resetKey` should change whenever an active filter changes (e.g. a string
 * built from the filter values), so the view snaps back to page 1 instead of
 * landing on a stale, possibly out-of-range page.
 */
export function usePagedList<T>(items: T[], resetKey?: unknown) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setPage(0);
  }, [resetKey]);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = items.slice(safePage * pageSize, (safePage + 1) * pageSize);

  return { page: safePage, pageSize, total, pageItems, setPage, setPageSize };
}

export const STOCK_PAGE_SIZE = 12;

export interface PaginationResult<T> {
  items: T[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export function parseStockPage(raw: string | undefined | null): number {
  if (raw === undefined || raw === null) return 1;
  const value = Number(raw);
  if (!Number.isFinite(value)) return 1;
  const page = Math.floor(value);
  return page >= 1 ? page : 1;
}

export function paginate<T>(
  items: ReadonlyArray<T>,
  page: number,
  perPage: number,
): PaginationResult<T> {
  const normalizedPerPage = Math.max(1, Math.floor(perPage));
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / normalizedPerPage));
  const normalizedPage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const start = (normalizedPage - 1) * normalizedPerPage;
  const pageItems = items.slice(start, start + normalizedPerPage);

  return {
    items: pageItems,
    page: normalizedPage,
    perPage: normalizedPerPage,
    totalItems,
    totalPages,
    hasPreviousPage: normalizedPage > 1,
    hasNextPage: normalizedPage < totalPages,
  };
}

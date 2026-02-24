/**
 * Pagination utilities for Moltbook SDK
 */
export interface PaginationOptions {
  /** Number of items per page */
  limit?: number;
  /** Starting offset */
  offset?: number;
  /** Maximum pages to fetch */
  maxPages?: number;
  /** Delay between page requests in ms */
  delay?: number;
}
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    count: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    currentPage: number;
    totalPages: number;
  };
}
export interface PageInfo {
  page: number;
  offset: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}
/** Calculate pagination info from offset and limit */
export declare function calculatePageInfo(offset: number, limit: number, total?: number): PageInfo;
/** Convert page number to offset */
export declare function pageToOffset(page: number, limit?: number): number;
/** Convert offset to page number */
export declare function offsetToPage(offset: number, limit?: number): number;
/** Calculate total pages from total items and limit */
export declare function calculateTotalPages(total: number, limit?: number): number;
/** Generate page numbers for pagination UI */
export declare function generatePageNumbers(
  current: number,
  total: number,
  maxVisible?: number,
): number[];
/** Async iterator for paginated results */
export declare function paginate<T>(
  fetchFn: (options: { limit: number; offset: number }) => Promise<T[]>,
  options?: PaginationOptions,
): AsyncGenerator<T[], void, unknown>;
/** Collect all pages into a single array */
export declare function collectAll<T>(
  fetchFn: (options: { limit: number; offset: number }) => Promise<T[]>,
  options?: PaginationOptions,
): Promise<T[]>;
/** Fetch pages in parallel */
export declare function fetchPagesParallel<T>(
  fetchFn: (options: { limit: number; offset: number }) => Promise<T[]>,
  pageCount: number,
  options?: {
    limit?: number;
    startPage?: number;
  },
): Promise<T[][]>;
/** Cursor-based pagination helper */
export interface CursorPaginationOptions {
  limit?: number;
  maxPages?: number;
  delay?: number;
}
export declare function paginateByCursor<T, C>(
  fetchFn: (
    cursor: C | null,
    limit: number,
  ) => Promise<{
    data: T[];
    nextCursor: C | null;
  }>,
  options?: CursorPaginationOptions,
): AsyncGenerator<T[], void, unknown>;
/** Window/infinite scroll helper */
export declare class InfiniteScrollHelper<T> {
  private items;
  private loading;
  private hasMore;
  private offset;
  private limit;
  private fetchFn;
  private onUpdate?;
  constructor(
    fetchFn: (options: { limit: number; offset: number }) => Promise<T[]>,
    options?: {
      limit?: number;
      onUpdate?: (items: T[], loading: boolean, hasMore: boolean) => void;
    },
  );
  loadMore(): Promise<T[]>;
  reset(): void;
  getItems(): T[];
  isLoading(): boolean;
  canLoadMore(): boolean;
  private notify;
}
/** Create batched requests */
export declare function batchRequests<T, R>(
  items: T[],
  processFn: (item: T) => Promise<R>,
  options?: {
    batchSize?: number;
    delay?: number;
  },
): Promise<R[]>;
//# sourceMappingURL=pagination.d.ts.map

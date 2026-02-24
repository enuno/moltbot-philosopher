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

const DEFAULT_LIMIT = 25;
const DEFAULT_MAX_PAGES = Infinity;

/** Calculate pagination info from offset and limit */
export function calculatePageInfo(offset: number, limit: number, total?: number): PageInfo {
  const page = Math.floor(offset / limit) + 1;
  return {
    page,
    offset,
    limit,
    hasPrev: offset > 0,
    hasNext: total !== undefined ? offset + limit < total : true,
  };
}

/** Convert page number to offset */
export function pageToOffset(page: number, limit: number = DEFAULT_LIMIT): number {
  return Math.max(0, page - 1) * limit;
}

/** Convert offset to page number */
export function offsetToPage(offset: number, limit: number = DEFAULT_LIMIT): number {
  return Math.floor(offset / limit) + 1;
}

/** Calculate total pages from total items and limit */
export function calculateTotalPages(total: number, limit: number = DEFAULT_LIMIT): number {
  return Math.ceil(total / limit);
}

/** Generate page numbers for pagination UI */
export function generatePageNumbers(
  current: number,
  total: number,
  maxVisible: number = 7,
): number[] {
  if (total <= maxVisible) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: number[] = [];
  const half = Math.floor(maxVisible / 2);

  let start = Math.max(1, current - half);
  let end = Math.min(total, start + maxVisible - 1);

  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return pages;
}

/** Async iterator for paginated results */
export async function* paginate<T>(
  fetchFn: (options: { limit: number; offset: number }) => Promise<T[]>,
  options: PaginationOptions = {},
): AsyncGenerator<T[], void, unknown> {
  const {
    limit = DEFAULT_LIMIT,
    offset: startOffset = 0,
    maxPages = DEFAULT_MAX_PAGES,
    delay = 0,
  } = options;
  let offset = startOffset;
  let page = 0;

  while (page < maxPages) {
    const results = await fetchFn({ limit, offset });

    if (results.length === 0) break;

    yield results;

    if (results.length < limit) break;

    offset += limit;
    page++;

    if (delay > 0 && page < maxPages) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/** Collect all pages into a single array */
export async function collectAll<T>(
  fetchFn: (options: { limit: number; offset: number }) => Promise<T[]>,
  options: PaginationOptions = {},
): Promise<T[]> {
  const all: T[] = [];

  for await (const page of paginate(fetchFn, options)) {
    all.push(...page);
  }

  return all;
}

/** Fetch pages in parallel */
export async function fetchPagesParallel<T>(
  fetchFn: (options: { limit: number; offset: number }) => Promise<T[]>,
  pageCount: number,
  options: { limit?: number; startPage?: number } = {},
): Promise<T[][]> {
  const { limit = DEFAULT_LIMIT, startPage = 1 } = options;

  const promises = Array.from({ length: pageCount }, (_, i) =>
    fetchFn({ limit, offset: (startPage + i - 1) * limit }),
  );

  return Promise.all(promises);
}

/** Cursor-based pagination helper */
export interface CursorPaginationOptions {
  limit?: number;
  maxPages?: number;
  delay?: number;
}

export async function* paginateByCursor<T, C>(
  fetchFn: (cursor: C | null, limit: number) => Promise<{ data: T[]; nextCursor: C | null }>,
  options: CursorPaginationOptions = {},
): AsyncGenerator<T[], void, unknown> {
  const { limit = DEFAULT_LIMIT, maxPages = DEFAULT_MAX_PAGES, delay = 0 } = options;
  let cursor: C | null = null;
  let page = 0;

  while (page < maxPages) {
    const { data, nextCursor } = await fetchFn(cursor, limit);

    if (data.length === 0) break;

    yield data;

    if (!nextCursor) break;

    cursor = nextCursor;
    page++;

    if (delay > 0 && page < maxPages) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/** Window/infinite scroll helper */
export class InfiniteScrollHelper<T> {
  private items: T[] = [];
  private loading = false;
  private hasMore = true;
  private offset = 0;
  private limit: number;
  private fetchFn: (options: { limit: number; offset: number }) => Promise<T[]>;
  private onUpdate?: (items: T[], loading: boolean, hasMore: boolean) => void;

  constructor(
    fetchFn: (options: { limit: number; offset: number }) => Promise<T[]>,
    options: {
      limit?: number;
      onUpdate?: (items: T[], loading: boolean, hasMore: boolean) => void;
    } = {},
  ) {
    this.fetchFn = fetchFn;
    this.limit = options.limit ?? DEFAULT_LIMIT;
    this.onUpdate = options.onUpdate;
  }

  async loadMore(): Promise<T[]> {
    if (this.loading || !this.hasMore) return this.items;

    this.loading = true;
    this.notify();

    try {
      const newItems = await this.fetchFn({ limit: this.limit, offset: this.offset });

      this.items.push(...newItems);
      this.offset += this.limit;
      this.hasMore = newItems.length === this.limit;

      return this.items;
    } finally {
      this.loading = false;
      this.notify();
    }
  }

  reset(): void {
    this.items = [];
    this.offset = 0;
    this.loading = false;
    this.hasMore = true;
    this.notify();
  }

  getItems(): T[] {
    return this.items;
  }

  isLoading(): boolean {
    return this.loading;
  }

  canLoadMore(): boolean {
    return this.hasMore && !this.loading;
  }

  private notify(): void {
    this.onUpdate?.(this.items, this.loading, this.hasMore);
  }
}

/** Create batched requests */
export async function batchRequests<T, R>(
  items: T[],
  processFn: (item: T) => Promise<R>,
  options: { batchSize?: number; delay?: number } = {},
): Promise<R[]> {
  const { batchSize = 10, delay = 0 } = options;
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processFn));
    results.push(...batchResults);

    if (delay > 0 && i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return results;
}

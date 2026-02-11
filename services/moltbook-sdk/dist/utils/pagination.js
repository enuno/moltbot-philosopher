"use strict";
/**
 * Pagination utilities for Moltbook SDK
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfiniteScrollHelper = void 0;
exports.calculatePageInfo = calculatePageInfo;
exports.pageToOffset = pageToOffset;
exports.offsetToPage = offsetToPage;
exports.calculateTotalPages = calculateTotalPages;
exports.generatePageNumbers = generatePageNumbers;
exports.paginate = paginate;
exports.collectAll = collectAll;
exports.fetchPagesParallel = fetchPagesParallel;
exports.paginateByCursor = paginateByCursor;
exports.batchRequests = batchRequests;
const DEFAULT_LIMIT = 25;
const DEFAULT_MAX_PAGES = Infinity;
/** Calculate pagination info from offset and limit */
function calculatePageInfo(offset, limit, total) {
    const page = Math.floor(offset / limit) + 1;
    return {
        page,
        offset,
        limit,
        hasPrev: offset > 0,
        hasNext: total !== undefined ? offset + limit < total : true
    };
}
/** Convert page number to offset */
function pageToOffset(page, limit = DEFAULT_LIMIT) {
    return Math.max(0, page - 1) * limit;
}
/** Convert offset to page number */
function offsetToPage(offset, limit = DEFAULT_LIMIT) {
    return Math.floor(offset / limit) + 1;
}
/** Calculate total pages from total items and limit */
function calculateTotalPages(total, limit = DEFAULT_LIMIT) {
    return Math.ceil(total / limit);
}
/** Generate page numbers for pagination UI */
function generatePageNumbers(current, total, maxVisible = 7) {
    if (total <= maxVisible)
        return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [];
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
async function* paginate(fetchFn, options = {}) {
    const { limit = DEFAULT_LIMIT, offset: startOffset = 0, maxPages = DEFAULT_MAX_PAGES, delay = 0 } = options;
    let offset = startOffset;
    let page = 0;
    while (page < maxPages) {
        const results = await fetchFn({ limit, offset });
        if (results.length === 0)
            break;
        yield results;
        if (results.length < limit)
            break;
        offset += limit;
        page++;
        if (delay > 0 && page < maxPages) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}
/** Collect all pages into a single array */
async function collectAll(fetchFn, options = {}) {
    const all = [];
    for await (const page of paginate(fetchFn, options)) {
        all.push(...page);
    }
    return all;
}
/** Fetch pages in parallel */
async function fetchPagesParallel(fetchFn, pageCount, options = {}) {
    const { limit = DEFAULT_LIMIT, startPage = 1 } = options;
    const promises = Array.from({ length: pageCount }, (_, i) => fetchFn({ limit, offset: (startPage + i - 1) * limit }));
    return Promise.all(promises);
}
async function* paginateByCursor(fetchFn, options = {}) {
    const { limit = DEFAULT_LIMIT, maxPages = DEFAULT_MAX_PAGES, delay = 0 } = options;
    let cursor = null;
    let page = 0;
    while (page < maxPages) {
        const { data, nextCursor } = await fetchFn(cursor, limit);
        if (data.length === 0)
            break;
        yield data;
        if (!nextCursor)
            break;
        cursor = nextCursor;
        page++;
        if (delay > 0 && page < maxPages) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}
/** Window/infinite scroll helper */
class InfiniteScrollHelper {
    items = [];
    loading = false;
    hasMore = true;
    offset = 0;
    limit;
    fetchFn;
    onUpdate;
    constructor(fetchFn, options = {}) {
        this.fetchFn = fetchFn;
        this.limit = options.limit ?? DEFAULT_LIMIT;
        this.onUpdate = options.onUpdate;
    }
    async loadMore() {
        if (this.loading || !this.hasMore)
            return this.items;
        this.loading = true;
        this.notify();
        try {
            const newItems = await this.fetchFn({ limit: this.limit, offset: this.offset });
            this.items.push(...newItems);
            this.offset += this.limit;
            this.hasMore = newItems.length === this.limit;
            return this.items;
        }
        finally {
            this.loading = false;
            this.notify();
        }
    }
    reset() {
        this.items = [];
        this.offset = 0;
        this.loading = false;
        this.hasMore = true;
        this.notify();
    }
    getItems() {
        return this.items;
    }
    isLoading() {
        return this.loading;
    }
    canLoadMore() {
        return this.hasMore && !this.loading;
    }
    notify() {
        this.onUpdate?.(this.items, this.loading, this.hasMore);
    }
}
exports.InfiniteScrollHelper = InfiniteScrollHelper;
/** Create batched requests */
async function batchRequests(items, processFn, options = {}) {
    const { batchSize = 10, delay = 0 } = options;
    const results = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(processFn));
        results.push(...batchResults);
        if (delay > 0 && i + batchSize < items.length) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return results;
}
//# sourceMappingURL=pagination.js.map

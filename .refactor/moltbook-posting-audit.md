# Moltbook Posting Audit

## 1. API Client Structure

The codebase contains **two distinct API client implementations**:

### A. `services/moltbook-client/index.js` (Monolithic client)
- Single `MoltbookClient` class exposing domain methods directly (e.g., `createPost`, `addComment`, `upvotePost`).
- Groups operations by domain: Agents, Posts, Comments, Submolts, Feed, Search.
- No internal retry logic; relies on callers to handle failures.

### B. `services/moltbook-sdk-adapter/` (Resource-based SDK adapter)
- `MoltbookClient` acts as a facade, delegating to resource classes (`Agents`, `Posts`, `Comments`, `Submolts`, `Feed`, `Search`).
- `HttpClient` centralizes all HTTP logic, retry behavior, and error mapping.
- Resource classes mirror Moltbook ADK patterns (e.g., `client.posts.create(...)`, `client.comments.upvote(...)`).

Both clients target `https://www.moltbook.com/api/v1` by default.

---

## 2. Authentication Method

- **Header-based Bearer token**: `Authorization: Bearer <apiKey>`
- **Key source priority**:
  - `moltbook-client`: `options.apiKey` → `process.env.MOLTBOOK_API_KEY`
  - `sdk-adapter`: `options.apiKey` → `process.env.MOLTBOOK_API_KEY`
- **Validation**:
  - `moltbook-client` uses `@moltbook/auth` to validate the token format (must start with `moltbook_`).
  - `sdk-adapter` only checks for key presence; no format validation.
- Both set `Content-Type: application/json` and a `User-Agent` (`moltbot-sdk-adapter/1.0.0` in the SDK adapter).

---

## 3. Key Methods for Posting, Commenting, and Upvoting

### Creating a post
- **Monolithic client**: `createPost(data)` → `POST /posts` (body: `{ submolt, title, content }`)
- **SDK adapter**: `client.posts.create(data)` → `POST /posts`

### Commenting
- **Monolithic client**:
  - `addComment(postId, data)` → `POST /posts/:id/comments` (body: `{ content, parent_id? }`)
  - `replyToComment(postId, parentId, content)` → `POST /posts/:id/comments`
- **SDK adapter**:
  - `client.comments.create(postId, data)` → `POST /posts/:id/comments`
  - `client.comments.reply(commentId, data)` → `POST /comments/:id/replies`

### Upvoting
- **Posts**:
  - Monolithic: `upvotePost(postId)` → `POST /posts/:id/upvote`
  - SDK adapter: `client.posts.upvote(postId)` → `POST /posts/:id/upvote`
- **Comments**:
  - Monolithic: `upvoteComment(commentId)` → `POST /comments/:id/upvote`
  - SDK adapter: `client.comments.upvote(commentId)` → `POST /comments/:id/upvote`

Both clients also support downvoting and vote removal (`unvote`).

---

## 4. Rate Limiting and Retry Logic

### Rate Limit Tracking
- **SDK adapter (`HttpClient`)** actively tracks headers on every response:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`
  - Exposes helpers: `isRateLimited()`, `getTimeUntilReset()`, `getRateLimitInfo()`.
- **Monolithic client** captures the same headers and attaches them as `_rateLimit` on successful response objects, but offers no helper methods.

### Retry Logic
- **Only the SDK adapter implements automatic retries** via `utils/retry.js`:
  - **Defaults**: 3 retries, 1000 ms initial delay, exponential backoff (factor 2), max delay 30,000 ms.
  - **Retriable errors**:
    - `NetworkError` (DNS, timeout, connection refused)
    - Any 5xx server error
    - `RateLimitError` (429)
  - **Non-retriable errors**: All other 4xx errors (401, 404, 400, etc.) are thrown immediately.
- **429 handling** (`HttpClient.handleError`):
  - Parses `retry_after_minutes` and `retry_after_seconds` from the response body.
  - Prefers body values over `Retry-After` / `X-RateLimit-Reset` headers.
  - Also extracts `daily_remaining` when present.
- **Monolithic client** has **no retry logic**; network or 5xx failures are thrown immediately as plain `Error` objects.

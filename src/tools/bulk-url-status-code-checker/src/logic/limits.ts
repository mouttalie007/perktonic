// No imports: shared by the client component and the route.

export const MAX_URLS = 50;
/** The page sends this many URLs per POST, so it can show progress and stop between batches. */
export const BATCH_SIZE = 5;
/** URLs of one batch checked at the same time. */
export const CONCURRENCY = 3;
/** Pause between two requests to the same host. */
export const HOST_GAP_MS = 250;
export const MAX_URL_LENGTH = 2048;
export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_PASTE_CHARS = 200_000;
export const MAX_REDIRECTS = 10;
/** Stop starting new requests after this long, so one slow batch cannot hold the route for minutes. */
export const BATCH_BUDGET_MS = 40_000;

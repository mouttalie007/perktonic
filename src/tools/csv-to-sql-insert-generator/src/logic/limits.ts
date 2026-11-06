// No imports: shared by the page and the worker.

export const MAX_PASTE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
/** Rows looked at to pick each column's type. */
export const TYPE_SAMPLE_ROWS = 10_000;
/** The screen shows this much of the SQL; Copy and Download give all of it. */
export const MAX_DISPLAY_CHARS = 200_000;
export const MAX_BATCH = 1000;

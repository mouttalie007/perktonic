// Shared by the component and the worker. No imports on purpose.
export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 10;
/** Scanned PDF pages are rendered at about 200 dpi. */
export const PDF_SCALE = 200 / 72;
/** Very large photos are scaled down to this width before OCR (enough for table text). */
export const MAX_WIDTH = 2600;

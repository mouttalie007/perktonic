// No imports here: the client component and the worker both read these numbers.

export const MAX_PASTE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_EXPRESSION_CHARS = 20_000;
/** Longer results are shown cut; Copy and Download always give everything. */
export const MAX_DISPLAY_CHARS = 200_000;

/**
 * Time limit for one query. Small documents get 2 s, which stops runaway
 * regexes and recursions quickly; larger ones get 250 ms more per MB because
 * jq has to parse the whole text on every run (about 1.5 s for 20 MB).
 */
export function timeLimitMs(docBytes: number): number {
  const mb = docBytes / (1024 * 1024);
  return mb <= 2 ? 2000 : Math.round(2000 + (mb - 2) * 250);
}

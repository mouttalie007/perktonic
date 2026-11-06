export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface HeaderFix {
  index: number;
  from: string;
  to: string;
}

/**
 * Makes header names usable as JSON keys: blanks become column_N (1-based
 * position) and repeats get _2, _3… so no value is silently overwritten.
 */
export function normalizeHeaders(raw: string[]): { headers: string[]; fixes: HeaderFix[] } {
  const headers: string[] = [];
  const fixes: HeaderFix[] = [];
  const used = new Set<string>();
  raw.forEach((name, index) => {
    const trimmed = name.trim();
    let candidate = trimmed === "" ? `column_${index + 1}` : trimmed;
    if (used.has(candidate)) {
      let n = 2;
      while (used.has(`${candidate}_${n}`)) n++;
      candidate = `${candidate}_${n}`;
    }
    used.add(candidate);
    headers.push(candidate);
    if (candidate !== name) fixes.push({ index, from: name, to: candidate });
  });
  return { headers, fixes };
}

export interface InferOptions {
  numbers: boolean;
  booleans: boolean;
  nulls: boolean;
  /** What an empty cell becomes: null or an empty string. */
  emptyAsNull: boolean;
}

export const DEFAULT_INFER: InferOptions = { numbers: true, booleans: true, nulls: true, emptyAsNull: true };

// No leading zeros (so 02134 stays text), no thousands separators, no "+".
const NUMBER_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][-+]?\d+)?$/;

export function inferValue(raw: string, opts: InferOptions): JsonValue {
  if (raw === "") return opts.emptyAsNull ? null : "";
  if (opts.booleans) {
    const lower = raw.toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;
  }
  if (opts.nulls && raw.toLowerCase() === "null") return null;
  if (opts.numbers && NUMBER_RE.test(raw)) {
    const n = Number(raw);
    // Long IDs and card-like numbers would lose digits as doubles; keep them as text.
    const digits = raw.replace(/^-/, "").replace(/\.|[eE].*$/g, "").length;
    if (Number.isFinite(n) && (Number.isSafeInteger(n) || !/^-?\d+$/.test(raw)) && digits <= 15) return n;
  }
  return raw;
}

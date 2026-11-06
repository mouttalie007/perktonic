export type ColType = "number" | "string" | "boolean" | "date" | "datetime";

/** Dates are kept as UTC milliseconds with their kind, so comparisons and sorting are plain number operations. */
export type Value = null | number | string | boolean | { date: number; time: boolean };

export function isDate(v: Value): v is { date: number; time: boolean } {
  return typeof v === "object" && v !== null;
}

const NUM_RE = /^[-+]?(?:[$€£¥]\s?)?(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d+)?%?$/;

export function parseNumber(raw: string): number | null {
  const t = raw.trim();
  if (t === "" || !/\d/.test(t) || !NUM_RE.test(t)) return null;
  const pct = t.endsWith("%");
  const n = Number(t.replace(/[$€£¥,%\s]/g, ""));
  if (!Number.isFinite(n)) return null;
  return pct ? n / 100 : n;
}

/** ISO dates (2026-01-31, with optional time) and US-style M/D/YYYY, which is what Google Sheets copies in an en-US file. */
export function parseDate(raw: string): { date: number; time: boolean } | null {
  const t = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(t);
  let y: number, mo: number, d: number;
  let h = 0, mi = 0, s = 0, time = false;
  if (m) {
    [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (m[4] !== undefined) [h, mi, s, time] = [Number(m[4]), Number(m[5]), Number(m[6] ?? 0), true];
  } else {
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(t);
    if (!m) return null;
    [mo, d, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (m[4] !== undefined) [h, mi, s, time] = [Number(m[4]), Number(m[5]), Number(m[6] ?? 0), true];
  }
  const ms = Date.UTC(y, mo - 1, d, h, mi, s);
  const check = new Date(ms);
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59 || s > 59) return null;
  return { date: ms, time };
}

export function typeOfCell(raw: string): ColType | null {
  const t = raw.trim();
  if (t === "") return null;
  if (/^(true|false)$/i.test(t)) return "boolean";
  if (parseNumber(t) !== null) return "number";
  const d = parseDate(t);
  if (d) return d.time ? "datetime" : "date";
  return "string";
}

export function convert(raw: string, type: ColType): Value {
  const t = raw.trim();
  if (t === "") return null;
  switch (type) {
    case "number":
      return parseNumber(t);
    case "boolean":
      return /^true$/i.test(t) ? true : /^false$/i.test(t) ? false : null;
    case "date":
    case "datetime":
      return parseDate(t);
    default:
      return raw;
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

export function formatValue(v: Value): string {
  if (v === null) return "";
  if (isDate(v)) {
    const d = new Date(v.date);
    const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    return v.time ? `${day} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}` : day;
  }
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return String(Number(v.toPrecision(15)));
  return v;
}

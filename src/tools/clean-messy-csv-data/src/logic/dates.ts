export type DayOrder = "dmy" | "mdy";
export type DateOutput = "iso" | "dmy" | "mdy";

export interface DateParts {
  y: number;
  m: number;
  d: number;
  time: string | null;
}

/** How one cell can be read. "either" means DD/MM and MM/DD are both valid and differ. */
export type DateKind = "fixed" | "dmy-only" | "mdy-only" | "either" | "none";

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11,
  november: 11, dec: 12, december: 12,
};

const TIME = "(?:[ T](\\d{1,2}):(\\d{2})(?::(\\d{2}))?\\s*([AaPp][Mm])?)?";
const YMD_RE = new RegExp(`^(\\d{4})([-/.])(\\d{1,2})\\2(\\d{1,2})${TIME}$`);
const XXY_RE = new RegExp(`^(\\d{1,2})([-/.])(\\d{1,2})\\2(\\d{4}|\\d{2})${TIME}$`);
const D_MON_Y_RE = /^(\d{1,2})(?:st|nd|rd|th)?[ -]([A-Za-z]{3,9})\.?,?[ -](\d{4})$/;
const MON_D_Y_RE = /^([A-Za-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})$/;

function daysIn(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function valid(y: number, m: number, d: number): boolean {
  return m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m) && y >= 1000 && y <= 9999;
}

function fullYear(raw: string): number {
  const n = Number(raw);
  if (raw.length === 4) return n;
  // Two-digit years: 00–69 → 2000s, 70–99 → 1900s (the POSIX strptime rule).
  return n < 70 ? 2000 + n : 1900 + n;
}

function timeOf(h?: string, mi?: string, s?: string, ampm?: string): string | null | false {
  if (h === undefined) return null;
  let hour = Number(h);
  if (ampm) {
    if (hour < 1 || hour > 12) return false;
    const pm = ampm.toLowerCase() === "pm";
    hour = (hour % 12) + (pm ? 12 : 0);
  }
  if (hour > 23 || Number(mi) > 59 || (s !== undefined && Number(s) > 59)) return false;
  const hh = String(hour).padStart(2, "0");
  return s !== undefined ? `${hh}:${mi}:${s}` : `${hh}:${mi}`;
}

export interface Classified {
  kind: DateKind;
  /** Parts when the reading does not depend on the day order. */
  fixed?: DateParts;
  dmy?: DateParts;
  mdy?: DateParts;
}

export function classifyDate(value: string): Classified {
  const v = value.trim();
  let m = YMD_RE.exec(v);
  if (m) {
    const t = timeOf(m[5], m[6], m[7], m[8]);
    const y = Number(m[1]);
    const mo = Number(m[3]);
    const d = Number(m[4]);
    if (t === false || !valid(y, mo, d)) return { kind: "none" };
    return { kind: "fixed", fixed: { y, m: mo, d, time: t } };
  }
  m = XXY_RE.exec(v);
  if (m) {
    const t = timeOf(m[5], m[6], m[7], m[8]);
    if (t === false) return { kind: "none" };
    const a = Number(m[1]);
    const b = Number(m[3]);
    const y = fullYear(m[4]);
    const asDmy = valid(y, b, a) ? { y, m: b, d: a, time: t } : undefined;
    const asMdy = valid(y, a, b) ? { y, m: a, d: b, time: t } : undefined;
    if (asDmy && asMdy) return a === b ? { kind: "fixed", fixed: asDmy } : { kind: "either", dmy: asDmy, mdy: asMdy };
    if (asDmy) return { kind: "dmy-only", dmy: asDmy };
    if (asMdy) return { kind: "mdy-only", mdy: asMdy };
    return { kind: "none" };
  }
  m = D_MON_Y_RE.exec(v);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()];
    const y = Number(m[3]);
    const d = Number(m[1]);
    return mo && valid(y, mo, d) ? { kind: "fixed", fixed: { y, m: mo, d, time: null } } : { kind: "none" };
  }
  m = MON_D_Y_RE.exec(v);
  if (m) {
    const mo = MONTHS[m[1].toLowerCase()];
    const y = Number(m[3]);
    const d = Number(m[2]);
    return mo && valid(y, mo, d) ? { kind: "fixed", fixed: { y, m: mo, d, time: null } } : { kind: "none" };
  }
  return { kind: "none" };
}

export function formatDate(p: DateParts, out: DateOutput): string {
  const dd = String(p.d).padStart(2, "0");
  const mm = String(p.m).padStart(2, "0");
  const date = out === "iso" ? `${p.y}-${mm}-${dd}` : out === "dmy" ? `${dd}/${mm}/${p.y}` : `${mm}/${dd}/${p.y}`;
  return p.time ? `${date} ${p.time}` : date;
}

export type ColumnDateStatus =
  | { kind: "not-date" }
  | { kind: "fixed" }
  | { kind: "detected"; order: DayOrder; evidence: string }
  | { kind: "ambiguous"; samples: string[] }
  | { kind: "mixed"; dmyExample: string; mdyExample: string };

/**
 * A column counts as dates when at least 80% of its non-empty cells parse.
 * The day order is only taken from cells that prove it (25/04 can only be
 * DD/MM); if no cell proves it, the column is "ambiguous" and the user decides.
 */
export function analyzeDateColumn(values: string[]): ColumnDateStatus {
  let nonEmpty = 0;
  let parsed = 0;
  let dmyEx = "";
  let mdyEx = "";
  const either: string[] = [];
  for (const v of values) {
    if (v.trim() === "") continue;
    nonEmpty++;
    const c = classifyDate(v);
    if (c.kind === "none") continue;
    parsed++;
    if (c.kind === "dmy-only" && !dmyEx) dmyEx = v;
    if (c.kind === "mdy-only" && !mdyEx) mdyEx = v;
    if (c.kind === "either" && either.length < 3 && !either.includes(v)) either.push(v);
  }
  if (nonEmpty === 0 || parsed / nonEmpty < 0.8) return { kind: "not-date" };
  if (dmyEx && mdyEx) return { kind: "mixed", dmyExample: dmyEx, mdyExample: mdyEx };
  if (dmyEx) return { kind: "detected", order: "dmy", evidence: dmyEx };
  if (mdyEx) return { kind: "detected", order: "mdy", evidence: mdyEx };
  if (either.length > 0) return { kind: "ambiguous", samples: either };
  return { kind: "fixed" };
}

/** Returns the reformatted value, or null when the cell is not a valid date in that order. */
export function convertDate(value: string, order: DayOrder | null, out: DateOutput): string | null {
  const c = classifyDate(value);
  let parts: DateParts | undefined;
  if (c.kind === "fixed") parts = c.fixed;
  else if (order === "dmy") parts = c.dmy;
  else if (order === "mdy") parts = c.mdy;
  return parts ? formatDate(parts, out) : null;
}

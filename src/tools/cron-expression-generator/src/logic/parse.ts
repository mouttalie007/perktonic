export type Dialect = "standard" | "quartz" | "aws";

export const DIALECT_LABELS: Record<Dialect, string> = {
  standard: "Standard cron (5 fields: Linux, Kubernetes, GitHub Actions)",
  quartz: "Quartz (6–7 fields with seconds: Java, Spring)",
  aws: "AWS EventBridge (6 fields with year)",
};

export const MAX_EXPRESSION_LENGTH = 200;

const MONTH_NAMES: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
const DOW_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export const MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

export interface DomSpec {
  /** "*" (standard) or "?" (Quartz/AWS): no day-of-month constraint. */
  any: boolean;
  days: Set<number>;
  last: boolean;
  lastOffset: number | null;
  nearestWeekday: number | null;
  lastWeekday: boolean;
}

export interface DowSpec {
  any: boolean;
  /** 0 = Sunday … 6 = Saturday, whatever the dialect's own numbering. */
  days: Set<number>;
  nth: { day: number; n: number } | null;
  lastOf: number | null;
}

export interface CronSpec {
  dialect: Dialect;
  seconds: number[];
  minutes: number[];
  hours: number[];
  months: Set<number>;
  years: Set<number> | null;
  dom: DomSpec;
  dow: DowSpec;
  /** Standard cron ORs the two day fields when both are restricted (Vixie cron rule). */
  dayOr: boolean;
  /** The raw fields, normalised to the dialect's layout. */
  fields: string[];
  /** Expression after macro expansion, without the AWS cron( ) wrapper. */
  normalized: string;
}

export type ParseResult = { ok: true; spec: CronSpec } | { ok: false; error: string };

class CronError extends Error {}

interface FieldDef {
  label: string;
  min: number;
  max: number;
  names?: Record<string, number>;
}

function parseValue(token: string, def: FieldDef): number {
  const upper = token.toUpperCase();
  if (def.names && upper in def.names) return def.names[upper];
  if (!/^\d+$/.test(token)) {
    const hint = def.names ? ` Use numbers ${def.min}–${def.max} or names like ${Object.keys(def.names).slice(0, 3).join(", ")}.` : ` Use a number from ${def.min} to ${def.max}.`;
    throw new CronError(`The ${def.label} field has "${token}", which is not a valid value.${hint}`);
  }
  const n = Number(token);
  if (n < def.min || n > def.max) throw new CronError(`The ${def.label} field has ${n}, but it must be between ${def.min} and ${def.max}.`);
  return n;
}

/** Parses lists, ranges and steps: "*", "5", "1-5", "*\/15", "10-40/10", "MON,WED,FRI". */
function parseList(text: string, def: FieldDef): number[] {
  if (text === "") throw new CronError(`The ${def.label} field is empty.`);
  const out = new Set<number>();
  for (const item of text.split(",")) {
    if (item === "") throw new CronError(`The ${def.label} field has an empty item: check for a doubled or trailing comma.`);
    const m = /^([^/-]+)(?:-([^/]+))?(?:\/(.+))?$/.exec(item);
    if (!m) throw new CronError(`The ${def.label} field has "${item}", which is not a value, range (1-5) or step (*/15).`);
    let start: number;
    let end: number;
    if (m[1] === "*") {
      if (m[2] !== undefined) throw new CronError(`The ${def.label} field has "${item}": a range cannot start with *.`);
      start = def.min;
      end = def.max;
    } else {
      start = parseValue(m[1], def);
      end = m[2] !== undefined ? parseValue(m[2], def) : m[3] !== undefined ? def.max : start;
    }
    if (start > end) {
      throw new CronError(`The ${def.label} field has the range ${item}, which goes backwards. To wrap around, split it in two: ${m[1]}-${def.max},${def.min}-${m[2]}.`);
    }
    let step = 1;
    if (m[3] !== undefined) {
      if (!/^\d+$/.test(m[3]) || Number(m[3]) === 0) throw new CronError(`The ${def.label} field has the step "/${m[3]}"; a step must be a whole number of at least 1.`);
      step = Number(m[3]);
      if (step > def.max - def.min + 1) throw new CronError(`The ${def.label} field has the step /${step}, which is larger than the field's range (${def.min}–${def.max}).`);
    }
    for (let v = start; v <= end; v += step) out.add(v);
  }
  return [...out].sort((a, b) => a - b);
}

function emptyDom(): DomSpec {
  return { any: false, days: new Set(), last: false, lastOffset: null, nearestWeekday: null, lastWeekday: false };
}

function parseDom(text: string, dialect: Dialect): DomSpec {
  const dom = emptyDom();
  const t = text.toUpperCase();
  if (t === "?") {
    if (dialect === "standard") throw new CronError("Standard cron does not use ?. Write * in the day-of-month field instead.");
    dom.any = true;
    return dom;
  }
  if (t === "*") {
    dom.any = true;
    return dom;
  }
  if (/[LW]/.test(t)) {
    if (dialect === "standard") {
      throw new CronError(`Standard cron does not support "${text}" (L and W are Quartz/AWS features). Switch the dialect to Quartz or AWS, or use a day number.`);
    }
    if (t === "L") dom.last = true;
    else if (t === "LW") dom.lastWeekday = true;
    else if (/^L-\d+$/.test(t)) {
      const n = Number(t.slice(2));
      if (n < 1 || n > 30) throw new CronError("In L-n (n days before the last day of the month) n must be between 1 and 30.");
      dom.lastOffset = n;
    } else if (/^\d+W$/.test(t)) {
      const n = Number(t.slice(0, -1));
      if (n < 1 || n > 31) throw new CronError(`In ${text} the day must be between 1 and 31.`);
      dom.nearestWeekday = n;
    } else {
      throw new CronError(`The day-of-month field has "${text}". Valid special forms are L (last day), L-3 (3 days before the last), LW (last weekday) and 15W (weekday nearest the 15th); they cannot be combined with other values.`);
    }
    return dom;
  }
  for (const d of parseList(text, { label: "day-of-month", min: 1, max: 31 })) dom.days.add(d);
  return dom;
}

function parseDow(text: string, dialect: Dialect): DowSpec {
  const dow: DowSpec = { any: false, days: new Set(), nth: null, lastOf: null };
  const t = text.toUpperCase();
  const oneBased = dialect !== "standard";
  const names: Record<string, number> = {};
  DOW_NAMES.forEach((n, i) => (names[n] = oneBased ? i + 1 : i));
  const def: FieldDef = oneBased ? { label: "day-of-week", min: 1, max: 7, names } : { label: "day-of-week", min: 0, max: 7, names };
  const toZero = (v: number) => (oneBased ? v - 1 : v % 7);

  if (t === "?") {
    if (dialect === "standard") throw new CronError("Standard cron does not use ?. Write * in the day-of-week field instead.");
    dow.any = true;
    return dow;
  }
  if (t === "*") {
    dow.any = true;
    return dow;
  }
  if (/[#L]/.test(t)) {
    if (dialect === "standard") {
      throw new CronError(`Standard cron does not support "${text}" (# and L are Quartz/AWS features). Switch the dialect to Quartz or AWS.`);
    }
    if (t === "L") {
      dow.days.add(6);
      return dow;
    }
    let m = /^([A-Z0-9]+)#(\d+)$/.exec(t);
    if (m) {
      const n = Number(m[2]);
      if (n < 1 || n > 5) throw new CronError(`In ${text} the number after # must be 1–5 (first to fifth ${m[1]} of the month).`);
      dow.nth = { day: toZero(parseValue(m[1], def)), n };
      return dow;
    }
    m = /^([A-Z0-9]+)L$/.exec(t);
    if (m) {
      dow.lastOf = toZero(parseValue(m[1], def));
      return dow;
    }
    throw new CronError(`The day-of-week field has "${text}". Use 6#3 (third Friday in Quartz numbering) or 6L (last Friday); these cannot be combined with other values.`);
  }
  for (const v of parseList(text, def)) dow.days.add(toZero(v));
  return dow;
}

export function stripAws(expr: string): string {
  const m = /^cron\((.*)\)$/i.exec(expr.trim());
  return m ? m[1].trim() : expr.trim();
}

export function parseCron(input: string, dialect: Dialect): ParseResult {
  try {
    const raw = input.trim().replace(/\s+/g, " ");
    if (raw === "") throw new CronError("Enter a cron expression, describe the schedule in words, or use the builder.");
    if (raw.length > MAX_EXPRESSION_LENGTH) throw new CronError(`The expression is longer than ${MAX_EXPRESSION_LENGTH} characters.`);
    if (/^rate\(/i.test(raw)) {
      throw new CronError("rate(...) is an EventBridge rate expression, not cron. For every 5 minutes write cron(0/5 * * * ? *) instead.");
    }
    let expr = dialect === "aws" ? stripAws(raw) : raw;
    if (dialect !== "aws" && /^cron\(/i.test(raw)) throw new CronError("cron(...) with brackets is the AWS EventBridge format. Switch the dialect to AWS EventBridge.");
    if (expr.startsWith("@")) {
      const key = expr.toLowerCase();
      if (key === "@reboot") throw new CronError("@reboot runs once when the machine starts, so it has no schedule to show.");
      if (dialect !== "standard") throw new CronError(`${expr} is a standard cron macro. Quartz and AWS do not support macros; switch the dialect to Standard.`);
      if (!MACROS[key]) throw new CronError(`${expr} is not a known macro. Use @yearly, @monthly, @weekly, @daily or @hourly.`);
      expr = MACROS[key];
    }
    const parts = expr.split(" ");
    let fields: string[];
    if (dialect === "standard") {
      if (parts.length !== 5) {
        throw new CronError(
          parts.length === 6 || parts.length === 7
            ? `This has ${parts.length} fields, but standard cron has 5 (minute hour day month weekday). It looks like Quartz or AWS: switch the dialect.`
            : `Standard cron needs 5 fields (minute hour day-of-month month day-of-week); this has ${parts.length}.`,
        );
      }
      fields = ["0", ...parts, "*"];
    } else if (dialect === "quartz") {
      if (parts.length !== 6 && parts.length !== 7) {
        throw new CronError(`Quartz needs 6 or 7 fields (second minute hour day-of-month month day-of-week [year]); this has ${parts.length}.${parts.length === 5 ? " Add the seconds first, e.g. 0 " + expr : ""}`);
      }
      fields = parts.length === 6 ? [...parts, "*"] : parts;
    } else {
      if (parts.length !== 6) {
        throw new CronError(`AWS EventBridge needs 6 fields (minute hour day-of-month month day-of-week year); this has ${parts.length}.${parts.length === 5 ? " Add a year field, usually *." : ""}`);
      }
      fields = ["0", ...parts];
    }
    const [secF, minF, hourF, domF, monF, dowF, yearF] = fields;

    const seconds = parseList(secF, { label: "seconds", min: 0, max: 59 });
    const minutes = parseList(minF, { label: "minute", min: 0, max: 59 });
    const hours = parseList(hourF, { label: "hour", min: 0, max: 23 });
    const months = new Set(parseList(monF, { label: "month", min: 1, max: 12, names: MONTH_NAMES }));
    const dom = parseDom(domF, dialect);
    const dow = parseDow(dowF, dialect);
    let years: Set<number> | null = null;
    if (yearF !== "*") {
      const max = dialect === "aws" ? 2199 : 2099;
      years = new Set(parseList(yearF, { label: "year", min: 1970, max }));
    }

    if (dialect !== "standard") {
      const domQ = domF === "?";
      const dowQ = dowF === "?";
      if (domQ && dowQ) throw new CronError("Only one of day-of-month and day-of-week can be ?. Put * in the other one.");
      if (!domQ && !dowQ) {
        throw new CronError(
          `${dialect === "aws" ? "AWS EventBridge" : "Quartz"} needs ? in either day-of-month or day-of-week, because both cannot be set at once. For example: ${dialect === "aws" ? "0 9 ? * MON-FRI *" : "0 0 9 ? * MON-FRI"}.`,
        );
      }
    }

    const dayOr = dialect === "standard" && !domF.startsWith("*") && !dowF.startsWith("*");
    const normalized = dialect === "standard" ? fields.slice(1, 6).join(" ") : dialect === "quartz" ? parts.join(" ") : fields.slice(1).join(" ");
    return {
      ok: true,
      spec: { dialect, seconds, minutes, hours, months, years, dom, dow, dayOr, fields, normalized },
    };
  } catch (err) {
    if (err instanceof CronError) return { ok: false, error: err.message };
    throw err;
  }
}

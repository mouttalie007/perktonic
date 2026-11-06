import { parseCron, type CronSpec, type Dialect } from "./parse";

/** Dialect-neutral schedule produced by the builder and the plain-language parser. */
export type DayRule =
  | { kind: "every" }
  | { kind: "dom"; value: string }
  | { kind: "last" }
  | { kind: "lastWeekday" }
  | { kind: "nearestWeekday"; day: number }
  | { kind: "weekdays"; days: number[] }
  | { kind: "nth"; day: number; n: number }
  | { kind: "lastDow"; day: number };

export interface Schedule {
  second: string;
  minute: string;
  hour: string;
  month: string;
  year: string;
  day: DayRule;
}

export type RenderResult = { ok: true; expression: string } | { ok: false; error: string };

const DOW_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SWITCH = "Switch the dialect to Quartz or AWS EventBridge.";

/** [1,2,3,5] → "1-3,5" */
export function compress(values: number[], label: (v: number) => string = String): string {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    if (j - i >= 2) parts.push(`${label(sorted[i])}-${label(sorted[j])}`);
    else for (let k = i; k <= j; k++) parts.push(label(sorted[k]));
    i = j;
  }
  return parts.join(",");
}

function dowField(days: number[], dialect: Dialect): string {
  if (dialect === "standard") return compress(days);
  return compress(days.map((d) => d + 1), (v) => DOW_NAMES[v - 1]);
}

export function render(s: Schedule, dialect: Dialect): RenderResult {
  if (dialect !== "quartz" && s.second !== "0") {
    return { ok: false, error: `${dialect === "aws" ? "AWS EventBridge" : "Standard cron"} cannot run more often than once a minute (no seconds field). ${dialect === "standard" ? "Switch the dialect to Quartz." : "Use Quartz, or a rate() expression in EventBridge."}` };
  }
  if (dialect === "standard" && s.year !== "*") return { ok: false, error: "Standard cron has no year field. " + SWITCH };

  let dom = "*";
  let dow = "*";
  const d = s.day;
  switch (d.kind) {
    case "every":
      break;
    case "dom":
      dom = d.value;
      break;
    case "last":
      if (dialect === "standard") return { ok: false, error: "Standard cron cannot say “last day of the month” (no L). " + SWITCH + " A common workaround is 0 0 28-31 * * plus a date check in the script." };
      dom = "L";
      break;
    case "lastWeekday":
      if (dialect === "standard") return { ok: false, error: "Standard cron cannot say “last weekday of the month” (no LW). " + SWITCH };
      dom = "LW";
      break;
    case "nearestWeekday":
      if (dialect === "standard") return { ok: false, error: "Standard cron has no W (nearest weekday). " + SWITCH };
      dom = `${d.day}W`;
      break;
    case "weekdays":
      dow = dowField(d.days, dialect);
      break;
    case "nth":
      if (dialect === "standard") return { ok: false, error: `Standard cron cannot pick the ${["", "first", "second", "third", "fourth", "fifth"][d.n]} ${DAY_LABELS[d.day]} of the month (no #). ` + SWITCH };
      dow = `${d.day + 1}#${d.n}`;
      break;
    case "lastDow":
      if (dialect === "standard") return { ok: false, error: `Standard cron cannot pick the last ${DAY_LABELS[d.day]} of the month. ` + SWITCH };
      dow = `${d.day + 1}L`;
      break;
  }

  if (dialect === "standard") return { ok: true, expression: [s.minute, s.hour, dom, s.month, dow].join(" ") };
  const domQ = dow !== "*" ? "?" : dom;
  const dowQ = dow !== "*" ? dow : "?";
  if (dialect === "quartz") {
    const parts = [s.second, s.minute, s.hour, domQ, s.month, dowQ];
    if (s.year !== "*") parts.push(s.year);
    return { ok: true, expression: parts.join(" ") };
  }
  return { ok: true, expression: `cron(${[s.minute, s.hour, domQ, s.month, dowQ, s.year].join(" ")})` };
}

/** Rewrites a valid expression for another dialect, or explains why it cannot be. */
export function convertDialect(expression: string, from: Dialect, to: Dialect): RenderResult {
  const parsed = parseCron(expression, from);
  if (!parsed.ok) return parsed;
  if (from === to) return { ok: true, expression: from === "aws" ? `cron(${parsed.spec.normalized})` : parsed.spec.normalized };
  const spec: CronSpec = parsed.spec;
  const [sec, min, hour, domF, mon, dowF, year] = spec.fields;
  const domRestricted = domF !== "*" && domF !== "?";
  const dowRestricted = dowF !== "*" && dowF !== "?";
  if (domRestricted && dowRestricted) {
    return { ok: false, error: "This expression sets both day-of-month and day-of-week. Standard cron runs when either matches, which Quartz and AWS cannot express in one schedule. Split it into two schedules." };
  }
  let day: DayRule = { kind: "every" };
  if (domRestricted) {
    const dom = spec.dom;
    if (dom.last) day = { kind: "last" };
    else if (dom.lastWeekday) day = { kind: "lastWeekday" };
    else if (dom.nearestWeekday !== null) day = { kind: "nearestWeekday", day: dom.nearestWeekday };
    else if (dom.lastOffset !== null) {
      if (to === "standard") return { ok: false, error: "Standard cron has no L-n (days before the end of the month)." };
      return { ok: true, expression: to === "quartz" ? [sec, min, hour, domF, mon, "?", ...(year !== "*" ? [year] : [])].join(" ") : `cron(${[min, hour, domF, mon, "?", year].join(" ")})` };
    } else day = { kind: "dom", value: domF };
  } else if (dowRestricted) {
    const dow = spec.dow;
    if (dow.nth) day = { kind: "nth", day: dow.nth.day, n: dow.nth.n };
    else if (dow.lastOf !== null) day = { kind: "lastDow", day: dow.lastOf };
    else day = { kind: "weekdays", days: [...dow.days] };
  }
  return render({ second: sec, minute: min, hour, month: mon, year, day }, to);
}

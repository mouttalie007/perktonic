import type { DayRule, Schedule } from "./build";

export type NaturalResult = { ok: true; schedule: Schedule } | { ok: false; error: string };

export const MAX_PHRASE_LENGTH = 200;

const DAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
};
const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4, may: 5, june: 6, jun: 6,
  july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9, october: 10, oct: 10,
  november: 11, nov: 11, december: 12, dec: 12,
};
const ORDINALS: Record<string, number> = { first: 1, "1st": 1, second: 2, "2nd": 2, third: 3, "3rd": 3, fourth: 4, "4th": 4, fifth: 5, "5th": 5 };

const DAY_RE = "(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues|tue|wed|thurs|thur|thu|fri|sat)s?";
const MONTH_RE = "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)";
const TIME_RE = "(noon|midday|midnight|\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?)";

const EXAMPLES = "Try “every weekday at 9:30”, “every 15 minutes”, “every Monday and Thursday at 6pm”, “on the last day of the month at 23:00” or “first Monday of the month at 10am”.";

interface Time {
  h: number;
  m: number;
}

function parseTime(raw: string): Time | null {
  const t = raw.trim();
  if (t === "noon" || t === "midday") return { h: 12, m: 0 };
  if (t === "midnight") return { h: 0, m: 0 };
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(t);
  if (!m) return null;
  let h = Number(m[1]);
  const mi = m[2] ? Number(m[2]) : 0;
  if (m[3]) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (m[3] === "pm" ? 12 : 0);
  } else if (!m[2] && h > 24) return null;
  if (h > 23 || mi > 59) return null;
  return { h, m: mi };
}

function dayList(text: string): number[] {
  const out: number[] = [];
  const re = new RegExp(`\\b${DAY_RE}\\b`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(DAYS[m[1]]);
  return out;
}

/**
 * Turns common English schedule phrases into a schedule without any AI:
 * a fixed set of patterns for intervals, times, weekdays, days of the month,
 * nth/last weekdays, months and years. Anything else gets a clear error.
 */
export function parseNatural(input: string): NaturalResult {
  let t = input.toLowerCase().trim();
  if (t === "") return { ok: false, error: "Describe the schedule in words. " + EXAMPLES };
  if (t.length > MAX_PHRASE_LENGTH) return { ok: false, error: `Keep the description under ${MAX_PHRASE_LENGTH} characters.` };
  t = t
    .replace(/a\.m\./g, "am")
    .replace(/p\.m\./g, "pm")
    .replace(/[.!]+$/g, "")
    .replace(/(\d)\s*o'?clock/g, "$1:00")
    .replace(/(\d)\.(\d{2})\b/g, "$1:$2")
    .replace(/\s+/g, " ");

  const s: Schedule = { second: "0", minute: "0", hour: "0", month: "*", year: "*", day: { kind: "every" } };
  let understood = false;
  let intervalKind: "seconds" | "minutes" | "hours" | null = null;

  // Intervals
  let m = /every (\d+) ?(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/.exec(t);
  if (m) {
    const n = Number(m[1]);
    const unit = m[2][0];
    if (unit === "s") {
      if (n < 1 || n > 59) return { ok: false, error: "Use an interval of 1 to 59 seconds." };
      s.second = n === 1 ? "*" : `0/${n}`;
      s.minute = "*";
      s.hour = "*";
      intervalKind = "seconds";
    } else if (unit === "m") {
      if (n < 1 || n > 59) return { ok: false, error: "Use an interval of 1 to 59 minutes. For longer gaps, use hours." };
      s.minute = n === 1 ? "*" : `*/${n}`;
      s.hour = "*";
      intervalKind = "minutes";
    } else {
      if (n < 1 || n > 23) return { ok: false, error: "Use an interval of 1 to 23 hours. For longer gaps, use days." };
      s.hour = n === 1 ? "*" : `*/${n}`;
      intervalKind = "hours";
    }
    understood = true;
  } else if (/\bevery second\b/.test(t)) {
    s.second = "*";
    s.minute = "*";
    s.hour = "*";
    intervalKind = "seconds";
    understood = true;
  } else if (/\bevery minute\b/.test(t)) {
    s.minute = "*";
    s.hour = "*";
    intervalKind = "minutes";
    understood = true;
  } else if (/\b(every hour|hourly)\b/.test(t)) {
    s.hour = "*";
    intervalKind = "hours";
    understood = true;
  } else if (/\b(every half hour|every half an hour|twice an hour)\b/.test(t)) {
    s.minute = "0,30";
    s.hour = "*";
    intervalKind = "minutes";
    understood = true;
  }
  if (intervalKind === "hours") {
    const pm = /(?:at|past)\s*(?:minute\s*)?:?(\d{1,2})\b(?! ?(?:am|pm|:))(?: minutes? past)?/.exec(t.replace(/every \d+ ?(hours?|hrs?)/, ""));
    const past = /(\d{1,2}) minutes? past/.exec(t);
    const minute = past ? Number(past[1]) : pm && /at :|at minute|past/.test(t) ? Number(pm[1]) : null;
    if (minute !== null) {
      if (minute > 59) return { ok: false, error: "The minute past the hour must be 0–59." };
      s.minute = String(minute);
    }
  }

  // Hour window: "between 9am and 5pm"
  m = new RegExp(`between ${TIME_RE} and ${TIME_RE}`).exec(t);
  if (m) {
    const a = parseTime(m[1]);
    const b = parseTime(m[2]);
    if (!a || !b) return { ok: false, error: "I could not read the times in “between … and …”. Use 9am, 17:00 or noon." };
    const end = intervalKind === "hours" || b.m > 0 ? b.h : b.h - 1;
    if (end < a.h) return { ok: false, error: "The window must end after it starts on the same day, e.g. between 9am and 5pm." };
    s.hour = intervalKind === "hours" && s.hour.startsWith("*/") ? `${a.h}-${end}/${s.hour.slice(2)}` : `${a.h}-${end}`;
    understood = true;
    t = t.replace(m[0], " ");
  }

  // Fixed times: "at 9:30", "at 9am and 5pm", "at noon"
  if (intervalKind === null) {
    const times: Time[] = [];
    const re = new RegExp(`(?:\\bat\\b|@|\\band\\b|,)\\s*${TIME_RE}(?![\\w])`, "g");
    let tm: RegExpExecArray | null;
    let sawAt = /\bat\b|@/.test(t);
    while ((tm = re.exec(t))) {
      if (/^\d{1,2}$/.test(tm[1].trim()) && !sawAt) continue;
      const parsed = parseTime(tm[1]);
      if (!parsed) return { ok: false, error: `“${tm[1].trim()}” is not a time I understand. Use 9:30, 9:30pm, 21:30, noon or midnight.` };
      times.push(parsed);
    }
    if (/\b(noon|midday|midnight)\b/.test(t) && times.length === 0) {
      const word = /\b(noon|midday|midnight)\b/.exec(t)![1];
      times.push(parseTime(word)!);
      sawAt = true;
    }
    if (times.length > 0) {
      const minutes = new Set(times.map((x) => x.m));
      if (minutes.size > 1) {
        return { ok: false, error: "One cron expression can only use one minute for several hours (e.g. 9:30 and 17:30). Times like 9:00 and 17:30 need two schedules." };
      }
      s.minute = String(times[0].m);
      s.hour = [...new Set(times.map((x) => x.h))].sort((a, b) => a - b).join(",");
      understood = true;
    }
    void sawAt;
  }

  // Days
  let day: DayRule | null = null;
  if ((m = new RegExp(`\\b(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th|last) ${DAY_RE}\\b`).exec(t))) {
    day = m[1] === "last" ? { kind: "lastDow", day: DAYS[m[2]] } : { kind: "nth", day: DAYS[m[2]], n: ORDINALS[m[1]] };
  } else if (/\blast (week ?day|business day|working day) of\b/.test(t)) {
    day = { kind: "lastWeekday" };
  } else if (/\blast day of\b|\bend of (the|every) month\b|\bmonth end\b/.test(t)) {
    day = { kind: "last" };
  } else if (/\b(every )?(weekdays?|workdays?|business days?|working days?)\b|\bmonday (to|through|-) friday\b|\bmon ?- ?fri\b/.test(t)) {
    day = { kind: "weekdays", days: [1, 2, 3, 4, 5] };
  } else if (/\bweekends?\b/.test(t)) {
    day = { kind: "weekdays", days: [0, 6] };
  } else {
    const dl = dayList(t);
    if (dl.length > 0) day = { kind: "weekdays", days: [...new Set(dl)].sort((a, b) => a - b) };
  }

  // Day of month: "on the 1st and 15th", "on day 10", "15th of every month", "January 1"
  let monthList: number[] = [];
  const monRe = new RegExp(`\\b${MONTH_RE}\\b`, "g");
  let mm: RegExpExecArray | null;
  while ((mm = monRe.exec(t))) {
    // "mar" or "may" inside other words is excluded by \b; "sat"/"sun" are days, not months.
    monthList.push(MONTHS[mm[1]]);
  }
  monthList = [...new Set(monthList)].sort((a, b) => a - b);

  if (!day) {
    const domNums: number[] = [];
    const re = /(?:^|\bon (?:the )?|\bday |\bthe |\band |, ?|\bevery )(\d{1,2})(?:st|nd|rd|th)\b|\bday (\d{1,2})\b/g;
    let dm: RegExpExecArray | null;
    while ((dm = re.exec(t))) domNums.push(Number(dm[1] ?? dm[2]));
    if (monthList.length > 0) {
      const md = new RegExp(`\\b${MONTH_RE} (\\d{1,2})(?:st|nd|rd|th)?\\b|\\b(\\d{1,2})(?:st|nd|rd|th)? (?:of )?${MONTH_RE}\\b`).exec(t);
      if (md) domNums.push(Number(md[2] ?? md[3]));
    }
    if (domNums.length > 0) {
      const bad = domNums.find((n) => n < 1 || n > 31);
      if (bad !== undefined) return { ok: false, error: `${bad} is not a day of the month (1–31).` };
      day = { kind: "dom", value: [...new Set(domNums)].sort((a, b) => a - b).join(",") };
    } else if (/\b(monthly|every month|each month)\b/.test(t)) {
      day = { kind: "dom", value: "1" };
    } else if (/\b(yearly|annually|every year|each year)\b/.test(t)) {
      day = { kind: "dom", value: "1" };
      if (monthList.length === 0) monthList = [1];
    }
  }
  if (day) {
    s.day = day;
    understood = true;
  } else if (/\b(daily|every day|each day|every night|nightly)\b/.test(t)) {
    understood = true;
  }
  if (monthList.length > 0) {
    s.month = monthList.join(",");
    understood = true;
  }

  const year = /\b(?:in|during|of) (\d{4})\b/.exec(t);
  if (year) {
    const y = Number(year[1]);
    if (y < 1970 || y > 2199) return { ok: false, error: "The year must be between 1970 and 2199." };
    s.year = String(y);
  }

  if (!understood) return { ok: false, error: `I could not turn “${input.trim()}” into a schedule. ${EXAMPLES}` };
  return { ok: true, schedule: s };
}

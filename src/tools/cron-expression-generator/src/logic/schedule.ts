import type { CronSpec } from "./parse";
import { wallClock, wallToInstants, type WallTime } from "./timezone";

export interface Run {
  utc: number;
  /** The wall-clock time happens twice (autumn DST change); this is the first one. */
  repeated: boolean;
}

export interface ScheduleResult {
  runs: Run[];
  /** Wall-clock times the schedule asked for that do not exist (spring DST gap). */
  skipped: WallTime[];
  /** True when the search ended without finding enough runs (e.g. 30 February or a past year). */
  exhausted: boolean;
}

function daysIn(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function weekday(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function nearestWeekday(target: number, y: number, m: number): number {
  const last = daysIn(y, m);
  const day = Math.min(target, last);
  const wd = weekday(y, m, day);
  if (wd === 6) return day === 1 ? 3 : day - 1;
  if (wd === 0) return day === last ? day - 2 : day + 1;
  return day;
}

function lastWeekdayOfMonth(y: number, m: number): number {
  let d = daysIn(y, m);
  while (weekday(y, m, d) === 0 || weekday(y, m, d) === 6) d--;
  return d;
}

function domMatches(spec: CronSpec, y: number, m: number, d: number): boolean {
  const dom = spec.dom;
  if (dom.any) return true;
  if (dom.days.has(d)) return true;
  const last = daysIn(y, m);
  if (dom.last && d === last) return true;
  if (dom.lastOffset !== null && d === last - dom.lastOffset) return true;
  if (dom.lastWeekday && d === lastWeekdayOfMonth(y, m)) return true;
  if (dom.nearestWeekday !== null && d === nearestWeekday(dom.nearestWeekday, y, m)) return true;
  return false;
}

function dowMatches(spec: CronSpec, y: number, m: number, d: number): boolean {
  const dow = spec.dow;
  if (dow.any) return true;
  const wd = weekday(y, m, d);
  if (dow.days.has(wd)) return true;
  if (dow.nth && dow.nth.day === wd && Math.ceil(d / 7) === dow.nth.n) return true;
  if (dow.lastOf !== null && dow.lastOf === wd && d + 7 > daysIn(y, m)) return true;
  return false;
}

export function dayMatches(spec: CronSpec, y: number, m: number, d: number): boolean {
  if (spec.dayOr) return domMatches(spec, y, m, d) || dowMatches(spec, y, m, d);
  return domMatches(spec, y, m, d) && dowMatches(spec, y, m, d);
}

const MAX_YEARS_AHEAD = 100;

/**
 * Finds the next `count` runs strictly after `fromMs`, evaluating the
 * schedule on the wall clock of `tz`, as cron daemons and Quartz do.
 * Times inside a DST gap are skipped (and reported); times that repeat in
 * the autumn run once, at their first occurrence.
 */
export function nextRuns(spec: CronSpec, fromMs: number, tz: string, count = 10): ScheduleResult {
  const runs: Run[] = [];
  const skipped: WallTime[] = [];
  const start = wallClock(fromMs, tz);
  const yearLimit = spec.years ? Math.min(Math.max(...spec.years), start.y + MAX_YEARS_AHEAD) : start.y + MAX_YEARS_AHEAD;
  let y = start.y;
  let m = start.m;
  let d = start.d;
  let first = true;

  const nextMonth = () => {
    m++;
    d = 1;
    if (m > 12) {
      m = 1;
      y++;
    }
    first = false;
  };

  while (y <= yearLimit) {
    if (spec.years && !spec.years.has(y)) {
      y++;
      m = 1;
      d = 1;
      first = false;
      continue;
    }
    if (!spec.months.has(m) || d > daysIn(y, m)) {
      nextMonth();
      continue;
    }
    if (dayMatches(spec, y, m, d)) {
      for (const h of spec.hours) {
        if (first && h < start.h) continue;
        for (const mi of spec.minutes) {
          if (first && h === start.h && mi < start.mi) continue;
          for (const s of spec.seconds) {
            if (first && h === start.h && mi === start.mi && s <= start.s) continue;
            const wall = { y, m, d, h, mi, s };
            const instants = wallToInstants(wall, tz);
            if (instants.length === 0) {
              if (skipped.length < 5) skipped.push(wall);
              continue;
            }
            if (instants[0] <= fromMs) continue;
            runs.push({ utc: instants[0], repeated: instants.length > 1 });
            if (runs.length >= count) return { runs, skipped, exhausted: false };
          }
        }
      }
    }
    d++;
    first = false;
  }
  return { runs, skipped, exhausted: true };
}

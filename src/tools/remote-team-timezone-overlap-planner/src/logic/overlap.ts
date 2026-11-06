import { offsetAt, wallClock, wallToInstants, type WallTime } from "./timezone";

export const SLOT_MINUTES = 15;
export const MAX_PEOPLE = 30;
const MIN = 60_000;

export interface Person {
  name: string;
  zone: string;
  /** "HH:MM" local time. An end at or before the start means the shift ends the next day. */
  start: string;
  end: string;
  /** Working days, 0 = Sunday … 6 = Saturday (the day the shift starts). */
  days: number[];
}

export interface Plan {
  people: Person[];
  /** The day to plan, as YYYY-MM-DD in the view zone. */
  date: string;
  viewZone: string;
  minMinutes: number;
}

export class PlanError extends Error {}

export function parseHm(text: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 24 || mi > 59 || (h === 24 && mi > 0)) return null;
  return h * 60 + mi;
}

function addDays(y: number, m: number, d: number, n: number): { y: number; m: number; d: number } {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function weekday(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * The instant a local time happens. A time inside a spring-forward gap moves
 * to the first minute after the gap; a repeated autumn time uses its first
 * occurrence for a start and its second for an end, so the shift never shrinks.
 */
function instantOf(day: { y: number; m: number; d: number }, minutes: number, zone: string, kind: "start" | "end"): { t: number; moved: number } {
  const base = { y: day.y, m: day.m, d: day.d, h: 0, mi: 0, s: 0 };
  const wall = (mins: number): WallTime => {
    const dd = addDays(day.y, day.m, day.d, Math.floor(mins / 1440));
    const r = ((mins % 1440) + 1440) % 1440;
    return { ...base, ...dd, h: Math.floor(r / 60), mi: r % 60 };
  };
  for (let shift = 0; shift <= 120; shift += 15) {
    const found = wallToInstants(wall(minutes + shift), zone);
    if (found.length > 0) return { t: kind === "start" ? found[0] : found[found.length - 1], moved: shift };
  }
  throw new PlanError(`The time could not be placed in ${zone}.`);
}

export interface Interval {
  from: number;
  to: number;
  /** Local date the shift starts on, for messages. */
  localDate: string;
  note: string | null;
}

/** Shifts that can touch the given UTC window: the person's local days before, on and after it. */
export function shiftsFor(p: Person, windowStart: number, windowEnd: number): Interval[] {
  const s = parseHm(p.start);
  const e = parseHm(p.end);
  if (s === null || e === null) throw new PlanError(`${p.name || "A person"}: working hours must look like 09:00 and 17:30.`);
  // A time input cannot hold 24:00, so the same start and end means a 24-hour shift.
  const overnight = e <= s;
  const local = wallClock(windowStart, p.zone);
  const out: Interval[] = [];
  for (let k = -2; k <= 2; k++) {
    const day = addDays(local.y, local.m, local.d, k);
    if (!p.days.includes(weekday(day.y, day.m, day.d))) continue;
    const a = instantOf(day, s, p.zone, "start");
    const b = instantOf(day, overnight ? e + 1440 : e, p.zone, "end");
    if (b.t <= windowStart || a.t >= windowEnd) continue;
    const iso = `${day.y}-${String(day.m).padStart(2, "0")}-${String(day.d).padStart(2, "0")}`;
    const note = a.moved ? `${p.start} does not exist in ${p.zone} on ${iso} (clocks jump forward); the shift starts ${a.moved} minutes later.` : b.moved ? `${p.end} does not exist in ${p.zone} on that day; the shift ends ${b.moved} minutes later.` : null;
    out.push({ from: a.t, to: b.t, localDate: iso, note });
  }
  return out;
}

export interface Slot {
  t: number;
  available: boolean[];
  count: number;
}

export interface Window {
  from: number;
  to: number;
  count: number;
  /** Names of people outside their working hours for (part of) the window. */
  missing: string[];
}

export interface DayResult {
  dayStart: number;
  dayEnd: number;
  slots: Slot[];
  /** Windows where everyone is available, longest first; if there are none, the best partial ones. */
  best: Window[];
  allAvailable: boolean;
  sharedMinutes: number;
  notes: string[];
}

export function validatePlan(plan: Plan, isZone: (z: string) => boolean): void {
  if (plan.people.length === 0) throw new PlanError("Add at least two people (or locations) to compare.");
  if (plan.people.length > MAX_PEOPLE) throw new PlanError(`You can compare up to ${MAX_PEOPLE} people.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.date)) throw new PlanError("Pick a date to plan.");
  if (!isZone(plan.viewZone)) throw new PlanError(`“${plan.viewZone}” is not a time zone.`);
  plan.people.forEach((p, i) => {
    const who = p.name.trim() || `Person ${i + 1}`;
    if (!isZone(p.zone)) throw new PlanError(`${who}: choose a city or time zone.`);
    if (parseHm(p.start) === null || parseHm(p.end) === null) throw new PlanError(`${who}: working hours must look like 09:00 and 17:30.`);
    if (p.days.length === 0) throw new PlanError(`${who}: pick at least one working day.`);
  });
}

/** Availability in 15-minute slots across one day of the view zone (23, 24 or 25 hours long around DST changes). */
export function computeDay(plan: Plan): DayResult {
  const [y, m, d] = plan.date.split("-").map(Number);
  const dayStart = instantOf({ y, m, d }, 0, plan.viewZone, "start").t;
  const next = addDays(y, m, d, 1);
  const dayEnd = instantOf(next, 0, plan.viewZone, "start").t;
  const notes = new Set<string>();
  const shifts = plan.people.map((p) => {
    const list = shiftsFor(p, dayStart, dayEnd);
    for (const s of list) if (s.note) notes.add(s.note);
    return list;
  });
  const slots: Slot[] = [];
  for (let t = dayStart; t < dayEnd; t += SLOT_MINUTES * MIN) {
    const available = shifts.map((list) => list.some((s) => s.from <= t && t + SLOT_MINUTES * MIN <= s.to));
    slots.push({ t, available, count: available.filter(Boolean).length });
  }
  const n = plan.people.length;
  const runs = (min: number): Window[] => {
    const out: Window[] = [];
    let i = 0;
    while (i < slots.length) {
      if (slots[i].count < min) {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < slots.length && slots[j + 1].count >= min) j++;
      const run = slots.slice(i, j + 1);
      const missing = plan.people.map((p, k) => ({ name: p.name.trim() || `Person ${k + 1}`, k })).filter(({ k }) => run.some((s) => !s.available[k])).map((x) => x.name);
      out.push({ from: slots[i].t, to: slots[j].t + SLOT_MINUTES * MIN, count: Math.min(...run.map((s) => s.count)), missing });
      i = j + 1;
    }
    return out.filter((w) => w.to - w.from >= plan.minMinutes * MIN).sort((a, b) => b.to - b.from - (a.to - a.from) || a.from - b.from);
  };
  let best = runs(n);
  const allAvailable = best.length > 0;
  const sharedMinutes = best.reduce((s, w) => s + (w.to - w.from) / MIN, 0);
  for (let k = n - 1; best.length === 0 && k >= Math.min(2, n); k--) best = runs(k);
  return { dayStart, dayEnd, slots, best: best.slice(0, 5), allAvailable, sharedMinutes, notes: [...notes] };
}

export function hm(t: number, zone: string): string {
  const w = wallClock(t, zone);
  return `${String(w.h).padStart(2, "0")}:${String(w.mi).padStart(2, "0")}`;
}

export function utcOffsetLabel(t: number, zone: string): string {
  const off = offsetAt(t, zone) / MIN;
  const sign = off < 0 ? "−" : "+";
  const a = Math.abs(off);
  return `UTC${sign}${Math.floor(a / 60)}${a % 60 ? `:${String(a % 60).padStart(2, "0")}` : ""}`;
}

/** “09:00–11:00 UTC (10:00–12:00 London, 14:30–16:30 Kolkata): everyone is within working hours.” */
export function explainWindow(w: Window, plan: Plan, total: number): string {
  const fmt = (zone: string) => `${hm(w.from, zone)}–${hm(w.to, zone)}`;
  const zones = [...new Set(plan.people.map((p) => p.zone))].filter((z) => z !== plan.viewZone);
  const local = zones.map((z) => `${fmt(z)} ${z.split("/").pop()!.replace(/_/g, " ")}`).join(", ");
  const head = `${fmt(plan.viewZone)} ${plan.viewZone === "UTC" ? "UTC" : plan.viewZone.split("/").pop()!.replace(/_/g, " ")}${local ? ` (${local})` : ""}`;
  if (w.count === total) return `${head}: everyone is within working hours.`;
  return `${head}: ${w.count} of ${total} people are within working hours; outside: ${w.missing.join(", ")}.`;
}

export interface OutlookChange {
  date: string;
  sharedMinutes: number;
}

/**
 * How the shared time changes over the coming weeks, e.g. when one country
 * changes its clocks and another does not. Only days on which the shared
 * time differs from the day before are returned.
 */
export function outlook(plan: Plan, days: number): { base: number; changes: OutlookChange[] } {
  const [y, m, d] = plan.date.split("-").map(Number);
  const base = computeDay(plan).sharedMinutes;
  const changes: OutlookChange[] = [];
  let prev = base;
  // Same weekday each week, so working-day patterns do not create noise.
  for (let k = 7; k <= days; k += 7) {
    const day = addDays(y, m, d, k);
    const date = `${day.y}-${String(day.m).padStart(2, "0")}-${String(day.d).padStart(2, "0")}`;
    const shared = computeDay({ ...plan, date }).sharedMinutes;
    if (shared !== prev) changes.push({ date, sharedMinutes: shared });
    prev = shared;
  }
  return { base, changes };
}

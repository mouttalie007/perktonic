import type { DayRule, Schedule } from "./build";

export type Frequency = "minutes" | "hourly" | "daily" | "weekly" | "monthly" | "yearly";
export type MonthlyMode = "day" | "last" | "lastWeekday" | "nth";

export interface BuilderState {
  frequency: Frequency;
  everyMinutes: number;
  everyHours: number;
  minute: number;
  time: string;
  weekdays: number[];
  monthlyMode: MonthlyMode;
  monthDay: number;
  nth: number;
  nthDay: number;
  month: number;
}

export const DEFAULT_BUILDER: BuilderState = {
  frequency: "weekly",
  everyMinutes: 15,
  everyHours: 1,
  minute: 0,
  time: "09:30",
  weekdays: [1, 2, 3, 4, 5],
  monthlyMode: "day",
  monthDay: 1,
  nth: 1,
  nthDay: 1,
  month: 1,
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(n) ? n : lo)));

/** Builder form → dialect-neutral schedule. */
export function buildSchedule(b: BuilderState): Schedule {
  const [hh, mm] = b.time.split(":").map(Number);
  const hour = String(clamp(hh, 0, 23));
  const minute = String(clamp(mm, 0, 59));
  const base: Schedule = { second: "0", minute, hour, month: "*", year: "*", day: { kind: "every" } };
  switch (b.frequency) {
    case "minutes": {
      const n = clamp(b.everyMinutes, 1, 59);
      return { ...base, minute: n === 1 ? "*" : `*/${n}`, hour: "*" };
    }
    case "hourly": {
      const n = clamp(b.everyHours, 1, 23);
      return { ...base, minute: String(clamp(b.minute, 0, 59)), hour: n === 1 ? "*" : `*/${n}` };
    }
    case "daily":
      return base;
    case "weekly": {
      const days = b.weekdays.length > 0 ? b.weekdays : [1];
      return { ...base, day: { kind: "weekdays", days: [...days].sort((x, y) => x - y) } };
    }
    case "monthly":
    case "yearly": {
      let day: DayRule;
      if (b.monthlyMode === "last") day = { kind: "last" };
      else if (b.monthlyMode === "lastWeekday") day = { kind: "lastWeekday" };
      else if (b.monthlyMode === "nth") day = b.nth === 6 ? { kind: "lastDow", day: b.nthDay } : { kind: "nth", day: b.nthDay, n: clamp(b.nth, 1, 5) };
      else day = { kind: "dom", value: String(clamp(b.monthDay, 1, 31)) };
      return { ...base, day, month: b.frequency === "yearly" ? String(clamp(b.month, 1, 12)) : "*" };
    }
  }
}

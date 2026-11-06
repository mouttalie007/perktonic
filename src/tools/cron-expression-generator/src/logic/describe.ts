import cronstrue from "cronstrue";
import type { CronSpec } from "./parse";

/** Plain-English translation via cronstrue, fed in the 7-field Quartz layout it understands for every dialect. */
export function describe(spec: CronSpec): string {
  const [sec, min, hour, dom, mon, dow, year] = spec.fields;
  const standard = spec.dialect === "standard";
  const input = standard ? spec.normalized : [sec, min, hour, dom, mon, dow, year].join(" ");
  try {
    let text = cronstrue.toString(input, {
      use24HourTimeFormat: true,
      dayOfWeekStartIndexZero: standard,
      throwExceptionOnParseError: true,
      verbose: false,
    });
    if (spec.dayOr) text += " (standard cron runs when either the day of the month or the weekday matches)";
    return text;
  } catch {
    return "";
  }
}

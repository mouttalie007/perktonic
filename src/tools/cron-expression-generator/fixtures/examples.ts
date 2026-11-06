import type { Dialect } from "../src/logic/parse";

/** "Try an example" cycles through these realistic schedules. */
export const EXAMPLES: { phrase: string; dialect: Dialect; timeZone: string }[] = [
  { phrase: "every weekday at 9:30", dialect: "standard", timeZone: "America/New_York" },
  { phrase: "on the last day of the month at 23:00", dialect: "quartz", timeZone: "Europe/London" },
  { phrase: "every 15 minutes between 9am and 5pm on weekdays", dialect: "aws", timeZone: "UTC" },
  { phrase: "first Monday of the month at 10am", dialect: "quartz", timeZone: "Asia/Dubai" },
];

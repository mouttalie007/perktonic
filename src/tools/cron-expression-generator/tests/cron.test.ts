import { describe as group, expect, it } from "vitest";
import { convertDialect, render, type Schedule } from "../src/logic/build";
import { buildSchedule, DEFAULT_BUILDER } from "../src/logic/builder";
import { describe } from "../src/logic/describe";
import { parseNatural } from "../src/logic/natural";
import { parseCron, type Dialect } from "../src/logic/parse";
import { nextRuns } from "../src/logic/schedule";
import { wallToInstants } from "../src/logic/timezone";
import { EXAMPLES } from "../fixtures/examples";

const spec = (expr: string, dialect: Dialect = "standard") => {
  const r = parseCron(expr, dialect);
  if (!r.ok) throw new Error(r.error);
  return r.spec;
};
const error = (expr: string, dialect: Dialect = "standard") => {
  const r = parseCron(expr, dialect);
  if (r.ok) throw new Error(`expected an error for ${expr}`);
  return r.error;
};
const iso = (ms: number) => new Date(ms).toISOString();
const runs = (expr: string, dialect: Dialect, from: string, tz: string, n = 10) => nextRuns(spec(expr, dialect), Date.parse(from), tz, n);
const fromPhrase = (phrase: string, dialect: Dialect) => {
  const p = parseNatural(phrase);
  if (!p.ok) throw new Error(p.error);
  const r = render(p.schedule, dialect);
  if (!r.ok) throw new Error(r.error);
  return r.expression;
};

group("dialects", () => {
  it("accepts the same schedule in all three dialects and finds the same runs", () => {
    const from = "2026-11-02T00:00:00Z";
    const a = runs("30 9 * * 1-5", "standard", from, "UTC").runs.map((r) => iso(r.utc));
    const b = runs("0 30 9 ? * MON-FRI", "quartz", from, "UTC").runs.map((r) => iso(r.utc));
    const c = runs("cron(30 9 ? * 2-6 *)", "aws", from, "UTC").runs.map((r) => iso(r.utc));
    expect(a).toEqual(b);
    expect(a).toEqual(c);
    expect(a.slice(0, 6)).toEqual([
      "2026-11-02T09:30:00.000Z",
      "2026-11-03T09:30:00.000Z",
      "2026-11-04T09:30:00.000Z",
      "2026-11-05T09:30:00.000Z",
      "2026-11-06T09:30:00.000Z",
      "2026-11-09T09:30:00.000Z",
    ]);
  });

  it("handles Quartz seconds and the optional year field", () => {
    expect(runs("*/20 * * * * ?", "quartz", "2026-01-01T00:00:00Z", "UTC", 3).runs.map((r) => iso(r.utc))).toEqual([
      "2026-01-01T00:00:20.000Z",
      "2026-01-01T00:00:40.000Z",
      "2026-01-01T00:01:00.000Z",
    ]);
    const y = runs("0 0 12 1 1 ? 2028-2029", "quartz", "2026-06-01T00:00:00Z", "UTC");
    expect(y.runs.map((r) => iso(r.utc))).toEqual(["2028-01-01T12:00:00.000Z", "2029-01-01T12:00:00.000Z"]);
    expect(y.exhausted).toBe(true);
  });

  it("converts between dialects and explains what cannot convert", () => {
    expect(convertDialect("30 9 * * 1-5", "standard", "quartz")).toEqual({ ok: true, expression: "0 30 9 ? * MON-FRI" });
    expect(convertDialect("30 9 * * 1-5", "standard", "aws")).toEqual({ ok: true, expression: "cron(30 9 ? * MON-FRI *)" });
    expect(convertDialect("0 0 9 ? * 2#1", "quartz", "aws")).toEqual({ ok: true, expression: "cron(0 9 ? * 2#1 *)" });
    expect(convertDialect("0 0 18 L * ?", "quartz", "standard")).toMatchObject({ ok: false });
    expect(convertDialect("*/10 * * * * ?", "quartz", "standard")).toMatchObject({ ok: false });
    expect(convertDialect("0 0 1 * 1", "standard", "quartz")).toMatchObject({ ok: false });
    expect(convertDialect("0 22 * * 0,6", "standard", "quartz")).toEqual({ ok: true, expression: "0 0 22 ? * SUN,SAT" });
  });
});

group("special characters", () => {
  it("L: last day of the month, including February in a leap year", () => {
    expect(runs("0 0 23 L * ?", "quartz", "2028-01-15T00:00:00Z", "UTC", 3).runs.map((r) => iso(r.utc))).toEqual([
      "2028-01-31T23:00:00.000Z",
      "2028-02-29T23:00:00.000Z",
      "2028-03-31T23:00:00.000Z",
    ]);
  });

  it("W, LW, L-n, # and nL", () => {
    // 15 Nov 2026 is a Sunday, so 15W fires on Monday the 16th; 1 Aug 2026 is a Saturday, so 1W fires on Monday the 3rd.
    expect(iso(runs("0 0 9 15W * ?", "quartz", "2026-11-01T00:00:00Z", "UTC", 1).runs[0].utc)).toBe("2026-11-16T09:00:00.000Z");
    expect(iso(runs("0 0 9 1W * ?", "quartz", "2026-07-15T00:00:00Z", "UTC", 1).runs[0].utc)).toBe("2026-08-03T09:00:00.000Z");
    // Last weekday of January 2027 is Friday the 29th; L-3 in January 2027 is the 28th.
    expect(iso(runs("0 0 0 LW * ?", "quartz", "2027-01-01T00:00:00Z", "UTC", 1).runs[0].utc)).toBe("2027-01-29T00:00:00.000Z");
    expect(iso(runs("0 0 0 L-3 * ?", "quartz", "2027-01-01T00:00:00Z", "UTC", 1).runs[0].utc)).toBe("2027-01-28T00:00:00.000Z");
    // Third Friday (6#3) and last Friday (6L) of November 2026: the 20th and the 27th.
    expect(iso(runs("0 0 10 ? * 6#3", "quartz", "2026-11-01T00:00:00Z", "UTC", 1).runs[0].utc)).toBe("2026-11-20T10:00:00.000Z");
    expect(iso(runs("cron(0 10 ? * FRIL *)", "aws", "2026-11-01T00:00:00Z", "UTC", 1).runs[0].utc)).toBe("2026-11-27T10:00:00.000Z");
  });

  it("ranges, steps, names and macros", () => {
    expect(spec("0-30/10 */6 * JAN-MAR MON,WED").minutes).toEqual([0, 10, 20, 30]);
    expect(spec("0-30/10 */6 * JAN-MAR MON,WED").hours).toEqual([0, 6, 12, 18]);
    expect([...spec("0 0 * * 7").dow.days]).toEqual([0]);
    expect(spec("@daily").normalized).toBe("0 0 * * *");
    expect(spec("@weekly").normalized).toBe("0 0 * * 0");
    expect(error("@reboot")).toMatch(/starts/);
  });

  it("standard cron ORs day-of-month and day-of-week when both are set", () => {
    // The 13th, or any Friday.
    const r = runs("0 0 13 * 5", "standard", "2026-11-01T00:00:00Z", "UTC", 4).runs.map((x) => iso(x.utc).slice(0, 10));
    expect(r).toEqual(["2026-11-06", "2026-11-13", "2026-11-20", "2026-11-27"]);
    expect(spec("0 0 */2 * 5").dayOr).toBe(false);
  });
});

group("time zones and DST", () => {
  it("skips the spring-forward gap and reports it", () => {
    // 8 Mar 2026: New York clocks jump from 02:00 to 03:00, so 02:30 does not exist that day.
    const r = runs("30 2 * * *", "standard", "2026-03-06T12:00:00Z", "America/New_York", 3);
    expect(r.runs.map((x) => iso(x.utc))).toEqual(["2026-03-07T07:30:00.000Z", "2026-03-09T06:30:00.000Z", "2026-03-10T06:30:00.000Z"]);
    expect(r.skipped).toEqual([{ y: 2026, m: 3, d: 8, h: 2, mi: 30, s: 0 }]);
  });

  it("runs once in the repeated autumn hour and keeps local time across the change", () => {
    // 1 Nov 2026: 01:00–02:00 happens twice in New York.
    const r = runs("30 1 * * *", "standard", "2026-10-31T12:00:00Z", "America/New_York", 3);
    expect(r.runs.map((x) => iso(x.utc))).toEqual(["2026-11-01T05:30:00.000Z", "2026-11-02T06:30:00.000Z", "2026-11-03T06:30:00.000Z"]);
    expect(r.runs[0].repeated).toBe(true);
    expect(wallToInstants({ y: 2026, m: 11, d: 1, h: 1, mi: 30, s: 0 }, "America/New_York")).toHaveLength(2);
  });

  it("evaluates in the selected zone (London vs Tokyo, half-hour zones)", () => {
    expect(iso(runs("0 9 * * *", "standard", "2026-07-01T00:00:00Z", "Europe/London", 1).runs[0].utc)).toBe("2026-07-01T08:00:00.000Z");
    expect(iso(runs("0 9 * * *", "standard", "2026-07-01T00:00:00Z", "Asia/Tokyo", 1).runs[0].utc)).toBe("2026-07-02T00:00:00.000Z");
    expect(iso(runs("0 9 * * *", "standard", "2026-07-01T00:00:00Z", "Asia/Kolkata", 1).runs[0].utc)).toBe("2026-07-01T03:30:00.000Z");
  });

  it("says when a schedule never runs, quickly", () => {
    const t = performance.now();
    const r = runs("0 0 30 2 *", "standard", "2026-01-01T00:00:00Z", "UTC");
    expect(r.runs).toHaveLength(0);
    expect(r.exhausted).toBe(true);
    expect(performance.now() - t).toBeLessThan(1000);
  });
});

group("plain language", () => {
  it("parses common phrases without an LLM", () => {
    expect(fromPhrase("every weekday at 9:30", "standard")).toBe("30 9 * * 1-5");
    expect(fromPhrase("Every 5 minutes", "standard")).toBe("*/5 * * * *");
    expect(fromPhrase("every 2 hours at 15 minutes past", "standard")).toBe("15 */2 * * *");
    expect(fromPhrase("every Monday and Thursday at 6pm", "standard")).toBe("0 18 * * 1,4");
    expect(fromPhrase("every day at noon", "standard")).toBe("0 12 * * *");
    expect(fromPhrase("daily at 9am and 5pm", "standard")).toBe("0 9,17 * * *");
    expect(fromPhrase("on the 1st and 15th at 08:00", "standard")).toBe("0 8 1,15 * *");
    expect(fromPhrase("every weekend at 10:30 am", "standard")).toBe("30 10 * * 0,6");
    expect(fromPhrase("every 15 minutes between 9am and 5pm on weekdays", "aws")).toBe("cron(*/15 9-16 ? * MON-FRI *)");
    expect(fromPhrase("on the last day of the month at 23:00", "quartz")).toBe("0 0 23 L * ?");
    expect(fromPhrase("first Monday of the month at 10am", "quartz")).toBe("0 0 10 ? * 2#1");
    expect(fromPhrase("every year on January 1 at midnight", "standard")).toBe("0 0 1 1 *");
    expect(fromPhrase("every 30 seconds", "quartz")).toBe("0/30 * * * * ?");
  });

  it("explains phrases it cannot express", () => {
    const last = parseNatural("last day of the month at 23:00");
    expect(last.ok && render(last.schedule, "standard")).toMatchObject({ ok: false });
    const mixed = parseNatural("every day at 9:00 and 17:30");
    expect(mixed.ok).toBe(false);
    expect(parseNatural("when the moon is full").ok).toBe(false);
  });

  it("every example phrase produces a valid expression with 10 upcoming runs", () => {
    for (const ex of EXAMPLES) {
      const expr = fromPhrase(ex.phrase, ex.dialect);
      const s = spec(expr, ex.dialect);
      expect(nextRuns(s, Date.parse("2026-11-01T00:00:00Z"), ex.timeZone).runs).toHaveLength(10);
      expect(describe(s)).not.toBe("");
    }
  });
});

group("errors and descriptions", () => {
  it("explains what is wrong with invalid expressions", () => {
    expect(error("60 * * * *")).toBe("The minute field has 60, but it must be between 0 and 59.");
    expect(error("* * * *")).toMatch(/5 fields/);
    expect(error("0 0 9 * * *")).toMatch(/switch the dialect/i);
    expect(error("0 9 L * *")).toMatch(/Quartz or AWS/);
    expect(error("0 0 9 * * MON", "quartz")).toMatch(/needs \?/);
    expect(error("0 0 9 ? * ?", "quartz")).toMatch(/Only one/);
    expect(error("*/0 * * * *")).toMatch(/step/);
    expect(error("0 17-9 * * *")).toMatch(/backwards/);
    expect(error("0 9 * * FUNDAY")).toMatch(/not a valid value/);
    expect(error("rate(5 minutes)", "aws")).toMatch(/rate expression/);
    expect(error("0 0 9 ? * 2#6", "quartz")).toMatch(/1–5/);
  });

  it("describes schedules in English for each dialect", () => {
    expect(describe(spec("30 9 * * 1-5"))).toBe("At 09:30, Monday through Friday");
    expect(describe(spec("0 30 9 ? * MON-FRI", "quartz"))).toBe("At 09:30, Monday through Friday");
    expect(describe(spec("cron(0 10 ? * 6L *)", "aws"))).toContain("last Friday of the month");
    expect(describe(spec("0 0 13 * 5"))).toContain("either");
  });

  it("builds expressions from the visual builder", () => {
    const s: Schedule = buildSchedule(DEFAULT_BUILDER);
    expect(render(s, "standard")).toEqual({ ok: true, expression: "30 9 * * 1-5" });
    expect(render(buildSchedule({ ...DEFAULT_BUILDER, frequency: "monthly", monthlyMode: "nth", nth: 6, nthDay: 5 }), "quartz")).toEqual({ ok: true, expression: "0 30 9 ? * 6L" });
    expect(render(buildSchedule({ ...DEFAULT_BUILDER, frequency: "minutes", everyMinutes: 10 }), "aws")).toEqual({ ok: true, expression: "cron(*/10 * * * ? *)" });
  });
});

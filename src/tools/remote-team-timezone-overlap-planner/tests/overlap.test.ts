import { describe, expect, it } from "vitest";
import { searchZones } from "../src/logic/cities";
import { toIcs } from "../src/logic/ics";
import { computeDay, explainWindow, outlook, PlanError, shiftsFor, validatePlan, type Plan } from "../src/logic/overlap";
import { decodePlan, encodePlan } from "../src/logic/share";
import { isValidTimeZone, listTimeZones } from "../src/logic/timezone";
import { EXAMPLE_PLAN } from "../fixtures/team";

const iso = (t: number) => new Date(t).toISOString().slice(11, 16);
const person = (name: string, zone: string, start: string, end: string, days = [0, 1, 2, 3, 4, 5, 6]) => ({ name, zone, start, end, days });

describe("overlap", () => {
  it("finds the window where everyone works and explains it in every zone", () => {
    const r = computeDay(EXAMPLE_PLAN);
    expect(r.allAvailable).toBe(true);
    expect(r.best.map((w) => `${iso(w.from)}-${iso(w.to)}`)).toEqual(["12:00-14:15"]);
    expect(explainWindow(r.best[0], EXAMPLE_PLAN, 5)).toBe("12:00–14:15 UTC (08:00–10:15 New York, 12:00–14:15 London, 13:00–15:15 Berlin, 17:30–19:45 Kolkata, 17:45–20:00 Kathmandu): everyone is within working hours.");
  });

  it("handles half-hour and 45-minute zones on 15-minute slots", () => {
    const day = Date.parse("2026-10-28T00:00:00Z");
    const [india] = shiftsFor(person("A", "Asia/Kolkata", "12:00", "21:00"), day, day + 86400000);
    const [nepal] = shiftsFor(person("S", "Asia/Kathmandu", "12:00", "20:00"), day, day + 86400000);
    expect([iso(india.from), iso(india.to)]).toEqual(["06:30", "15:30"]);
    expect([iso(nepal.from), iso(nepal.to)]).toEqual(["06:15", "14:15"]);
    expect(shiftsFor(person("C", "Pacific/Chatham", "09:00", "17:00"), day, day + 86400000).map((s) => iso(s.from))).toContain("19:15");
  });

  it("supports overnight shifts that end the next day", () => {
    const plan: Plan = { date: "2026-10-28", viewZone: "UTC", minMinutes: 30, people: [person("Night desk", "Europe/London", "22:00", "06:00"), person("Manila", "Asia/Manila", "09:00", "18:00")] };
    const r = computeDay(plan);
    // Night shift 22:00–06:00 GMT; Manila 01:00–10:00 UTC: shared 01:00–06:00.
    expect(r.best.map((w) => `${iso(w.from)}-${iso(w.to)}`)).toEqual(["01:00-06:00"]);
  });

  it("respects working days and reports partial overlaps with the people who are missing", () => {
    const plan: Plan = { ...EXAMPLE_PLAN, date: "2026-10-28", people: [person("Ana", "America/Sao_Paulo", "09:00", "18:00"), person("Ken", "Asia/Tokyo", "09:00", "18:00"), person("Lea", "Europe/Paris", "09:00", "17:00")] };
    const r = computeDay(plan);
    expect(r.allAvailable).toBe(false);
    expect(explainWindow(r.best[0], plan, 3)).toMatch(/2 of 3 people are within working hours; outside: (Ken|Ana)\./);
    const weekend: Plan = { ...plan, people: [person("Sun only", "Europe/Paris", "09:00", "17:00", [0]), person("Lea", "Europe/Paris", "09:00", "17:00", [1, 2, 3, 4, 5])] };
    expect(computeDay(weekend).allAvailable).toBe(false);
  });
});

describe("daylight saving time", () => {
  it("shows that the shared time shrinks when the US changes its clocks a week after Europe", () => {
    const o = outlook(EXAMPLE_PLAN, 21);
    expect(o.base).toBe(135);
    expect(o.changes).toEqual([{ date: "2026-11-04", sharedMinutes: 75 }]);
  });

  it("moves a start time that falls in a spring-forward gap and notes it", () => {
    const plan: Plan = { date: "2026-03-08", viewZone: "America/New_York", minMinutes: 30, people: [person("Early", "America/New_York", "02:30", "10:00"), person("Other", "America/New_York", "08:00", "16:00")] };
    const r = computeDay(plan);
    expect(r.notes[0]).toMatch(/02:30 does not exist in America\/New_York on 2026-03-08/);
    expect(r.slots).toHaveLength(92);
  });

  it("gives the view day 25 hours when clocks go back", () => {
    const plan: Plan = { date: "2026-11-01", viewZone: "America/New_York", minMinutes: 30, people: [person("A", "America/New_York", "00:00", "24:00"), person("B", "UTC", "00:00", "24:00")] };
    expect(computeDay(plan).slots).toHaveLength(100);
  });
});

describe("input, sharing and export", () => {
  it("searches cities and IANA zones, ignoring accents and case", () => {
    const zones = listTimeZones();
    expect(searchZones("kolk", zones)[0]).toEqual({ label: "Kolkata", zone: "Asia/Kolkata" });
    expect(searchZones("sao paulo", zones)[0]).toEqual({ label: "São Paulo", zone: "America/Sao_Paulo" });
    expect(searchZones("kathmandu", zones).map((z) => z.zone)).toContain("Asia/Kathmandu");
    expect(searchZones("argentina/sal", zones).map((z) => z.zone)).toContain("America/Argentina/Salta");
    expect(zones).not.toContain("Asia/Calcutta");
    expect(searchZones("katm", zones).map((z) => z.zone)).not.toContain("Asia/Katmandu");
  });

  it("round-trips the plan through the URL fragment and rejects tampered links", () => {
    const frag = encodePlan(EXAMPLE_PLAN);
    expect(frag).toMatch(/^plan=[A-Za-z0-9_-]+$/);
    const back = decodePlan(`#${frag}`, isValidTimeZone);
    expect(back).toEqual({ ok: true, plan: EXAMPLE_PLAN });
    expect(decodePlan("#plan=%%%", isValidTimeZone).ok).toBe(false);
    const bad = encodePlan({ ...EXAMPLE_PLAN, people: [{ ...EXAMPLE_PLAN.people[0], zone: "Mars/Olympus" }] });
    expect(decodePlan(bad, isValidTimeZone)).toEqual({ ok: false, error: "The entry for Maya (product) is not valid." });
  });

  it("validates the plan with readable messages", () => {
    expect(() => validatePlan({ ...EXAMPLE_PLAN, people: [] }, isValidTimeZone)).toThrow(/at least two/);
    expect(() => validatePlan({ ...EXAMPLE_PLAN, people: [person("X", "Europe/Paris", "9am", "17:00")] }, isValidTimeZone)).toThrow(PlanError);
    expect(() => validatePlan({ ...EXAMPLE_PLAN, people: [{ ...person("X", "Europe/Paris", "09:00", "17:00"), days: [] }, person("Y", "UTC", "09:00", "17:00")] }, isValidTimeZone)).toThrow(/at least one working day/);
    // The same start and end time is a 24-hour shift, because a time input cannot hold 24:00.
    const day = computeDay({ ...EXAMPLE_PLAN, people: [person("Ops", "Europe/Paris", "09:00", "09:00"), person("Dev", "UTC", "10:00", "12:00")] });
    expect(day.slots.every((s) => s.available[0])).toBe(true);
    expect(day.best[0].to - day.best[0].from).toBe(2 * 3600_000);
  });

  it("exports the best slot as a calendar event in UTC", () => {
    const w = computeDay(EXAMPLE_PLAN).best[0];
    const ics = toIcs(w.from, w.to, "Team sync", "Everyone, within working hours", Date.parse("2026-10-20T10:00:00Z"));
    expect(ics).toContain("DTSTART:20261028T120000Z");
    expect(ics).toContain("DTEND:20261028T141500Z");
    expect(ics).toContain("DESCRIPTION:Everyone\\, within working hours");
  });
});

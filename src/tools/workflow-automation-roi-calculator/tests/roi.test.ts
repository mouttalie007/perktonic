import { describe, expect, it } from "vitest";
import { monthlyCsv, summaryText } from "../src/logic/report";
import { calculate, DEFAULTS, formatMoney, formatPayback, formatPercent, parseNumber, series, validate, type Inputs } from "../src/logic/roi";
import { decodeState, encodeState } from "../src/logic/share";
import { EXAMPLES, INVOICE_ENTRY, PAYROLL_MAD, WEEKLY_REPORT } from "../fixtures/examples";

const inputs = (e = INVOICE_ENTRY): Inputs => {
  const v = validate(e.raw);
  if (!v.ok) throw new Error("fixture invalid");
  return v.inputs;
};

describe("the calculation", () => {
  it("computes hours, savings, payback and ROI for the opening example", () => {
    const r = calculate(inputs());
    // 20 × 230 days × 3 people = 13,800 tasks; × 4 min × 90% = 828 h; × $35 = $28,980.
    expect(r.tasksPerYear).toBe(13_800);
    expect(r.hoursSavedPerYear).toBeCloseTo(828, 6);
    expect(r.annualSavings).toBeCloseTo(28_980, 6);
    expect(r.netAnnual).toBeCloseTo(27_180, 6);
    expect(r.paybackMonths).toBeCloseTo(6000 / 2265, 6);
    expect(r.roiYear1).toBeCloseTo(((28_980 - 7_800) / 7_800) * 100, 6);
    expect(r.roi3Years).toBeCloseTo(((86_940 - 11_400) / 11_400) * 100, 6);
    expect(formatPayback(r.paybackMonths)).toBe("2.6 months");
  });

  it("supports per-week and per-month frequencies", () => {
    expect(calculate({ ...DEFAULTS, count: 5, per: "week", people: 1 }).tasksPerYear).toBe(260);
    expect(calculate({ ...DEFAULTS, count: 2, per: "month", people: 2 }).tasksPerYear).toBe(48);
    expect(calculate({ ...DEFAULTS, count: 1, per: "day", people: 1, workingDaysPerYear: 250 }).tasksPerYear).toBe(250);
  });

  it("says 'never pays back' when running costs eat the savings, without dividing by zero", () => {
    const r = calculate(inputs(WEEKLY_REPORT));
    // 52 × 20 min = 17.3 h × €40 = €693/yr, but the tool costs €588/yr plus €1,500 to build.
    expect(r.annualSavings).toBeCloseTo(693.33, 1);
    expect(r.paybackMonths).not.toBeNull();
    const worse = calculate({ ...inputs(WEEKLY_REPORT), monthlyCost: 60 });
    expect(worse.paybackMonths).toBeNull();
    expect(worse.never).toBe(true);
    expect(formatPayback(worse.paybackMonths)).toBe("Never pays back");
    const zero = calculate({ ...DEFAULTS, count: 0 });
    expect(zero.annualSavings).toBe(0);
    expect(zero.paybackMonths).toBeNull();
    expect(Number.isFinite(zero.roiYear1 ?? 0)).toBe(true);
  });

  it("handles zero costs: immediate payback and ROI not defined", () => {
    const r = calculate({ ...DEFAULTS, buildCost: 0, monthlyCost: 0 });
    expect(r.paybackMonths).toBe(0);
    expect(r.roiYear1).toBeNull();
    expect(formatPercent(r.roiYear1)).toBe("Not defined (no cost)");
    expect(formatPayback(0)).toBe("Immediately");
    expect(formatPayback(0.5)).toBe("15 days");
    expect(formatPayback(30)).toBe("2.5 years");
    expect(formatPercent(-42.4)).toBe("−42%");
  });
});

describe("inputs", () => {
  it("rejects negative, empty and non-numeric values with a message per field", () => {
    const v = validate({ ...INVOICE_ENTRY.raw, hourlyCost: "-35", people: "", minutesPerTask: "four", automatedPercent: "120" });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.errors.hourlyCost).toBe("Hourly cost cannot be negative. Enter 0 if there is none.");
    expect(v.errors.people).toBe("People doing it is empty. Enter a number (0 is allowed).");
    expect(v.errors.minutesPerTask).toBe("Minutes per task must be a number, such as 12 or 12.5.");
    expect(v.errors.automatedPercent).toBe("Share automated can be at most 100.");
    expect(parseNumber("1,500")).toBe(1500);
    expect(parseNumber(" 12.5 ")).toBe(12.5);
  });

  it("round-trips the inputs and currency through the URL fragment and refuses edited links", () => {
    const frag = encodeState(PAYROLL_MAD.raw, PAYROLL_MAD.currency);
    expect(frag).toBe("n=2&min=180&ppl=2&rate=120&build=15000&monthly=0&auto=75&days=230&per=month&cur=MAD");
    expect(decodeState("#" + frag)).toEqual({ ok: true, raw: PAYROLL_MAD.raw, currency: "MAD" });
    expect(decodeState("#n=2&min=<script>&ppl=2&rate=1&build=1&monthly=1&auto=1&days=1&per=day")).toMatchObject({ ok: false });
    expect(decodeState("#" + frag.replace("cur=MAD", "cur=XYZ"))).toMatchObject({ ok: false });
    expect(decodeState("")).toBeNull();
  });
});

describe("chart data, currency and exports", () => {
  it("builds cumulative series whose lines cross at the break-even month", () => {
    const i = inputs();
    const r = calculate(i);
    const { points, months } = series(i, r);
    expect(months).toBe(36);
    expect(points).toHaveLength(37);
    expect(points[0]).toEqual({ month: 0, savings: 0, cost: 6000 });
    const be = r.paybackMonths!;
    expect(points[Math.floor(be)].savings).toBeLessThan(points[Math.floor(be)].cost);
    expect(points[Math.ceil(be)].savings).toBeGreaterThan(points[Math.ceil(be)].cost);
    const slow = calculate({ ...i, buildCost: 100_000 });
    expect(series(i, slow).months).toBeGreaterThan(36);
  });

  it("formats each currency correctly", () => {
    expect(formatMoney(28980, "USD")).toBe("$28,980");
    expect(formatMoney(12.5, "EUR")).toBe("€12.50");
    expect(formatMoney(1500, "GBP")).toBe("£1,500");
    expect(formatMoney(15000, "MAD")).toBe("MAD\u00a015,000");
    expect(formatMoney(1234.56, "JPY")).toBe("¥1,235");
    expect(formatMoney(-588, "EUR")).toBe("-€588.00");
    expect(formatMoney(28980, "USD", true)).toBe("$29K");
  });

  it("writes a summary and a monthly CSV", () => {
    const i = inputs();
    const r = calculate(i);
    const text = summaryText(i, r, "USD", "https://perktonic.com/tools/workflow-automation-roi-calculator#n=20");
    expect(text).toContain("Hours saved per year: 828");
    expect(text).toContain("Payback: 2.6 months");
    expect(text).toContain("Assumes 230 working days a year.");
    const csv = monthlyCsv(i, r).split("\r\n");
    expect(csv[0]).toBe("month,cumulative_savings,cumulative_cost,cumulative_net");
    expect(csv[1]).toBe("0,0.00,6000.00,-6000.00");
    expect(csv[13]).toBe("12,28980.00,7800.00,21180.00");
    expect(EXAMPLES.every((e) => validate(e.raw).ok)).toBe(true);
  });
});

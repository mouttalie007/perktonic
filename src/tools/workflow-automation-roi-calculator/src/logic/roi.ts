// No imports: used by the page and the tests.

export type Per = "day" | "week" | "month";

export interface Inputs {
  /** How many times the task happens, per person, in each period. */
  count: number;
  per: Per;
  minutesPerTask: number;
  people: number;
  hourlyCost: number;
  /** One-off cost to build the automation. */
  buildCost: number;
  /** Monthly tool subscription or maintenance. */
  monthlyCost: number;
  /** Share of the manual time the automation removes, 0–100. */
  automatedPercent: number;
  /** Used only when the task is counted per day. */
  workingDaysPerYear: number;
}

export type Field = keyof Inputs;

export const DEFAULTS: Inputs = {
  count: 20,
  per: "day",
  minutesPerTask: 4,
  people: 3,
  hourlyCost: 35,
  buildCost: 6000,
  monthlyCost: 150,
  automatedPercent: 90,
  workingDaysPerYear: 230,
};

export const LIMITS: Record<Exclude<Field, "per">, { min: number; max: number; label: string }> = {
  count: { min: 0, max: 100_000, label: "Times per period" },
  minutesPerTask: { min: 0, max: 1_440, label: "Minutes per task" },
  people: { min: 0, max: 100_000, label: "People doing it" },
  hourlyCost: { min: 0, max: 100_000, label: "Hourly cost" },
  buildCost: { min: 0, max: 1_000_000_000, label: "Build cost" },
  monthlyCost: { min: 0, max: 100_000_000, label: "Monthly cost" },
  automatedPercent: { min: 0, max: 100, label: "Share automated" },
  workingDaysPerYear: { min: 1, max: 366, label: "Working days per year" },
};

/** Reads a typed value: accepts "1,500", "1 500" and "35.5"; empty means missing. */
export function parseNumber(raw: string): number | null {
  const t = raw.trim().replace(/[\s,_]/g, "");
  if (t === "") return null;
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return Number.NaN;
  return Number(t);
}

export type Validation = { ok: true; inputs: Inputs } | { ok: false; errors: Partial<Record<Field, string>> };

export function validate(raw: Record<Exclude<Field, "per">, string> & { per: Per }): Validation {
  const errors: Partial<Record<Field, string>> = {};
  const out = { per: raw.per } as Inputs;
  for (const key of Object.keys(LIMITS) as Exclude<Field, "per">[]) {
    const { min, max, label } = LIMITS[key];
    const v = parseNumber(raw[key]);
    if (v === null) errors[key] = `${label} is empty. Enter a number (0 is allowed).`;
    else if (Number.isNaN(v)) errors[key] = `${label} must be a number, such as 12 or 12.5.`;
    else if (v < 0) errors[key] = `${label} cannot be negative. Enter 0 if there is none.`;
    else if (v < min) errors[key] = `${label} must be at least ${min}.`;
    else if (v > max) errors[key] = `${label} can be at most ${max.toLocaleString("en-US")}.`;
    else out[key] = v;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, inputs: out };
}

export function periodsPerYear(per: Per, workingDays: number): number {
  return per === "day" ? workingDays : per === "week" ? 52 : 12;
}

export interface Results {
  tasksPerYear: number;
  hoursSavedPerYear: number;
  annualSavings: number;
  annualToolCost: number;
  /** Savings minus running costs, per year. */
  netAnnual: number;
  /** Months until cumulative savings cover all costs; 0 = from the start; null = never. */
  paybackMonths: number | null;
  /** null when there is no cost at all (ROI is not defined). */
  roiYear1: number | null;
  roi3Years: number | null;
  net3Years: number;
  never: boolean;
}

/** ROI = (gain − cost) / cost over the period, as a percentage. */
function roi(gain: number, cost: number): number | null {
  return cost > 0 ? ((gain - cost) / cost) * 100 : null;
}

export function calculate(i: Inputs): Results {
  const tasksPerYear = i.count * periodsPerYear(i.per, i.workingDaysPerYear) * i.people;
  const hoursSavedPerYear = (tasksPerYear * i.minutesPerTask * (i.automatedPercent / 100)) / 60;
  const annualSavings = hoursSavedPerYear * i.hourlyCost;
  const annualToolCost = i.monthlyCost * 12;
  const netAnnual = annualSavings - annualToolCost;
  const monthlyNet = netAnnual / 12;
  let paybackMonths: number | null;
  if (monthlyNet > 0) paybackMonths = i.buildCost / monthlyNet;
  else if (monthlyNet === 0 && i.buildCost === 0 && annualSavings > 0) paybackMonths = 0;
  else paybackMonths = null;
  return {
    tasksPerYear,
    hoursSavedPerYear,
    annualSavings,
    annualToolCost,
    netAnnual,
    paybackMonths,
    roiYear1: roi(annualSavings, i.buildCost + annualToolCost),
    roi3Years: roi(annualSavings * 3, i.buildCost + annualToolCost * 3),
    net3Years: annualSavings * 3 - i.buildCost - annualToolCost * 3,
    never: paybackMonths === null,
  };
}

export interface ChartPoint {
  month: number;
  savings: number;
  cost: number;
}

/** Cumulative savings and cost for each month, over 36 months or until a little past break-even (max 120). */
export function series(i: Inputs, r: Results): { points: ChartPoint[]; months: number } {
  const months = r.paybackMonths !== null && r.paybackMonths > 30 ? Math.min(120, Math.ceil((r.paybackMonths * 1.25) / 6) * 6) : 36;
  const points: ChartPoint[] = [];
  for (let m = 0; m <= months; m++) points.push({ month: m, savings: (r.annualSavings / 12) * m, cost: i.buildCost + i.monthlyCost * m });
  return { points, months };
}

export function formatMoney(value: number, currency: string, compact = false): string {
  const digits = currency === "JPY" ? 0 : Math.abs(value) >= 1000 || compact ? 0 : 2;
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: digits, minimumFractionDigits: digits, notation: compact ? "compact" : "standard" }).format(value);
}

export function formatPayback(months: number | null): string {
  if (months === null) return "Never pays back";
  if (months === 0) return "Immediately";
  if (months < 1) return `${Math.max(1, Math.round(months * 30))} days`;
  if (months < 24) return `${months.toFixed(1)} months`;
  return `${(months / 12).toFixed(1)} years`;
}

export function formatPercent(p: number | null): string {
  if (p === null) return "Not defined (no cost)";
  return `${p >= 0 ? "" : "−"}${Math.abs(Math.round(p)).toLocaleString("en-US")}%`;
}

export const CURRENCIES = ["USD", "EUR", "GBP", "MAD", "CAD", "AUD", "CHF", "JPY", "INR", "AED", "SAR"] as const;
export type Currency = (typeof CURRENCIES)[number];

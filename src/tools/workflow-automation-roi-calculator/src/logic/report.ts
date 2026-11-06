import { formatMoney, formatPayback, formatPercent, periodsPerYear, series, type Currency, type Inputs, type Results } from "./roi";

const n = (v: number, d = 0) => v.toLocaleString("en-US", { maximumFractionDigits: d });

export function summaryText(i: Inputs, r: Results, currency: Currency, link: string | null): string {
  const m = (v: number) => formatMoney(v, currency);
  const lines = [
    "Workflow automation ROI",
    `Task: ${n(i.count, 2)} per ${i.per} per person, ${n(i.minutesPerTask, 2)} min each, ${n(i.people)} people, ${n(i.automatedPercent)}% automated`,
    `Hourly cost ${m(i.hourlyCost)} · build ${m(i.buildCost)} · running ${m(i.monthlyCost)}/month`,
    "",
    `Hours saved per year: ${n(r.hoursSavedPerYear, 1)}`,
    `Annual savings: ${m(r.annualSavings)} (net of running costs: ${m(r.netAnnual)})`,
    `Payback: ${formatPayback(r.paybackMonths)}`,
    `First-year ROI: ${formatPercent(r.roiYear1)} · 3-year ROI: ${formatPercent(r.roi3Years)} (net ${m(r.net3Years)})`,
  ];
  if (i.per === "day") lines.push(`Assumes ${n(i.workingDaysPerYear)} working days a year.`);
  if (link) lines.push("", link);
  return lines.join("\n");
}

/** Month-by-month cumulative figures, for a spreadsheet. */
export function monthlyCsv(i: Inputs, r: Results): string {
  const rows = ["month,cumulative_savings,cumulative_cost,cumulative_net"];
  for (const p of series(i, r).points) rows.push(`${p.month},${p.savings.toFixed(2)},${p.cost.toFixed(2)},${(p.savings - p.cost).toFixed(2)}`);
  return rows.join("\r\n") + "\r\n";
}

export function tasksLabel(i: Inputs): string {
  return `${n(i.count, 2)} × ${n(periodsPerYear(i.per, i.workingDaysPerYear))} ${i.per === "day" ? "working days" : i.per === "week" ? "weeks" : "months"} × ${n(i.people)} people`;
}

"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { monthlyCsv, summaryText, tasksLabel } from "./logic/report";
import { calculate, CURRENCIES, formatMoney, formatPayback, formatPercent, LIMITS, series, validate, type Currency, type Field, type Inputs, type Per, type Results } from "./logic/roi";
import { decodeState, encodeState, type RawInputs } from "./logic/share";
import { EXAMPLES, INVOICE_ENTRY } from "../fixtures/examples";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";


const EMPTY: RawInputs = { count: "", per: "day", minutesPerTask: "", people: "", hourlyCost: "", buildCost: "", monthlyCost: "", automatedPercent: "100", workingDaysPerYear: "230" };

const FIELDS: { key: Exclude<Field, "per">; label: string; hint: string; money?: boolean; suffix?: string }[] = [
  { key: "count", label: "How often the task happens", hint: "per person, in the period chosen next to it" },
  { key: "minutesPerTask", label: "Minutes per task", hint: "time one person spends on it by hand", suffix: "min" },
  { key: "people", label: "People doing it", hint: "everyone who does this task" },
  { key: "hourlyCost", label: "Hourly cost per person", hint: "salary plus overhead, per hour", money: true },
  { key: "buildCost", label: "One-off build cost", hint: "development, setup, training", money: true },
  { key: "monthlyCost", label: "Monthly tool or maintenance cost", hint: "subscriptions, hosting, upkeep", money: true },
  { key: "automatedPercent", label: "Share of the work automated", hint: "100% if no manual step remains", suffix: "%" },
];

function save(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Round axis steps: 1, 2 or 5 × a power of ten. */
function niceStep(max: number, ticks: number): number {
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const m = raw / pow;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * pow;
}

function BreakEvenChart({ inputs, results, currency }: { inputs: Inputs; results: Results; currency: Currency }) {
  const uid = useId();
  const { points, months } = series(inputs, results);
  const W = 640;
  const H = 300;
  const pad = { l: 64, r: 16, t: 16, b: 40 };
  const maxY = Math.max(1, ...points.map((p) => Math.max(p.savings, p.cost)));
  const step = niceStep(maxY, 5);
  const top = Math.ceil(maxY / step) * step;
  const x = (m: number) => pad.l + (m / months) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / top) * (H - pad.t - pad.b);
  const path = (k: "savings" | "cost") => points.map((p, i) => `${i ? "L" : "M"}${x(p.month).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");
  const be = results.paybackMonths;
  const showBe = be !== null && be <= months;
  const beValue = showBe ? inputs.buildCost + inputs.monthlyCost * be : 0;
  const xStep = months <= 36 ? 6 : 12;
  const desc = showBe ? `Cumulative savings overtake cumulative cost at month ${be.toFixed(1)}.` : "Cumulative savings never overtake cumulative cost in this period.";
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby={`${uid}-t ${uid}-d`}>
        <title id={`${uid}-t`}>{`Break-even chart: cumulative savings and cumulative cost over ${months} months`}</title>
        <desc id={`${uid}-d`}>{desc}</desc>
        {Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step).map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#e2e8f0" />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#475569">
              {formatMoney(v, currency, true)}
            </text>
          </g>
        ))}
        {Array.from({ length: Math.floor(months / xStep) + 1 }, (_, i) => i * xStep).map((m) => (
          <text key={m} x={x(m)} y={H - pad.b + 18} textAnchor="middle" fontSize="11" fill="#475569">
            {m}
          </text>
        ))}
        <text x={(pad.l + W - pad.r) / 2} y={H - 4} textAnchor="middle" fontSize="11" fill="#475569">
          Months after launch
        </text>
        <path d={path("cost")} fill="none" stroke="#d97706" strokeWidth="2.5" strokeDasharray="6 4" />
        <path d={path("savings")} fill="none" stroke="#0b5cff" strokeWidth="2.5" />
        {showBe && (
          <g>
            <line x1={x(be)} x2={x(be)} y1={pad.t} y2={H - pad.b} stroke="#16a34a" strokeDasharray="3 3" />
            <circle cx={x(be)} cy={y(beValue)} r="5" fill="#16a34a" stroke="#fff" strokeWidth="2" />
            <text x={Math.min(x(be) + 8, W - pad.r - 150)} y={pad.t + 14} fontSize="12" fontWeight="600" fill="#166534">
              {`Break-even: month ${be.toFixed(1)}`}
            </text>
          </g>
        )}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-700">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-6 bg-primary" aria-hidden="true" /> Cumulative savings
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 border-t-2 border-dashed border-amber-600" aria-hidden="true" /> Cumulative cost (build + running)
        </span>
        {showBe ? (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-600" aria-hidden="true" /> Break-even
          </span>
        ) : (
          <span className="font-semibold text-red-800">{results.never ? "The lines never cross: it never pays back." : `Break-even is after month ${months}.`}</span>
        )}
      </figcaption>
      <details className="mt-3 text-sm print:hidden">
        <summary className={`cursor-pointer rounded text-slate-700 ${focusRing}`}>Show the numbers as a table</summary>
        <div className={`relative mt-2 max-h-64 overflow-auto rounded ${focusRing}`} role="region" aria-label="Break-even data" tabIndex={0}>
          <table className="w-full text-right text-xs">
            <caption className="sr-only">Cumulative savings, cost and net result by month</caption>
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th scope="col" className="py-1 pr-3 text-left">
                  Month
                </th>
                <th scope="col" className="py-1 pr-3">
                  Savings
                </th>
                <th scope="col" className="py-1 pr-3">
                  Cost
                </th>
                <th scope="col" className="py-1">
                  Net
                </th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {points
                .filter((p) => p.month % 3 === 0)
                .map((p) => (
                  <tr key={p.month} className="border-b border-slate-100">
                    <th scope="row" className="py-1 pr-3 text-left font-sans font-normal">
                      {p.month}
                    </th>
                    <td className="py-1 pr-3">{formatMoney(p.savings, currency)}</td>
                    <td className="py-1 pr-3">{formatMoney(p.cost, currency)}</td>
                    <td className={`py-1 ${p.savings - p.cost < 0 ? "text-red-800" : "text-green-800"}`}>{formatMoney(p.savings - p.cost, currency)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export default function WorkflowAutomationRoiCalculatorTool() {
  const uid = useId();
  const [raw, setRaw] = useState<RawInputs>(INVOICE_ENTRY.raw);
  const [currency, setCurrency] = useState<Currency>(INVOICE_ENTRY.currency);
  const [view, setView] = useState<"year" | "month">("year");
  const [notice, setNotice] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // A shared link (#n=…) replaces the example after the first render. Applying it twice is harmless.
  useEffect(() => {
    const d = decodeState(window.location.hash);
    if (!d) return;
    const t = setTimeout(() => {
      if (d.ok) {
        setRaw(d.raw);
        setCurrency(d.currency);
      } else setLinkError(d.error);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const v = useMemo(() => validate(raw), [raw]);
  const inputs = v.ok ? v.inputs : null;
  const results = useMemo(() => (inputs ? calculate(inputs) : null), [inputs]);
  const allEmpty = (Object.keys(LIMITS) as Exclude<Field, "per">[]).filter((k) => k !== "automatedPercent" && k !== "workingDaysPerYear").every((k) => raw[k].trim() === "");
  const errors = !v.ok && !allEmpty ? v.errors : {};

  const set = (k: Field, value: string) => {
    setNotice(null);
    setRaw((r) => ({ ...r, [k]: value }));
  };

  const link = () => `${window.location.origin}${window.location.pathname}#${encodeState(raw, currency)}`;

  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${what} copied.`);
    } catch {
      setNotice("Your browser blocked clipboard access. Select the text in the address bar instead.");
    }
  };

  const m = (x: number) => formatMoney(x, currency);
  const div = view === "year" ? 1 : 12;
  const per = view === "year" ? "per year" : "per month";

  return (
    <div className="space-y-6 text-navy print:space-y-4">
      <section className={`${card} print:hidden`} aria-labelledby={`${uid}-in`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-in`} className="text-lg font-semibold">
            Your task and costs
          </h2>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((e, i) => (
              <button
                key={e.name}
                type="button"
                className={btnSecondary}
                onClick={() => {
                  setRaw(e.raw);
                  setCurrency(e.currency);
                  setLinkError(null);
                  setNotice(null);
                }}
              >
                {i === 0 ? "Try an example" : e.name}
              </button>
            ))}
            <button
              type="button"
              className={btnSecondary}
              onClick={() => {
                setRaw(EMPTY);
                setLinkError(null);
                setNotice(null);
              }}
            >
              Clear
            </button>
          </div>
        </div>
        {linkError && (
          <p role="alert" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            {linkError}
          </p>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FIELDS.map((f) => {
            const err = errors[f.key];
            return (
              <div key={f.key}>
                <label htmlFor={`${uid}-${f.key}`} className="block text-sm font-medium">
                  {f.label}
                  {f.money ? ` (${currency})` : ""}
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id={`${uid}-${f.key}`}
                    inputMode="decimal"
                    className={`${inputCls} ${err ? "border-red-500" : "border-slate-300"}`}
                    value={raw[f.key]}
                    onChange={(e) => set(f.key, e.target.value)}
                    aria-invalid={err ? true : undefined}
                    aria-describedby={`${uid}-${f.key}-h${err ? ` ${uid}-${f.key}-e` : ""}`}
                  />
                  {f.key === "count" && (
                    <select aria-label="Period" className={`${inputCls} w-32 border-slate-300`} value={raw.per} onChange={(e) => set("per", e.target.value as Per)}>
                      <option value="day">per day</option>
                      <option value="week">per week</option>
                      <option value="month">per month</option>
                    </select>
                  )}
                  {f.suffix && (
                    <span className="self-center text-sm text-slate-600" aria-hidden="true">
                      {f.suffix}
                    </span>
                  )}
                </div>
                <p id={`${uid}-${f.key}-h`} className="mt-1 text-xs text-slate-600">
                  {f.hint}
                </p>
                {err && (
                  <p id={`${uid}-${f.key}-e`} className="mt-1 text-xs font-semibold text-red-800">
                    {err}
                  </p>
                )}
              </div>
            );
          })}
          <div>
            <label htmlFor={`${uid}-cur`} className="block text-sm font-medium">
              Currency
            </label>
            <select id={`${uid}-cur`} className={`${inputCls} mt-1 border-slate-300`} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-600">only changes how amounts are shown</p>
          </div>
        </div>
        {raw.per === "day" && (
          <div className="mt-4 max-w-xs">
            <label htmlFor={`${uid}-days`} className="block text-sm font-medium">
              Working days per year
            </label>
            <input id={`${uid}-days`} inputMode="numeric" className={`${inputCls} mt-1 ${errors.workingDaysPerYear ? "border-red-500" : "border-slate-300"}`} value={raw.workingDaysPerYear} onChange={(e) => set("workingDaysPerYear", e.target.value)} aria-invalid={errors.workingDaysPerYear ? true : undefined} />
            {errors.workingDaysPerYear && <p className="mt-1 text-xs font-semibold text-red-800">{errors.workingDaysPerYear}</p>}
          </div>
        )}
        <p className="mt-4 text-xs text-slate-600">Everything is calculated in your browser as you type. Nothing is sent anywhere; the share link keeps the numbers in the part of the address after #, which browsers do not send to servers.</p>
      </section>

      <div aria-live="polite" className="min-h-6 text-sm text-slate-700 print:hidden">
        {notice}
      </div>

      {allEmpty && (
        <section className={card}>
          <p className="text-sm text-slate-700">Fill in the task and its costs to see the hours saved, the payback period and the ROI. Or press “Try an example”.</p>
        </section>
      )}

      {!allEmpty && !v.ok && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Fix {Object.keys(v.errors).length === 1 ? "this value" : `these ${Object.keys(v.errors).length} values`} to see the results:</p>
          <ul className="mt-1 list-disc pl-5">
            {Object.values(v.errors).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {inputs && results && !allEmpty && (
        <>
          <section className={card} aria-labelledby={`${uid}-res`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id={`${uid}-res`} className="text-lg font-semibold">
                Return on investment
              </h2>
              <div className="flex rounded-xl border border-slate-300 p-0.5 print:hidden" role="group" aria-label="Show amounts">
                {(["year", "month"] as const).map((p) => (
                  <button key={p} type="button" aria-pressed={view === p} onClick={() => setView(p)} className={`rounded-lg px-3 py-1 text-sm font-semibold ${focusRing} ${view === p ? "bg-primary text-white" : "text-navy"}`}>
                    {p === "year" ? "Yearly" : "Monthly"}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-2 hidden text-sm print:block">
              {summaryText(inputs, results, currency, null).split("\n").slice(1, 3).join(" · ")}
            </p>
            {results.never && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                <strong>This automation never pays back</strong> with these numbers: it saves {m(results.annualSavings / div)} {per} but costs {m(results.annualToolCost / div)} {per} to run{inputs.buildCost > 0 ? `, so the ${m(inputs.buildCost)} build cost is never recovered` : ""}.
              </p>
            )}
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Hours saved", `${(results.hoursSavedPerYear / div).toLocaleString("en-US", { maximumFractionDigits: 1 })} h ${per}`],
                ["Savings", `${m(results.annualSavings / div)} ${per}`],
                ["Savings after running costs", `${m(results.netAnnual / div)} ${per}`],
                ["Payback period", formatPayback(results.paybackMonths)],
                ["First-year ROI", formatPercent(results.roiYear1)],
                ["3-year ROI", `${formatPercent(results.roi3Years)}${results.roi3Years !== null ? ` (net ${m(results.net3Years)})` : ""}`],
              ].map(([k, val]) => (
                <div key={k} className="rounded-xl bg-slate-50 p-3 print:border print:border-slate-300">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">{k}</dt>
                  <dd className={`mt-1 text-xl font-bold ${k === "Payback period" && results.never ? "text-red-800" : ""}`}>{val}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex flex-wrap gap-2 print:hidden">
              <button type="button" className={btnPrimary} onClick={() => copy(link(), "Share link")}>
                Copy share link
              </button>
              <button type="button" className={btnSecondary} onClick={() => copy(summaryText(inputs, results, currency, link()), "Summary")}>
                Copy summary
              </button>
              <button type="button" className={btnSecondary} onClick={() => save(monthlyCsv(inputs, results), "automation-roi-by-month.csv", "text/csv;charset=utf-8")}>
                Download CSV
              </button>
              <button type="button" className={btnSecondary} onClick={() => window.print()}>
                Print report
              </button>
            </div>
          </section>

          <section className={`${card} print:break-inside-avoid`} aria-labelledby={`${uid}-chart`}>
            <h2 id={`${uid}-chart`} className="text-lg font-semibold">
              Break-even
            </h2>
            <div className="mt-3">
              <BreakEvenChart inputs={inputs} results={results} currency={currency} />
            </div>
          </section>

          <section className={card} aria-labelledby={`${uid}-how`}>
            <h2 id={`${uid}-how`} className="text-lg font-semibold">
              How these numbers are calculated
            </h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-800">
              <li>
                Tasks per year = {tasksLabel(inputs)} = <strong>{results.tasksPerYear.toLocaleString("en-US", { maximumFractionDigits: 1 })}</strong>
                {inputs.per === "week" ? " (52 weeks)" : inputs.per === "month" ? " (12 months)" : ""}.
              </li>
              <li>
                Hours saved per year = tasks × {inputs.minutesPerTask} min × {inputs.automatedPercent}% ÷ 60 = <strong>{results.hoursSavedPerYear.toLocaleString("en-US", { maximumFractionDigits: 1 })} h</strong>.
              </li>
              <li>
                Savings per year = hours × {m(inputs.hourlyCost)} = <strong>{m(results.annualSavings)}</strong>; running cost = {m(inputs.monthlyCost)} × 12 = {m(results.annualToolCost)}.
              </li>
              <li>Payback = build cost ÷ (savings − running cost) per month{results.never ? ": the monthly result is not positive, so it never pays back" : ` = ${m(inputs.buildCost)} ÷ ${m(results.netAnnual / 12)} = ${formatPayback(results.paybackMonths)}`}.</li>
              <li>ROI = (savings − cost) ÷ cost over the period. Year 1 cost = build + 12 months of running cost; 3-year cost = build + 36 months. If there is no cost at all, ROI is not defined.</li>
            </ol>
            <p className="mt-3 text-xs text-slate-600">Assumptions: savings start on day one and stay the same every month; time saved is valued at the full hourly cost (it is only real money if that time is used for other work or saves paid hours); no discounting, taxes or price changes.</p>
          </section>
        </>
      )}
    </div>
  );
}

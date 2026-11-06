"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { convertDialect, DAY_LABELS, render, type Schedule } from "./logic/build";
import { buildSchedule, DEFAULT_BUILDER, type BuilderState, type Frequency, type MonthlyMode } from "./logic/builder";
import { MAX_PHRASE_LENGTH, parseNatural } from "./logic/natural";
import { DIALECT_LABELS, MAX_EXPRESSION_LENGTH, parseCron, type Dialect } from "./logic/parse";
import { describe } from "./logic/describe";
import { nextRuns } from "./logic/schedule";
import { isValidTimeZone, listTimeZones } from "./logic/timezone";
import { EXAMPLES } from "../fixtures/examples";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

/**
 * The page opens on this common schedule, so the meaning and the field table are in
 * the first HTML (visitors and crawlers see a filled result, not an empty box).
 */
const DEFAULT_PHRASE = "every weekday at 9:00";
const DEFAULT_EXPRESSION = "0 9 * * 1-5";

const FIELD_NAMES: Record<Dialect, string[]> = {
  standard: ["Minute", "Hour", "Day of month", "Month", "Day of week (0–7, Sun = 0 or 7)"],
  quartz: ["Second", "Minute", "Hour", "Day of month", "Month", "Day of week (1–7, Sun = 1)", "Year (optional)"],
  aws: ["Minute", "Hour", "Day of month", "Month", "Day of week (1–7, Sun = 1)", "Year"],
};

const MONTH_LABELS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];


function defaultZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export default function CronExpressionGeneratorTool() {
  const uid = useId();
  const [mode, setMode] = useState<"words" | "builder">("words");
  const [phrase, setPhrase] = useState(DEFAULT_PHRASE);
  const [phraseError, setPhraseError] = useState<string | null>(null);
  const [builder, setBuilder] = useState<BuilderState>(DEFAULT_BUILDER);
  const [dialect, setDialect] = useState<Dialect>("standard");
  const [expr, setExpr] = useState(DEFAULT_EXPRESSION);
  const [note, setNote] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState("UTC");
  const [zones, setZones] = useState<string[]>(["UTC"]);
  const [now, setNow] = useState(0);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Read the visitor's zone and the clock after mount so the server render and first client render match.
    const init = setTimeout(() => {
      setTimeZone(defaultZone());
      setZones(listTimeZones());
      setNow(Date.now());
    }, 0);
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearTimeout(init);
      clearInterval(t);
    };
  }, []);

  const applySchedule = (s: Schedule, d: Dialect) => {
    const r = render(s, d);
    if (r.ok) {
      setExpr(r.expression);
      setNote(null);
    } else {
      setNote(r.error);
    }
  };

  const generateFromWords = (text = phrase, d = dialect) => {
    const p = parseNatural(text);
    if (!p.ok) {
      setPhraseError(p.error);
      return;
    }
    setPhraseError(null);
    applySchedule(p.schedule, d);
  };

  const updateBuilder = (patch: Partial<BuilderState>) => {
    const next = { ...builder, ...patch };
    setBuilder(next);
    applySchedule(buildSchedule(next), dialect);
  };

  const changeDialect = (d: Dialect) => {
    if (d === dialect) return;
    setDialect(d);
    if (expr.trim() === "") return;
    const r = convertDialect(expr, dialect, d);
    if (r.ok) {
      setExpr(r.expression);
      setNote(`Converted to ${d === "standard" ? "standard cron" : d === "quartz" ? "Quartz" : "AWS EventBridge"}.`);
    } else {
      setNote(`Could not convert automatically: ${r.error}`);
    }
  };

  const tryExample = () => {
    const ex = EXAMPLES[exampleIndex % EXAMPLES.length];
    setExampleIndex((i) => i + 1);
    setMode("words");
    setPhrase(ex.phrase);
    setDialect(ex.dialect);
    if (isValidTimeZone(ex.timeZone)) setTimeZone(ex.timeZone);
    generateFromWords(ex.phrase, ex.dialect);
  };

  const parsed = useMemo(() => (expr.trim() === "" ? null : parseCron(expr, dialect)), [expr, dialect]);
  const schedule = useMemo(() => (parsed && parsed.ok && now > 0 ? nextRuns(parsed.spec, now, timeZone, 10) : null), [parsed, now, timeZone]);

  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone,
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: dialect === "quartz" ? "2-digit" : undefined,
        hourCycle: "h23",
        timeZoneName: "shortOffset",
      }),
    [timeZone, dialect],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(expr.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNote("Your browser blocked clipboard access. Select the expression and copy it with Ctrl+C or Cmd+C.");
    }
  };

  const downloadRuns = () => {
    if (!schedule) return;
    const lines = ["local_time,time_zone,utc"];
    for (const r of schedule.runs) lines.push(`"${fmt.format(new Date(r.utc))}",${timeZone},${new Date(r.utc).toISOString()}`);
    const blob = new Blob([lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "next-runs.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const fields = parsed && parsed.ok ? (dialect === "standard" ? parsed.spec.fields.slice(1, 6) : dialect === "aws" ? parsed.spec.fields.slice(1) : parsed.spec.fields.slice(0, parsed.spec.normalized.split(" ").length)) : [];
  const description = parsed && parsed.ok ? describe(parsed.spec) : "";

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-in`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>1</span>Describe the schedule</h2>
          <button type="button" className={btnSecondary} onClick={tryExample}>Try an example</button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-dialect`} className="block text-sm font-medium">Cron dialect</label>
            <select id={`${uid}-dialect`} className={`${inputCls} mt-1`} value={dialect} onChange={(e) => changeDialect(e.target.value as Dialect)}>
              {(Object.keys(DIALECT_LABELS) as Dialect[]).map((d) => <option key={d} value={d}>{DIALECT_LABELS[d]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${uid}-tz`} className="block text-sm font-medium">Time zone for the next runs</label>
            <select id={`${uid}-tz`} className={`${inputCls} mt-1`} value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
              {(zones.includes(timeZone) ? zones : [timeZone, ...zones]).map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-5 flex gap-1 border-b border-slate-200" role="tablist" aria-label="Input method">
          {(["words", "builder"] as const).map((m) => (
            <button key={m} type="button" role="tab" id={`${uid}-tab-${m}`} aria-selected={mode === m} aria-controls={`${uid}-panel-${m}`} onClick={() => setMode(m)} className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-semibold ${mode === m ? "border-primary text-primary-dark" : "border-transparent text-slate-ink hover:text-navy"} ${focusRing}`}>
              {m === "words" ? "In plain English" : "Visual builder"}
            </button>
          ))}
        </div>

        {mode === "words" ? (
          <form
            id={`${uid}-panel-words`}
            role="tabpanel"
            aria-labelledby={`${uid}-tab-words`}
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              generateFromWords();
            }}
          >
            <label htmlFor={`${uid}-phrase`} className="block text-sm font-medium">Schedule in words</label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input id={`${uid}-phrase`} className={inputCls} value={phrase} maxLength={MAX_PHRASE_LENGTH} onChange={(e) => setPhrase(e.target.value)} placeholder="every weekday at 9:30" aria-describedby={`${uid}-phrase-help`} aria-invalid={phraseError ? true : undefined} />
              <button type="submit" className={btnPrimary}>Generate</button>
            </div>
            <p id={`${uid}-phrase-help`} className="mt-1 text-xs text-slate-ink">
              Understands intervals, times, weekdays, days of the month, “first Monday”, “last day of the month”, months and “between 9am and 5pm”. Parsed in your browser, no AI.
            </p>
            {phraseError && <p role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{phraseError}</p>}
          </form>
        ) : (
          <div id={`${uid}-panel-builder`} role="tabpanel" aria-labelledby={`${uid}-tab-builder`} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor={`${uid}-freq`} className="block text-sm font-medium">Repeat</label>
              <select id={`${uid}-freq`} className={`${inputCls} mt-1`} value={builder.frequency} onChange={(e) => updateBuilder({ frequency: e.target.value as Frequency })}>
                <option value="minutes">Every few minutes</option>
                <option value="hourly">Every few hours</option>
                <option value="daily">Every day</option>
                <option value="weekly">On chosen weekdays</option>
                <option value="monthly">Every month</option>
                <option value="yearly">Every year</option>
              </select>
            </div>
            {builder.frequency === "minutes" && (
              <NumberField id={`${uid}-every-min`} label="Every N minutes" value={builder.everyMinutes} min={1} max={59} onChange={(v) => updateBuilder({ everyMinutes: v })} />
            )}
            {builder.frequency === "hourly" && (
              <>
                <NumberField id={`${uid}-every-h`} label="Every N hours" value={builder.everyHours} min={1} max={23} onChange={(v) => updateBuilder({ everyHours: v })} />
                <NumberField id={`${uid}-minute`} label="At minute" value={builder.minute} min={0} max={59} onChange={(v) => updateBuilder({ minute: v })} />
              </>
            )}
            {builder.frequency !== "minutes" && builder.frequency !== "hourly" && (
              <div>
                <label htmlFor={`${uid}-time`} className="block text-sm font-medium">At time</label>
                <input id={`${uid}-time`} type="time" className={`${inputCls} mt-1`} value={builder.time} onChange={(e) => e.target.value && updateBuilder({ time: e.target.value })} />
              </div>
            )}
            {builder.frequency === "weekly" && (
              <fieldset className="sm:col-span-2 lg:col-span-3">
                <legend className="text-sm font-medium">On these days</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <label key={d} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${builder.weekdays.includes(d) ? "border-primary bg-primary-soft font-semibold text-primary-dark" : "border-slate-300"}`}>
                      <input type="checkbox" className="sr-only" checked={builder.weekdays.includes(d)} onChange={(e) => updateBuilder({ weekdays: e.target.checked ? [...builder.weekdays, d] : builder.weekdays.filter((x) => x !== d) })} />
                      {DAY_LABELS[d].slice(0, 3)}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {(builder.frequency === "monthly" || builder.frequency === "yearly") && (
              <>
                {builder.frequency === "yearly" && (
                  <div>
                    <label htmlFor={`${uid}-month`} className="block text-sm font-medium">Month</label>
                    <select id={`${uid}-month`} className={`${inputCls} mt-1`} value={builder.month} onChange={(e) => updateBuilder({ month: Number(e.target.value) })}>
                      {MONTH_LABELS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label htmlFor={`${uid}-mmode`} className="block text-sm font-medium">Which day</label>
                  <select id={`${uid}-mmode`} className={`${inputCls} mt-1`} value={builder.monthlyMode} onChange={(e) => updateBuilder({ monthlyMode: e.target.value as MonthlyMode })}>
                    <option value="day">A day number</option>
                    <option value="last">The last day (Quartz/AWS)</option>
                    <option value="lastWeekday">The last weekday (Quartz/AWS)</option>
                    <option value="nth">A weekday, e.g. first Monday (Quartz/AWS)</option>
                  </select>
                </div>
                {builder.monthlyMode === "day" && (
                  <NumberField id={`${uid}-mday`} label="Day of the month" value={builder.monthDay} min={1} max={31} onChange={(v) => updateBuilder({ monthDay: v })} />
                )}
                {builder.monthlyMode === "nth" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor={`${uid}-nth`} className="block text-sm font-medium">Which</label>
                      <select id={`${uid}-nth`} className={`${inputCls} mt-1`} value={builder.nth} onChange={(e) => updateBuilder({ nth: Number(e.target.value) })}>
                        {["First", "Second", "Third", "Fourth", "Fifth", "Last"].map((l, i) => <option key={l} value={i + 1}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`${uid}-nthday`} className="block text-sm font-medium">Weekday</label>
                      <select id={`${uid}-nthday`} className={`${inputCls} mt-1`} value={builder.nthDay} onChange={(e) => updateBuilder({ nthDay: Number(e.target.value) })}>
                        {DAY_LABELS.map((l, i) => <option key={l} value={i}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="flex items-end">
              <button type="button" className={btnPrimary} onClick={() => applySchedule(buildSchedule(builder), dialect)}>Use these settings</button>
            </div>
          </div>
        )}
      </section>

      <section className={card} aria-labelledby={`${uid}-expr-h`}>
        <h2 id={`${uid}-expr-h`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>2</span>Cron expression</h2>
        <label htmlFor={`${uid}-expr`} className="mt-3 block text-sm font-medium">Expression ({dialect === "standard" ? "5 fields" : dialect === "quartz" ? "6 or 7 fields" : "cron( ) with 6 fields"}); you can also type or paste one</label>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <input
            id={`${uid}-expr`}
            className={`${inputCls} font-mono text-base`}
            value={expr}
            maxLength={MAX_EXPRESSION_LENGTH}
            onChange={(e) => {
              setExpr(e.target.value);
              setNote(null);
            }}
            placeholder={dialect === "standard" ? "30 9 * * 1-5" : dialect === "quartz" ? "0 30 9 ? * MON-FRI" : "cron(30 9 ? * MON-FRI *)"}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={parsed && !parsed.ok ? true : undefined}
          />
          <button type="button" className={btnPrimary} onClick={copy} disabled={!parsed || !parsed.ok}>{copied ? "Copied" : "Copy"}</button>
        </div>
        {note && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{note}</p>}
        <p className="mt-2 text-xs text-slate-ink">Up to {MAX_EXPRESSION_LENGTH} characters. Everything is calculated in your browser.</p>
      </section>

      <section className={card} aria-labelledby={`${uid}-out`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-out`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>3</span>What it means</h2>
          <button type="button" className={btnSecondary} onClick={downloadRuns} disabled={!schedule || schedule.runs.length === 0}>Download next runs (.csv)</button>
        </div>
        <div aria-live="polite" className="mt-3 min-h-[22rem]">
          {!parsed && <p className="text-sm text-slate-ink">Describe a schedule, use the builder, type an expression or try an example. The meaning and the next 10 run times appear here.</p>}
          {parsed && !parsed.ok && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <strong>This expression is not valid.</strong> {parsed.error}
            </div>
          )}
          {parsed && parsed.ok && (
            <>
              <p className="text-lg font-semibold">{description}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {fields.map((f, i) => (
                  <div key={i} className="rounded-xl bg-slate-50 p-2">
                    <dt className="text-xs text-slate-ink">{FIELD_NAMES[dialect][i]}</dt>
                    <dd className="font-mono text-sm font-semibold break-all">{f}</dd>
                  </div>
                ))}
              </dl>
              {!schedule && (
                // The run times depend on the visitor's clock and time zone, so they are filled in right after the page loads.
                <div aria-hidden className="mt-5">
                  <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
                  <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {Array.from({ length: 10 }, (_, i) => (
                      <div key={i} className="px-3 py-2.5">
                        <div className="h-4 w-56 animate-pulse rounded bg-slate-100" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {schedule && <h3 className="mt-5 text-sm font-semibold">Next {schedule.runs.length} runs in {timeZone.replace(/_/g, " ")}</h3>}
              {schedule && (schedule.runs.length === 0 ? (
                <p className="mt-2 text-sm text-slate-ink">This schedule has no runs in the next 100 years (for example 30 February, or only past years).</p>
              ) : (
                <ol className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                  {schedule.runs.map((r, i) => (
                    <li key={r.utc} className="flex flex-wrap items-baseline justify-between gap-x-4 px-3 py-2">
                      <span><span className="mr-2 text-slate-ink tabular-nums">{i + 1}.</span><span className="tabular-nums">{fmt.format(new Date(r.utc))}</span>{r.repeated && <span className="ml-2 text-xs text-amber-900">(clock time repeats on DST change; first one)</span>}</span>
                      <span className="font-mono text-xs text-slate-ink">{new Date(r.utc).toISOString().replace(".000Z", "Z")}</span>
                    </li>
                  ))}
                </ol>
              ))}
              {schedule && schedule.skipped.length > 0 && (
                <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                  Skipped because the clock jumps forward (DST): {schedule.skipped.map((w) => `${w.y}-${String(w.m).padStart(2, "0")}-${String(w.d).padStart(2, "0")} ${String(w.h).padStart(2, "0")}:${String(w.mi).padStart(2, "0")}`).join(", ")}. Some cron daemons run such jobs right after the jump instead.
                </p>
              )}
              {dialect === "aws" && <p className="mt-2 text-xs text-slate-ink">EventBridge rules always run in UTC; EventBridge Scheduler lets you pick a time zone.</p>}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function NumberField({ id, label, value, min, max, onChange }: { id: string; label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <input id={id} type="number" inputMode="numeric" className={`${inputCls} mt-1`} value={value} min={min} max={max} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

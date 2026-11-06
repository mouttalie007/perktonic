"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { CITIES, searchZones } from "./logic/cities";
import { toIcs } from "./logic/ics";
import { hm, MAX_PEOPLE, type Person, type Plan } from "./logic/overlap";
import { decodePlan, encodePlan } from "./logic/share";
import { isValidTimeZone, listTimeZones } from "./logic/timezone";
import type { WorkerRequest, WorkerResponse } from "./worker/plan.worker";
import { EXAMPLE_PLAN } from "../fixtures/team";
import { btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

type Result = Extract<WorkerResponse, { type: "result" }>;

const OUTLOOK_WEEKS = 12;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];


function cityLabel(zone: string): string {
  return CITIES.find(([, z]) => z === zone)?.[0] ?? zone.split("/").pop()!.replace(/_/g, " ");
}

/** Today, or the next Monday when today is a weekend: the sample team works Monday to Friday, so a weekend would show "no overlap". */
function todayIso(): string {
  const d = new Date();
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  else if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function saveEvent(from: number, to: number, description: string, name: string) {
  const blob = new Blob([toIcs(from, to, "Team meeting", description, Date.now())], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ZonePicker({ id, label, value, onChange, zones }: { id: string; label: string; value: string; onChange: (zone: string) => void; zones: string[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const options = useMemo(() => (query ? searchZones(query, zones, 8) : []), [query, zones]);
  const choose = (zone: string) => {
    onChange(zone);
    setQuery("");
    setOpen(false);
  };
  return (
    <div className="relative min-w-0">
      <label htmlFor={id} className="block text-xs font-medium">{label}</label>
      <input
        id={id}
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${id}-opt-${active}` : undefined}
        className={`${inputCls} mt-1`}
        value={open ? query : value ? `${cityLabel(value)} (${value})` : ""}
        placeholder="Search a city or zone"
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && options[active]) {
            e.preventDefault();
            choose(options[active].zone);
          } else if (e.key === "Escape") setOpen(false);
        }}
        spellCheck={false}
        autoComplete="off"
      />
      {open && options.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {options.map((o, i) => (
            <li key={o.label + o.zone} id={`${id}-opt-${i}`} role="option" aria-selected={i === active} className={`cursor-pointer px-3 py-1.5 ${i === active ? "bg-primary-soft" : ""}`} onMouseDown={(e) => { e.preventDefault(); choose(o.zone); }}>
              {o.label} <span className="text-xs text-slate-ink">{o.zone}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function RemoteTeamTimezoneOverlapPlannerTool() {
  const uid = useId();
  const [people, setPeople] = useState<Person[]>(EXAMPLE_PLAN.people);
  const [date, setDate] = useState("");
  const [viewZone, setViewZone] = useState(EXAMPLE_PLAN.viewZone);
  const [minMinutes, setMinMinutes] = useState(30);
  const [zones, setZones] = useState<string[]>(["UTC"]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const jobRef = useRef(0);
  const ready = useRef(false);

  const plan: Plan = useMemo(() => ({ people, date, viewZone, minMinutes }), [people, date, viewZone, minMinutes]);

  // Read a shared plan from the URL fragment once, after mount (the fragment never reaches the server).
  useEffect(() => {
    const t = setTimeout(() => {
      setZones(listTimeZones());
      setDate(todayIso());
      const hash = window.location.hash;
      if (hash.includes("plan=")) {
        const r = decodePlan(hash, isValidTimeZone);
        if (r.ok) {
          setPeople(r.plan.people);
          setDate(r.plan.date);
          setViewZone(r.plan.viewZone);
          setMinMinutes(r.plan.minMinutes);
        } else setLinkError(r.error);
      }
      ready.current = true;
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const w = new Worker(new URL("./worker/plan.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.jobId !== jobRef.current) return;
        setLoading(false);
        if (e.data.type === "result") {
          setResult(e.data);
          setError(null);
        } else {
          setResult(null);
          setError(e.data.message);
        }
      };
      workerRef.current = w;
    }
    return workerRef.current;
  }, []);

  useEffect(() => () => workerRef.current?.terminate(), []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!ready.current) return;
      // The sample team the page opens with stays out of the address bar until the visitor changes it.
      const sample = encodePlan(plan) === encodePlan({ ...EXAMPLE_PLAN, date: plan.date });
      if (people.length > 0 && !sample) window.history.replaceState(null, "", `#${encodePlan(plan)}`);
      else if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
      if (people.length < 2) {
        jobRef.current++;
        setResult(null);
        setError(null);
        setLoading(false);
        return;
      }
      const jobId = ++jobRef.current;
      setLoading(true);
      getWorker().postMessage({ jobId, plan, weeks: OUTLOOK_WEEKS } satisfies WorkerRequest);
    }, 150);
    return () => clearTimeout(t);
  }, [plan, people.length, getWorker]);

  const update = (i: number, p: Partial<Person>) => setPeople((list) => list.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const addPerson = () =>
    setPeople((list) => [...list, { name: "", zone: list[list.length - 1]?.zone ?? "Europe/London", start: "09:00", end: "17:00", days: [1, 2, 3, 4, 5] }]);

  const loadExample = () => {
    setPeople(EXAMPLE_PLAN.people);
    setDate(todayIso());
    setViewZone(EXAMPLE_PLAN.viewZone);
    setMinMinutes(EXAMPLE_PLAN.minMinutes);
    setLinkError(null);
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${what} copied.`);
    } catch {
      setNotice("Your browser blocked clipboard access. Copy the address from the address bar instead.");
    }
  };

  const shareLink = () => copy(`${window.location.origin}${window.location.pathname}#${encodePlan(plan)}`, "Share link");

  const summary = result
    ? [`Meeting windows for ${date} (${viewZone}):`, ...(result.explanations.length ? result.explanations.map((e) => `- ${e}`) : ["- No shared window of at least " + minMinutes + " minutes."])].join("\n")
    : "";

  const downloadIcs = (i: number) => {
    if (result) saveEvent(result.day.best[i].from, result.day.best[i].to, result.explanations[i], `meeting-${date}.ics`);
  };

  const viewOptions = useMemo(() => [...new Set(["UTC", ...people.map((p) => p.zone)])], [people]);
  const fmtMinutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-team`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-team`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>1</span>Your team</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={loadExample}>Try an example</button>
            <button type="button" className={btnSecondary} onClick={() => setPeople([])} disabled={people.length === 0}>Clear</button>
          </div>
        </div>
        {linkError && <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{linkError}</div>}
        <ul className="mt-4 space-y-3">
          {people.map((p, i) => (
            <li key={i} className="rounded-xl border border-slate-200 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto_auto]">
                <div>
                  <label htmlFor={`${uid}-n${i}`} className="block text-xs font-medium">Name or role</label>
                  <input id={`${uid}-n${i}`} className={`${inputCls} mt-1`} value={p.name} maxLength={40} onChange={(e) => update(i, { name: e.target.value })} placeholder={`Person ${i + 1}`} />
                </div>
                <ZonePicker id={`${uid}-z${i}`} label="City or time zone" value={p.zone} zones={zones} onChange={(zone) => update(i, { zone })} />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor={`${uid}-s${i}`} className="block text-xs font-medium">Starts</label>
                    <input id={`${uid}-s${i}`} type="time" step={900} className={`${inputCls} mt-1`} value={p.start} onChange={(e) => update(i, { start: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor={`${uid}-e${i}`} className="block text-xs font-medium">Ends</label>
                    <input id={`${uid}-e${i}`} type="time" step={900} className={`${inputCls} mt-1`} value={p.end === "24:00" ? "23:59" : p.end} onChange={(e) => update(i, { end: e.target.value })} />
                  </div>
                </div>
                <button type="button" className={`${btnSecondary} self-end`} aria-label={`Remove ${p.name || `person ${i + 1}`}`} onClick={() => setPeople((list) => list.filter((_, j) => j !== i))}>Remove</button>
              </div>
              <fieldset className="mt-2">
                <legend className="sr-only">Working days for {p.name || `person ${i + 1}`}</legend>
                <div className="flex flex-wrap gap-1">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <label key={d} className={`cursor-pointer rounded-lg border px-2 py-1 text-xs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${p.days.includes(d) ? "border-primary bg-primary-soft font-semibold text-primary-dark" : "border-slate-300 text-slate-ink"}`}>
                      <input type="checkbox" className="sr-only" checked={p.days.includes(d)} onChange={(e) => update(i, { days: e.target.checked ? [...p.days, d].sort() : p.days.filter((x) => x !== d) })} />
                      {DAY_NAMES[d]}
                    </label>
                  ))}
                  {p.end !== "" && p.end === p.start && <span className="ml-2 self-center text-xs text-slate-ink">Same start and end: works around the clock</span>}
                  {p.end !== "" && p.end < p.start && <span className="ml-2 self-center text-xs text-slate-ink">Overnight: ends the next day</span>}
                </div>
              </fieldset>
            </li>
          ))}
        </ul>
        <button type="button" className={`${btnSecondary} mt-3`} onClick={addPerson} disabled={people.length >= MAX_PEOPLE}>Add person</button>
        <p className="mt-2 text-xs text-slate-ink">Up to {MAX_PEOPLE} people. Everything is calculated in your browser; the share link keeps the plan after the # of the address, which browsers never send to a server.</p>
      </section>

      <section className={card} aria-labelledby={`${uid}-settings`}>
        <h2 id={`${uid}-settings`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>2</span>Day and view</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={`${uid}-date`} className="block text-sm font-medium">Date to plan</label>
            <input id={`${uid}-date`} type="date" className={`${inputCls} mt-1`} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor={`${uid}-view`} className="block text-sm font-medium">Show times in</label>
            <select id={`${uid}-view`} className={`${inputCls} mt-1`} value={viewZone} onChange={(e) => setViewZone(e.target.value)}>
              {viewOptions.map((z) => <option key={z} value={z}>{z === "UTC" ? "UTC" : `${cityLabel(z)} (${z})`}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${uid}-min`} className="block text-sm font-medium">Shortest useful meeting</label>
            <select id={`${uid}-min`} className={`${inputCls} mt-1`} value={minMinutes} onChange={(e) => setMinMinutes(Number(e.target.value))}>
              {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{fmtMinutes(m)}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className={card} aria-labelledby={`${uid}-out`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-out`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>3</span>Best meeting times</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} disabled={people.length === 0} onClick={shareLink}>Copy share link</button>
            <button type="button" className={btnSecondary} disabled={!result} onClick={() => copy(summary, "Summary")}>Copy summary</button>
          </div>
        </div>
        <div aria-live="polite" className="mt-3 min-h-6 text-sm text-slate-ink">
          {people.length < 2 && "Add at least two people, or try the example."}
          {people.length >= 2 && loading && !result && "Comparing time zones…"}
          {result && (result.day.allAvailable ? `Everyone overlaps for ${fmtMinutes(result.day.sharedMinutes)} on ${date}.` : `There is no time when all ${people.length} people are working on ${date}; the best partial windows are shown.`)}
          {notice && <span className="block text-navy">{notice}</span>}
        </div>
        {error && <div role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

        <div className="mt-3 min-h-40">
          {result && (
            <>
              <ol className="space-y-2">
                {result.explanations.map((text, i) => (
                  <li key={i} className={`flex flex-wrap items-start justify-between gap-2 rounded-xl border p-3 text-sm ${result.day.best[i].count === people.length ? "border-green-200 bg-green-50 text-green-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                    <span className="min-w-0 flex-1">{text}</span>
                    <button type="button" className={btnSecondary} onClick={() => downloadIcs(i)}>Download .ics</button>
                  </li>
                ))}
                {result.explanations.length === 0 && <li className="rounded-xl border border-slate-200 p-3 text-sm">No window of at least {fmtMinutes(minMinutes)} where two or more people are working.</li>}
              </ol>
              {result.outlook.changes.length > 0 && (
                <div className="mt-3 rounded-xl bg-primary-soft p-3 text-sm">
                  <strong>Daylight saving ahead:</strong>{" "}
                  {result.outlook.changes.map((c, i) => `${i === 0 ? "from" : "then from"} ${c.date} the shared time ${c.sharedMinutes > (i === 0 ? result.outlook.base : result.outlook.changes[i - 1].sharedMinutes) ? "grows" : "shrinks"} to ${fmtMinutes(c.sharedMinutes)}`).join("; ")} (same weekday, next {OUTLOOK_WEEKS} weeks).
                </div>
              )}
              {result.day.notes.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-slate-ink">{result.day.notes.map((n) => <li key={n}>{n}</li>)}</ul>}

              <div className="relative mt-4 overflow-x-auto rounded-xl border border-slate-200">
                <table className="border-collapse text-xs">
                  <caption className="sr-only">Working hours per person in 15-minute steps, in {viewZone}</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="sticky left-0 z-10 bg-white px-2 py-1 text-left font-semibold">{viewZone === "UTC" ? "UTC" : cityLabel(viewZone)}</th>
                      {result.day.slots.map((s) => {
                        const label = hm(s.t, viewZone);
                        return <th key={s.t} scope="col" className="w-3 min-w-3 px-0 py-1 text-[10px] font-normal text-slate-ink">{label.endsWith(":00") ? label.slice(0, 2) : ""}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((p, i) => (
                      <tr key={i}>
                        <th scope="row" className="sticky left-0 z-10 max-w-40 truncate bg-white px-2 py-1 text-left font-medium" title={`${p.name} · ${p.zone} · ${result.labels[i]?.offset ?? ""}`}>
                          {p.name || `Person ${i + 1}`} <span className="font-normal text-slate-ink">{result.labels[i]?.offset}</span>
                        </th>
                        {result.day.slots.map((s) => (
                          <td key={s.t} className="h-6 p-0" title={`${p.name || `Person ${i + 1}`}: ${hm(s.t, p.zone)} local, ${s.available[i] ? "working" : "not working"}`}>
                            <div className={`h-full w-3 border-b-2 border-r border-white ${s.available[i] ? (s.count === people.length ? "bg-green-600" : "bg-primary") : "bg-slate-100"}`} />
                            <span className="sr-only">{s.available[i] ? "working" : "not working"}</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <th scope="row" className="sticky left-0 z-10 bg-white px-2 py-1 text-left font-medium">Working</th>
                      {result.day.slots.map((s) => <td key={s.t} className="p-0 text-center text-[9px] tabular-nums text-slate-ink">{s.count}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-xs text-slate-ink">Green: everyone is working. Blue: this person is working. Hover a cell for local time.</p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

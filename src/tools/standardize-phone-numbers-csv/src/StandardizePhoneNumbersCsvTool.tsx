"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { MAX_FILE_BYTES } from "./logic/input";
import { DEFAULT_OPTIONS, PHONE_COUNTRIES, RULES, type AmountOutput, type ColumnRule, type CountryOutput, type CurrencyLabel, type Options, type Rule } from "./logic/types";
import type { Loaded, Source, WorkerRequest, WorkerResponse } from "./worker/standardize.worker";
import { CONTACTS_CSV } from "../fixtures/contacts";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

type Applied = Extract<WorkerResponse, { type: "applied" }>;


const EXAMPLE_OPTIONS: Options = { ...DEFAULT_OPTIONS, phoneCountry: "GB", phoneCountryColumn: 3, amountOutput: "1.234,56", currencyLabel: "symbol-after", currency: "auto" };
const CURRENCIES = ["USD", "EUR", "GBP", "MAD", "CAD", "AUD", "CHF", "JPY", "INR", "AED", "SAR"];
const fmt = (n: number) => n.toLocaleString("en-US");

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function StandardizePhoneNumbersCsvTool() {
  const uid = useId();
  const [text, setText] = useState(CONTACTS_CSV);
  const [file, setFile] = useState<File | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [rules, setRules] = useState<ColumnRule[]>([]);
  const [opts, setOpts] = useState<Options>(EXAMPLE_OPTIONS);
  const [result, setResult] = useState<Applied | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ label: string; fraction: number } | null>(null);
  const [slow, setSlow] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [revive, setRevive] = useState(0);

  const workerRef = useRef<Worker | null>(null);
  const seq = useRef(0);
  const job = useRef(-1);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const keepOptions = useRef(true);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const w = new Worker(new URL("./worker/standardize.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const m = event.data;
        if (m.jobId !== job.current) return;
        if (m.type === "progress") return setBusy({ label: m.label, fraction: m.fraction });
        setBusy(null);
        setSlow(false);
        if (m.type === "loaded") {
          setLoaded(m.loaded);
          setRules(m.loaded.suggested.map((rule) => ({ rule, decimal: "auto" })));
          if (!keepOptions.current) {
            const countryCol = m.loaded.suggested.indexOf("country");
            setOpts((o) => ({ ...o, phoneCountryColumn: countryCol }));
          }
          keepOptions.current = false;
          setError(null);
        } else if (m.type === "applied") {
          setResult(m);
          setError(null);
        } else if (m.type === "error") {
          setResult(null);
          setError(m.message);
        }
      };
      w.onerror = () => {
        setBusy(null);
        setError("The background worker stopped unexpectedly, possibly out of memory. Try a smaller file.");
        workerRef.current = null;
      };
      workerRef.current = w;
    }
    return workerRef.current;
  }, []);
  useEffect(() => () => workerRef.current?.terminate(), []);

  const send = useCallback(
    (req: { type: "load"; source: Source } | { type: "apply"; rules: ColumnRule[]; options: Options }) => {
      const jobId = ++seq.current;
      job.current = jobId;
      setBusy({ label: req.type === "load" ? "Reading" : "Standardising", fraction: 0 });
      setSlow(false);
      setTimeout(() => {
        if (job.current === jobId) setSlow(true);
      }, 1000);
      getWorker().postMessage({ ...req, jobId } as WorkerRequest);
    },
    [getWorker],
  );

  // Read the data when it changes.
  useEffect(() => {
    const t = setTimeout(
      () => {
        const source: Source | null = file ? { kind: "file", file } : text.trim() ? { kind: "text", text } : null;
        if (!source) {
          job.current = ++seq.current;
          setLoaded(null);
          setResult(null);
          setBusy(null);
          setError(null);
          return;
        }
        send({ type: "load", source });
      },
      file ? 0 : 400,
    );
    return () => clearTimeout(t);
  }, [text, file, revive, send]);

  // Apply the rules whenever they or the options change.
  useEffect(() => {
    if (!loaded || rules.length !== loaded.header.length) return;
    const t = setTimeout(() => send({ type: "apply", rules, options: opts }), 250);
    return () => clearTimeout(t);
  }, [loaded, rules, opts, send]);

  const cancel = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    job.current = ++seq.current;
    setBusy(null);
    setSlow(false);
    setLoaded(null);
    setResult(null);
    setError("Cancelled. Press “Read again” to start over.");
  };

  const onFile = (f: File | null) => {
    if (!f) return;
    if (fileInput.current) fileInput.current.value = "";
    if (f.size > MAX_FILE_BYTES) return setError(`${f.name} is ${(f.size / 1048576).toFixed(1)} MB. The limit is 50 MB.`);
    setFile(f);
    setText("");
    setResult(null);
  };

  const copy = async (blob: Blob, what: string) => {
    try {
      await navigator.clipboard.writeText(await blob.text());
      setNotice(`${what} copied.`);
    } catch {
      setNotice("Your browser blocked clipboard access. Use the download instead.");
    }
  };

  const setRule = (i: number, patch: Partial<ColumnRule>) => setRules((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const header = loaded?.header ?? [];
  const usesPhone = rules.some((r) => r.rule === "phone");
  const usesAmount = rules.some((r) => r.rule === "amount");
  const usesCountry = rules.some((r) => r.rule === "country");
  const baseName = file ? file.name.replace(/\.(csv|tsv|txt|xlsx)$/i, "") : "data";

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-in`} className="text-lg font-semibold">
            Your data
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => {
                keepOptions.current = true;
                setFile(null);
                setText(CONTACTS_CSV);
                setOpts(EXAMPLE_OPTIONS);
                setRevive((n) => n + 1);
              }}
            >
              Try an example
            </button>
            <button type="button" className={btnSecondary} onClick={() => fileInput.current?.click()}>
              Open CSV or Excel
            </button>
            <button
              type="button"
              className={btnSecondary}
              disabled={!file && text === ""}
              onClick={() => {
                setFile(null);
                setText("");
              }}
            >
              Clear
            </button>
          </div>
        </div>
        <input ref={fileInput} type="file" accept=".csv,.tsv,.txt,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        {file ? (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            File: <span className="font-semibold text-navy">{file.name}</span> ({(file.size / 1048576).toFixed(2)} MB), read in your browser, not uploaded.
          </p>
        ) : (
          <>
            <label htmlFor={`${uid}-text`} className="mt-3 block text-sm text-slate-600">
              Paste CSV or TSV with a header row
            </label>
            <textarea id={`${uid}-text`} className={`${inputCls} mt-1 h-40 resize-y font-mono text-xs`} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
          </>
        )}
        <p className="mt-2 text-xs text-slate-600">
          {loaded ? `${loaded.info}: ${fmt(loaded.rowCount)} rows, ${loaded.header.length} columns. ` : ""}Paste up to 5 MB, or open a CSV, TSV or .xlsx file up to 50 MB (the first sheet is used). Nothing is uploaded.
        </p>
      </section>

      {loaded && (
        <section className={card} aria-labelledby={`${uid}-rules`}>
          <h2 id={`${uid}-rules`} className="text-lg font-semibold">
            Rule for each column
          </h2>
          <p className="mt-1 text-xs text-slate-600">Rules were suggested from the column names and values. Change any of them; the result updates by itself.</p>
          <div className={`relative mt-3 overflow-x-auto rounded-xl border border-slate-200 ${focusRing}`} role="region" aria-label="Columns and rules" tabIndex={0}>
            <table className="w-full min-w-[36rem] text-left text-sm">
              <caption className="sr-only">Each column with sample values and the rule applied to it</caption>
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-600">
                  <th scope="col" className="px-3 py-2">
                    Column
                  </th>
                  <th scope="col" className="px-3 py-2">
                    First values
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Rule
                  </th>
                </tr>
              </thead>
              <tbody>
                {header.map((h, i) => (
                  <tr key={i} className="border-b border-slate-100 align-top">
                    <th scope="row" className="px-3 py-2 font-semibold">
                      {h || `Column ${i + 1}`}
                    </th>
                    <td className="max-w-56 truncate px-3 py-2 font-mono text-xs text-slate-700">{loaded.sample.map((r) => r[i] ?? "").filter(Boolean).slice(0, 3).join(" · ")}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <select aria-label={`Rule for ${h || `column ${i + 1}`}`} className={`${inputCls} w-auto py-1.5`} value={rules[i]?.rule ?? "none"} onChange={(e) => setRule(i, { rule: e.target.value as Rule })}>
                          {RULES.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                        {rules[i]?.rule === "amount" && (
                          <select aria-label={`Number format of ${h}`} className={`${inputCls} w-auto py-1.5`} value={rules[i]?.decimal ?? "auto"} onChange={(e) => setRule(i, { decimal: e.target.value as ColumnRule["decimal"] })}>
                            <option value="auto">Read format: detect</option>
                            <option value="dot">Read as 1,234.56</option>
                            <option value="comma">Read as 1.234,56</option>
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {usesPhone && (
              <>
                <div>
                  <label htmlFor={`${uid}-pc`} className="block text-sm text-slate-600">
                    Default country for local phone numbers
                  </label>
                  <select id={`${uid}-pc`} className={`${inputCls} mt-1`} value={opts.phoneCountry} onChange={(e) => setOpts((o) => ({ ...o, phoneCountry: e.target.value }))}>
                    {PHONE_COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${uid}-pcc`} className="block text-sm text-slate-600">
                    Use each row&apos;s country from
                  </label>
                  <select id={`${uid}-pcc`} className={`${inputCls} mt-1`} value={opts.phoneCountryColumn} onChange={(e) => setOpts((o) => ({ ...o, phoneCountryColumn: Number(e.target.value) }))}>
                    <option value={-1}>No column (default country only)</option>
                    {header.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {usesCountry && (
              <div>
                <label htmlFor={`${uid}-co`} className="block text-sm text-slate-600">
                  Write countries as
                </label>
                <select id={`${uid}-co`} className={`${inputCls} mt-1`} value={opts.countryOutput} onChange={(e) => setOpts((o) => ({ ...o, countryOutput: e.target.value as CountryOutput }))}>
                  <option value="alpha2">ISO alpha-2 (DE)</option>
                  <option value="alpha3">ISO alpha-3 (DEU)</option>
                  <option value="name">English name (Germany)</option>
                </select>
              </div>
            )}
            {usesAmount && (
              <>
                <div>
                  <label htmlFor={`${uid}-ao`} className="block text-sm text-slate-600">
                    Write amounts as
                  </label>
                  <select id={`${uid}-ao`} className={`${inputCls} mt-1`} value={opts.amountOutput} onChange={(e) => setOpts((o) => ({ ...o, amountOutput: e.target.value as AmountOutput }))}>
                    <option value="1234.56">1234.56 (for spreadsheets)</option>
                    <option value="1,234.56">1,234.56</option>
                    <option value="1.234,56">1.234,56</option>
                    <option value="1 234,56">1 234,56</option>
                  </select>
                </div>
                <div>
                  <label htmlFor={`${uid}-cur`} className="block text-sm text-slate-600">
                    Currency
                  </label>
                  <select id={`${uid}-cur`} className={`${inputCls} mt-1`} value={opts.currency} onChange={(e) => setOpts((o) => ({ ...o, currency: e.target.value }))}>
                    <option value="auto">Most common in the column</option>
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${uid}-cl`} className="block text-sm text-slate-600">
                    Currency label
                  </label>
                  <select id={`${uid}-cl`} className={`${inputCls} mt-1`} value={opts.currencyLabel} onChange={(e) => setOpts((o) => ({ ...o, currencyLabel: e.target.value as CurrencyLabel }))}>
                    <option value="symbol-before">Symbol before (€1,234.56)</option>
                    <option value="symbol-after">Symbol after (1.234,56 €)</option>
                    <option value="code-before">Code before (EUR 1234.56)</option>
                    <option value="none">No currency</option>
                  </select>
                </div>
              </>
            )}
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={opts.bom} onChange={(e) => setOpts((o) => ({ ...o, bom: e.target.checked }))} />
              Add a BOM (helps Excel open UTF-8)
            </label>
          </div>
          <p className="mt-3 text-xs text-slate-600">Emails get a syntax check only: no mailbox is contacted. Amounts in a different currency are listed, not converted. Phone extensions go to a new column next to the phone column.</p>
        </section>
      )}

      <div aria-live="polite" className="min-h-6 text-sm text-slate-700">
        {busy && (
          <div className="flex flex-wrap items-center gap-3">
            <span>
              {busy.label}… {Math.round(busy.fraction * 100)}%
            </span>
            <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={busy.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(busy.fraction * 100)}>
              <div className="h-full bg-primary" style={{ width: `${Math.max(3, Math.round(busy.fraction * 100))}%` }} />
            </div>
            {slow && (
              <button type="button" className={btnSecondary} onClick={cancel}>
                Cancel
              </button>
            )}
          </div>
        )}
        {!busy && notice}
        {!busy && !loaded && !error && !notice && "Paste data or open a file to start."}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{error}</p>
          {error.startsWith("Cancelled") && (
            <button type="button" className={`${btnSecondary} mt-2`} onClick={() => setRevive((n) => n + 1)}>
              Read again
            </button>
          )}
        </div>
      )}

      {loaded && result && !error && (
        <>
          <section className={card} aria-labelledby={`${uid}-res`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id={`${uid}-res`} className="text-lg font-semibold">
                Result{" "}
                <span className="text-sm font-normal text-slate-600">
                  · {fmt(loaded.rowCount)} rows · {fmt(result.invalidTotal)} invalid value{result.invalidTotal === 1 ? "" : "s"} · {fmt(result.ms)} ms
                </span>
              </h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnPrimary} onClick={() => save(result.csv, `${baseName}-standardized.csv`)}>
                  Download standardized CSV
                </button>
                <button type="button" className={btnSecondary} disabled={result.invalidTotal === 0} onClick={() => save(result.invalidCsv, `${baseName}-invalid-values.csv`)}>
                  Download invalid list
                </button>
                <button type="button" className={btnSecondary} disabled={result.csv.size > 5 * 1048576} onClick={() => copy(result.csv, "Standardized CSV")}>
                  Copy CSV
                </button>
              </div>
            </div>
            <div className={`relative mt-3 overflow-x-auto ${focusRing}`} role="region" aria-label="Changes per column" tabIndex={0}>
              <table className="w-full min-w-[34rem] text-left text-sm">
                <caption className="sr-only">How many values each rule changed, left alone or found invalid</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-600">
                    <th scope="col" className="py-2 pr-3">
                      Column
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right">
                      Changed
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right">
                      Left alone
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right">
                      Invalid
                    </th>
                    <th scope="col" className="py-2 text-right">
                      Empty
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.stats
                    .filter((s) => s.rule !== "none")
                    .map((s) => (
                      <tr key={s.column} className="border-b border-slate-100 align-top">
                        <th scope="row" className="py-2 pr-3 font-semibold">
                          {s.column}
                          <span className="block text-xs font-normal text-slate-600">{RULES.find((r) => r.id === s.rule)?.label}</span>
                          {s.note && <span className="block text-xs font-normal text-slate-600">{s.note}</span>}
                        </th>
                        <td className="py-2 pr-3 text-right tabular-nums text-green-800">{fmt(s.changed)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{fmt(s.unchanged)}</td>
                        <td className={`py-2 pr-3 text-right tabular-nums ${s.invalid ? "font-semibold text-red-800" : ""}`}>{fmt(s.invalid)}</td>
                        <td className="py-2 text-right tabular-nums text-slate-600">{fmt(s.empty)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={card} aria-labelledby={`${uid}-prev`}>
            <h2 id={`${uid}-prev`} className="text-lg font-semibold">
              Before and after (first {result.after.length} rows)
            </h2>
            <p className="mt-1 text-xs text-slate-600">Changed values are green with the original underneath; invalid values are red and kept unchanged.</p>
            <div className={`relative mt-3 overflow-x-auto rounded-xl border border-slate-200 ${focusRing}`} role="region" aria-label="Before and after preview" tabIndex={0}>
              <table className="w-full text-left text-xs">
                <caption className="sr-only">Standardized values with the original values</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th scope="col" className="px-2 py-2">
                      Line
                    </th>
                    {result.outHeader.map((h, i) => (
                      <th key={i} scope="col" className="whitespace-nowrap px-2 py-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {result.after.map((row, r) => (
                    <tr key={r} className="border-b border-slate-100 align-top">
                      <td className="px-2 py-1.5 text-slate-600">{r + 2}</td>
                      {row.map((cell, j) => {
                        const src = result.outIndex.indexOf(j);
                        const before = src >= 0 ? (result.before[r]?.[src] ?? "") : null;
                        const isInvalid = src >= 0 && result.invalid.some((e) => e.row === r + 2 && e.column === header[src]);
                        const changed = before !== null && before !== cell;
                        return (
                          <td key={j} className={`whitespace-nowrap px-2 py-1.5 ${isInvalid ? "bg-red-50 text-red-900" : changed ? "bg-green-50 text-green-900" : ""}`}>
                            {cell}
                            {changed && <span className="block text-[11px] text-slate-500 line-through decoration-slate-400">{before}</span>}
                            {isInvalid && <span className="block font-sans text-[11px]">invalid</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {result.invalidTotal > 0 && (
            <section className={card} aria-labelledby={`${uid}-inv`}>
              <h2 id={`${uid}-inv`} className="text-lg font-semibold">
                Invalid or unfixable values ({fmt(result.invalidTotal)})
              </h2>
              <p className="mt-1 text-xs text-slate-600">These were left as they were in the output. Line numbers count the header as line 1.</p>
              <div className={`relative mt-3 max-h-96 overflow-auto ${focusRing}`} role="region" aria-label="Invalid values" tabIndex={0}>
                <table className="w-full min-w-[30rem] text-left text-sm">
                  <caption className="sr-only">Values that could not be standardised, with the reason</caption>
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-200 text-xs text-slate-600">
                      <th scope="col" className="py-2 pr-3">
                        Line
                      </th>
                      <th scope="col" className="py-2 pr-3">
                        Column
                      </th>
                      <th scope="col" className="py-2 pr-3">
                        Value
                      </th>
                      <th scope="col" className="py-2">
                        Reason
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.invalid.map((e, i) => (
                      <tr key={i} className="border-b border-slate-100 align-top">
                        <td className="py-1.5 pr-3 tabular-nums">{e.row}</td>
                        <td className="py-1.5 pr-3">{e.column}</td>
                        <td className="break-all py-1.5 pr-3 font-mono text-xs">{e.value}</td>
                        <td className="py-1.5 text-slate-700">{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.invalidTotal > result.invalid.length && <p className="mt-2 text-xs text-slate-600">Showing the first {fmt(result.invalid.length)}; the download has all of them.</p>}
            </section>
          )}
        </>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { buildPreviewQuery, buildQuery, BuildError, OPERATORS, toFormula, type BuilderState, type Filter, type Operator, type SelectItem } from "./logic/builder";
import { firstColumnOf, MAX_PASTE_BYTES, type Column } from "./logic/data";
import { AGG_FNS, type AggFn } from "./logic/query";
import type { WorkerRequest, WorkerResponse } from "./worker/query.worker";
import { EXAMPLE_RANGE, SALES_TSV } from "../fixtures/sales";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const PREVIEW_ROWS = 20;
const RUN_TIMEOUT_MS = 2000;


const TYPE_LABEL = { number: "number", string: "text", boolean: "TRUE/FALSE", date: "date", datetime: "date-time" } as const;

const EMPTY: Omit<BuilderState, "range" | "headerRows" | "colNotation"> = { select: [], filters: [], groupBy: [], pivot: "", orderBy: [], limit: "", offset: "" };

type Preview = Extract<WorkerResponse, { type: "result" }>;

/** The page opens on this query over the sample sales data; "Try an example" restores it. */
const EXAMPLE_BUILDER: typeof EMPTY = {
  select: [{ col: "B", agg: "", label: "" }, { col: "F", agg: "sum", label: "Revenue" }, { col: "A", agg: "count", label: "Orders" }],
  filters: [{ col: "A", op: ">=", value: "2026-02-01", cell: "", join: "and" }],
  groupBy: ["B"],
  pivot: "",
  orderBy: [{ target: "sum(F)", desc: true }],
  limit: "",
  offset: "",
};

export default function GoogleSheetsQueryBuilderTool() {
  const uid = useId();
  const [text, setText] = useState(SALES_TSV);
  const [file, setFile] = useState<File | null>(null);
  const [range, setRange] = useState(EXAMPLE_RANGE);
  const [headerRows, setHeaderRows] = useState<0 | 1 | 2>(1);
  const [colNotation, setColNotation] = useState(false);
  const [b, setB] = useState(EXAMPLE_BUILDER);
  const [manual, setManual] = useState(false);
  const [manualQuery, setManualQuery] = useState("");
  const [columns, setColumns] = useState<Column[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [reload, setReload] = useState(0);

  const workerRef = useRef<Worker | null>(null);
  const jobRef = useRef(0);
  const loadRef = useRef(0);
  const timedOut = useRef<string | null>(null);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const csvResolve = useRef<((csv: string | null) => void) | null>(null);

  const state: BuilderState = { ...b, range, headerRows, colNotation };

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const w = new Worker(new URL("./worker/query.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const msg = event.data;
        const isLoad = msg.type === "loaded" || (msg.type === "error" && msg.stage === "load");
        if (msg.jobId !== (isLoad ? loadRef.current : jobRef.current)) return;
        if (!isLoad && watchdog.current) clearTimeout(watchdog.current);
        setSlow(false);
        if (isLoad) setLoading(false);
        if (msg.type === "loaded") {
          setColumns(msg.columns);
          setRowCount(msg.rowCount);
          setLoadError(null);
          setDataVersion((v) => v + 1);
        } else if (msg.type === "result") {
          setPreview(msg);
          setRunError(null);
        } else if (msg.type === "csv") {
          csvResolve.current?.(msg.csv);
        } else if (msg.stage === "load") {
          setLoadError(msg.message);
          setColumns([]);
        } else {
          setRunError(msg.message);
          setPreview(null);
          csvResolve.current?.(null);
        }
      };
      workerRef.current = w;
    }
    return workerRef.current;
  }, []);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const send = useCallback(
    (req: WorkerRequest) => {
      getWorker().postMessage(req);
      if (req.type === "load") {
        setTimeout(() => {
          if (loadRef.current === req.jobId) setSlow(true);
        }, 1000);
        return;
      }
      if (watchdog.current) clearTimeout(watchdog.current);
      watchdog.current = setTimeout(() => {
        if (jobRef.current !== req.jobId) return;
        // A runaway “matches” pattern can freeze the worker: replace it, reload the data, and do not retry this query.
        workerRef.current?.terminate();
        workerRef.current = null;
        timedOut.current = req.query;
        jobRef.current++;
        setRunError("The preview took more than 2 seconds and was stopped. A “matches” pattern may be too complex; simplify it or use contains/like.");
        setPreview(null);
        csvResolve.current?.(null);
        setReload((n) => n + 1);
      }, RUN_TIMEOUT_MS);
    },
    [getWorker],
  );

  // Load (or reload) the data into the worker.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!file && text.trim() === "") {
        loadRef.current++;
        setColumns([]);
        setRowCount(0);
        setPreview(null);
        setLoadError(null);
        return;
      }
      if (!file && new TextEncoder().encode(text).length > MAX_PASTE_BYTES) {
        setLoadError("The pasted data is larger than 5 MB. Save it as a CSV file and choose it instead (up to 50 MB).");
        setColumns([]);
        return;
      }
      const jobId = ++loadRef.current;
      setLoading(true);
      send({ type: "load", jobId, source: file ? { kind: "file", file } : { kind: "text", text }, options: { headerRows, firstColumn: firstColumnOf(range), colNotation } });
    }, file ? 0 : 300);
    return () => clearTimeout(t);
  }, [text, file, headerRows, range, colNotation, reload, send]);

  const built = useMemo((): { query: string; previewQuery: string; error: null } | { query: null; previewQuery: null; error: string } => {
    if (columns.length === 0) return { query: null, previewQuery: null, error: "" };
    try {
      if (manual) return { query: manualQuery, previewQuery: manualQuery, error: null };
      return { query: buildQuery(state, columns), previewQuery: buildPreviewQuery(state, columns), error: null };
    } catch (e) {
      return { query: null, previewQuery: null, error: e instanceof BuildError ? e.message : "This combination cannot be turned into a query." };
    }
    // state is rebuilt from these pieces on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, manual, manualQuery, b, range, headerRows, colNotation]);

  // Run the preview whenever the query or the data changes.
  useEffect(() => {
    if (columns.length === 0 || built.previewQuery === null || built.previewQuery === timedOut.current) return;
    const t = setTimeout(() => {
      timedOut.current = null;
      const jobId = ++jobRef.current;
      send({ type: "run", jobId, query: built.previewQuery, previewRows: PREVIEW_ROWS });
    }, 250);
    return () => clearTimeout(t);
  }, [built.previewQuery, columns.length, dataVersion, send]);

  const formula = built.query !== null ? toFormula(built.query, range, headerRows) : null;

  const patch = (p: Partial<typeof b>) => setB((x) => ({ ...x, ...p }));
  const setSelect = (i: number, p: Partial<SelectItem>) => patch({ select: b.select.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const setFilter = (i: number, p: Partial<Filter>) => patch({ filters: b.filters.map((f, j) => (j === i ? { ...f, ...p } : f)) });

  const loadExample = () => {
    setFile(null);
    setText(SALES_TSV);
    setRange(EXAMPLE_RANGE);
    setHeaderRows(1);
    setColNotation(false);
    setManual(false);
    setB(EXAMPLE_BUILDER);
  };

  const clearAll = () => {
    setText("");
    setFile(null);
    setB(EMPTY);
    setManual(false);
  };

  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${what} copied.`);
    } catch {
      setNotice("Your browser blocked clipboard access. Select the text and copy it manually.");
    }
  };

  const downloadCsv = async () => {
    if (!built.previewQuery) return;
    const csv = await new Promise<string | null>((resolve) => {
      csvResolve.current = resolve;
      const jobId = ++jobRef.current;
      send({ type: "csv", jobId, query: built.previewQuery! });
    });
    csvResolve.current = null;
    if (!csv) return;
    const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "query-preview.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const cancel = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    loadRef.current++;
    setLoading(false);
    setSlow(false);
    setLoadError("Loading cancelled. Change the data or options to try again.");
  };

  const colOptions = columns.map((c) => ({ value: c.id, label: c.label ? `${c.id} – ${c.label}` : c.id }));
  const orderTargets = [...colOptions, ...b.select.filter((s) => s.agg && s.col).map((s) => ({ value: `${s.agg}(${s.col})`, label: `${s.agg}(${s.col})` }))];
  const ready = columns.length > 0;

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-data`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-data`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>1</span>Your data</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={loadExample}>Try an example</button>
            <button type="button" className={btnSecondary} onClick={clearAll} disabled={!file && text === ""}>Clear</button>
          </div>
        </div>
        <label htmlFor={`${uid}-paste`} className="mt-4 block text-sm font-medium">Paste the cells of your range (header rows included), copied from Google Sheets</label>
        <textarea id={`${uid}-paste`} className={`${inputCls} mt-1 h-32 resize-y font-mono text-xs`} value={text} onChange={(e) => { setFile(null); setText(e.target.value); }} placeholder={"Date\tRegion\tRevenue\n2026-01-05\tNorth\t3897"} spellCheck={false} />
        <div className="mt-3">
          <label htmlFor={`${uid}-file`} className="block text-sm font-medium">Or choose a CSV/TSV file</label>
          <input id={`${uid}-file`} type="file" accept=".csv,.tsv,.txt,text/csv" className={`mt-1 block max-w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:font-semibold file:text-primary-dark ${focusRing}`} onChange={(e) => { const f = e.target.files?.[0]; if (f) { setText(""); setFile(f); } }} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={`${uid}-range`} className="block text-sm font-medium">Range in your sheet</label>
            <input id={`${uid}-range`} className={`${inputCls} mt-1 font-mono`} value={range} onChange={(e) => setRange(e.target.value)} placeholder="Sheet1!A1:F" spellCheck={false} />
          </div>
          <div>
            <label htmlFor={`${uid}-hdr`} className="block text-sm font-medium">Header rows</label>
            <select id={`${uid}-hdr`} className={`${inputCls} mt-1`} value={headerRows} onChange={(e) => setHeaderRows(Number(e.target.value) as 0 | 1 | 2)}>
              <option value={0}>0 (no header row)</option>
              <option value={1}>1</option>
              <option value={2}>2 (labels are joined)</option>
            </select>
          </div>
          <label className="flex items-start gap-2 self-end text-sm">
            <input type="checkbox" className={`mt-0.5 h-4 w-4 accent-primary ${focusRing}`} checked={colNotation} onChange={(e) => setColNotation(e.target.checked)} />
            <span>Use Col1, Col2… (needed when the data is an {"{array}"} or IMPORTRANGE)</span>
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-ink">Limits: pasted data up to 5 MB, files up to 50 MB. The preview runs in your browser; nothing is uploaded.</p>
        <div aria-live="polite" className="mt-2 min-h-6 text-sm text-slate-ink">
          {loading && !slow && "Reading the data…"}
          {ready && !loading && `${rowCount.toLocaleString("en-US")} data row(s), ${columns.length} column(s).`}
        </div>
        {loading && slow && (
          <div className="mt-1 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Reading data"><div className="h-full w-1/3 bg-primary motion-safe:animate-pulse" /></div>
            <button type="button" className={btnSecondary} onClick={cancel}>Cancel</button>
          </div>
        )}
        {loadError && <div role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{loadError}</div>}
        {ready && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Detected columns">
            {columns.map((c) => (
              <li key={c.id} className="rounded-lg bg-slate-50 px-2 py-1 text-xs">
                <span className="font-mono font-semibold">{c.id}</span> {c.label || <span className="text-slate-ink">(no header)</span>} <span className="text-slate-ink">· {TYPE_LABEL[c.type]}{c.mismatched ? ` · ${c.mismatched} cell(s) of another type count as empty` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card} aria-labelledby={`${uid}-build`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-build`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>2</span>Build the query</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={manual} disabled={!ready} onChange={(e) => { if (e.target.checked && built.query) setManualQuery(built.query); setManual(e.target.checked); }} />
            Edit the query text by hand
          </label>
        </div>
        {!ready ? (
          <p className="mt-3 text-sm text-slate-ink">Add data first; the column lists fill in from it.</p>
        ) : manual ? (
          <div className="mt-3">
            <label htmlFor={`${uid}-manual`} className="block text-sm font-medium">Query (Google Visualization query language)</label>
            <textarea id={`${uid}-manual`} className={`${inputCls} mt-1 h-28 font-mono`} value={manualQuery} onChange={(e) => setManualQuery(e.target.value)} spellCheck={false} />
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            <fieldset>
              <legend className="text-sm font-semibold">Columns to show <span className="font-normal text-slate-ink">(none = all columns)</span></legend>
              {b.select.map((s, i) => (
                <div key={i} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_2fr_auto]">
                  <Select label={`Column ${i + 1}`} value={s.col} onChange={(v) => setSelect(i, { col: v })} options={colOptions} placeholder="Choose…" />
                  <Select label={`Aggregate ${i + 1}`} value={s.agg} onChange={(v) => setSelect(i, { agg: v as AggFn | "" })} options={[{ value: "", label: "none" }, ...AGG_FNS.map((f) => ({ value: f, label: f }))]} />
                  <TextField label={`Header label ${i + 1}`} value={s.label} onChange={(v) => setSelect(i, { label: v })} placeholder="optional" />
                  <button type="button" className={`${btnSecondary} self-end`} aria-label={`Remove column ${i + 1}`} onClick={() => patch({ select: b.select.filter((_, j) => j !== i) })}>Remove</button>
                </div>
              ))}
              <button type="button" className={`${btnSecondary} mt-2`} onClick={() => patch({ select: [...b.select, { col: columns[0]?.id ?? "", agg: "", label: "" }] })}>Add column</button>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-semibold">Filters (where)</legend>
              {b.filters.map((f, i) => {
                const col = columns.find((c) => c.id === f.col);
                const ops = OPERATORS.filter((o) => !col || o.types === "all" || o.types.includes(col.type));
                const needsValue = f.op !== "is null" && f.op !== "is not null";
                return (
                  <div key={i} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[auto_2fr_2fr_2fr_1fr_auto]">
                    {i > 0 ? <Select label={`Join ${i + 1}`} value={f.join} onChange={(v) => setFilter(i, { join: v as "and" | "or" })} options={[{ value: "and", label: "and" }, { value: "or", label: "or" }]} /> : <span className="hidden sm:block" />}
                    <Select label={`Filter column ${i + 1}`} value={f.col} onChange={(v) => setFilter(i, { col: v })} options={colOptions} />
                    <Select label={`Condition ${i + 1}`} value={f.op} onChange={(v) => setFilter(i, { op: v as Operator })} options={ops.map((o) => ({ value: o.op, label: o.label }))} />
                    {needsValue ? <TextField label={f.cell ? `Sample value of ${f.cell} ${i + 1}` : `Value ${i + 1}`} value={f.value} onChange={(v) => setFilter(i, { value: v })} placeholder={col?.type === "date" ? "2026-01-31" : col?.type === "number" ? "1000" : "text"} /> : <span />}
                    {needsValue ? <TextField label={`From cell ${i + 1}`} value={f.cell} onChange={(v) => setFilter(i, { cell: v })} placeholder="e.g. H1" /> : <span />}
                    <button type="button" className={`${btnSecondary} self-end`} aria-label={`Remove filter ${i + 1}`} onClick={() => patch({ filters: b.filters.filter((_, j) => j !== i) })}>Remove</button>
                  </div>
                );
              })}
              <button type="button" className={`${btnSecondary} mt-2`} onClick={() => patch({ filters: [...b.filters, { col: columns[0]?.id ?? "", op: "=", value: "", cell: "", join: "and" }] })}>Add filter</button>
              <p className="mt-1 text-xs text-slate-ink">“From cell” builds a formula that reads the value from that cell, e.g. &quot;… where B = &apos;&quot;&amp;H1&amp;&quot;&apos;&quot;. The value box is then only used for the preview.</p>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset>
                <legend className="text-sm font-semibold">Group by</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {columns.map((c) => (
                    <label key={c.id} className={`cursor-pointer rounded-lg border px-2 py-1 text-xs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${b.groupBy.includes(c.id) ? "border-primary bg-primary-soft font-semibold text-primary-dark" : "border-slate-300"}`}>
                      <input type="checkbox" className="sr-only" checked={b.groupBy.includes(c.id)} onChange={(e) => patch({ groupBy: e.target.checked ? [...b.groupBy, c.id] : b.groupBy.filter((g) => g !== c.id) })} />
                      {c.id}{c.label ? ` ${c.label}` : ""}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Select label="Pivot (values become columns)" value={b.pivot} onChange={(v) => patch({ pivot: v })} options={[{ value: "", label: "No pivot" }, ...colOptions]} />
            </div>

            <fieldset>
              <legend className="text-sm font-semibold">Sort (order by)</legend>
              {b.orderBy.map((o, i) => (
                <div key={i} className="mt-2 grid grid-cols-[2fr_1fr_auto] gap-2">
                  <Select label={`Sort by ${i + 1}`} value={o.target} onChange={(v) => patch({ orderBy: b.orderBy.map((x, j) => (j === i ? { ...x, target: v } : x)) })} options={orderTargets} />
                  <Select label={`Direction ${i + 1}`} value={o.desc ? "desc" : "asc"} onChange={(v) => patch({ orderBy: b.orderBy.map((x, j) => (j === i ? { ...x, desc: v === "desc" } : x)) })} options={[{ value: "asc", label: "A→Z / smallest first" }, { value: "desc", label: "Z→A / largest first" }]} />
                  <button type="button" className={`${btnSecondary} self-end`} aria-label={`Remove sort ${i + 1}`} onClick={() => patch({ orderBy: b.orderBy.filter((_, j) => j !== i) })}>Remove</button>
                </div>
              ))}
              <button type="button" className={`${btnSecondary} mt-2`} onClick={() => patch({ orderBy: [...b.orderBy, { target: columns[0]?.id ?? "", desc: false }] })}>Add sort</button>
            </fieldset>

            <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
              <TextField label="Limit (rows)" value={b.limit} onChange={(v) => patch({ limit: v })} placeholder="all" inputMode="numeric" />
              <TextField label="Offset (skip rows)" value={b.offset} onChange={(v) => patch({ offset: v })} placeholder="0" inputMode="numeric" />
            </div>
          </div>
        )}
      </section>

      <section className={card} aria-labelledby={`${uid}-out`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-out`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>3</span>Formula and preview</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} disabled={!formula} onClick={() => formula && copy(formula, "Formula")}>Copy formula</button>
            <button type="button" className={btnSecondary} disabled={!built.query} onClick={() => built.query && copy(built.query, "Query text")}>Copy query only</button>
            <button type="button" className={btnSecondary} disabled={!preview} onClick={downloadCsv}>Download result CSV</button>
          </div>
        </div>
        {formula ? <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-slate-50 p-3 font-mono text-sm">{formula}</pre> : <p className="mt-3 text-sm text-slate-ink">{ready ? "" : "The =QUERY(…) formula appears here."}</p>}
        {built.error && <div role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{built.error}</div>}
        <div aria-live="polite" className="mt-3 min-h-6 text-sm text-slate-ink">
          {preview && !runError && `Preview: first ${Math.min(PREVIEW_ROWS, preview.totalRows)} of ${preview.totalRows} result row(s), calculated here. Google Sheets may differ in rare cases.`}
          {preview?.ignored.length ? ` Not applied in the preview: ${preview.ignored.join("; ")}.` : ""}
          {notice && <span className="block text-navy">{notice}</span>}
        </div>
        {runError && <div role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{runError}</div>}
        <div className="relative mt-3 min-h-48 max-h-[28rem] overflow-auto rounded-xl border border-slate-200">
          {preview && !runError ? (
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Preview of the first {PREVIEW_ROWS} result rows</caption>
              <thead className="sticky top-0 bg-slate-50"><tr>{preview.headers.map((h, i) => <th key={i} scope="col" className="whitespace-nowrap border-b px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
              <tbody>{preview.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className="whitespace-nowrap border-b border-slate-100 px-3 py-1.5 tabular-nums">{v}</td>)}</tr>)}</tbody>
            </table>
          ) : (
            <p className="p-4 text-sm text-slate-ink">The first 20 result rows appear here.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Select({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-xs font-medium">{label}</label>
      <select id={id} className={`${inputCls} mt-1`} value={value} onChange={(e) => onChange(e.target.value)}>
        {placeholder && value === "" && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, inputMode }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; inputMode?: "numeric" }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-xs font-medium">{label}</label>
      <input id={id} className={`${inputCls} mt-1`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} spellCheck={false} />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { toCsv } from "./logic/csvWriter";
import type { DateOutput, DayOrder } from "./logic/dates";
import { ENCODING_LABELS, type EncodingChoice, type EncodingId } from "./logic/encoding";
import type { HeaderStyle } from "./logic/headers";
import { byteLength, MAX_PASTE_BYTES } from "./logic/input";
import { DEFAULT_CLEAN_OPTIONS, STEP_LABELS, STEP_ORDER, type CleanOptions, type DateColumnReport, type StepId } from "./logic/pipeline";
import { visible } from "./logic/text";
import type { Source, WorkerRequest, WorkerResponse } from "./worker/clean.worker";
import { EXAMPLE_CSV } from "../fixtures/example";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

type ResultMsg = Extract<WorkerResponse, { type: "result" }>;
type Status = "empty" | "working" | "done" | "error";

const PROGRESS_DELAY_MS = 400;
const LOG_ROWS = 300;

const STEP_HINTS: Partial<Record<StepId, string>> = {
  mojibake: "Fixes text like “CafÃ©” or “Ø§Ù„” that was decoded with the wrong encoding.",
  invisible: "Zero-width spaces, BOMs, soft hyphens and control characters. ZWNJ/ZWJ are kept.",
  spaces: "Non-breaking, narrow and ideographic spaces become normal spaces.",
  trim: "Removes spaces at the start and end of every cell.",
  blanks: "Placeholders such as N/A, null or - become a real blank.",
  dates: "Rewrites date columns in one format. Ambiguous days and months are never guessed.",
  emptyColumns: "Drops columns whose data cells are all blank.",
  duplicates: "Keeps the first copy of rows that are identical after cleaning.",
};


export default function CleanMessyCsvDataTool() {
  const uid = useId();
  const [text, setText] = useState(EXAMPLE_CSV);
  const [file, setFile] = useState<File | null>(null);
  const [sourceId, setSourceId] = useState(0);
  const [encoding, setEncoding] = useState<EncodingChoice>("auto");
  const [sheet, setSheet] = useState(0);
  const [options, setOptions] = useState<CleanOptions>(DEFAULT_CLEAN_OPTIONS);
  const [blankText, setBlankText] = useState(DEFAULT_CLEAN_OPTIONS.blankTokens.join(", "));
  const [status, setStatus] = useState<Status>("empty");
  const [result, setResult] = useState<ResultMsg | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ fraction: number | null; label: string } | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [view, setView] = useState<"data" | "log">("data");
  const [logStep, setLogStep] = useState<StepId | "all">("all");
  const [excelBom, setExcelBom] = useState(true);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const jobRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const w = new Worker(new URL("./worker/clean.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const msg = event.data;
        if (msg.jobId !== jobRef.current) return;
        if (msg.type === "progress") setProgress({ fraction: msg.fraction, label: msg.label });
        else if (msg.type === "result") {
          setResult(msg);
          setError(null);
          setStatus("done");
          setProgress(null);
        } else {
          setResult(null);
          setError(msg.message);
          setStatus("error");
          setProgress(null);
        }
      };
      w.onerror = () => {
        setError("The cleaner stopped unexpectedly, possibly out of memory. Try a smaller file.");
        setStatus("error");
        setProgress(null);
        workerRef.current = null;
      };
      workerRef.current = w;
    }
    return workerRef.current;
  }, []);

  useEffect(() => () => workerRef.current?.terminate(), []);

  useEffect(() => {
    if (status !== "working") return;
    const t = setTimeout(() => setShowProgress(true), PROGRESS_DELAY_MS);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (!file && text.trim() === "") {
      // Deferred so the state updates happen in a callback, not synchronously in the effect.
      const t = setTimeout(() => {
        jobRef.current++;
        setStatus("empty");
        setResult(null);
        setError(null);
      }, 0);
      return () => clearTimeout(t);
    }
    if (!file && byteLength(text) > MAX_PASTE_BYTES) {
      const t = setTimeout(() => {
        jobRef.current++;
        setStatus("error");
        setResult(null);
        setError("The pasted text is larger than 5 MB. Save it as a file and upload it instead (up to 50 MB).");
      }, 0);
      return () => clearTimeout(t);
    }
    const source: Source = file ? { kind: "file", file } : { kind: "text", text };
    const timer = setTimeout(() => {
      const jobId = ++jobRef.current;
      setStatus("working");
      setShowProgress(false);
      const req: WorkerRequest = { type: "run", jobId, sourceId, source, encoding, sheet, options };
      getWorker().postMessage(req);
    }, file ? 0 : 300);
    return () => clearTimeout(timer);
  }, [text, file, sourceId, encoding, sheet, options, getWorker]);

  const cancel = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    jobRef.current++;
    setStatus("error");
    setResult(null);
    setProgress(null);
    setError("Cleaning cancelled. Change the input or an option to start again.");
  };

  const newSource = () => {
    setSourceId((n) => n + 1);
    setSheet(0);
    setOptions((o) => ({ ...o, dateOrders: {} }));
  };

  const onPaste = (value: string) => {
    setFile(null);
    setText(value);
    newSource();
  };

  const pickFile = (f: File | null) => {
    if (!f) return;
    setText("");
    setFile(f);
    newSource();
  };

  const clearAll = () => {
    setFile(null);
    setText("");
    newSource();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const setStep = (id: StepId, on: boolean) => setOptions((o) => ({ ...o, steps: { ...o.steps, [id]: on } }));
  const patch = (p: Partial<CleanOptions>) => setOptions((o) => ({ ...o, ...p }));
  const setDateOrder = (col: number, value: DayOrder | "skip" | "") =>
    setOptions((o) => {
      const next = { ...o.dateOrders };
      if (value === "") delete next[col];
      else next[col] = value;
      return { ...o, dateOrders: next };
    });

  const download = (content: string, name: string, type: string, bom: boolean) => {
    const blob = new Blob(bom ? ["﻿", content] : [content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const baseName = file ? file.name.replace(/\.[^.]+$/, "") : "data";
  const header = result?.header ?? null;

  const columnName = useCallback(
    (col: number) => {
      if (!result) return `Column ${col + 1}`;
      const outIndex = result.columnIndexes.indexOf(col);
      return (outIndex >= 0 && result.header?.[outIndex]) || `Column ${col + 1}`;
    },
    [result],
  );

  const downloadReport = () => {
    if (!result) return;
    const rows = result.report.changes.map((c) => [STEP_LABELS[c.step], String(c.row), c.col >= 0 ? columnName(c.col) : "(whole row)", c.before, c.after]);
    download(toCsv(["step", "row", "column", "before", "after"], rows, ","), `${baseName}-changes.csv`, "text/csv;charset=utf-8", true);
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Your browser blocked clipboard access. Use Download instead.");
    }
  };

  const changedCells = useMemo(() => {
    const m = new Map<string, string>();
    if (!result) return m;
    for (const c of result.report.changes) {
      if (c.col < 0) continue;
      const key = `${c.row}:${c.col}`;
      if (!m.has(key)) m.set(key, c.before);
    }
    return m;
  }, [result]);

  const pending = result?.report.dateColumns.filter((d) => d.needsDecision) ?? [];
  const dateInfo = result?.report.dateColumns.filter((d) => !d.needsDecision) ?? [];
  const logRows = result ? result.report.changes.filter((c) => logStep === "all" || c.step === logStep) : [];

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-in`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>1</span>Your data</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={() => onPaste(EXAMPLE_CSV)}>Try an example</button>
            <button type="button" className={btnSecondary} onClick={clearAll} disabled={!file && text === ""}>Clear</button>
          </div>
        </div>
        <label htmlFor={`${uid}-text`} className="mt-4 block text-sm font-medium">Paste CSV or TSV text</label>
        <textarea
          id={`${uid}-text`}
          className={`${inputCls} mt-1 h-40 resize-y font-mono text-xs`}
          value={text}
          onChange={(e) => onPaste(e.target.value)}
          placeholder={"name,email,signup\n  Ana ,ana@example.com,25/03/2026"}
          spellCheck={false}
          aria-describedby={`${uid}-limits`}
        />
        <div
          className={`mt-4 rounded-xl border-2 border-dashed p-4 text-center text-sm ${dragging ? "border-primary bg-primary-soft" : "border-slate-300"}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pickFile(e.dataTransfer.files[0] ?? null);
          }}
        >
          <label htmlFor={`${uid}-file`} className="font-medium">Or choose a .csv, .tsv, .txt or .xlsx file, or drop it here</label>
          <input
            ref={fileInputRef}
            id={`${uid}-file`}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className={`mx-auto mt-2 block max-w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:font-semibold file:text-primary-dark ${focusRing}`}
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          {file && (
            <p className="mt-2 text-slate-ink">
              Selected: <span className="font-medium text-navy">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB). Your original file is never changed.
            </p>
          )}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-enc`} className="block text-sm font-medium">File encoding</label>
            <select id={`${uid}-enc`} className={`${inputCls} mt-1`} value={encoding} onChange={(e) => setEncoding(e.target.value as EncodingChoice)}>
              <option value="auto">Detect automatically</option>
              {(Object.keys(ENCODING_LABELS) as EncodingId[]).map((id) => (
                <option key={id} value={id}>{ENCODING_LABELS[id]}</option>
              ))}
            </select>
            {result?.info.detectedEncoding && (
              <p className="mt-1 text-xs text-slate-ink">
                Detected {result.info.detectedEncoding} ({result.info.encodingReason}).{encoding !== "auto" && ` Using ${result.info.encoding} as you chose.`}
              </p>
            )}
          </div>
          {result && result.info.sheets.length > 1 && (
            <div>
              <label htmlFor={`${uid}-sheet`} className="block text-sm font-medium">Sheet</label>
              <select id={`${uid}-sheet`} className={`${inputCls} mt-1`} value={sheet} onChange={(e) => setSheet(Number(e.target.value))}>
                {result.info.sheets.map((s, i) => <option key={s + i} value={i}>{s}</option>)}
              </select>
            </div>
          )}
        </div>
        <p id={`${uid}-limits`} className="mt-3 text-xs text-slate-ink">
          Limits: pasted text up to 5 MB, files up to 50 MB. The file is read and cleaned in your browser; nothing is uploaded.
        </p>
      </section>

      <section className={card} aria-labelledby={`${uid}-steps`}>
        <h2 id={`${uid}-steps`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>2</span>Cleaning steps</h2>
        <p className="mt-1 text-sm text-slate-ink">Each step runs in this order and can be switched off.</p>
        <label className="mt-3 flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={options.hasHeader} onChange={(e) => patch({ hasHeader: e.target.checked })} />
          First row contains column names
        </label>
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {STEP_ORDER.map((id) => (
            <li key={id} className="rounded-xl border border-slate-200 p-3">
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className={`mt-0.5 h-4 w-4 shrink-0 accent-primary ${focusRing}`} checked={options.steps[id]} onChange={(e) => setStep(id, e.target.checked)} disabled={id === "headers" && !options.hasHeader} />
                <span>
                  <span className="font-medium">{STEP_LABELS[id]}</span>
                  {STEP_HINTS[id] && <span className="block text-xs text-slate-ink">{STEP_HINTS[id]}</span>}
                </span>
              </label>
              {options.steps[id] && id === "trim" && (
                <SubCheck label="Also collapse double spaces inside cells" checked={options.collapseSpaces} onChange={(v) => patch({ collapseSpaces: v })} />
              )}
              {options.steps[id] && id === "quotes" && (
                <SubCheck label="Also turn « » into straight quotes" checked={options.guillemets} onChange={(v) => patch({ guillemets: v })} />
              )}
              {options.steps[id] && id === "blanks" && (
                <div className="mt-2 grid gap-2 pl-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`${uid}-tokens`} className="block text-xs font-medium">Treat as blank (comma separated, any case)</label>
                    <input
                      id={`${uid}-tokens`}
                      className={`${inputCls} mt-1`}
                      value={blankText}
                      onChange={(e) => {
                        setBlankText(e.target.value);
                        patch({ blankTokens: e.target.value.split(",").map((t) => t.trim()).filter((t) => t !== "") });
                      }}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${uid}-fill`} className="block text-xs font-medium">Write blanks as (empty = nothing)</label>
                    <input id={`${uid}-fill`} className={`${inputCls} mt-1`} value={options.blankFill} onChange={(e) => patch({ blankFill: e.target.value })} placeholder="e.g. NULL" />
                  </div>
                </div>
              )}
              {options.steps[id] && id === "dates" && (
                <div className="mt-2 pl-6">
                  <label htmlFor={`${uid}-dfmt`} className="block text-xs font-medium">Output format</label>
                  <select id={`${uid}-dfmt`} className={`${inputCls} mt-1`} value={options.dateOutput} onChange={(e) => patch({ dateOutput: e.target.value as DateOutput })}>
                    <option value="iso">2026-04-03 (ISO 8601)</option>
                    <option value="dmy">03/04/2026 (DD/MM/YYYY)</option>
                    <option value="mdy">04/03/2026 (MM/DD/YYYY)</option>
                  </select>
                </div>
              )}
              {options.steps[id] && id === "headers" && (
                <div className="mt-2 pl-6">
                  <label htmlFor={`${uid}-hstyle`} className="block text-xs font-medium">Style</label>
                  <select id={`${uid}-hstyle`} className={`${inputCls} mt-1`} value={options.headerStyle} onChange={(e) => patch({ headerStyle: e.target.value as HeaderStyle })}>
                    <option value="snake">snake_case (customer_name)</option>
                    <option value="title">Title Case (Customer Name)</option>
                    <option value="lower">lowercase (customer name)</option>
                    <option value="trim">Keep as is, only trim</option>
                  </select>
                </div>
              )}
              {options.steps[id] && id === "duplicates" && (
                <SubCheck label="Ignore case and spacing when comparing" checked={options.dedupeIgnoreCase} onChange={(v) => patch({ dedupeIgnoreCase: v })} />
              )}
            </li>
          ))}
        </ul>
      </section>

      {status === "done" && pending.length > 0 && (
        <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 sm:p-6" aria-labelledby={`${uid}-ask`}>
          <h2 id={`${uid}-ask`} className="text-lg font-semibold">Your answer is needed: day or month first?</h2>
          <p className="mt-1 text-sm">These columns look like dates but nothing in them shows the order, so they were left unchanged.</p>
          <div className="mt-3 space-y-3">
            {pending.map((d) => (
              <DateQuestion key={d.col} uid={uid} report={d} name={columnName(d.col)} onAnswer={(v) => setDateOrder(d.col, v)} />
            ))}
          </div>
        </section>
      )}

      <section className={card} aria-labelledby={`${uid}-out`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-out`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>3</span>Result and report</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} disabled={status !== "done"} onClick={() => result && download(result.csv, `${baseName}-clean.csv`, "text/csv;charset=utf-8", excelBom)}>
              Download clean CSV
            </button>
            <button type="button" className={btnSecondary} disabled={status !== "done"} onClick={copy}>{copied ? "Copied" : "Copy CSV"}</button>
            <button type="button" className={btnSecondary} disabled={status !== "done"} onClick={downloadReport}>Download change log</button>
          </div>
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-ink">
          <input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={excelBom} onChange={(e) => setExcelBom(e.target.checked)} />
          Save as UTF-8 with BOM (so Excel shows Arabic and accented letters correctly)
        </label>

        <div aria-live="polite" className="mt-3 min-h-6 text-sm text-slate-ink">
          {status === "empty" && "Paste data, choose a file or try the example. The cleaned data and a report of every change appear here."}
          {status === "working" && !showProgress && "Cleaning…"}
          {status === "done" && result && `Cleaned ${result.report.rowsIn} rows: ${result.report.cellsModified} cells changed, ${result.report.rowsRemoved} rows and ${result.report.columnsRemoved} columns removed.${pending.length ? ` ${pending.length} date column(s) need your answer.` : ""}`}
        </div>

        {status === "working" && showProgress && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={progress?.label ?? "Cleaning"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress?.fraction != null ? Math.round(progress.fraction * 100) : undefined}>
              <div className={`h-full bg-primary ${progress?.fraction == null ? "w-1/3 motion-safe:animate-pulse" : "motion-safe:transition-all"}`} style={progress?.fraction != null ? { width: `${Math.round(progress.fraction * 100)}%` } : undefined} />
            </div>
            <span className="text-xs text-slate-ink">{progress?.label ?? "Cleaning…"}</span>
            <button type="button" className={btnSecondary} onClick={cancel}>Cancel</button>
          </div>
        )}

        {status === "error" && error && <div role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

        {status === "done" && result && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Rows before → after" value={`${result.report.rowsIn} → ${result.report.rowsOut}`} />
              <Stat label="Columns before → after" value={`${result.report.columnsIn} → ${result.report.columnsOut}`} />
              <Stat label="Cells changed" value={String(result.report.cellsModified)} />
              <Stat label="Rows removed" value={String(result.report.rowsRemoved)} />
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Changes per cleaning step</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th scope="col" className="py-2 pr-4 font-semibold">Step</th>
                    <th scope="col" className="py-2 text-right font-semibold">Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {STEP_ORDER.map((id) => (
                    <tr key={id} className="border-b border-slate-100">
                      <td className="py-1.5 pr-4">{STEP_LABELS[id]}{!options.steps[id] && <span className="text-slate-ink"> (off)</span>}</td>
                      <td className="py-1.5 text-right tabular-nums">{result.report.counts[id]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dateInfo.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {dateInfo.map((d) => (
                  <li key={d.col} className="flex flex-wrap items-center gap-2">
                    <span>
                      Dates in <strong>{columnName(d.col)}</strong>: {describeDate(d)}
                    </span>
                    {(d.status.kind === "detected" || d.source === "user") && (
                      <select aria-label={`Day order for ${columnName(d.col)}`} className={`rounded-lg border border-slate-300 px-2 py-1 text-xs ${focusRing}`} value={options.dateOrders[d.col] ?? ""} onChange={(e) => setDateOrder(d.col, e.target.value as DayOrder | "skip" | "")}>
                        <option value="">{d.status.kind === "detected" ? "As detected" : "Ask me"}</option>
                        <option value="dmy">DD/MM</option>
                        <option value="mdy">MM/DD</option>
                        <option value="skip">Leave unchanged</option>
                      </select>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {result.report.changesTruncated && (
              <p className="mt-2 text-xs text-slate-ink">The counts above are exact. The change log lists the first 20,000 changes.</p>
            )}
          </>
        )}

        <div className="mt-5 flex gap-1 border-b border-slate-200" role="tablist" aria-label="Result view">
          {(["data", "log"] as const).map((v) => (
            <button key={v} type="button" role="tab" id={`${uid}-tab-${v}`} aria-selected={view === v} aria-controls={`${uid}-panel-${v}`} className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-semibold ${view === v ? "border-primary text-primary-dark" : "border-transparent text-slate-ink hover:text-navy"} ${focusRing}`} onClick={() => setView(v)}>
              {v === "data" ? "Cleaned data" : "Before / after"}
            </button>
          ))}
        </div>
        <div className="mt-3 min-h-64">
          {view === "data" ? (
            <div id={`${uid}-panel-data`} role="tabpanel" aria-labelledby={`${uid}-tab-data`} className="relative max-h-[28rem] overflow-auto rounded-xl border border-slate-200">
              {status === "done" && result ? (
                <table className="w-full border-collapse text-sm">
                  <caption className="sr-only">First {result.preview.length} cleaned rows. Highlighted cells were changed.</caption>
                  {header && (
                    <thead className="sticky top-0 bg-slate-50">
                      <tr>
                        <th scope="col" className="border-b border-slate-200 px-2 py-2 text-right text-xs font-normal text-slate-ink">Row</th>
                        {header.map((h, j) => {
                          const before = changedCells.get(`1:${result.columnIndexes[j]}`);
                          return (
                            <th key={j} scope="col" className={`whitespace-nowrap border-b border-slate-200 px-3 py-2 text-left font-semibold ${before !== undefined ? "bg-primary-soft" : ""}`} title={before !== undefined ? `Before: ${visible(before)}` : undefined}>{h}</th>
                          );
                        })}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {result.preview.map((row, i) => (
                      <tr key={i}>
                        <td className="border-b border-slate-100 px-2 py-1.5 text-right text-xs text-slate-ink">{result.previewRowNumbers[i]}</td>
                        {row.map((v, j) => {
                          const before = changedCells.get(`${result.previewRowNumbers[i]}:${result.columnIndexes[j]}`);
                          return (
                            <td key={j} className={`whitespace-pre-wrap border-b border-slate-100 px-3 py-1.5 ${before !== undefined ? "bg-primary-soft" : ""}`} title={before !== undefined ? `Before: ${visible(before)}` : undefined}>
                              {v}
                              {before !== undefined && <span className="sr-only"> (changed, was {visible(before)})</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="p-4 text-sm text-slate-ink">The first 50 cleaned rows appear here. Changed cells are highlighted; hover to see the old value.</p>
              )}
            </div>
          ) : (
            <div id={`${uid}-panel-log`} role="tabpanel" aria-labelledby={`${uid}-tab-log`}>
              <label htmlFor={`${uid}-logstep`} className="text-sm font-medium">Show changes from</label>
              <select id={`${uid}-logstep`} className={`${inputCls} mt-1 max-w-sm`} value={logStep} onChange={(e) => setLogStep(e.target.value as StepId | "all")}>
                <option value="all">All steps</option>
                {STEP_ORDER.map((id) => <option key={id} value={id}>{STEP_LABELS[id]}</option>)}
              </select>
              <div className="relative mt-3 max-h-[28rem] overflow-auto rounded-xl border border-slate-200">
                {status === "done" && result ? (
                  logRows.length === 0 ? (
                    <p className="p-4 text-sm text-slate-ink">No changes for this step.</p>
                  ) : (
                    <table className="w-full border-collapse text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-left">
                        <tr>
                          <th scope="col" className="border-b px-3 py-2 font-semibold">Row</th>
                          <th scope="col" className="border-b px-3 py-2 font-semibold">Column</th>
                          <th scope="col" className="border-b px-3 py-2 font-semibold">Before</th>
                          <th scope="col" className="border-b px-3 py-2 font-semibold">After</th>
                          <th scope="col" className="border-b px-3 py-2 font-semibold">Step</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logRows.slice(0, LOG_ROWS).map((c, i) => (
                          <tr key={i} className="align-top">
                            <td className="border-b border-slate-100 px-3 py-1.5 tabular-nums">{c.row}</td>
                            <td className="border-b border-slate-100 px-3 py-1.5">{c.col >= 0 ? columnName(c.col) : "—"}</td>
                            <td className="border-b border-slate-100 px-3 py-1.5 font-mono text-xs text-red-800">{c.col >= 0 ? visible(c.before) : c.before}</td>
                            <td className="border-b border-slate-100 px-3 py-1.5 font-mono text-xs text-green-800">{c.col >= 0 ? visible(c.after) : c.after}</td>
                            <td className="border-b border-slate-100 px-3 py-1.5 text-xs text-slate-ink">{STEP_LABELS[c.step]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                ) : (
                  <p className="p-4 text-sm text-slate-ink">Every change is listed here with its row, column, old and new value.</p>
                )}
              </div>
              {logRows.length > LOG_ROWS && <p className="mt-1 text-xs text-slate-ink">Showing {LOG_ROWS} of {logRows.length} changes. Download the change log for the full list.</p>}
              <p className="mt-1 text-xs text-slate-ink">· marks a leading, trailing or repeated space; ⟨ZWSP⟩ and similar mark invisible characters.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function describeDate(d: DateColumnReport): string {
  const counts = `${d.converted} converted${d.unparsed ? `, ${d.unparsed} not valid dates (left unchanged)` : ""}`;
  if (d.source === "user" && d.order === null) return "left unchanged, as you chose";
  if (d.source === "user") return `read as ${d.order === "dmy" ? "DD/MM" : "MM/DD"} as you chose; ${counts}`;
  if (d.status.kind === "detected") return `read as ${d.status.order === "dmy" ? "DD/MM" : "MM/DD"} because of “${d.status.evidence}”; ${counts}`;
  return counts;
}

function DateQuestion({ uid, report, name, onAnswer }: { uid: string; report: DateColumnReport; name: string; onAnswer: (v: DayOrder | "skip") => void }) {
  const s = report.status;
  const example = s.kind === "ambiguous" ? s.samples[0] : s.kind === "mixed" ? s.dmyExample : "";
  const [d, m, rest] = example.split(/[-/.]/);
  return (
    <fieldset className="rounded-xl bg-white p-3">
      <legend className="sr-only">Day order for {name}</legend>
      <p className="text-sm">
        <strong>{name}</strong>:{" "}
        {s.kind === "ambiguous"
          ? `values like ${s.samples.map((x) => `“${x}”`).join(", ")} can be read either way.`
          : s.kind === "mixed"
            ? `some values only work as DD/MM (“${s.dmyExample}”) and others only as MM/DD (“${s.mdyExample}”). Pick the one most rows use; the others stay unchanged.`
            : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} onClick={() => onAnswer("dmy")} aria-describedby={`${uid}-q-${report.col}`}>
          Day first (DD/MM){d && m ? `: ${d} = day` : ""}
        </button>
        <button type="button" className={btnPrimary} onClick={() => onAnswer("mdy")}>
          Month first (MM/DD){d && m ? `: ${d} = month` : ""}
        </button>
        <button type="button" className={btnSecondary} onClick={() => onAnswer("skip")}>Leave unchanged</button>
      </div>
      <span id={`${uid}-q-${report.col}`} className="sr-only">{rest ? `Example value ${example}` : ""}</span>
    </fieldset>
  );
}

function SubCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mt-2 flex items-start gap-2 pl-6 text-xs">
      <input type="checkbox" className={`mt-0.5 h-4 w-4 shrink-0 accent-primary ${focusRing}`} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-xs text-slate-ink">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { MAX_FILE_BYTES, MAX_MERGE_BYTES, MAX_MERGE_FILES, MAX_OUTPUT_FILES, MAX_PASTE_BYTES, type MergeOptions, type OutDelimiter, type SplitMode, type SplitOptions } from "./logic/limits";
import type { Inspected, Source, WorkerRequest, WorkerResponse } from "./worker/csv.worker";
import { MERGE_SAMPLES, ORDERS_CSV } from "../fixtures/samples";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

type SplitDone = Extract<WorkerResponse, { type: "split" }>;
type MergeDone = Extract<WorkerResponse, { type: "merged" }>;


const SAMPLE_SPLIT: SplitOptions = { mode: "column", rowsPerPart: 1000, maxBytes: 10 * 1048576, column: 3, hasHeader: true, bom: false };
const SAMPLE_MERGE: MergeOptions = { delimiter: ",", addSource: true, looseHeaders: true, bom: false };

const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`);
const fmtInt = (n: number) => n.toLocaleString("en-US");

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function CsvSplitterMergerTool() {
  const uid = useId();
  const [tab, setTab] = useState<"split" | "merge">("split");
  // Split
  const [text, setText] = useState(ORDERS_CSV);
  const [file, setFile] = useState<File | null>(null);
  const [opts, setOpts] = useState<SplitOptions>(SAMPLE_SPLIT);
  const [sizeMb, setSizeMb] = useState("10");
  const [rowsRaw, setRowsRaw] = useState("1000");
  const [info, setInfo] = useState<Inspected | null>(null);
  const [split, setSplit] = useState<SplitDone | null>(null);
  const [selected, setSelected] = useState(0);
  // Merge
  const [mergeSources, setMergeSources] = useState<Source[]>(MERGE_SAMPLES.map((s) => ({ kind: "text", name: s.name, text: s.text })));
  const [mopts, setMopts] = useState<MergeOptions>(SAMPLE_MERGE);
  const [merged, setMerged] = useState<MergeDone | null>(null);
  const [mergeRequested, setMergeRequested] = useState(0);
  // Shared
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ label: string; fraction: number } | null>(null);
  const [slow, setSlow] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [splitRequested, setSplitRequested] = useState(0);

  const workerRef = useRef<Worker | null>(null);
  const seq = useRef(0);
  const job = useRef(-1);
  const inspectJob = useRef(-1);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const mergeInput = useRef<HTMLInputElement | null>(null);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const w = new Worker(new URL("./worker/csv.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const m = event.data;
        if (m.type === "inspected" || (m.type === "error" && m.jobId === inspectJob.current)) {
          if (m.jobId !== inspectJob.current) return;
          if (m.type === "inspected") {
            setInfo(m.info);
            setOpts((o) => (o.column >= m.info.header.length ? { ...o, column: 0 } : o));
          } else {
            setInfo(null);
            setError(m.message);
          }
          return;
        }
        if (m.jobId !== job.current) return;
        if (m.type === "progress") return setBusy({ label: m.label, fraction: m.fraction });
        setBusy(null);
        setSlow(false);
        if (m.type === "split") {
          setSplit(m);
          setSelected(0);
          setError(null);
        } else if (m.type === "merged") {
          setMerged(m);
          setError(null);
        } else if (m.type === "error") setError(m.message);
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
  const post = useCallback((r: WorkerRequest) => getWorker().postMessage(r), [getWorker]);

  const splitSource = useCallback((): Source | null => (file ? { kind: "file", file } : text.trim() ? { kind: "text", name: "pasted.csv", text } : null), [file, text]);

  // Read the header whenever the input changes, so the column list is right.
  useEffect(() => {
    const t = setTimeout(() => {
      const s = splitSource();
      inspectJob.current = ++seq.current;
      if (!s) {
        setInfo(null);
        return;
      }
      post({ type: "inspect", jobId: inspectJob.current, source: s });
    }, file ? 0 : 300);
    return () => clearTimeout(t);
  }, [splitSource, file, post]);

  const start = (req: WorkerRequest) => {
    job.current = req.jobId;
    setBusy({ label: "Reading", fraction: 0 });
    setSlow(false);
    setError(null);
    setNotice(null);
    setTimeout(() => {
      if (job.current === req.jobId) setSlow(true);
    }, 1000);
    post(req);
  };

  // Pasted text and the example are split automatically; files wait for the button.
  useEffect(() => {
    if (file) return;
    const t = setTimeout(() => {
      const s = splitSource();
      if (!s) {
        job.current = ++seq.current;
        setSplit(null);
        return;
      }
      if (new TextEncoder().encode(text).length > MAX_PASTE_BYTES) {
        setSplit(null);
        setError("The pasted text is larger than 5 MB. Save it as a .csv file and open it instead (up to 50 MB).");
        return;
      }
      start({ type: "split", jobId: ++seq.current, source: s, options: opts });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, file, opts]);

  useEffect(() => {
    if (!file || splitRequested === 0) return;
    start({ type: "split", jobId: ++seq.current, source: { kind: "file", file }, options: opts });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitRequested]);

  useEffect(() => {
    if (tab !== "merge" || mergeSources.length === 0) return;
    const t = setTimeout(() => {
      if (mergeSources.length < 2) {
        setMerged(null);
        return;
      }
      if (mergeSources.some((s) => s.kind === "file") && mergeRequested === 0) return;
      start({ type: "merge", jobId: ++seq.current, sources: mergeSources, options: mopts });
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, mergeSources, mopts, mergeRequested]);

  const cancel = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    job.current = ++seq.current;
    setBusy(null);
    setSlow(false);
    setError("Cancelled. Press the button again to start over.");
  };

  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${what} copied.`);
    } catch {
      setNotice("Your browser blocked clipboard access. Use the download instead.");
    }
  };

  const onFile = (f: File | null) => {
    if (!f) return;
    if (fileInput.current) fileInput.current.value = "";
    if (f.size > MAX_FILE_BYTES) {
      setError(`${f.name} is ${(f.size / 1048576).toFixed(1)} MB. The limit for splitting is 50 MB.`);
      return;
    }
    setFile(f);
    setText("");
    setSplit(null);
    setError(null);
  };

  const onMergeFiles = (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list);
    if (mergeInput.current) mergeInput.current.value = "";
    const existing = mergeSources.filter((s) => s.kind === "file");
    const all = [...existing, ...files.map((f) => ({ kind: "file" as const, file: f }))];
    if (all.length > MAX_MERGE_FILES) return setError(`That makes ${all.length} files; the limit is ${MAX_MERGE_FILES}.`);
    const total = all.reduce((n, s) => n + s.file.size, 0);
    if (total > MAX_MERGE_BYTES) return setError(`The files add up to ${(total / 1048576).toFixed(0)} MB; the limit is 500 MB.`);
    setMergeSources(all);
    setMergeRequested(0);
    setMerged(null);
    setError(null);
  };

  const setMode = (mode: SplitMode) => setOpts((o) => ({ ...o, mode }));
  const parts = split?.parts ?? [];
  const part = parts[selected];
  const columns = info?.header ?? [];
  const delimName = (d: string) => (d === "\t" ? "tab" : d === "," ? "comma" : d === ";" ? "semicolon" : d === "|" ? "pipe" : d);

  return (
    <div className="space-y-6 text-navy">
      <div className="flex gap-1 border-b border-slate-200" role="tablist" aria-label="Mode">
        {(["split", "merge"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`${uid}-tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`${uid}-panel-${t}`}
            onClick={() => {
              setTab(t);
              setError(null);
              setNotice(null);
            }}
            className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-semibold ${tab === t ? "border-primary text-primary-dark" : "border-transparent text-slate-600 hover:text-navy"} ${focusRing}`}
          >
            {t === "split" ? "Split a CSV" : "Merge CSV files"}
          </button>
        ))}
      </div>

      {tab === "split" ? (
        <section id={`${uid}-panel-split`} role="tabpanel" aria-labelledby={`${uid}-tab-split`} className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">CSV to split</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  setFile(null);
                  setText(ORDERS_CSV);
                  setOpts(SAMPLE_SPLIT);
                }}
              >
                Try an example
              </button>
              <button type="button" className={btnSecondary} onClick={() => fileInput.current?.click()}>
                Open a CSV file
              </button>
              <button
                type="button"
                className={btnSecondary}
                disabled={!file && text === ""}
                onClick={() => {
                  setFile(null);
                  setText("");
                  setSplit(null);
                  setError(null);
                }}
              >
                Clear
              </button>
            </div>
          </div>
          <input ref={fileInput} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          {file ? (
            <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              File: <span className="font-semibold text-navy">{file.name}</span> ({fmtBytes(file.size)}), read in your browser, not uploaded.
              {info && ` ${delimName(info.delimiter)}-separated, ${info.encoding}, ${info.header.length} columns.`}
            </p>
          ) : (
            <>
              <label htmlFor={`${uid}-text`} className="mt-3 block text-sm text-slate-600">
                Paste CSV (up to 5 MB) or open a file (up to 50 MB)
              </label>
              <textarea id={`${uid}-text`} className={`${inputCls} mt-1 h-40 resize-y font-mono text-xs`} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
            </>
          )}

          <fieldset className="mt-4">
            <legend className="text-sm font-medium">Split by</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["column", "Column value", "one file per value, e.g. per country"],
                  ["rows", "Number of rows", "the same number of rows in each part"],
                  ["size", "File size", "parts no bigger than a size"],
                ] as const
              ).map(([m, label, hint]) => (
                <label key={m} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${opts.mode === m ? "border-primary bg-primary-soft" : "border-slate-200"}`}>
                  <input type="radio" name={`${uid}-mode`} className={`mt-0.5 accent-primary ${focusRing}`} checked={opts.mode === m} onChange={() => setMode(m)} />
                  <span>
                    <span className="font-semibold">{label}</span>
                    <span className="block text-xs text-slate-600">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {opts.mode === "column" && (
              <div>
                <label htmlFor={`${uid}-col`} className="block text-sm text-slate-600">
                  Column
                </label>
                <select id={`${uid}-col`} className={`${inputCls} mt-1`} value={opts.column} onChange={(e) => setOpts((o) => ({ ...o, column: Number(e.target.value) }))} disabled={columns.length === 0}>
                  {columns.map((c, i) => (
                    <option key={i} value={i}>
                      {opts.hasHeader ? c || `Column ${i + 1}` : `Column ${i + 1} (${c.slice(0, 20)})`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {opts.mode === "rows" && (
              <div>
                <label htmlFor={`${uid}-rows`} className="block text-sm text-slate-600">
                  Rows per part (header not counted)
                </label>
                <input
                  id={`${uid}-rows`}
                  inputMode="numeric"
                  className={`${inputCls} mt-1`}
                  value={rowsRaw}
                  onChange={(e) => {
                    setRowsRaw(e.target.value);
                    const n = Number(e.target.value.replace(/[\s,]/g, ""));
                    setOpts((o) => ({ ...o, rowsPerPart: Number.isInteger(n) ? n : 0 }));
                  }}
                />
              </div>
            )}
            {opts.mode === "size" && (
              <div>
                <label htmlFor={`${uid}-size`} className="block text-sm text-slate-600">
                  Maximum size per part (MB)
                </label>
                <input
                  id={`${uid}-size`}
                  inputMode="decimal"
                  className={`${inputCls} mt-1`}
                  value={sizeMb}
                  onChange={(e) => {
                    setSizeMb(e.target.value);
                    const n = Number(e.target.value.replace(",", "."));
                    setOpts((o) => ({ ...o, maxBytes: Number.isFinite(n) ? Math.round(n * 1048576) : 0 }));
                  }}
                />
              </div>
            )}
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={opts.hasHeader} onChange={(e) => setOpts((o) => ({ ...o, hasHeader: e.target.checked }))} />
              First row is a header (repeated in every part)
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={opts.bom} onChange={(e) => setOpts((o) => ({ ...o, bom: e.target.checked }))} />
              Add a BOM (helps Excel open UTF-8)
            </label>
          </div>
          {file && (
            <button type="button" className={`${btnPrimary} mt-4`} disabled={!!busy} onClick={() => setSplitRequested((n) => n + 1)}>
              Split the file
            </button>
          )}
          <p className="mt-3 text-xs text-slate-600">
            Limits: paste up to 5 MB, open a file up to 50 MB, at most {MAX_OUTPUT_FILES} output files. The parts are packed into a ZIP in your browser; nothing is uploaded.
          </p>
        </section>
      ) : (
        <section id={`${uid}-panel-merge`} role="tabpanel" aria-labelledby={`${uid}-tab-merge`} className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">CSV files to merge</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  setMergeSources(MERGE_SAMPLES.map((s) => ({ kind: "text", name: s.name, text: s.text })));
                  setMopts(SAMPLE_MERGE);
                }}
              >
                Try an example
              </button>
              <button type="button" className={btnSecondary} onClick={() => mergeInput.current?.click()}>
                Add CSV files
              </button>
              <button
                type="button"
                className={btnSecondary}
                disabled={mergeSources.length === 0}
                onClick={() => {
                  setMergeSources([]);
                  setMerged(null);
                  setError(null);
                }}
              >
                Clear
              </button>
            </div>
          </div>
          <input ref={mergeInput} type="file" multiple accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onMergeFiles(e.target.files)} />
          {mergeSources.length > 0 ? (
            <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
              {mergeSources.map((s, i) => (
                <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0 break-all">
                    {s.kind === "file" ? s.file.name : s.name} <span className="text-xs text-slate-600">({fmtBytes(s.kind === "file" ? s.file.size : s.text.length)}{s.kind === "text" ? ", example" : ""})</span>
                  </span>
                  <button type="button" className={`${btnSecondary} px-2 py-1 text-xs`} aria-label={`Remove ${s.kind === "file" ? s.file.name : s.name}`} onClick={() => setMergeSources((list) => list.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">Add two or more CSV files. Their columns are matched by header name.</p>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor={`${uid}-md`} className="block text-sm text-slate-600">
                Output separator
              </label>
              <select id={`${uid}-md`} className={`${inputCls} mt-1`} value={mopts.delimiter} onChange={(e) => setMopts((o) => ({ ...o, delimiter: e.target.value as OutDelimiter }))}>
                <option value=",">Comma (,)</option>
                <option value=";">Semicolon (;)</option>
                <option value={"\t"}>Tab</option>
              </select>
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={mopts.looseHeaders} onChange={(e) => setMopts((o) => ({ ...o, looseHeaders: e.target.checked }))} />
              Ignore case and spaces in headers
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={mopts.addSource} onChange={(e) => setMopts((o) => ({ ...o, addSource: e.target.checked }))} />
              Add a source_file column
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={mopts.bom} onChange={(e) => setMopts((o) => ({ ...o, bom: e.target.checked }))} />
              Add a BOM for Excel
            </label>
          </div>
          {mergeSources.some((s) => s.kind === "file") && (
            <button type="button" className={`${btnPrimary} mt-4`} disabled={!!busy || mergeSources.length < 2} onClick={() => setMergeRequested((n) => n + 1)}>
              Merge {mergeSources.length} files
            </button>
          )}
          <p className="mt-3 text-xs text-slate-600">
            Limits: up to {MAX_MERGE_FILES} files and 500 MB in total. Each file&apos;s separator and encoding are detected on its own. Nothing is uploaded.
          </p>
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
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {tab === "split" && split && !error && (
        <section className={card} aria-labelledby={`${uid}-sres`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id={`${uid}-sres`} className="text-lg font-semibold">
              {fmtInt(parts.length)} file{parts.length === 1 ? "" : "s"}{" "}
              <span className="text-sm font-normal text-slate-600">
                · {fmtInt(split.rows)} rows · ZIP {fmtBytes(split.zip.size)} · {fmtInt(split.ms)} ms
              </span>
            </h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnPrimary} onClick={() => save(split.zip, `${split.info.name.replace(/\.(csv|tsv|txt)$/i, "") || "csv"}-split.zip`)}>
                Download ZIP
              </button>
              <button type="button" className={btnSecondary} onClick={() => copy(parts.map((p) => `${p.name}\t${p.rows} rows`).join("\n"), "File list")}>
                Copy file list
              </button>
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Read as {delimName(split.info.delimiter)}-separated, {split.info.encoding}. Every part is a comma-separated UTF-8 CSV{opts.hasHeader ? " that starts with the header row" : ""}.
            {split.oversizedRows > 0 && ` ${split.oversizedRows} row(s) alone are bigger than the size limit, so they each got a part of their own.`}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div className={`relative max-h-80 overflow-auto rounded-xl border border-slate-200 ${focusRing}`} role="region" aria-label="Output files" tabIndex={0}>
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Files in the ZIP with their row counts and sizes</caption>
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200 text-xs text-slate-600">
                    <th scope="col" className="px-3 py-2">
                      File
                    </th>
                    <th scope="col" className="px-3 py-2 text-right">
                      Rows
                    </th>
                    <th scope="col" className="px-3 py-2 text-right">
                      Size
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((p, i) => (
                    <tr key={p.name} className={`border-b border-slate-100 ${i === selected ? "bg-primary-soft" : ""}`}>
                      <td className="px-3 py-1.5">
                        <button type="button" className={`break-all text-left underline-offset-2 hover:underline ${focusRing}`} aria-pressed={i === selected} onClick={() => setSelected(i)}>
                          {p.name}
                        </button>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtInt(p.rows)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtBytes(p.bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {part && (
              <div>
                <h3 className="text-sm font-semibold">
                  Preview of <span className="break-all font-mono">{part.name}</span>
                </h3>
                <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-slate-50 p-3 font-mono text-xs leading-5">{part.preview.join("\n")}</pre>
                {part.rows > part.preview.length - (opts.hasHeader ? 1 : 0) && <p className="mt-1 text-xs text-slate-600">… and {fmtInt(part.rows - (part.preview.length - (opts.hasHeader ? 1 : 0)))} more rows.</p>}
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "merge" && merged && !error && (
        <section className={card} aria-labelledby={`${uid}-mres`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id={`${uid}-mres`} className="text-lg font-semibold">
              merged.csv{" "}
              <span className="text-sm font-normal text-slate-600">
                · {fmtInt(merged.rows)} rows · {merged.columns.length} columns · {fmtBytes(merged.bytes)} · {fmtInt(merged.ms)} ms
              </span>
            </h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnPrimary} onClick={() => save(merged.file, "merged.csv")}>
                Download merged.csv
              </button>
              <button type="button" className={btnSecondary} disabled={merged.bytes > MAX_PASTE_BYTES} onClick={async () => copy(await merged.file.text(), "Merged CSV")}>
                Copy
              </button>
            </div>
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {merged.report.map((r) => (
              <li key={r.name}>
                <span className="font-semibold">{r.name}</span>: {fmtInt(r.rows)} {r.rows === 1 ? "row" : "rows"}, {delimName(r.delimiter)}-separated, {r.encoding}
                {r.missing.length > 0 && <span className="text-amber-900">; no {r.missing.join(", ")} (left empty)</span>}
                {r.extra.length > 0 && <span>; extra {r.extra.join(", ")}</span>}
                {r.renamed.length > 0 && <span className="text-slate-600">; matched {r.renamed.map((x) => `“${x.from}” → ${x.to}`).join(", ")}</span>}
              </li>
            ))}
          </ul>
          <h3 className="mt-4 text-sm font-semibold">First rows</h3>
          <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-slate-50 p-3 font-mono text-xs leading-5">{merged.preview.join("\n")}</pre>
        </section>
      )}
    </div>
  );
}

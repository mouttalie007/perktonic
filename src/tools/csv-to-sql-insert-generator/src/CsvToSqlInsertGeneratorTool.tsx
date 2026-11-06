"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ENCODING_LABELS, type EncodingChoice } from "./logic/encoding";
import { MAX_BATCH, MAX_DISPLAY_CHARS, MAX_FILE_BYTES, MAX_PASTE_BYTES } from "./logic/limits";
import { COLUMN_TYPES, DIALECTS, type ColumnInfo, type ColumnType, type Dialect, type Options } from "./logic/types";
import type { WorkerRequest, WorkerResponse } from "./worker/sql.worker";
import { SAMPLE_CSV } from "../fixtures/examples";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

type Analysis = Extract<WorkerResponse, { type: "analyzed" }>;
type Generated = Extract<WorkerResponse, { type: "generated" }>;


const TYPE_LABEL: Record<ColumnType, string> = { integer: "Integer", bigint: "Big integer", decimal: "Decimal", boolean: "Boolean", date: "Date", timestamp: "Timestamp", text: "Text" };

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/sql;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function CsvToSqlInsertGeneratorTool() {
  const uid = useId();
  const [text, setText] = useState(SAMPLE_CSV);
  const [file, setFile] = useState<File | null>(null);
  const [encoding, setEncoding] = useState<EncodingChoice>("auto");
  const [hasHeader, setHasHeader] = useState(true);
  const [options, setOptions] = useState<Options>({ dialect: "postgresql", table: "customers", createTable: true, dropTable: false, inserts: true, batchSize: 100, transaction: true, emptyText: "null", nullTokens: false, notNull: false, primaryKey: 0, quoteAll: false });
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [types, setTypes] = useState<ColumnType[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [result, setResult] = useState<Generated | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ label: string; fraction: number | null } | null>(null);
  const [slow, setSlow] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [revive, setRevive] = useState(0);

  const workerRef = useRef<Worker | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const seq = useRef(0);
  const job = useRef(-1);
  const analyzed = useRef(false);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const w = new Worker(new URL("./worker/sql.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const m = event.data;
        if (m.jobId !== job.current) return;
        if (m.type === "progress") {
          setBusy({ label: m.label, fraction: m.fraction });
          return;
        }
        setBusy(null);
        setSlow(false);
        if (m.type === "analyzed") {
          analyzed.current = true;
          setAnalysis(m);
          setTypes(m.columns.map((c: ColumnInfo) => c.detected));
          setNames(m.columns.map((c: ColumnInfo) => c.name));
          setError(null);
        } else if (m.type === "generated") {
          setResult(m);
          setError(null);
        } else {
          setAnalysis(null);
          setResult(null);
          setError(m.message);
        }
      };
      w.onerror = () => {
        setBusy(null);
        setError("The converter stopped unexpectedly, possibly out of memory. Try a smaller file.");
        workerRef.current = null;
        analyzed.current = false;
      };
      workerRef.current = w;
    }
    return workerRef.current;
  }, []);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const start = useCallback(
    (req: WorkerRequest) => {
      job.current = req.jobId;
      setBusy({ label: req.type === "analyze" ? "Reading the CSV" : "Writing SQL", fraction: null });
      setSlow(false);
      setTimeout(() => {
        if (job.current === req.jobId) setSlow(true);
      }, 1000);
      getWorker().postMessage(req);
    },
    [getWorker],
  );

  // Read the CSV (and detect types) when the input changes.
  useEffect(() => {
    const t = setTimeout(
      () => {
        analyzed.current = false;
        if (!file && text.trim() === "") {
          job.current = ++seq.current;
          setAnalysis(null);
          setResult(null);
          setError(null);
          setBusy(null);
          return;
        }
        if (!file && text.length * 3 > MAX_PASTE_BYTES && new TextEncoder().encode(text).length > MAX_PASTE_BYTES) {
          job.current = ++seq.current;
          setAnalysis(null);
          setResult(null);
          setError("The pasted text is larger than 5 MB. Save it as a .csv file and open it instead (up to 50 MB).");
          return;
        }
        start({ type: "analyze", jobId: ++seq.current, source: file ? { kind: "file", file } : { kind: "text", text }, encoding, hasHeader, dialect: options.dialect });
      },
      file ? 0 : 300,
    );
    return () => clearTimeout(t);
    // The dialect only changes name length limits, which generation re-applies, so it is not a trigger here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, file, encoding, hasHeader, revive, start]);

  // Write the SQL whenever the analysis or an option changes.
  useEffect(() => {
    if (!analysis) return;
    const t = setTimeout(() => {
      if (!analyzed.current) return;
      start({ type: "generate", jobId: ++seq.current, options, types, names });
    }, 200);
    return () => clearTimeout(t);
  }, [analysis, options, types, names, start]);

  const cancel = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    analyzed.current = false;
    job.current = ++seq.current;
    setBusy(null);
    setSlow(false);
    setAnalysis(null);
    setResult(null);
    setError("Stopped. Change the input or press “Read again” to start over.");
  };

  const onFile = (f: File | null) => {
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      setError(`This file is ${(f.size / 1048576).toFixed(1)} MB. The limit is 50 MB.`);
      return;
    }
    setFile(f);
    setText("");
    const base = f.name.replace(/\.[^.]+$/, "");
    setOptions((o) => ({ ...o, table: base || o.table, primaryKey: null }));
  };

  const set = <K extends keyof Options>(key: K, value: Options[K]) => setOptions((o) => ({ ...o, [key]: value }));

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.sql);
      setNotice("SQL copied to the clipboard.");
    } catch {
      setNotice("Copying was blocked by the browser. Use Download .sql instead.");
    }
    setTimeout(() => setNotice(null), 3000);
  };

  const shown = result ? (result.sql.length > MAX_DISPLAY_CHARS ? result.sql.slice(0, MAX_DISPLAY_CHARS) : result.sql) : "";

  return (
    <div className="space-y-6">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-in`} className="text-lg font-semibold text-navy"><span className="tool-step" aria-hidden>1</span>CSV data</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => {
                setFile(null);
                setText(SAMPLE_CSV);
                setHasHeader(true);
                setOptions((o) => ({ ...o, table: "customers", primaryKey: 0 }));
                setRevive((n) => n + 1);
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
              disabled={text === "" && !file}
              onClick={() => {
                setFile(null);
                setText("");
              }}
            >
              Clear
            </button>
          </div>
        </div>
        <input ref={fileInput} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        {file ? (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            File: <span className="font-semibold text-navy">{file.name}</span> ({(file.size / 1048576).toFixed(2)} MB), read in your browser, not uploaded.
          </p>
        ) : (
          <>
            <label htmlFor={`${uid}-text`} className="mt-3 block text-sm text-slate-600">
              Paste CSV (comma, semicolon, tab or pipe separated)
            </label>
            <textarea id={`${uid}-text`} className={`${inputCls} mt-2 h-40 font-mono`} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
          </>
        )}
        <div className="mt-3 flex flex-wrap items-end gap-4 text-sm">
          <label className="inline-flex items-center gap-2 text-slate-700">
            <input type="checkbox" className={`h-4 w-4 rounded ${focusRing}`} checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
            First row is a header
          </label>
          {file && (
            <div>
              <label htmlFor={`${uid}-enc`} className="block text-xs text-slate-600">
                Encoding
              </label>
              <select id={`${uid}-enc`} className={`${inputCls} mt-1`} value={encoding} onChange={(e) => setEncoding(e.target.value as EncodingChoice)}>
                <option value="auto">Detect automatically</option>
                {Object.entries(ENCODING_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Paste up to {MAX_PASTE_BYTES / 1048576} MB or open a file up to 50 MB. Types are detected from the first 10,000 rows. Everything runs in your browser; the tool never connects to a database.
        </p>
        {analysis && (
          <p className="mt-2 text-sm text-slate-700">
            {analysis.rowCount.toLocaleString("en-US")} rows, {analysis.columns.length} columns, separator “{analysis.delimiter === "\t" ? "tab" : analysis.delimiter}”{analysis.encoding && `, ${analysis.encoding} (${analysis.encodingReason})`}.
          </p>
        )}
        {analysis?.warnings.map((w) => (
          <p key={w} className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
            {w}
          </p>
        ))}
      </section>

      <section className={card} aria-labelledby={`${uid}-opt`}>
        <h2 id={`${uid}-opt`} className="text-lg font-semibold text-navy"><span className="tool-step" aria-hidden>2</span>Table and options</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={`${uid}-dialect`} className="block text-sm text-slate-600">
              SQL dialect
            </label>
            <select id={`${uid}-dialect`} className={`${inputCls} mt-1`} value={options.dialect} onChange={(e) => set("dialect", e.target.value as Dialect)}>
              {DIALECTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${uid}-table`} className="block text-sm text-slate-600">
              Table name
            </label>
            <input id={`${uid}-table`} className={`${inputCls} mt-1`} value={options.table} maxLength={128} onChange={(e) => set("table", e.target.value)} />
          </div>
          <div>
            <label htmlFor={`${uid}-batch`} className="block text-sm text-slate-600">
              Rows per INSERT
            </label>
            <input id={`${uid}-batch`} type="number" min={1} max={MAX_BATCH} className={`${inputCls} mt-1`} value={options.batchSize} onChange={(e) => set("batchSize", Math.max(1, Math.min(MAX_BATCH, Number(e.target.value) || 1)))} />
          </div>
        </div>
        <fieldset className="mt-4">
          <legend className="sr-only">Output options</legend>
          <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            {(
              [
                ["createTable", "CREATE TABLE statement"],
                ["dropTable", "DROP TABLE IF EXISTS first"],
                ["inserts", "INSERT statements"],
                ["transaction", "Wrap the INSERTs in a transaction"],
                ["notNull", "NOT NULL for columns with no empty cells"],
                ["nullTokens", "Read the text NULL and \\N as NULL"],
                ["quoteAll", "Quote every name (not only reserved words)"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="inline-flex items-center gap-2">
                <input type="checkbox" className={`h-4 w-4 rounded ${focusRing}`} checked={options[key]} onChange={(e) => set(key, e.target.checked)} />
                {label}
              </label>
            ))}
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" className={`h-4 w-4 rounded ${focusRing}`} checked={options.emptyText === "empty"} onChange={(e) => set("emptyText", e.target.checked ? "empty" : "null")} />
              Empty cells in text columns become &apos;&apos; (otherwise NULL)
            </label>
          </div>
        </fieldset>

        {analysis && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-navy">Columns: check the detected types</h3>
            <div className="relative mt-2 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <caption className="sr-only">Column names and types</caption>
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th scope="col" className="px-3 py-2">CSV header</th>
                    <th scope="col" className="px-3 py-2">SQL name</th>
                    <th scope="col" className="px-3 py-2">Type</th>
                    <th scope="col" className="px-3 py-2">Key</th>
                    <th scope="col" className="px-3 py-2">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.columns.map((c, i) => (
                    <tr key={i} className="border-t border-slate-200 align-top">
                      <td className="px-3 py-2 text-xs text-slate-700">{c.source || <em>empty</em>}</td>
                      <td className="px-3 py-2">
                        <label className="sr-only" htmlFor={`${uid}-n${i}`}>
                          SQL name for {c.source || `column ${i + 1}`}
                        </label>
                        <input id={`${uid}-n${i}`} className={`${inputCls} py-1 font-mono text-xs`} value={names[i] ?? ""} maxLength={128} onChange={(e) => setNames((list) => list.map((x, j) => (j === i ? e.target.value : x)))} />
                      </td>
                      <td className="px-3 py-2">
                        <label className="sr-only" htmlFor={`${uid}-t${i}`}>
                          Type for {c.source || `column ${i + 1}`}
                        </label>
                        <select id={`${uid}-t${i}`} className={`${inputCls} py-1 text-xs`} value={types[i] ?? c.detected} onChange={(e) => setTypes((list) => list.map((x, j) => (j === i ? (e.target.value as ColumnType) : x)))}>
                          {COLUMN_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {TYPE_LABEL[t]}
                              {t === c.detected ? " (detected)" : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <label className="inline-flex items-center gap-1 text-xs">
                          <input type="radio" name={`${uid}-pk`} className={focusRing} checked={options.primaryKey === i} onChange={() => set("primaryKey", i)} />
                          <span className="sr-only">Primary key: {c.source}</span>
                          PK
                        </label>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {c.reason}
                        {c.empty > 0 && `; ${c.empty.toLocaleString("en-US")} empty`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className={`${btnSecondary} mt-2 text-xs`} onClick={() => set("primaryKey", null)} disabled={options.primaryKey === null}>
              No primary key
            </button>
          </div>
        )}
      </section>

      <div aria-live="polite" className="min-h-6 text-sm text-slate-700">
        {busy && (
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-block h-4 w-4 rounded-full border-2 border-primary border-t-transparent motion-safe:animate-spin" aria-hidden="true" />
              <span>{busy.label}…</span>
              {slow && (
                <button type="button" className={btnSecondary} onClick={cancel}>
                  Cancel
                </button>
              )}
            </div>
            {busy.fraction !== null && (
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(busy.fraction * 100)}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(busy.fraction * 100)}%` }} />
              </div>
            )}
          </div>
        )}
        {notice && <p>{notice}</p>}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{error}</p>
          {!busy && (
            <button type="button" className={`${btnSecondary} mt-2`} onClick={() => setRevive((n) => n + 1)}>
              Read again
            </button>
          )}
        </div>
      )}

      <div aria-live="polite">
        {result && analysis && (
          <section className={card} aria-labelledby={`${uid}-out`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id={`${uid}-out`} className="text-lg font-semibold text-navy">
                <span className="tool-step" aria-hidden>3</span>SQL <span className="text-sm font-normal text-slate-600">· {result.statements.toLocaleString("en-US")} statements, {result.rowCount.toLocaleString("en-US")} rows</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnSecondary} onClick={copy}>
                  Copy SQL
                </button>
                <button type="button" className={btnPrimary} onClick={() => download(result.sql, `${options.table.trim() || "data"}.sql`)}>
                  Download .sql
                </button>
              </div>
            </div>
            {result.problems.map((p) => (
              <p key={p.column} className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                {p.count.toLocaleString("en-US")} value{p.count === 1 ? "" : "s"} in <code>{p.column}</code> do{p.count === 1 ? "es" : ""} not fit {TYPE_LABEL[p.type].toLowerCase()} (e.g. row {p.examples[0].row}: “{p.examples[0].value}”). They were written as quoted text, which the database may reject; choose Text for this column if that is expected.
              </p>
            ))}
            <pre className="mt-3 max-h-[32rem] overflow-auto rounded-xl bg-slate-900 p-4 font-mono text-xs leading-5 text-slate-100">
              <code>{shown}</code>
            </pre>
            {shown.length < result.sql.length && (
              <p className="mt-2 text-xs text-slate-500">
                Showing the first {MAX_DISPLAY_CHARS.toLocaleString("en-US")} of {result.sql.length.toLocaleString("en-US")} characters. Copy or download to get all of it.
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Delimiter } from "./logic/csvParser";
import type { CsvToJsonOptions } from "./logic/csvToJson";
import { byteLength, ENCODINGS, MAX_PASTE_BYTES, sniffKind, type EncodingId } from "./logic/input";
import type { JsonToCsvOptions } from "./logic/jsonToCsv";
import { DEFAULT_INFER } from "./logic/values";
import type { Direction, Source, WorkerRequest, WorkerResponse } from "./worker/convert.worker";
import { EXAMPLE_CSV, EXAMPLE_JSON } from "../fixtures/example";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

type ResultMsg = Extract<WorkerResponse, { type: "result" }>;
type Status = "empty" | "working" | "done" | "error";

const MAX_COPY_BYTES = 5 * 1024 * 1024;
const PROGRESS_DELAY_MS = 400;

const DEFAULT_CSV: CsvToJsonOptions = {
  delimiter: "auto",
  hasHeader: true,
  infer: DEFAULT_INFER,
  nest: false,
  separator: ".",
  nestArrays: true,
  output: "array",
  indent: 2,
};

const DEFAULT_JSON: JsonToCsvOptions = {
  delimiter: ",",
  includeHeader: true,
  flatten: true,
  separator: ".",
  arrays: "index",
  quoteAll: false,
  lineEnding: "\n",
  protectFormulas: false,
};

const DELIMS: { id: Delimiter; label: string }[] = [
  { id: ",", label: "Comma ," },
  { id: ";", label: "Semicolon ;" },
  { id: "\t", label: "Tab" },
  { id: "|", label: "Pipe |" },
];


export default function CsvToJsonConverterTool() {
  const uid = useId();
  const [direction, setDirection] = useState<Direction>("csv2json");
  const [text, setText] = useState(EXAMPLE_CSV);
  const [file, setFile] = useState<File | null>(null);
  const [encoding, setEncoding] = useState<EncodingId>("auto");
  const [csvOpts, setCsvOpts] = useState<CsvToJsonOptions>({ ...DEFAULT_CSV, nest: true });
  const [jsonOpts, setJsonOpts] = useState<JsonToCsvOptions>(DEFAULT_JSON);
  const [excelBom, setExcelBom] = useState(false);
  const [status, setStatus] = useState<Status>("empty");
  const [result, setResult] = useState<ResultMsg | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ fraction: number | null; label: string } | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [view, setView] = useState<"text" | "table">("text");
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const jobRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const w = new Worker(new URL("./worker/convert.worker.ts", import.meta.url), { type: "module" });
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
          setError(msg.message);
          setResult(null);
          setStatus("error");
          setProgress(null);
        }
      };
      w.onerror = () => {
        setError("The converter stopped unexpectedly, possibly because the browser ran out of memory. Try a smaller file.");
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
        setError("The pasted text is larger than 5 MB. Save it as a file and upload it instead (CSV up to 200 MB, JSON up to 50 MB).");
      }, 0);
      return () => clearTimeout(t);
    }
    const source: Source = file ? { kind: "file", file } : { kind: "text", text };
    const timer = setTimeout(() => {
      const jobId = ++jobRef.current;
      setStatus("working");
      setShowProgress(false);
      const req: WorkerRequest = { type: "run", jobId, source, direction, encoding, csv: csvOpts, json: jsonOpts };
      getWorker().postMessage(req);
    }, file ? 0 : 250);
    return () => clearTimeout(timer);
  }, [text, file, direction, encoding, csvOpts, jsonOpts, getWorker]);

  const cancel = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    jobRef.current++;
    setStatus("error");
    setResult(null);
    setProgress(null);
    setError("Conversion cancelled. Change the input or an option to start again.");
  };

  const onPaste = (value: string) => {
    setFile(null);
    setText(value);
    if (value.trim() !== "") setDirection(sniffKind(value) === "json" ? "json2csv" : "csv2json");
  };

  const pickFile = async (f: File | null) => {
    if (!f) return;
    const head = await f.slice(0, 1024).text();
    setDirection(sniffKind(head) === "json" ? "json2csv" : "csv2json");
    setText("");
    setFile(f);
  };

  const loadExample = () => {
    setFile(null);
    if (direction === "json2csv") {
      setText(EXAMPLE_JSON);
    } else {
      setCsvOpts((o) => ({ ...o, nest: true }));
      setText(EXAMPLE_CSV);
    }
  };

  const clearAll = () => {
    setFile(null);
    setText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const outExt = direction === "csv2json" ? (csvOpts.output === "ndjson" ? "ndjson" : "json") : "csv";
  const baseName = file ? file.name.replace(/\.[^.]+$/, "") : "converted";

  const download = () => {
    if (!result) return;
    const parts: BlobPart[] = direction === "json2csv" && excelBom ? ["﻿", result.blob] : [result.blob];
    const url = URL.createObjectURL(new Blob(parts, { type: result.blob.type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}.${outExt}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const canCopy = status === "done" && result !== null && result.blob.size <= MAX_COPY_BYTES;
  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(await result.blob.text());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Your browser blocked clipboard access. Use Download instead, or select the text and press Ctrl+C or Cmd+C.");
    }
  };

  const patchCsv = (p: Partial<CsvToJsonOptions>) => setCsvOpts((o) => ({ ...o, ...p }));
  const patchJson = (p: Partial<JsonToCsvOptions>) => setJsonOpts((o) => ({ ...o, ...p }));

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-in`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>1</span>Your data</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={loadExample}>Try an example</button>
            <button type="button" className={btnSecondary} onClick={clearAll} disabled={!file && text === ""}>Clear</button>
          </div>
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Direction</legend>
          <div className="mt-2 inline-flex rounded-xl border border-slate-300 p-1">
            {(["csv2json", "json2csv"] as const).map((d) => (
              <label
                key={d}
                className={`cursor-pointer rounded-lg px-4 py-1.5 text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${direction === d ? "bg-primary text-white" : "text-navy hover:bg-slate-50"}`}
              >
                <input type="radio" className="sr-only" name={`${uid}-dir`} checked={direction === d} onChange={() => setDirection(d)} />
                {d === "csv2json" ? "CSV → JSON" : "JSON → CSV"}
              </label>
            ))}
          </div>
        </fieldset>

        <label htmlFor={`${uid}-text`} className="mt-4 block text-sm font-medium">
          Paste {direction === "csv2json" ? "CSV (comma, semicolon, tab or pipe separated)" : "JSON (array of objects, single object or NDJSON)"}
        </label>
        <textarea
          id={`${uid}-text`}
          className={`${inputCls} mt-1 h-44 resize-y font-mono text-xs`}
          value={text}
          onChange={(e) => onPaste(e.target.value)}
          placeholder={direction === "csv2json" ? "id,name,zip\n1,Ada,02134" : "[{\"id\": 1, \"name\": \"Ada\"}]"}
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
            void pickFile(e.dataTransfer.files[0] ?? null);
          }}
        >
          <label htmlFor={`${uid}-file`} className="font-medium">Or choose a .csv, .tsv, .txt or .json file, or drop it here</label>
          <input
            ref={fileInputRef}
            id={`${uid}-file`}
            type="file"
            accept=".csv,.tsv,.txt,.json,.ndjson,text/csv,application/json"
            className={`mx-auto mt-2 block max-w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:font-semibold file:text-primary-dark ${focusRing}`}
            onChange={(e) => void pickFile(e.target.files?.[0] ?? null)}
          />
          {file && (
            <p className="mt-2 text-slate-ink">
              Selected: <span className="font-medium text-navy">{file.name}</span> ({formatSize(file.size)})
            </p>
          )}
        </div>
        <p id={`${uid}-limits`} className="mt-3 text-xs text-slate-ink">
          Limits: pasted text up to 5 MB; CSV files up to 200 MB (streamed); JSON files up to 50 MB. Nothing is uploaded: the conversion runs in your browser.
        </p>
      </section>

      <section className={card} aria-labelledby={`${uid}-opt`}>
        <h2 id={`${uid}-opt`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>2</span>Options</h2>
        {direction === "csv2json" ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              id={`${uid}-delim`}
              label="Delimiter"
              value={csvOpts.delimiter}
              onChange={(v) => patchCsv({ delimiter: v as CsvToJsonOptions["delimiter"] })}
              options={[{ value: "auto", label: "Detect automatically" }, ...DELIMS.map((d) => ({ value: d.id, label: d.label }))]}
            />
            <Select
              id={`${uid}-enc`}
              label="File encoding"
              value={encoding}
              onChange={(v) => setEncoding(v as EncodingId)}
              options={ENCODINGS.map((e) => ({ value: e.id, label: e.label }))}
            />
            <Select
              id={`${uid}-fmt`}
              label="Output"
              value={`${csvOpts.output}:${csvOpts.indent}`}
              onChange={(v) => {
                const [output, indent] = v.split(":");
                patchCsv({ output: output as CsvToJsonOptions["output"], indent: Number(indent) as CsvToJsonOptions["indent"] });
              }}
              options={[
                { value: "array:2", label: "JSON array, 2-space indent" },
                { value: "array:4", label: "JSON array, 4-space indent" },
                { value: "array:0", label: "JSON array, minified" },
                { value: "ndjson:0", label: "NDJSON (one object per line)" },
              ]}
            />
            <Check label="First row contains column names" checked={csvOpts.hasHeader} onChange={(v) => patchCsv({ hasHeader: v })} />
            <Check label="Numbers as numbers (leading zeros stay text)" checked={csvOpts.infer.numbers} onChange={(v) => patchCsv({ infer: { ...csvOpts.infer, numbers: v } })} />
            <Check label="true / false as booleans" checked={csvOpts.infer.booleans} onChange={(v) => patchCsv({ infer: { ...csvOpts.infer, booleans: v } })} />
            <Check label="The word null as null" checked={csvOpts.infer.nulls} onChange={(v) => patchCsv({ infer: { ...csvOpts.infer, nulls: v } })} />
            <Check label="Empty cells as null (off: empty string)" checked={csvOpts.infer.emptyAsNull} onChange={(v) => patchCsv({ infer: { ...csvOpts.infer, emptyAsNull: v } })} />
            <Check label="Build nested objects from column names" checked={csvOpts.nest} onChange={(v) => patchCsv({ nest: v })} />
            {csvOpts.nest && (
              <>
                <TextInput id={`${uid}-sep`} label="Nesting separator" value={csvOpts.separator} onChange={(v) => patchCsv({ separator: v.slice(0, 3) })} />
                <Check label="Numeric parts (items.0) make arrays" checked={csvOpts.nestArrays} onChange={(v) => patchCsv({ nestArrays: v })} />
              </>
            )}
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              id={`${uid}-odelim`}
              label="CSV delimiter"
              value={jsonOpts.delimiter}
              onChange={(v) => patchJson({ delimiter: v as Delimiter })}
              options={DELIMS.map((d) => ({ value: d.id, label: d.label }))}
            />
            <Select
              id={`${uid}-arr`}
              label="Arrays"
              value={jsonOpts.arrays}
              onChange={(v) => patchJson({ arrays: v as JsonToCsvOptions["arrays"] })}
              options={[
                { value: "index", label: "One column per item (tags.0, tags.1)" },
                { value: "json", label: "Keep as JSON text in one cell" },
              ]}
            />
            <Select
              id={`${uid}-eol`}
              label="Line endings"
              value={jsonOpts.lineEnding}
              onChange={(v) => patchJson({ lineEnding: v as JsonToCsvOptions["lineEnding"] })}
              options={[
                { value: "\n", label: "LF (macOS, Linux)" },
                { value: "\r\n", label: "CRLF (Windows, Excel)" },
              ]}
            />
            <Check label="Include header row" checked={jsonOpts.includeHeader} onChange={(v) => patchJson({ includeHeader: v })} />
            <Check label="Flatten nested objects" checked={jsonOpts.flatten} onChange={(v) => patchJson({ flatten: v })} />
            {jsonOpts.flatten && (
              <TextInput id={`${uid}-fsep`} label="Flatten separator" value={jsonOpts.separator} onChange={(v) => patchJson({ separator: v.slice(0, 3) })} />
            )}
            <Check label="Quote every cell" checked={jsonOpts.quoteAll} onChange={(v) => patchJson({ quoteAll: v })} />
            <Check label="Neutralise formulas (= + - @) for spreadsheets" checked={jsonOpts.protectFormulas} onChange={(v) => patchJson({ protectFormulas: v })} />
            <Check label="Add a BOM to the download (helps Excel show accents)" checked={excelBom} onChange={setExcelBom} />
          </div>
        )}
      </section>

      <section className={card} aria-labelledby={`${uid}-out`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-out`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>3</span>Result</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} onClick={download} disabled={status !== "done"}>
              Download .{outExt}
            </button>
            <button type="button" className={btnSecondary} onClick={copy} disabled={!canCopy}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div aria-live="polite" className="mt-3 min-h-6 text-sm text-slate-ink">
          {status === "empty" && "Paste data, choose a file or try the example. The result appears here."}
          {status === "working" && !showProgress && "Converting…"}
          {status === "done" && result && (
            <>
              Done: {result.info}. Output size {formatSize(result.blob.size)}.
              {result.blob.size > MAX_COPY_BYTES && " Too large to copy; use Download."}
            </>
          )}
        </div>

        {status === "working" && showProgress && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div
              className="h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-label={progress?.label ?? "Converting"}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress?.fraction != null ? Math.round(progress.fraction * 100) : undefined}
            >
              <div
                className={`h-full bg-primary ${progress?.fraction == null ? "w-1/3 motion-safe:animate-pulse" : "motion-safe:transition-all"}`}
                style={progress?.fraction != null ? { width: `${Math.round(progress.fraction * 100)}%` } : undefined}
              />
            </div>
            <span className="text-xs text-slate-ink">{progress?.label ?? "Converting…"}</span>
            <button type="button" className={btnSecondary} onClick={cancel}>Cancel</button>
          </div>
        )}

        {status === "error" && error && (
          <div role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}
        {status === "done" && result && result.warnings.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 rounded-xl bg-amber-50 p-3 pl-7 text-sm text-amber-900">
            {result.warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        )}

        <div className="mt-4 flex gap-1 border-b border-slate-200" role="tablist" aria-label="Result view">
          {(["text", "table"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              id={`${uid}-tab-${v}`}
              aria-selected={view === v}
              aria-controls={`${uid}-panel-${v}`}
              className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-semibold ${view === v ? "border-primary text-primary-dark" : "border-transparent text-slate-ink hover:text-navy"} ${focusRing}`}
              onClick={() => setView(v)}
            >
              {v === "text" ? (direction === "csv2json" ? "JSON" : "CSV") : "First rows"}
            </button>
          ))}
        </div>

        <div className="mt-3 min-h-72">
          {view === "text" ? (
            <div id={`${uid}-panel-text`} role="tabpanel" aria-labelledby={`${uid}-tab-text`}>
              <label htmlFor={`${uid}-output`} className="sr-only">Converted output</label>
              <textarea
                id={`${uid}-output`}
                readOnly
                className={`${inputCls} h-72 resize-y bg-slate-50 font-mono text-xs`}
                value={status === "done" && result ? result.previewText : ""}
                placeholder="The converted output appears here."
                spellCheck={false}
              />
              {status === "done" && result?.truncated && (
                <p className="mt-1 text-xs text-slate-ink">Showing the first 100,000 characters. Download the file to get everything.</p>
              )}
            </div>
          ) : (
            <div id={`${uid}-panel-table`} role="tabpanel" aria-labelledby={`${uid}-tab-table`} className="max-h-96 overflow-auto rounded-xl border border-slate-200">
              {status === "done" && result ? (
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {result.columns.map((c, i) => (
                        <th key={i} scope="col" className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-left font-semibold">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r, ri) => (
                      <tr key={ri} className="even:bg-slate-50/60">
                        {r.map((c, i) => (
                          <td key={i} className="max-w-xs truncate border-b border-slate-100 px-3 py-2 font-mono text-xs" title={c}>{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="p-4 text-sm text-slate-ink">The first 10 rows appear here as a table.</p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function formatSize(bytes: number): string {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className={`mt-0.5 h-4 w-4 shrink-0 accent-primary ${focusRing}`}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function Select({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <select id={id} className={`${inputCls} mt-1`} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function TextInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <input id={id} className={`${inputCls} mt-1 font-mono`} value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
    </div>
  );
}

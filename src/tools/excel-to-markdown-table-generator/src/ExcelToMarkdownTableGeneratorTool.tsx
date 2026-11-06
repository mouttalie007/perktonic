"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { DEFAULT_OPTIONS, FILE_EXTENSIONS, type ConvertOptions } from "./logic/convert";
import { byteLength, MAX_PASTE_BYTES } from "./logic/input";
import { columnIndexToLetter, type Align, type AlignChoice } from "./logic/table";
import type { Format } from "./logic/writers";
import type { Source, WorkerRequest, WorkerResponse } from "./worker/table.worker";
import { EXAMPLE_TSV } from "../fixtures/example";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

type ResultMsg = Extract<WorkerResponse, { type: "result" }>;
type Status = "empty" | "working" | "done" | "error";

const MAX_DISPLAY_CHARS = 200_000;
const PROGRESS_DELAY_MS = 400;

const FORMATS: { id: Format; label: string }[] = [
  { id: "markdown", label: "Markdown" },
  { id: "html", label: "HTML" },
  { id: "latex", label: "LaTeX" },
];

const ALIGN_LABELS: Record<AlignChoice, string> = {
  auto: "Auto",
  left: "Left",
  center: "Center",
  right: "Right",
};


export default function ExcelToMarkdownTableGeneratorTool() {
  const uid = useId();
  const [text, setText] = useState(EXAMPLE_TSV);
  const [file, setFile] = useState<File | null>(null);
  const [sourceId, setSourceId] = useState(0);
  const [sheet, setSheet] = useState(0);
  const [options, setOptions] = useState<ConvertOptions>(DEFAULT_OPTIONS);
  const [status, setStatus] = useState<Status>("empty");
  const [result, setResult] = useState<ResultMsg | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ fraction: number | null; label: string } | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [view, setView] = useState<"code" | "preview">("code");
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const jobRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const w = new Worker(new URL("./worker/table.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const msg = event.data;
        if (msg.jobId !== jobRef.current) return;
        if (msg.type === "progress") {
          setProgress({ fraction: msg.fraction, label: msg.label });
        } else if (msg.type === "result") {
          setResult(msg);
          setError(null);
          setStatus("done");
          setProgress(null);
        } else {
          setError(msg.message);
          setStatus("error");
          setProgress(null);
        }
      };
      w.onerror = () => {
        setError("The converter stopped unexpectedly. Reload the page and try again.");
        setStatus("error");
        setProgress(null);
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
    const hasText = text.trim() !== "";
    if (!file && !hasText) {
      // Deferred so the state updates happen in a callback, not synchronously in the effect.
      const t = setTimeout(() => {
        jobRef.current++;
        setStatus("empty");
        setResult(null);
        setError(null);
        setProgress(null);
      }, 0);
      return () => clearTimeout(t);
    }
    if (!file && byteLength(text) > MAX_PASTE_BYTES) {
      const t = setTimeout(() => {
        jobRef.current++;
        setStatus("error");
        setError("The pasted text is larger than 5 MB. Upload it as a file instead (up to 50 MB).");
      }, 0);
      return () => clearTimeout(t);
    }
    const source: Source = file ? { kind: "file", file } : { kind: "text", text };
    const delay = file ? 0 : 200;
    const timer = setTimeout(() => {
      const jobId = ++jobRef.current;
      setStatus("working");
      setShowProgress(false);
      const req: WorkerRequest = { type: "run", jobId, sourceId, source, sheet, options };
      getWorker().postMessage(req);
    }, delay);
    return () => clearTimeout(timer);
  }, [text, file, sourceId, sheet, options, getWorker]);

  const cancel = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    jobRef.current++;
    setStatus("error");
    setProgress(null);
    setError("Conversion cancelled. Change the input or options to run it again.");
  };

  const setPasted = (value: string) => {
    setFile(null);
    setText(value);
    setSheet(0);
    setSourceId((n) => n + 1);
  };

  const pickFile = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setText("");
    setSheet(0);
    setSourceId((n) => n + 1);
  };

  const clearAll = () => {
    setFile(null);
    setText("");
    setSourceId((n) => n + 1);
    setOptions((o) => ({ ...o, range: "", columnAligns: [] }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const patch = <K extends keyof ConvertOptions>(key: K, value: ConvertOptions[K]) =>
    setOptions((o) => ({ ...o, [key]: value }));

  const setColumnAlign = (index: number, value: AlignChoice) =>
    setOptions((o) => {
      const next = [...o.columnAligns];
      next[index] = value;
      return { ...o, columnAligns: next };
    });

  const output = result?.text ?? "";
  const shown = output.length > MAX_DISPLAY_CHARS ? output.slice(0, MAX_DISPLAY_CHARS) : output;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Your browser blocked clipboard access. Select the code and copy it with Ctrl+C or Cmd+C.");
    }
  };

  const download = () => {
    const types: Record<Format, string> = { markdown: "text/markdown", html: "text/html", latex: "application/x-tex" };
    const blob = new Blob([output], { type: `${types[options.format]};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `table.${FILE_EXTENSIONS[options.format]}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const columnNames = result
    ? Array.from({ length: result.columnCount }, (_, i) => result.header?.[i]?.trim() || `Column ${columnIndexToLetter(i)}`)
    : [];

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-input`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-input`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>1</span>Your table</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={() => setPasted(EXAMPLE_TSV)}>
              Try an example
            </button>
            <button type="button" className={btnSecondary} onClick={clearAll} disabled={!file && text === ""}>
              Clear
            </button>
          </div>
        </div>

        <label htmlFor={`${uid}-paste`} className="mt-4 block text-sm font-medium">
          Paste cells from Excel or Google Sheets, or CSV text
        </label>
        <textarea
          id={`${uid}-paste`}
          className={`${inputCls} mt-1 h-40 resize-y font-mono text-xs`}
          value={text}
          onChange={(e) => setPasted(e.target.value)}
          placeholder={"Region\tQ1\tQ2\nNorth\t1,200\t1,350"}
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
          <label htmlFor={`${uid}-file`} className="font-medium">
            Or choose a file (.xlsx, .csv, .tsv), or drop it here
          </label>
          <input
            ref={fileInputRef}
            id={`${uid}-file`}
            type="file"
            accept=".xlsx,.csv,.tsv,.txt,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className={`mx-auto mt-2 block max-w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:font-semibold file:text-primary-dark ${focusRing}`}
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          {file && (
            <p className="mt-2 text-slate-ink">
              Selected: <span className="font-medium text-navy">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>
        <p id={`${uid}-limits`} className="mt-3 text-xs text-slate-ink">
          Limits: pasted text up to 5 MB, files up to 50 MB, 200 columns. Everything runs in your browser; nothing is uploaded.
        </p>
      </section>

      <section className={card} aria-labelledby={`${uid}-opts`}>
        <h2 id={`${uid}-opts`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>2</span>Options</h2>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Output format</legend>
          <div className="mt-2 inline-flex rounded-xl border border-slate-300 p-1" role="radiogroup">
            {FORMATS.map((f) => (
              <label
                key={f.id}
                className={`cursor-pointer rounded-lg px-4 py-1.5 text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${options.format === f.id ? "bg-primary text-white" : "text-navy hover:bg-slate-50"}`}
              >
                <input
                  type="radio"
                  name={`${uid}-format`}
                  value={f.id}
                  checked={options.format === f.id}
                  onChange={() => patch("format", f.id)}
                  className="sr-only"
                />
                {f.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Check label="First row is the header" checked={options.hasHeader} onChange={(v) => patch("hasHeader", v)} />
          <Check
            label="Right-align number columns (Auto)"
            checked={options.autoRightNumbers}
            onChange={(v) => patch("autoRightNumbers", v)}
          />
          <div>
            <label htmlFor={`${uid}-range`} className="block text-sm font-medium">Cell range (optional)</label>
            <input
              id={`${uid}-range`}
              className={`${inputCls} mt-1`}
              value={options.range}
              onChange={(e) => patch("range", e.target.value)}
              placeholder="e.g. A1:D20"
              spellCheck={false}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-align`} className="block text-sm font-medium">Default alignment</label>
            <select
              id={`${uid}-align`}
              className={`${inputCls} mt-1`}
              value={options.defaultAlign}
              onChange={(e) => patch("defaultAlign", e.target.value as AlignChoice)}
            >
              {(Object.keys(ALIGN_LABELS) as AlignChoice[]).map((a) => (
                <option key={a} value={a}>{a === "auto" ? "Auto (text left, numbers right)" : ALIGN_LABELS[a]}</option>
              ))}
            </select>
          </div>
          {result && result.sheets.length > 1 && (
            <div>
              <label htmlFor={`${uid}-sheet`} className="block text-sm font-medium">Sheet</label>
              <select
                id={`${uid}-sheet`}
                className={`${inputCls} mt-1`}
                value={sheet}
                onChange={(e) => setSheet(Number(e.target.value))}
              >
                {result.sheets.map((name, i) => (
                  <option key={name + i} value={i}>{name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {options.format === "markdown" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Check
              label="Line up columns in the source"
              checked={options.markdown.pretty}
              onChange={(v) => patch("markdown", { ...options.markdown, pretty: v })}
            />
            <Check
              label="Escape Markdown characters (* _ ` [ ] < >)"
              checked={options.markdown.escapeFormatting}
              onChange={(v) => patch("markdown", { ...options.markdown, escapeFormatting: v })}
            />
          </div>
        )}
        {options.format === "html" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Check
              label="Wrap header in <thead> and rows in <tbody>"
              checked={options.html.useThead}
              onChange={(v) => patch("html", { ...options.html, useThead: v })}
            />
            <Check
              label="Indent the code"
              checked={options.html.indent}
              onChange={(v) => patch("html", { ...options.html, indent: v })}
            />
            <div>
              <label htmlFor={`${uid}-hcap`} className="block text-sm font-medium">Caption (optional)</label>
              <input
                id={`${uid}-hcap`}
                className={`${inputCls} mt-1`}
                value={options.html.caption}
                onChange={(e) => patch("html", { ...options.html, caption: e.target.value })}
              />
            </div>
          </div>
        )}
        {options.format === "latex" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Check
              label="booktabs rules (\toprule, \midrule)"
              checked={options.latex.booktabs}
              onChange={(v) => patch("latex", { ...options.latex, booktabs: v })}
            />
            <Check
              label="Bold header row"
              checked={options.latex.boldHeader}
              onChange={(v) => patch("latex", { ...options.latex, boldHeader: v })}
            />
            <Check
              label="Wrap in a table float"
              checked={options.latex.floatEnv}
              onChange={(v) => patch("latex", { ...options.latex, floatEnv: v })}
            />
            {options.latex.floatEnv && (
              <>
                <div>
                  <label htmlFor={`${uid}-lcap`} className="block text-sm font-medium">Caption</label>
                  <input
                    id={`${uid}-lcap`}
                    className={`${inputCls} mt-1`}
                    value={options.latex.caption}
                    onChange={(e) => patch("latex", { ...options.latex, caption: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor={`${uid}-llab`} className="block text-sm font-medium">Label</label>
                  <input
                    id={`${uid}-llab`}
                    className={`${inputCls} mt-1`}
                    value={options.latex.label}
                    onChange={(e) => patch("latex", { ...options.latex, label: e.target.value })}
                    spellCheck={false}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {result && result.columnCount > 0 && result.columnCount <= 30 && (
          <details className="mt-4">
            <summary className={`cursor-pointer rounded text-sm font-medium text-primary-dark ${focusRing}`}>
              Alignment per column ({result.columnCount} columns)
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {columnNames.map((name, i) => (
                <div key={i}>
                  <label htmlFor={`${uid}-col-${i}`} className="block truncate text-xs font-medium" title={name}>
                    {name}
                  </label>
                  <select
                    id={`${uid}-col-${i}`}
                    className={`${inputCls} mt-1`}
                    value={options.columnAligns[i] ?? "auto"}
                    onChange={(e) => setColumnAlign(i, e.target.value as AlignChoice)}
                  >
                    {(Object.keys(ALIGN_LABELS) as AlignChoice[]).map((a) => (
                      <option key={a} value={a}>{a === "auto" ? "Use default" : ALIGN_LABELS[a]}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      <section className={card} aria-labelledby={`${uid}-out`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-out`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>3</span>Result</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} onClick={copy} disabled={status !== "done"}>
              {copied ? "Copied" : "Copy code"}
            </button>
            <button type="button" className={btnSecondary} onClick={download} disabled={status !== "done"}>
              Download .{FILE_EXTENSIONS[options.format]}
            </button>
          </div>
        </div>

        <div aria-live="polite" className="mt-3 min-h-6 text-sm text-slate-ink">
          {status === "empty" && "Paste a table, choose a file or try the example to see the code here."}
          {status === "working" && !showProgress && "Converting…"}
          {status === "done" && result &&
            `${result.rowCount} row(s) × ${result.columnCount} column(s) converted to ${FORMATS.find((f) => f.id === options.format)?.label}. ${result.info}.`}
        </div>

        {status === "working" && showProgress && (
          <div className="mt-2 flex items-center gap-3">
            <div
              className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-label={progress?.label ?? "Working"}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress?.fraction != null ? Math.round(progress.fraction * 100) : undefined}
            >
              <div
                className={`h-full bg-primary ${progress?.fraction == null ? "w-1/3 motion-safe:animate-pulse" : "motion-safe:transition-all"}`}
                style={progress?.fraction != null ? { width: `${Math.round(progress.fraction * 100)}%` } : undefined}
              />
            </div>
            <span className="text-xs text-slate-ink">{progress?.label ?? "Working"}</span>
            <button type="button" className={btnSecondary} onClick={cancel}>Cancel</button>
          </div>
        )}

        {status === "error" && error && (
          <div role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {status === "done" && result && result.warnings.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 rounded-xl bg-amber-50 p-3 pl-7 text-sm text-amber-900">
            {result.warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        )}

        <div className="mt-4 flex gap-1 border-b border-slate-200" role="tablist" aria-label="Result view">
          {(["code", "preview"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              aria-controls={`${uid}-panel-${v}`}
              id={`${uid}-tab-${v}`}
              className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-semibold ${view === v ? "border-primary text-primary-dark" : "border-transparent text-slate-ink hover:text-navy"} ${focusRing}`}
              onClick={() => setView(v)}
            >
              {v === "code" ? "Code" : "Preview"}
            </button>
          ))}
        </div>

        <div className="mt-3 min-h-72">
          {view === "code" ? (
            <div id={`${uid}-panel-code`} role="tabpanel" aria-labelledby={`${uid}-tab-code`}>
              <label htmlFor={`${uid}-code`} className="sr-only">Generated table code</label>
              <textarea
                id={`${uid}-code`}
                readOnly
                className={`${inputCls} h-72 resize-y overflow-x-auto bg-slate-50 font-mono text-xs whitespace-pre`}
                wrap="off"
                value={status === "done" ? shown : ""}
                placeholder="The generated code appears here."
                spellCheck={false}
              />
              {status === "done" && output.length > MAX_DISPLAY_CHARS && (
                <p className="mt-1 text-xs text-slate-ink">
                  Showing the first {MAX_DISPLAY_CHARS.toLocaleString("en-US")} characters of {output.length.toLocaleString("en-US")}. Copy or download to get everything.
                </p>
              )}
            </div>
          ) : (
            <div id={`${uid}-panel-preview`} role="tabpanel" aria-labelledby={`${uid}-tab-preview`} className="max-h-96 overflow-auto rounded-xl border border-slate-200">
              {status === "done" && result ? (
                <Preview header={result.header} rows={result.preview} aligns={result.aligns} />
              ) : (
                <p className="p-4 text-sm text-slate-ink">The rendered table appears here.</p>
              )}
            </div>
          )}
          {view === "preview" && status === "done" && result && result.rowCount > result.preview.length && (
            <p className="mt-1 text-xs text-slate-ink">Preview shows the first {result.preview.length} of {result.rowCount} rows.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className={`mt-0.5 h-4 w-4 rounded border-slate-300 accent-primary ${focusRing}`}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

/** Renders cells as React text nodes, so nothing the user typed is ever parsed as HTML. */
function Preview({ header, rows, aligns }: { header: string[] | null; rows: string[][]; aligns: Align[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      {header && (
        <thead className="bg-slate-50">
          <tr>
            {header.map((c, i) => (
              <th key={i} scope="col" className="whitespace-pre-line border-b border-slate-200 px-3 py-2 font-semibold" style={{ textAlign: aligns[i] }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className="odd:bg-white even:bg-slate-50/60">
            {r.map((c, i) => (
              <td key={i} className="whitespace-pre-line border-b border-slate-100 px-3 py-2" style={{ textAlign: aligns[i] }}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

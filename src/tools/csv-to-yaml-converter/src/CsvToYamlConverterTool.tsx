"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { DEFAULT_OPTIONS, DIRECTIONS, EXT, MAX_DISPLAY_CHARS, MAX_FILE_BYTES, MAX_PASTE_BYTES, MIME, type ConvertOptions, type Format } from "./logic/options";
import type { WorkerRequest, WorkerResponse } from "./worker/convert.worker";
import { SAMPLES } from "../fixtures/examples";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

type Result = Extract<WorkerResponse, { type: "result" }>;

const NAME: Record<Format, string> = { csv: "CSV", yaml: "YAML", xml: "XML", toml: "TOML" };

/** Picks the source format from the file name, then from the first characters. */
function guessFormat(name: string, head: string): Format | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "csv" || ext === "tsv") return "csv";
  if (ext === "yaml" || ext === "yml") return "yaml";
  if (ext === "xml") return "xml";
  if (ext === "toml") return "toml";
  const t = head.trimStart();
  if (t.startsWith("<")) return "xml";
  if (/^\[\[?[\w.-]+\]\]?\s*$/m.test(t) || /^[\w-]+\s*=\s*\S/m.test(t)) return "toml";
  if (/^(---|[\w-]+:\s|- )/m.test(t)) return "yaml";
  return null;
}

function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function CsvToYamlConverterTool() {
  const uid = useId();
  const [options, setOptions] = useState<ConvertOptions>(DEFAULT_OPTIONS);
  const [text, setText] = useState(SAMPLES.csv);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<{ message: string; line: number | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [revive, setRevive] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const seq = useRef(0);
  const job = useRef(-1);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const w = new Worker(new URL("./worker/convert.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const m = event.data;
        if (m.jobId !== job.current) return;
        if (m.type === "progress") {
          setBusy(m.label);
          return;
        }
        setBusy(null);
        setSlow(false);
        if (m.type === "result") {
          setResult(m);
          setError(null);
        } else {
          setResult(null);
          setError({ message: m.message, line: m.line });
        }
      };
      w.onerror = () => {
        setBusy(null);
        setError({ message: "The converter stopped unexpectedly, possibly out of memory. Try a smaller file.", line: null });
        workerRef.current = null;
      };
      workerRef.current = w;
    }
    return workerRef.current;
  }, []);

  useEffect(() => () => workerRef.current?.terminate(), []);

  useEffect(() => {
    const t = setTimeout(
      () => {
        const jobId = ++seq.current;
        job.current = jobId;
        if (!file && text.trim() === "") {
          setResult(null);
          setError(null);
          setBusy(null);
          return;
        }
        if (!file && text.length * 3 > MAX_PASTE_BYTES && new TextEncoder().encode(text).length > MAX_PASTE_BYTES) {
          setResult(null);
          setError({ message: "The pasted text is larger than 5 MB. Save it as a file and open it instead (up to 50 MB).", line: null });
          return;
        }
        setBusy("Converting");
        setSlow(false);
        setTimeout(() => {
          if (job.current === jobId) setSlow(true);
        }, 1000);
        const req: WorkerRequest = { jobId, source: file ? { kind: "file", file } : { kind: "text", text }, options };
        getWorker().postMessage(req);
      },
      file ? 0 : 300,
    );
    return () => clearTimeout(t);
  }, [text, file, options, revive, getWorker]);

  const set = <K extends keyof ConvertOptions>(key: K, value: ConvertOptions[K]) => setOptions((o) => ({ ...o, [key]: value }));

  const setDirection = (label: string) => {
    const d = DIRECTIONS.find((x) => x.label === label)!;
    const switched = d.from !== options.from;
    setOptions((o) => ({ ...o, from: d.from, to: d.to }));
    // Switching the input format with the old sample still in the box would only give an error.
    if (switched && !file && Object.values(SAMPLES).includes(text)) setText(SAMPLES[d.from]);
  };

  const cancel = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    job.current = ++seq.current;
    setBusy(null);
    setSlow(false);
    setResult(null);
    setError({ message: "Stopped. Change the input or press “Convert again”.", line: null });
  };

  const onFile = async (f: File | null) => {
    if (!f) return;
    if (fileInput.current) fileInput.current.value = "";
    if (f.size > MAX_FILE_BYTES) {
      setError({ message: `This file is ${(f.size / 1048576).toFixed(1)} MB. The limit is 50 MB.`, line: null });
      return;
    }
    const head = await f.slice(0, 2048).text();
    const fmt = guessFormat(f.name, head);
    if (fmt && fmt !== options.from) {
      const d = fmt === "csv" ? DIRECTIONS[0] : DIRECTIONS.find((x) => x.from === fmt)!;
      setOptions((o) => ({ ...o, from: d.from, to: d.to }));
    }
    setFile(f);
    setText("");
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.output);
      setNotice("Copied to the clipboard.");
    } catch {
      setNotice("Copying was blocked by the browser. Use Download instead.");
    }
    setTimeout(() => setNotice(null), 3000);
  };

  const dirLabel = DIRECTIONS.find((d) => d.from === options.from && d.to === options.to)!.label;
  const shown = result ? (result.output.length > MAX_DISPLAY_CHARS ? result.output.slice(0, MAX_DISPLAY_CHARS) : result.output) : "";
  const fromCsv = options.from === "csv";

  return (
    <div className="space-y-6">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="w-full sm:w-56">
            <label htmlFor={`${uid}-dir`} className="block text-sm font-semibold text-navy">
              Convert
            </label>
            <select id={`${uid}-dir`} className={`${inputCls} mt-1`} value={dirLabel} onChange={(e) => setDirection(e.target.value)}>
              {DIRECTIONS.map((d) => (
                <option key={d.label}>{d.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => {
                setFile(null);
                setText(SAMPLES[options.from]);
                setRevive((n) => n + 1);
              }}
            >
              Try an example
            </button>
            <button type="button" className={btnSecondary} onClick={() => fileInput.current?.click()}>
              Open a file
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
        <h2 id={`${uid}-in`} className="sr-only">
          Input
        </h2>
        <input ref={fileInput} type="file" accept=".csv,.tsv,.txt,.yaml,.yml,.xml,.toml" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
        {file ? (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            File: <span className="font-semibold text-navy">{file.name}</span> ({(file.size / 1048576).toFixed(2)} MB), read as {NAME[options.from]} in your browser, not uploaded.
          </p>
        ) : (
          <>
            <label htmlFor={`${uid}-text`} className="mt-4 block text-sm text-slate-600">
              Paste {NAME[options.from]}
            </label>
            <textarea id={`${uid}-text`} className={`${inputCls} mt-2 h-52 font-mono`} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
          </>
        )}
        <p className="mt-2 text-xs text-slate-500">Paste up to 5 MB or open a file up to 50 MB. Converted in your browser; nothing is uploaded.</p>
      </section>

      <section className={card} aria-labelledby={`${uid}-opt`}>
        <h2 id={`${uid}-opt`} className="text-lg font-semibold text-navy">Options</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {options.to === "yaml" && (
            <div>
              <label htmlFor={`${uid}-yroot`} className="block text-sm text-slate-600">
                Top-level key (empty for a plain list)
              </label>
              <input id={`${uid}-yroot`} className={`${inputCls} mt-1`} value={options.yamlRoot} maxLength={100} onChange={(e) => set("yamlRoot", e.target.value)} />
            </div>
          )}
          {options.to === "toml" && (
            <div>
              <label htmlFor={`${uid}-tkey`} className="block text-sm text-slate-600">
                Table name for the rows ([[name]])
              </label>
              <input id={`${uid}-tkey`} className={`${inputCls} mt-1`} value={options.tomlKey} maxLength={100} onChange={(e) => set("tomlKey", e.target.value)} />
            </div>
          )}
          {options.to === "xml" && (
            <>
              <div>
                <label htmlFor={`${uid}-xroot`} className="block text-sm text-slate-600">
                  Root element
                </label>
                <input id={`${uid}-xroot`} className={`${inputCls} mt-1 font-mono`} value={options.xmlRoot} maxLength={100} onChange={(e) => set("xmlRoot", e.target.value)} />
              </div>
              <div>
                <label htmlFor={`${uid}-xrow`} className="block text-sm text-slate-600">
                  Row element
                </label>
                <input id={`${uid}-xrow`} className={`${inputCls} mt-1 font-mono`} value={options.xmlRow} maxLength={100} onChange={(e) => set("xmlRow", e.target.value)} />
              </div>
            </>
          )}
          {options.to === "csv" && (
            <div>
              <label htmlFor={`${uid}-delim`} className="block text-sm text-slate-600">
                CSV separator
              </label>
              <select id={`${uid}-delim`} className={`${inputCls} mt-1`} value={options.delimiter} onChange={(e) => set("delimiter", e.target.value as ConvertOptions["delimiter"])}>
                <option value=",">Comma</option>
                <option value=";">Semicolon (Excel in many European locales)</option>
                <option value={"\t"}>Tab</option>
              </select>
            </div>
          )}
          <div>
            <label htmlFor={`${uid}-sep`} className="block text-sm text-slate-600">
              List separator {fromCsv ? "(for columns named like tags[])" : "(joins simple lists)"}
            </label>
            <input id={`${uid}-sep`} className={`${inputCls} mt-1 font-mono`} value={options.listSeparator} maxLength={5} onChange={(e) => set("listSeparator", e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 text-sm text-slate-700 sm:flex-row sm:flex-wrap sm:gap-6">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className={`h-4 w-4 rounded ${focusRing}`} checked={options.detectTypes} onChange={(e) => set("detectTypes", e.target.checked)} />
            Detect numbers, true/false and empty (null)
          </label>
          {fromCsv && (
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" className={`h-4 w-4 rounded ${focusRing}`} checked={options.nest} onChange={(e) => set("nest", e.target.checked)} />
              Nest dotted headers (address.city)
            </label>
          )}
          {options.to === "xml" && (
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" className={`h-4 w-4 rounded ${focusRing}`} checked={options.xmlAttributes} onChange={(e) => set("xmlAttributes", e.target.checked)} />
              Write simple values as attributes
            </label>
          )}
          {options.to === "csv" && (
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" className={`h-4 w-4 rounded ${focusRing}`} checked={options.bom} onChange={(e) => set("bom", e.target.checked)} />
              Add a BOM (helps Excel read accents)
            </label>
          )}
        </div>
        <details className="mt-4 text-sm text-slate-700">
          <summary className={`cursor-pointer rounded font-semibold text-navy ${focusRing}`}>How nested data maps to a table</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Nested objects become dotted columns: {"{ address: { city: Paris } }"} ↔ a column <code>address.city</code>.</li>
            <li>Lists of plain values are joined with the list separator: [a, b] ↔ “a|b”. From CSV, name the column <code>tags[]</code> to split it back into a list.</li>
            <li>Lists of objects and nested lists cannot be table cells; they are written as JSON text in one cell, and the result says so.</li>
            <li>Only one list becomes rows (the longest one); other top-level keys are listed as not included.</li>
            <li>XML attributes become plain columns (<code>id</code>), or <code>@id</code> if a child element has the same name.</li>
            <li>CSV has no types: numbers and true/false are written as text, and null as an empty cell. TOML has no null, so empty cells are left out.</li>
          </ul>
        </details>
      </section>

      <div aria-live="polite" className="min-h-6 text-sm text-slate-700">
        {busy && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-block h-4 w-4 rounded-full border-2 border-primary border-t-transparent motion-safe:animate-spin" aria-hidden="true" />
            <span>{busy}…</span>
            {slow && (
              <button type="button" className={btnSecondary} onClick={cancel}>
                Cancel
              </button>
            )}
          </div>
        )}
        {notice && <p>{notice}</p>}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>
            <strong>This could not be converted{error.line ? ` (line ${error.line})` : ""}:</strong> {error.message}
          </p>
          <button type="button" className={`${btnSecondary} mt-2`} onClick={() => setRevive((n) => n + 1)}>
            Convert again
          </button>
        </div>
      )}

      <div aria-live="polite">
        {result && (
          <section className={card} aria-labelledby={`${uid}-out`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id={`${uid}-out`} className="text-lg font-semibold text-navy">
                {NAME[options.to]} <span className="text-sm font-normal text-slate-600">· {result.rowCount.toLocaleString("en-US")} row{result.rowCount === 1 ? "" : "s"} · {result.ms} ms</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnSecondary} onClick={copy}>
                  Copy
                </button>
                <button type="button" className={btnPrimary} onClick={() => download(result.output, `${(file?.name ?? "converted").replace(/\.[^.]+$/, "")}.${EXT[options.to]}`, MIME[options.to])}>
                  Download .{EXT[options.to]}
                </button>
              </div>
            </div>
            {result.notes.length > 0 && (
              <ul className="mt-3 space-y-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                {result.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
            {result.table && (
              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-left text-xs">
                  <caption className="sr-only">Preview of the first rows</caption>
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      {result.table.headers.map((h) => (
                        <th key={h} scope="col" className="whitespace-nowrap px-2 py-1.5 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.table.rows.slice(0, 8).map((r, i) => (
                      <tr key={i} className="border-t border-slate-200 align-top">
                        {r.map((c, j) => (
                          <td key={j} className="max-w-[16rem] truncate px-2 py-1.5 text-slate-700" title={c}>
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <pre className="mt-3 max-h-[32rem] overflow-auto rounded-xl bg-slate-900 p-4 font-mono text-xs leading-5 text-slate-100">
              <code>{shown}</code>
            </pre>
            {shown.length < result.output.length && (
              <p className="mt-2 text-xs text-slate-500">
                Showing the first {MAX_DISPLAY_CHARS.toLocaleString("en-US")} of {result.output.length.toLocaleString("en-US")} characters. Copy or download to get all of it.
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

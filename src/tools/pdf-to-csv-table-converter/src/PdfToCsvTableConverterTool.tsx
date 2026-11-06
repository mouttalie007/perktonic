"use client";

import { useEffect, useId, useRef, useState } from "react";
import { sampleAnalysis, SAMPLE_NUM_PAGES } from "../fixtures/sampleAnalysis";
import { SAMPLE_PDF_DATA_URL, SAMPLE_PDF_NAME } from "../fixtures/samplePdf";
import { MAX_BYTES, MAX_PAGES, PREVIEW_ROWS, SCAN_TOOL, TIMEOUT_MS } from "./limits";
import { checkFile } from "./logic/file";
import { ENCODINGS, csvName, tableCsv, type CsvOptions, type Delimiter, type Encoding, type Eol } from "./logic/csv";
import type { Analysis, MethodChoice, Table } from "./logic/pdfTables";
import { TAG, type AnalyseMessage, type AnalyseRequest } from "./worker/protocol";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const label = "block text-sm font-medium text-slate-700";

type Failure = { message: string; scan?: boolean };
interface TableState {
  include: boolean;
}
const initialStates = (a: Analysis): TableState[] => a.tables.map(() => ({ include: true }));
const tableLabel = (t: Table, index: number) => `Table ${index} (p${t.pages[0]}${t.pages.length > 1 ? `-${t.pages.at(-1)}` : ""})`;
const DELIMITERS: { id: Delimiter; label: string }[] = [
  { id: ",", label: "Comma ( , )" },
  { id: ";", label: "Semicolon ( ; )" },
  { id: "\t", label: "Tab" },
  { id: "|", label: "Pipe ( | )" },
];

function save(data: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Preview({ t, csv }: { t: Table; csv: string }) {
  const shown = t.rows.slice(0, PREVIEW_ROWS);
  const lines = csv.split(/\r?\n/);
  return (
    <div className="mt-2 grid gap-3 lg:grid-cols-2">
      <div className="max-h-80 overflow-auto rounded-xl border border-slate-200" tabIndex={0} role="region" aria-label={`Preview of ${t.rows.length} rows`}>
        <table dir={t.rtl ? "rtl" : "ltr"} className="min-w-full border-collapse text-xs">
          <tbody>
            {shown.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className="whitespace-nowrap border border-slate-200 px-2 py-1 text-start">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {t.rows.length > PREVIEW_ROWS && <p className="px-2 py-1 text-xs text-slate-600">… and {t.rows.length - PREVIEW_ROWS} more rows in the download.</p>}
      </div>
      <pre className="max-h-80 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono text-xs leading-5" tabIndex={0} aria-label="CSV preview" dir="auto">
        {lines.slice(0, 12).join("\n")}
        {lines.length > 13 ? `\n… ${lines.length - 13} more lines` : ""}
      </pre>
    </div>
  );
}

export default function PdfToCsvTableConverterTool() {
  const uid = useId();
  const [fileName, setFileName] = useState(SAMPLE_PDF_NAME);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [range, setRange] = useState("");
  const [method, setMethod] = useState<MethodChoice>("auto");
  const [password, setPassword] = useState("");
  const [needPassword, setNeedPassword] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(sampleAnalysis);
  const [numPages, setNumPages] = useState(SAMPLE_NUM_PAGES);
  const [states, setStates] = useState<TableState[]>(() => initialStates(sampleAnalysis));
  const [isSample, setIsSample] = useState(true);
  const [delimiter, setDelimiter] = useState<Delimiter>(",");
  const [encoding, setEncoding] = useState<Encoding>("utf-8-bom");
  const [eol, setEol] = useState<Eol>("\r\n");
  const [protect, setProtect] = useState(true);
  const [combined, setCombined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);

  const stop = () => {
    worker.current?.terminate();
    worker.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setBusy(false);
    setProgress(null);
  };
  useEffect(() => () => stop(), []);

  const run = (data: ArrayBuffer, pw = password) => {
    stop();
    setBusy(true);
    setFailure(null);
    setNotice(null);
    const w = new Worker(new URL("./worker/analyse.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    timer.current = setTimeout(() => {
      stop();
      setFailure({ message: `Stopped after ${TIMEOUT_MS / 1000} seconds. Try a smaller page range.` });
    }, TIMEOUT_MS);
    w.onmessage = (e: MessageEvent<AnalyseMessage>) => {
      const m = e.data;
      if (!m || m.tag !== TAG) return;
      if (m.type === "opened") setProgress({ done: 0, total: m.pages });
      else if (m.type === "progress") setProgress({ done: m.done, total: m.total });
      else if (m.type === "error") {
        stop();
        if (m.code === "password_required" || m.code === "password_wrong") setNeedPassword(true);
        setFailure({ message: m.message });
      } else {
        stop();
        setNeedPassword(false);
        if (m.analysis.textless) {
          setFailure({ message: "This PDF has no text layer: it looks like a scan or a photo. This tool reads text-based PDFs only.", scan: true });
          return;
        }
        setAnalysis(m.analysis);
        setNumPages(m.numPages);
        setStates(initialStates(m.analysis));
        setIsSample(false);
        if (!m.analysis.tables.length) setNotice("No table was found on the pages read. Try the other detection method, or check the page range.");
        setTimeout(() => heading.current?.focus(), 0);
      }
    };
    w.onerror = () => {
      stop();
      setFailure({ message: "The PDF reader stopped unexpectedly. Try again, or try a smaller page range." });
    };
    const req: AnalyseRequest = { bytes: data.slice(0), password: pw, range, method };
    w.postMessage(req, [req.bytes]);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFailure(null);
    setNeedPassword(false);
    setPassword("");
    const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    const problem = checkFile(file.name, file.size, head);
    if (problem) return setFailure({ message: problem, scan: /image/.test(problem) });
    const data = await file.arrayBuffer();
    setFileName(file.name);
    setBytes(data);
    run(data, "");
  };

  const cancel = () => {
    stop();
    setNotice("Cancelled. The previous result is still shown.");
  };

  const tables = analysis?.tables ?? [];
  const opts: CsvOptions = { delimiter, eol, protect };
  const selected = tables.map((table, i) => ({ table, index: i + 1 })).filter((_, i) => states[i]?.include);

  const download = async () => {
    if (!selected.length) return setNotice("Tick at least one table to download.");
    const { buildOutput } = await import("./logic/files");
    const out = buildOutput(selected, { ...opts, encoding, combined, base: fileName });
    save(out.bytes, out.name, out.type);
    const what = combined ? "one combined CSV" : selected.length === 1 ? "one CSV file" : `a ZIP with ${selected.length} CSV files`;
    setNotice(`Downloaded ${what}.${out.replaced ? ` ${out.replaced} character${out.replaced === 1 ? "" : "s"} cannot be written in ${ENCODINGS.find((e) => e.id === encoding)?.label} and became "?". Choose UTF-8 to keep them.` : ""}`);
  };

  const copy = async (t: Table) => {
    try {
      await navigator.clipboard.writeText(tableCsv(t, opts));
      setNotice("CSV copied.");
    } catch {
      setNotice("Your browser blocked clipboard access. Use the download instead.");
    }
  };

  const setState = (i: number, patch: Partial<TableState>) => setStates((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const pagesWithTables = new Set(tables.flatMap((t) => t.pages)).size;

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <h2 id={`${uid}-in`} className="text-lg font-semibold">
          PDF file
        </h2>
        <div className="mt-3 space-y-4">
          <div>
            <label htmlFor={`${uid}-f`} className={label}>
              Choose a PDF <span className="font-normal text-slate-600">(up to {MAX_BYTES / 1024 / 1024} MB and {MAX_PAGES} pages)</span>
            </label>
            <input id={`${uid}-f`} type="file" accept=".pdf,application/pdf" className={`mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold ${focusRing}`} onChange={(e) => void onFile(e.target.files?.[0])} disabled={busy} />
            <p className="mt-1 text-xs text-slate-600">The PDF is read in your browser and is never uploaded.{fileName && ` Current file: ${fileName}.`}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-r`} className={label}>
                Pages <span className="font-normal text-slate-600">(optional, e.g. 1-3, 5)</span>
              </label>
              <input id={`${uid}-r`} className={`${inputCls} mt-1`} value={range} onChange={(e) => setRange(e.target.value)} placeholder="All pages" />
            </div>
            <div>
              <label htmlFor={`${uid}-m`} className={label}>
                How to find tables
              </label>
              <select id={`${uid}-m`} className={`${inputCls} mt-1`} value={method} onChange={(e) => setMethod(e.target.value as MethodChoice)}>
                <option value="auto">Automatic</option>
                <option value="ruled">Ruled lines only (tables with borders)</option>
                <option value="aligned">Text alignment only (tables without borders)</option>
              </select>
            </div>
          </div>
          {needPassword && (
            <div className="sm:w-1/2">
              <label htmlFor={`${uid}-p`} className={label}>
                PDF password
              </label>
              <input id={`${uid}-p`} type="password" autoComplete="off" className={`${inputCls} mt-1`} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={btnPrimary} disabled={busy || !bytes} onClick={() => bytes && run(bytes)}>
              {needPassword ? "Open with password" : "Find tables again"}
            </button>
            {busy ? (
              <button type="button" className={btnSecondary} onClick={cancel}>
                Cancel
              </button>
            ) : (
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  stop();
                  setFileName(SAMPLE_PDF_NAME);
                  setBytes(null);
                  setRange("");
                  setMethod("auto");
                  setNeedPassword(false);
                  setAnalysis(sampleAnalysis);
                  setNumPages(SAMPLE_NUM_PAGES);
                  setStates(initialStates(sampleAnalysis));
                  setIsSample(true);
                  setFailure(null);
                  setNotice(null);
                }}
              >
                Try an example
              </button>
            )}
            {!busy && analysis && (
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  setFileName("");
                  setBytes(null);
                  setAnalysis(null);
                  setStates([]);
                  setIsSample(false);
                  setFailure(null);
                  setNotice(null);
                }}
              >
                Clear
              </button>
            )}
            <a href={SAMPLE_PDF_DATA_URL} download={SAMPLE_PDF_NAME} className={`text-sm font-semibold text-primary underline-offset-2 hover:underline ${focusRing} rounded`}>
              Download the sample PDF
            </a>
          </div>
          {busy && (
            <div aria-live="polite">
              <p className="text-sm text-slate-700">{progress ? `Reading page ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…` : "Opening the PDF…"}</p>
              <progress className="mt-1 h-2 w-full accent-primary" max={progress?.total ?? 1} value={progress?.done ?? 0} />
            </div>
          )}
        </div>
      </section>

      {failure && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p>{failure.message}</p>
          {failure.scan && (
            <p className="mt-1">
              Use the{" "}
              <a href={SCAN_TOOL} className="font-semibold underline">
                Scanned Table to Spreadsheet tool
              </a>
              , which reads scans with OCR in your browser.
            </p>
          )}
        </div>
      )}

      <section className={`${card} min-h-64`} aria-labelledby={`${uid}-out`} aria-busy={busy}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={`${uid}-out`} ref={heading} tabIndex={-1} className="text-lg font-semibold focus:outline-none">
            Tables found
          </h2>
          {isSample && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Example result (sample PDF)</span>}
        </div>
        <div aria-live="polite" className="mt-2 space-y-1 text-sm text-slate-700">
          {analysis ? (
            <p>
              {tables.length} table{tables.length === 1 ? "" : "s"} on {pagesWithTables} of {analysis.pagesRead.length} page{analysis.pagesRead.length === 1 ? "" : "s"} read ({numPages} in the file). Complex layouts need checking in the preview.
            </p>
          ) : (
            <p>No PDF yet. Choose a text-based PDF above (an invoice, a statement, a report) or press Try an example; its tables appear here with a preview.</p>
          )}
          {notice && <p>{notice}</p>}
        </div>
        {tables.length > 0 && (
          <div className="mt-4 space-y-4 border-y border-slate-100 py-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor={`${uid}-d`} className={label}>
                  Delimiter
                </label>
                <select id={`${uid}-d`} className={`${inputCls} mt-1`} value={delimiter} onChange={(e) => setDelimiter(e.target.value as Delimiter)}>
                  {DELIMITERS.map((d) => (
                    <option key={d.label} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${uid}-e`} className={label}>
                  Encoding
                </label>
                <select id={`${uid}-e`} className={`${inputCls} mt-1`} value={encoding} onChange={(e) => setEncoding(e.target.value as Encoding)}>
                  {ENCODINGS.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${uid}-l`} className={label}>
                  Line endings
                </label>
                <select id={`${uid}-l`} className={`${inputCls} mt-1`} value={eol} onChange={(e) => setEol(e.target.value as Eol)}>
                  <option value={"\r\n"}>CRLF (Windows, Excel)</option>
                  <option value={"\n"}>LF (macOS, Linux)</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={protect} onChange={(e) => setProtect(e.target.checked)} />
                Protect against spreadsheet formulas
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={combined} onChange={(e) => setCombined(e.target.checked)} />
                One combined CSV (with a &quot;table&quot; column) instead of a ZIP
              </label>
              <button type="button" className={`${btnPrimary} sm:ml-auto`} onClick={() => void download()} disabled={busy}>
                {combined || selected.length === 1 ? "Download CSV" : "Download ZIP of CSV files"}
              </button>
            </div>
          </div>
        )}
        <ul className="mt-4 space-y-6">
          {tables.map((t, i) => (
            <li key={i}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={states[i]?.include ?? false} onChange={(e) => setState(i, { include: e.target.checked })} />
                  {tableLabel(t, i + 1)}
                  <span className="font-normal text-slate-600"> → {csvName(t, i + 1)}</span>
                  <span className="font-normal text-slate-600">
                    · {t.rows.length} rows × {t.rows[0]?.length ?? 0} columns
                  </span>
                </label>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${t.method === "ruled" ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-950"}`}>{t.method === "ruled" ? "Ruled lines: cell borders found" : "Text alignment: check the columns"}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                {t.pages.length > 1 && (
                  <span className="text-slate-700">
                    Continued over pages {t.pages.join(", ")}
                    {t.droppedHeaders > 0 && ` (repeated header removed ${t.droppedHeaders} time${t.droppedHeaders === 1 ? "" : "s"})`}
                  </span>
                )}
                {t.merges.length > 0 && <span className="text-slate-700">Merged cells: {t.merges.length}</span>}
                <button type="button" className={`ml-auto ${btnSecondary}`} onClick={() => void copy(t)}>
                  Copy
                </button>
              </div>
              <Preview t={t} csv={tableCsv(t, opts)} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

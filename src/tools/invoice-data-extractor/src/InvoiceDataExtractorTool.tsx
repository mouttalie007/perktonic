"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SAMPLE_FILE_NAME, sampleInput } from "../fixtures/sampleInput";
import { sampleResult } from "../fixtures/sampleResult";
import { AI_REQUESTS, LIMIT_TEXT, MAX_BYTES, MAX_FILES, MAX_PDF_PAGES, MAX_TEXT_CHARS, RETENTION } from "./limits";
import { maskAccounts } from "./logic/mask";
import { LANGUAGES, type LangId } from "./ocr/engine";
import type { Recognise } from "./ocr/types";
import type { ApiResponse, ArithmeticCheck, Checked, CheckedAmount, InvoiceResult } from "./types";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const ENDPOINT = "/api/tools/invoice-data-extractor";
const label = "block text-sm font-medium text-slate-700";

interface Entry {
  id: number;
  name: string;
  state: "reading" | "ready" | "error" | "sending" | "done";
  stage?: string;
  progress?: number;
  text: string;
  source: "pdf" | "ocr";
  words?: { text: string; confidence: number }[];
  error?: string;
  result?: InvoiceResult;
}

const sampleEntry = (): Entry => ({ id: 0, name: SAMPLE_FILE_NAME, state: "done", text: sampleInput.text, source: "pdf", result: sampleResult });

function save(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Badge({ c }: { c: Checked }) {
  const cls = c.status === "verified" ? "bg-emerald-50 text-emerald-900" : c.status === "check" ? "bg-amber-100 text-amber-950" : "bg-slate-100 text-slate-700";
  const text = c.status === "verified" ? "Verified" : c.status === "check" ? "Check" : "Not found";
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`} title={c.reason}>
      {text}
      {c.ocr != null && <span className="font-normal"> · OCR {Math.round(c.ocr)}</span>}
    </span>
  );
}

const fmt = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: 2 }));

function CheckRow({ c }: { c: ArithmeticCheck }) {
  const cls = c.status === "pass" ? "text-emerald-800" : c.status === "fail" ? "font-semibold text-red-800" : "text-slate-600";
  return (
    <li className={`text-sm ${cls}`}>
      {c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : "–"} {c.label}
      {c.status === "fail" && `: expected ${fmt(c.expected)}, printed ${fmt(c.actual)} (difference ${fmt(c.difference)})`}
      {c.status === "skipped" && " (not checked: a value is missing)"}
    </li>
  );
}

function Field({ name, c }: { name: string; c: Checked | CheckedAmount }) {
  return (
    <tr className="border-t border-slate-100 align-top">
      <th scope="row" className="py-2 pr-3 text-left font-medium text-slate-700">
        {name}
      </th>
      <td className="py-2 pr-3" dir="auto">
        {c.value ?? <span className="text-slate-500">Not found</span>}
        {c.reason && <p className="mt-0.5 text-xs text-amber-900">{c.reason}</p>}
      </td>
      <td className="py-2 pr-3">
        <Badge c={c} />
      </td>
      <td className="hidden py-2 text-xs text-slate-600 md:table-cell" dir="auto">
        {c.quote && `“${c.quote.replace(/\s+/g, " ")}”`}
      </td>
    </tr>
  );
}

function Result({ r }: { r: InvoiceResult }) {
  if (r.status !== "ok")
    return (
      <div className={`rounded-xl border p-4 text-sm ${r.status === "refused" ? "border-slate-200 bg-slate-50" : "border-blue-200 bg-primary-soft"}`}>
        <p className="font-semibold">{r.status === "refused" ? "This does not look like an invoice or a receipt" : "The AI needs one more detail"}</p>
        <p className="mt-1">{r.message}</p>
      </div>
    );
  const fails = r.checks.filter((c) => c.status === "fail").length;
  return (
    <div className="space-y-5">
      <div className={`rounded-xl border p-3 text-sm ${fails ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-950"}`}>
        <p className="font-semibold">{fails ? `${fails} arithmetic check${fails === 1 ? "" : "s"} failed: the printed numbers do not add up.` : r.checks.some((c) => c.status === "pass") ? "The printed numbers add up." : "The arithmetic could not be checked (values missing)."}</p>
        <ul className="mt-1 space-y-0.5">
          {r.checks.map((c, i) => (
            <CheckRow key={i} c={c} />
          ))}
        </ul>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Invoice fields</caption>
          <tbody>
            <Field name="Vendor" c={r.vendor} />
            <Field name="Vendor tax ID" c={r.vendorTaxId} />
            <Field name="Invoice number" c={r.invoiceNumber} />
            <Field name="Invoice date" c={r.invoiceDate} />
            <Field name="Due date" c={r.dueDate} />
            <Field name="Currency" c={r.currency} />
            <Field name="Subtotal" c={r.subtotal} />
            {r.taxes.map((t, i) => (
              <Field key={i} name={`Tax ${[t.name, t.rate].filter(Boolean).join(" ")}`.trim()} c={t.amount} />
            ))}
            <Field name="Total" c={r.total} />
          </tbody>
        </table>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-700">Line items ({r.lineItems.length})</h3>
        <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200" tabIndex={0} role="region" aria-label="Line items">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-700">
              <tr>
                <th className="px-2 py-1.5">#</th>
                <th className="px-2 py-1.5">Description</th>
                <th className="px-2 py-1.5 text-right">Qty</th>
                <th className="px-2 py-1.5 text-right">Unit price</th>
                <th className="px-2 py-1.5 text-right">Amount</th>
                <th className="px-2 py-1.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {r.lineItems.map((l, i) => {
                const lineCheck = r.checks.find((c) => c.id === "line" && c.line === i + 1);
                const worst = [l.description, l.quantity, l.unitPrice, l.amount].find((c) => c.status === "check") ?? l.amount;
                return (
                  <tr key={i} className="border-t border-slate-100 align-top">
                    <td className="px-2 py-1.5 text-slate-600">{i + 1}</td>
                    <td className="px-2 py-1.5" dir="auto">
                      {l.description.value ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right" dir="auto">
                      {l.quantity.value ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right" dir="auto">
                      {l.unitPrice.value ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right" dir="auto">
                      {l.amount.value ?? "—"}
                      {lineCheck?.status === "fail" && <p className="text-xs font-semibold text-red-800">qty × price = {fmt(lineCheck.expected)}</p>}
                    </td>
                    <td className="px-2 py-1.5">
                      <Badge c={worst} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {r.notes.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-primary-soft p-3 text-sm">
          <h3 className="font-semibold">Notes</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {r.notes.map((n, i) => (
              <li key={i} dir="auto">
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-slate-600">Numbers style on this invoice: {r.numberStyle}. Amounts are shown as printed; our own code parses them and does the arithmetic.</p>
    </div>
  );
}

export default function InvoiceDataExtractorTool({ recognise }: { recognise?: Recognise }) {
  const uid = useId();
  const [entries, setEntries] = useState<Entry[]>([sampleEntry()]);
  const [selected, setSelected] = useState(0);
  const [isSample, setIsSample] = useState(true);
  const [mask, setMask] = useState(false);
  const [lang, setLang] = useState<LangId>("eng");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ message: string; retry: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const heading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => () => abort.current?.abort(), []);
  const patch = (id: number, p: Partial<Entry>) => setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...p } : e)));

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setFailure(null);
    setNotice(null);
    const kept = isSample ? [] : entries;
    const room = MAX_FILES - kept.length;
    const files = [...list].slice(0, Math.max(0, room));
    if (list.length > room) setNotice(`Up to ${MAX_FILES} files at a time: ${list.length - files.length} not added.`);
    if (!files.length) return;
    const fresh: Entry[] = files.map((f) => ({ id: nextId.current++, name: f.name, state: "reading", stage: "Opening", progress: 0, text: "", source: "pdf" }));
    setEntries([...kept, ...fresh]);
    setIsSample(false);
    setSelected(kept.length);
    const { readInvoice } = await import("./browser/read");
    for (const [i, f] of files.entries()) {
      const e = fresh[i];
      try {
        const r = await readInvoice(f, { lang, recognise, onProgress: (p, stage) => patch(e.id, { progress: p, stage }) });
        if (r.text.length > MAX_TEXT_CHARS) patch(e.id, { state: "error", error: `The text is longer than ${MAX_TEXT_CHARS.toLocaleString("en-US")} characters. This version does not split long documents.` });
        else if (r.text.replace(/\s/g, "").length < 20) patch(e.id, { state: "error", error: "Almost no text was found. For a photo, check the language and take a sharper picture." });
        else patch(e.id, { state: "ready", text: r.text, source: r.source, words: r.words });
      } catch (err) {
        patch(e.id, { state: "error", error: err instanceof Error && err.message ? err.message : "This file could not be read." });
      }
    }
  };

  const outgoing = (e: Entry) => (mask ? maskAccounts(e.text).text : e.text);
  const ready = entries.filter((e) => e.state === "ready");

  const extract = async () => {
    if (!ready.length) return;
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setFailure(null);
    setNotice(null);
    for (const e of ready) {
      if (ctrl.signal.aborted) break;
      patch(e.id, { state: "sending" });
      try {
        const res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: outgoing(e), source: e.source, words: e.words }), signal: ctrl.signal });
        const body = (await res.json().catch(() => null)) as ApiResponse | null;
        if (!body) throw new Error("bad");
        if (body.ok) patch(e.id, { state: "done", result: body.data, text: outgoing(e) });
        else {
          patch(e.id, { state: "ready" });
          setFailure({ message: body.error.message, retry: res.status === 502 || res.status === 500 });
          if (res.status === 429) break;
        }
      } catch {
        if (ctrl.signal.aborted) {
          patch(e.id, { state: "ready" });
          break;
        }
        patch(e.id, { state: "ready" });
        setFailure({ message: "Could not reach the extractor. Check your connection and try again.", retry: true });
        break;
      }
    }
    if (abort.current === ctrl) {
      abort.current = null;
      setBusy(false);
    }
    setTimeout(() => heading.current?.focus(), 0);
  };

  const cancel = () => {
    abort.current?.abort();
    abort.current = null;
    setBusy(false);
    setNotice("Cancelled. Finished invoices are kept.");
  };

  const done = entries.filter((e) => e.state === "done" && e.result).map((e) => ({ fileName: e.name, result: e.result! }));
  const exportAs = async (kind: "json" | "csv" | "xlsx") => {
    const { toCsv, toJson, toXlsx } = await import("./logic/export");
    if (kind === "json") save(toJson(done), "invoices.json", "application/json");
    else if (kind === "csv") save(toCsv(done), "invoice-lines.csv", "text/csv;charset=utf-8");
    else save(toXlsx(done) as BlobPart, "invoices.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  };
  const copy = async () => {
    const { toJson } = await import("./logic/export");
    try {
      await navigator.clipboard.writeText(toJson(done));
      setNotice("JSON copied.");
    } catch {
      setNotice("Your browser blocked clipboard access. Use the downloads instead.");
    }
  };

  const current = entries[selected] ?? entries[0];
  const masked = current ? maskAccounts(current.text).count : 0;

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <h2 id={`${uid}-in`} className="text-lg font-semibold">
          Invoices and receipts
        </h2>
        <div className="mt-3 space-y-4">
          <div>
            <label htmlFor={`${uid}-f`} className={label}>
              Add 1 to {MAX_FILES} files <span className="font-normal text-slate-600">(PDF up to {MAX_PDF_PAGES} pages, or JPG, PNG, WebP; {MAX_BYTES / 1024 / 1024} MB each)</span>
            </label>
            <input id={`${uid}-f`} type="file" multiple accept=".pdf,application/pdf,image/jpeg,image/png,image/webp" className={`mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold ${focusRing}`} onChange={(e) => void addFiles(e.target.files)} disabled={busy} />
            <p className="mt-1 text-xs text-slate-600">Files are read in your browser. {RETENTION}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-l`} className={label}>
                Language for photos and scans
              </label>
              <select id={`${uid}-l`} className={`${inputCls} mt-1`} value={lang} onChange={(e) => setLang(e.target.value as LangId)}>
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm sm:pt-6">
              <input type="checkbox" role="switch" aria-checked={mask} className={`h-4 w-4 accent-primary ${focusRing}`} checked={mask} onChange={(e) => setMask(e.target.checked)} />
              Hide account numbers before sending (IBANs and long digit runs keep their last 4 digits)
            </label>
          </div>
          {entries.length > 0 && (
            <ul className="space-y-1 text-sm">
              {entries.map((e, i) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2">
                  <button type="button" className={`truncate text-left font-medium underline-offset-2 hover:underline ${focusRing} rounded ${i === selected ? "text-primary" : ""}`} onClick={() => setSelected(i)}>
                    {e.name}
                  </button>
                  <span className="text-slate-600">
                    {e.state === "reading" && `${e.stage ?? "Reading"}… ${Math.round((e.progress ?? 0) * 100)}%`}
                    {e.state === "ready" && `Text ready (${e.source === "pdf" ? "PDF text" : "OCR"}, ${e.text.length.toLocaleString("en-US")} characters)`}
                    {e.state === "sending" && "Extracting…"}
                    {e.state === "done" && (e.result?.status === "ok" ? "Done" : "Not extracted")}
                    {e.state === "error" && <span className="text-red-800">{e.error}</span>}
                  </span>
                  {!busy && (
                    <button type="button" className={`text-xs text-slate-600 underline ${focusRing} rounded`} onClick={() => (setEntries((es) => es.filter((x) => x.id !== e.id)), setSelected(0))} aria-label={`Remove ${e.name}`}>
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            Invoices hold personal and financial data. {ready.length > 0 ? `${ready.length} file${ready.length === 1 ? " uses" : "s use"} ${ready.length} of your ${AI_REQUESTS} AI requests per 10 minutes. ` : ""}Each invoice is one request; the text is sent to our server and to the AI provider. Always verify extracted numbers before you use them.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={btnPrimary} disabled={busy || !ready.length} onClick={() => void extract()}>
              {busy ? "Extracting…" : `Extract data${ready.length ? ` (${ready.length} request${ready.length === 1 ? "" : "s"})` : ""}`}
            </button>
            {busy ? (
              <button type="button" className={btnSecondary} onClick={cancel}>
                Cancel
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    setEntries([sampleEntry()]);
                    setSelected(0);
                    setIsSample(true);
                    setFailure(null);
                    setNotice(null);
                  }}
                >
                  Try an example
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    setEntries([]);
                    setIsSample(false);
                    setFailure(null);
                    setNotice(null);
                  }}
                >
                  Clear
                </button>
              </>
            )}
          </div>
          <p className="text-xs text-slate-600">Limit: {LIMIT_TEXT}.</p>
        </div>
      </section>

      {failure && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between">
          <p>{failure.message}</p>
          {failure.retry && (
            <button type="button" className={btnSecondary} onClick={() => void extract()} disabled={busy}>
              Try again
            </button>
          )}
        </div>
      )}

      <section className={`${card} min-h-64`} aria-labelledby={`${uid}-out`} aria-busy={busy}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={`${uid}-out`} ref={heading} tabIndex={-1} className="text-lg font-semibold focus:outline-none">
            Extracted data
          </h2>
          {isSample && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Example result (nothing was sent)</span>}
          {!isSample && current?.result?.cached && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Answered from a short-lived cache</span>}
        </div>
        <div aria-live="polite" className="mt-2 text-sm text-slate-700">
          {notice && <p>{notice}</p>}
        </div>
        {!current ? (
          <p className="mt-4 text-sm text-slate-700">No invoice yet. Add a PDF or a photo of an invoice or receipt above, or press Try an example.</p>
        ) : (
          <div className="mt-3 space-y-4">
            <p className="text-sm font-medium" dir="auto">
              {current.name}
            </p>
            {current.result ? <Result r={current.result} /> : <p className="text-sm text-slate-700">{current.state === "ready" ? "Text ready: press Extract data." : current.state === "error" ? current.error : "Reading…"}</p>}
            {current.text && (
              <details className="rounded-xl border border-slate-200 p-3 text-sm">
                <summary className={`cursor-pointer font-medium ${focusRing} rounded`}>
                  Text {current.state === "done" ? "that was sent" : "that will be sent"}
                  {mask && current.state !== "done" && masked > 0 && ` (${masked} account number${masked === 1 ? "" : "s"} hidden)`}
                </summary>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5" dir="auto">
                  {current.state === "done" ? current.text : outgoing(current)}
                </pre>
              </details>
            )}
            {done.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <button type="button" className={btnPrimary} onClick={() => void exportAs("xlsx")}>
                  Download .xlsx
                </button>
                <button type="button" className={btnSecondary} onClick={() => void exportAs("csv")}>
                  Download CSV
                </button>
                <button type="button" className={btnSecondary} onClick={() => void exportAs("json")}>
                  Download JSON
                </button>
                <button type="button" className={btnSecondary} onClick={() => void copy()}>
                  Copy JSON
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

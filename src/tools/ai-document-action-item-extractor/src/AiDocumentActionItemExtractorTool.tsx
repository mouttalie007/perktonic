"use client";

import { useEffect, useId, useRef, useState } from "react";
import { sampleInput } from "../fixtures/sampleInput";
import { sampleResult } from "../fixtures/sampleResult";
import { LIMIT_TEXT, MAX_FILE_BYTES, MAX_TEXT_CHARS } from "./limits";
import { toCsv, toMarkdown } from "./logic/export";
import { decodeTextFile } from "./logic/file";
import { findQuote } from "./logic/text";
import type { ApiResponse, ExtractResult } from "./types";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const ENDPOINT = "/api/tools/ai-document-action-item-extractor";

type Failure = { message: string; retry: boolean };

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function save(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function adjustmentText(r: Extract<ExtractResult, { status: "ok" }>): string[] {
  const a = r.adjustments;
  const out: string[] = [];
  if (a.droppedQuotes) out.push(`${a.droppedQuotes} item${a.droppedQuotes === 1 ? " was" : "s were"} left out because ${a.droppedQuotes === 1 ? "its quote is" : "their quotes are"} not in your text.`);
  if (a.ownersCleared) out.push(`${a.ownersCleared} owner${a.ownersCleared === 1 ? " was" : "s were"} set to Unassigned because the name does not appear in your text.`);
  if (a.datesCleared) out.push(`${a.datesCleared} due date${a.datesCleared === 1 ? " was" : "s were"} removed (not a real date, or more than 5 years from the reference date); the deadline words are kept.`);
  if (a.datesCorrected) out.push(`${a.datesCorrected} due date${a.datesCorrected === 1 ? " was" : "s were"} recalculated from the words in the text and the reference date.`);
  return out;
}

export default function AiDocumentActionItemExtractorTool() {
  const uid = useId();
  const [text, setText] = useState(sampleInput.text);
  const [referenceDate, setReferenceDate] = useState(sampleInput.referenceDate);
  const [result, setResult] = useState<ExtractResult>(sampleResult);
  const [isSample, setIsSample] = useState(true);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const replaceText = (value: string) => {
    // The example comes with its own reference date; the visitor's own text defaults to today.
    if (text === sampleInput.text && referenceDate === sampleInput.referenceDate && value !== sampleInput.text) {
      setReferenceDate(todayLocal());
      setNotice("The reference date is now today. Change it if the text was written on another day.");
    }
    setText(value);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setFailure({ message: `The file is larger than ${MAX_FILE_BYTES / 1024} KB. This version does not split long texts: paste it in parts.`, retry: false });
    const read = decodeTextFile(file.name, new Uint8Array(await file.arrayBuffer()));
    if (!read.ok) return setFailure({ message: read.error, retry: false });
    setFailure(null);
    replaceText(read.text);
  };

  const extract = async () => {
    if (text.trim().length < 20) return setFailure({ message: "Paste the text to read (a few sentences at least).", retry: false });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) return setFailure({ message: "Set the reference date.", retry: false });
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setFailure(null);
    setNotice(null);
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, referenceDate }), signal: ctrl.signal });
      const body = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!body) throw new Error("The extractor did not answer properly. Please try again.");
      if (body.ok) {
        setResult(body.data);
        setIsSample(false);
        setTimeout(() => heading.current?.focus(), 0);
      } else setFailure({ message: body.error.message, retry: res.status === 502 || res.status === 500 });
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setFailure({ message: e instanceof Error && !(e instanceof TypeError) ? e.message : "Could not reach the extractor. Check your connection and try again.", retry: true });
    } finally {
      if (abort.current === ctrl) {
        abort.current = null;
        setBusy(false);
      }
    }
  };

  const cancel = () => {
    abort.current?.abort();
    abort.current = null;
    setBusy(false);
    setNotice("Request cancelled. The previous result is still shown.");
  };

  const showQuote = (quote: string) => {
    const at = findQuote(text, quote);
    const el = textRef.current;
    if (!at || !el) return setNotice("That sentence is no longer in the text box (the text was changed).");
    el.focus();
    el.setSelectionRange(at[0], at[1]);
    const lines = text.slice(0, at[0]).split("\n").length;
    el.scrollTop = Math.max(0, (lines - 3) * 20);
    setNotice("The sentence is selected in the text box.");
  };

  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${what} copied.`);
    } catch {
      setNotice("Your browser blocked clipboard access. Use the downloads instead.");
    }
  };

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <h2 id={`${uid}-in`} className="text-lg font-semibold">
          Text to read
        </h2>
        <form
          className="mt-3 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void extract();
          }}
        >
          <div>
            <label htmlFor={`${uid}-t`} className="block text-sm font-medium text-slate-700">
              Meeting notes, e-mail thread or minutes
            </label>
            <textarea id={`${uid}-t`} ref={textRef} dir="auto" className={`${inputCls} mt-1 min-h-56 leading-5`} value={text} maxLength={MAX_TEXT_CHARS} onChange={(e) => replaceText(e.target.value)} placeholder="Paste the text here" aria-describedby={`${uid}-tc`} />
            <p id={`${uid}-tc`} className="mt-1 text-xs text-slate-600">
              {text.length.toLocaleString("en-US")} / {MAX_TEXT_CHARS.toLocaleString("en-US")} characters. Longer texts are not split in this version: send them in parts.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-f`} className="block text-sm font-medium text-slate-700">
                Or open a .txt or .md file <span className="font-normal text-slate-600">(read in your browser)</span>
              </label>
              <input id={`${uid}-f`} type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" className={`mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold ${focusRing}`} onChange={(e) => void onFile(e.target.files?.[0])} />
            </div>
            <div>
              <label htmlFor={`${uid}-d`} className="block text-sm font-medium text-slate-700">
                Reference date <span className="font-normal text-slate-600">(what “today” means in the text)</span>
              </label>
              <div className="mt-1 flex gap-2">
                <input id={`${uid}-d`} type="date" className={inputCls} value={referenceDate} onChange={(e) => setReferenceDate(e.target.value)} />
                <button type="button" className={btnSecondary} onClick={() => setReferenceDate(todayLocal())}>
                  Today
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className={btnPrimary} disabled={busy}>
              {busy ? "Reading…" : "Extract action items"}
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
                  setText(sampleInput.text);
                  setReferenceDate(sampleInput.referenceDate);
                  setResult(sampleResult);
                  setIsSample(true);
                  setFailure(null);
                  setNotice(null);
                }}
              >
                Try an example
              </button>
            )}
          </div>
          <p className="text-xs text-slate-600">When you press Extract action items, the text and the reference date are sent to our server and to the AI provider. Files are read in your browser first. Limit: {LIMIT_TEXT}.</p>
        </form>
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
            Action items
          </h2>
          {isSample && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Example result (nothing was sent)</span>}
          {!isSample && result.cached && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Answered from a short-lived cache</span>}
        </div>
        <div aria-live="polite" className="mt-3 space-y-4">
          {busy && <p className="text-sm text-slate-700">Reading the text… this can take up to half a minute for long notes.</p>}
          {notice && <p className="text-sm text-slate-700">{notice}</p>}
          {result.status === "ok" ? (
            <>
              <p className="text-sm text-slate-800">
                {result.count === 0 ? "No action items found in this text." : `${result.count} action item${result.count === 1 ? "" : "s"} found`} (dates relative to {result.referenceDate}).
              </p>
              {adjustmentText(result).length > 0 && (
                <ul role="alert" className="space-y-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  {adjustmentText(result).map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              )}
              {result.count > 0 && (
                <>
                  <ol className="space-y-3 sm:hidden">
                    {result.items.map((item, i) => (
                      <li key={i} className="rounded-xl border border-slate-200 p-3 text-sm">
                        <p dir="auto" className="text-start font-semibold">
                          {item.task}
                        </p>
                        <p className="mt-1 text-slate-700">
                          Owner: <bdi>{item.owner ?? "Unassigned"}</bdi>
                          {" · "}Due: {item.dueDate ?? "—"}
                          {item.dueText && (
                            <>
                              {" "}
                              (<bdi>{item.dueText}</bdi>)
                            </>
                          )}
                        </p>
                        <button type="button" dir="auto" className={`mt-1 rounded text-start text-xs text-primary-dark underline decoration-dotted underline-offset-2 ${focusRing}`} onClick={() => showQuote(item.quote)}>
                          {item.quote}
                        </button>
                      </li>
                    ))}
                  </ol>
                  <div role="region" aria-label="Action items table" tabIndex={0} className={`hidden overflow-x-auto rounded-lg sm:block ${focusRing}`}>
                    <table className="w-full min-w-[40rem] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-600">
                          <th className="py-2 pr-3 font-medium">Task</th>
                          <th className="py-2 pr-3 font-medium">Owner</th>
                          <th className="py-2 pr-3 font-medium">Due</th>
                          <th className="py-2 font-medium">Quote</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.items.map((item, i) => (
                          <tr key={i} className="border-b border-slate-100 align-top">
                            <td dir="auto" className="py-2 pr-3 text-start">
                              {item.task}
                            </td>
                            <td dir="auto" className="py-2 pr-3 text-start">
                              {item.owner ?? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">Unassigned</span>}
                            </td>
                            <td className="whitespace-nowrap py-2 pr-3">
                              {item.dueDate ?? "—"}
                              {item.dueText && (
                                <span dir="auto" className="block whitespace-normal text-xs text-slate-600">
                                  “{item.dueText}”
                                </span>
                              )}
                            </td>
                            <td className="py-2">
                              <button type="button" dir="auto" className={`rounded text-start text-xs text-primary-dark underline decoration-dotted underline-offset-2 hover:decoration-solid ${focusRing}`} onClick={() => showQuote(item.quote)} title="Select this sentence in the text">
                                {item.quote}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <button type="button" className={btnSecondary} onClick={() => save(toCsv(result.items), "action-items.csv", "text/csv;charset=utf-8")}>
                      Download CSV
                    </button>
                    <button type="button" className={btnSecondary} onClick={() => save(toMarkdown(result.items), "action-items.md", "text/markdown;charset=utf-8")}>
                      Download Markdown checklist
                    </button>
                    <button type="button" className={btnSecondary} onClick={() => void copy(toMarkdown(result.items), "Checklist")}>
                      Copy checklist
                    </button>
                  </div>
                </>
              )}
              <p className="text-xs text-slate-600">Owners and deadlines are only shown when they appear in the text; quotes are checked against your text on our server.</p>
            </>
          ) : (
            <div className={`rounded-xl border p-4 text-sm ${result.status === "refused" ? "border-slate-200 bg-slate-50" : "border-blue-200 bg-primary-soft"}`}>
              <p className="font-semibold">{result.status === "refused" ? "This does not look like a document with tasks" : "The AI needs one more detail"}</p>
              <p className="mt-1">{result.message}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

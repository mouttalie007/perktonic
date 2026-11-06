"use client";

import { useEffect, useId, useRef, useState } from "react";
import { sampleInput } from "../fixtures/sampleInput";
import { sampleResult } from "../fixtures/sampleResult";
import { DISCLAIMER, LIMIT_TEXT, MAX_FILE_BYTES, MAX_FOCUS_CHARS, MAX_TEXT_CHARS } from "./limits";
import { decodeText, limitText, sniff } from "./logic/docFile";
import { categoryLabel, clauseText, formatNormalised, groupTerms, toCsv, toMarkdownChecklist, toPlainText } from "./logic/render";
import { findQuote } from "./logic/text";
import type { ApiResponse, ExtractResult, Term } from "./types";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const ENDPOINT = "/api/tools/contract-key-terms-extractor";

type Failure = { message: string; retry: boolean };

function save(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ContractKeyTermsExtractorTool() {
  const uid = useId();
  const [text, setText] = useState(sampleInput.text);
  const [focus, setFocus] = useState(sampleInput.focus);
  const [result, setResult] = useState<ExtractResult>(sampleResult);
  const [isSample, setIsSample] = useState(true);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const area = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFailure(null);
    if (file.size > MAX_FILE_BYTES) return setFailure({ message: `The file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB. This version does not split long documents: paste the contract in parts.`, retry: false });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniff(file.name, bytes.subarray(0, 8), { md: false, docx: true });
    if (kind.error) return setFailure({ message: kind.error, retry: false });
    let raw: string;
    if (kind.kind === "docx") {
      setReading(true);
      try {
        const { readDocx } = await import("./logic/readDocx");
        raw = await readDocx(bytes);
      } catch {
        return setFailure({ message: "This Word file could not be read. Open it in Word, save it again as .docx, or copy the text and paste it.", retry: false });
      } finally {
        setReading(false);
      }
    } else {
      const dec = decodeText(bytes);
      if (!dec.ok) return setFailure({ message: dec.error, retry: false });
      raw = dec.text;
    }
    const lim = limitText(raw, MAX_TEXT_CHARS);
    if (!lim.ok) return setFailure({ message: lim.error, retry: false });
    setText(lim.text);
    setNotice(`${file.name} opened (${lim.text.length.toLocaleString("en-US")} characters).`);
  };

  const extract = async () => {
    if (text.trim().length < 100) return setFailure({ message: "Paste the contract text (at least a few clauses).", retry: false });
    if (text.length > MAX_TEXT_CHARS) return setFailure({ message: `The contract is longer than ${MAX_TEXT_CHARS.toLocaleString("en-US")} characters. This version does not split long documents: paste it in parts.`, retry: false });
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setFailure(null);
    setNotice(null);
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, focus }), signal: ctrl.signal });
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

  /** Select the quoted clause in the contract box so the visitor sees it in context. */
  const showInText = (t: Term) => {
    const el = area.current;
    const at = findQuote(text, t.quote);
    if (!el || !at) return setNotice("This quote could not be located in the current text (it may have been edited).");
    el.focus();
    el.setSelectionRange(at[0], at[1]);
    const before = text.slice(0, at[0]).split("\n").length - 1;
    el.scrollTop = Math.max(0, before * 20 - el.clientHeight / 3);
    setNotice(`Clause highlighted in the contract box: ${t.label}.`);
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Key terms copied.");
    } catch {
      setNotice("Your browser blocked clipboard access. Use the downloads instead.");
    }
  };

  const over = text.length > MAX_TEXT_CHARS;
  const adj = result.status === "ok" ? result.adjustments : null;

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <h2 id={`${uid}-in`} className="text-lg font-semibold">
          Contract
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
              Contract text
            </label>
            <textarea ref={area} id={`${uid}-t`} dir="auto" className={`${inputCls} mt-1 min-h-64 font-mono leading-5`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a contract, lease, NDA or terms of service" aria-describedby={`${uid}-tc`} aria-invalid={over || undefined} />
            <p id={`${uid}-tc`} className={`mt-1 text-xs ${over ? "font-semibold text-red-800" : "text-slate-600"}`}>
              {text.length.toLocaleString("en-US")} / {MAX_TEXT_CHARS.toLocaleString("en-US")} characters.{" "}
              {over ? "Too long: this version does not split long documents, so paste it in parts." : "Longer contracts are not split in this version: paste them in parts."}
            </p>
          </div>
          <div>
            <label htmlFor={`${uid}-f`} className="block text-sm font-medium text-slate-700">
              Or open a .txt or .docx file <span className="font-normal text-slate-600">(read in your browser; for a PDF, copy the text and paste it)</span>
            </label>
            <input id={`${uid}-f`} type="file" accept=".txt,.docx,.pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf" className={`mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold ${focusRing}`} onChange={(e) => void onFile(e.target.files?.[0])} />
            {reading && <p className="mt-1 text-xs text-slate-700">Reading the Word file…</p>}
          </div>
          <div>
            <label htmlFor={`${uid}-q`} className="block text-sm font-medium text-slate-700">
              Anything specific to look for? <span className="font-normal text-slate-600">(optional)</span>
            </label>
            <input id={`${uid}-q`} type="text" maxLength={MAX_FOCUS_CHARS} className={`${inputCls} mt-1`} value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. notice periods, penalties, who owns the data" aria-describedby={`${uid}-qc`} />
            <p id={`${uid}-qc`} className="mt-1 text-xs text-slate-600">
              {focus.length} / {MAX_FOCUS_CHARS} characters. The tool lists what the text says; it does not judge whether a clause is valid or fair.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className={btnPrimary} disabled={busy || reading}>
              {busy ? "Extracting…" : "Extract key terms"}
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
                  setFocus(sampleInput.focus);
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
          <p className="text-xs text-slate-600">Remove names and amounts you do not want to send; the text goes to our server and to the AI provider. Files are read in your browser first. Limit: {LIMIT_TEXT}.</p>
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
            Key terms
          </h2>
          {isSample && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Example result (nothing was sent)</span>}
          {!isSample && result.cached && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Answered from a short-lived cache</span>}
        </div>
        <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-950">{DISCLAIMER}</p>
        <div aria-live="polite" className="mt-3 space-y-4">
          {busy && <p className="text-sm text-slate-700">Reading the contract… this can take up to half a minute for long contracts.</p>}
          {notice && <p className="text-sm text-slate-700">{notice}</p>}
          {result.notes.length > 0 && result.status !== "ok" && (
            <ul className="space-y-1 text-sm text-slate-800">
              {result.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
          {result.status === "ok" ? (
            <>
              {adj && adj.droppedQuotes + adj.normalisedCleared + adj.clauseRefsCleared > 0 && (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                  Checked against your text:{" "}
                  {[
                    adj.droppedQuotes > 0 && `${adj.droppedQuotes} term${adj.droppedQuotes === 1 ? "" : "s"} removed because the quote is not in the contract`,
                    adj.normalisedCleared > 0 && `${adj.normalisedCleared} date or amount${adj.normalisedCleared === 1 ? "" : "s"} not written in the clause left blank`,
                    adj.clauseRefsCleared > 0 && `${adj.clauseRefsCleared} clause number${adj.clauseRefsCleared === 1 ? "" : "s"} not found removed`,
                  ]
                    .filter(Boolean)
                    .join("; ")}
                  .
                </p>
              )}
              {result.notes.length > 0 && (
                <div className="rounded-xl border border-blue-200 bg-primary-soft p-3 text-sm">
                  <h3 className="font-semibold">Notes</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {result.notes.map((n, i) => (
                      <li key={i} dir="auto">
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.terms.length === 0 && <p className="text-sm text-slate-700">No key terms were found in this text.</p>}
              {groupTerms(result.terms).map((g) => (
                <div key={g.id}>
                  <h3 className="text-sm font-semibold text-slate-700">{g.label}</h3>
                  <ul className="mt-2 space-y-2">
                    {g.terms.map((t, i) => (
                      <li key={i} className="rounded-xl border border-slate-200 p-3 text-sm">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <p dir="auto" className="min-w-0 break-words">
                            <span className="font-semibold">{t.label}:</span> {t.value}
                          </p>
                          <span className="flex flex-wrap gap-1 text-xs">
                            {t.clauseRef && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700">{clauseText(t.clauseRef)}</span>}
                            {t.normalised !== null && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">{formatNormalised(t.normalised)}</span>}
                          </span>
                        </div>
                        <p dir="auto" className="mt-1 break-words border-l-2 border-slate-200 pl-2 text-xs text-slate-600">
                          “{t.quote.replace(/\s+/g, " ")}”
                        </p>
                        <button type="button" className={`mt-2 text-xs font-semibold text-primary underline-offset-2 hover:underline ${focusRing} rounded`} onClick={() => showInText(t)}>
                          Show in the contract
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {result.notFound.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Not found in this text</h3>
                  <p className="mt-1 text-sm text-slate-700">{result.notFound.map(categoryLabel).join(" · ")}</p>
                  <p className="mt-1 text-xs text-slate-600">Nothing is filled in for these: check the full contract and its annexes.</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <button type="button" className={btnSecondary} onClick={() => void copy(toPlainText(result.terms, result.notFound))}>
                  Copy
                </button>
                <button type="button" className={btnSecondary} onClick={() => save(toCsv(result.terms), "contract-key-terms.csv", "text/csv;charset=utf-8")}>
                  Download CSV
                </button>
                <button type="button" className={btnSecondary} onClick={() => save(toMarkdownChecklist(result.terms, result.notFound, result.notes), "contract-checklist.md", "text/markdown;charset=utf-8")}>
                  Download checklist (Markdown)
                </button>
              </div>
            </>
          ) : (
            <div className={`rounded-xl border p-4 text-sm ${result.status === "refused" ? "border-slate-200 bg-slate-50" : "border-blue-200 bg-primary-soft"}`}>
              <p className="font-semibold">{result.status === "refused" ? "This does not look like a contract" : "The AI needs one more detail"}</p>
              <p className="mt-1">{result.message}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

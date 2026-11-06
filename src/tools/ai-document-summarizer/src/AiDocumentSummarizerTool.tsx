"use client";

import { useEffect, useId, useRef, useState } from "react";
import { sampleInput } from "../fixtures/sampleInput";
import { sampleResult } from "../fixtures/sampleResult";
import { LENGTHS, LIMIT_TEXT, MAX_FILE_BYTES, MAX_TEXT_CHARS, TONES, type LengthId, type ToneId } from "./limits";
import { decodeText, limitText, sniff } from "./logic/docFile";
import { markFigures, toMarkdown, toPlainText } from "./logic/render";
import type { ApiResponse, Figure, SummaryResult } from "./types";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const ENDPOINT = "/api/tools/ai-document-summarizer";
const chip = (on: boolean) => `flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${on ? "border-primary bg-primary-soft" : "border-slate-300"}`;

type Failure = { message: string; retry: boolean };

function save(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Marked({ text, figures }: { text: string; figures: Figure[] }) {
  return (
    <>
      {markFigures(text, figures).map((p, i) =>
        p.missing ? (
          <mark key={i} className="rounded bg-amber-200 px-0.5 text-amber-950" title="Not found in your text: check it">
            {p.text}
            <span className="sr-only"> (not found in your text: check it)</span>
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

export default function AiDocumentSummarizerTool() {
  const uid = useId();
  const [text, setText] = useState(sampleInput.text);
  const [length, setLength] = useState<LengthId>(sampleInput.length);
  const [tone, setTone] = useState<ToneId>(sampleInput.tone);
  const [sections, setSections] = useState(sampleInput.sections);
  const [result, setResult] = useState<SummaryResult>(sampleResult);
  const [isSample, setIsSample] = useState(true);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFailure(null);
    if (file.size > MAX_FILE_BYTES) return setFailure({ message: `The file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB. This version does not split long documents: paste one part at a time.`, retry: false });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniff(file.name, bytes.subarray(0, 8), { md: true, docx: true });
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

  const summarise = async () => {
    if (text.trim().length < 200) return setFailure({ message: "Paste a longer text (at least a few paragraphs, 200 characters).", retry: false });
    if (text.length > MAX_TEXT_CHARS) return setFailure({ message: `The text is longer than ${MAX_TEXT_CHARS.toLocaleString("en-US")} characters. This version does not split long documents: summarise it in parts.`, retry: false });
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setFailure(null);
    setNotice(null);
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, length, tone, sections }), signal: ctrl.signal });
      const body = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!body) throw new Error("The summariser did not answer properly. Please try again.");
      if (body.ok) {
        setResult(body.data);
        setIsSample(false);
        setTimeout(() => heading.current?.focus(), 0);
      } else setFailure({ message: body.error.message, retry: res.status === 502 || res.status === 500 });
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setFailure({ message: e instanceof Error && !(e instanceof TypeError) ? e.message : "Could not reach the summariser. Check your connection and try again.", retry: true });
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

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Summary copied.");
    } catch {
      setNotice("Your browser blocked clipboard access. Use the downloads instead.");
    }
  };

  const over = text.length > MAX_TEXT_CHARS;

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <h2 id={`${uid}-in`} className="text-lg font-semibold">
          Document to summarise
        </h2>
        <form
          className="mt-3 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void summarise();
          }}
        >
          <div>
            <label htmlFor={`${uid}-t`} className="block text-sm font-medium text-slate-700">
              Text of the document
            </label>
            <textarea id={`${uid}-t`} dir="auto" className={`${inputCls} mt-1 min-h-56 leading-5`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a report, article, letter or minutes" aria-describedby={`${uid}-tc`} aria-invalid={over || undefined} />
            <p id={`${uid}-tc`} className={`mt-1 text-xs ${over ? "font-semibold text-red-800" : "text-slate-600"}`}>
              {text.length.toLocaleString("en-US")} / {MAX_TEXT_CHARS.toLocaleString("en-US")} characters.{" "}
              {over ? "Too long: this version does not split long documents, so summarise it in parts." : "Longer documents are not split in this version: summarise them in parts."}
            </p>
          </div>
          <div>
            <label htmlFor={`${uid}-f`} className="block text-sm font-medium text-slate-700">
              Or open a .txt, .md or .docx file <span className="font-normal text-slate-600">(read in your browser; for a PDF, copy the text and paste it)</span>
            </label>
            <input id={`${uid}-f`} type="file" accept=".txt,.md,.markdown,.docx,.pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf" className={`mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold ${focusRing}`} onChange={(e) => void onFile(e.target.files?.[0])} />
            {reading && <p className="mt-1 text-xs text-slate-700">Reading the Word file…</p>}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <fieldset>
              <legend className="text-sm font-medium text-slate-700">Length</legend>
              <div className="mt-2 grid gap-2">
                {LENGTHS.map((l) => (
                  <label key={l.id} className={chip(length === l.id)}>
                    <input type="radio" name={`${uid}-l`} className={`accent-primary ${focusRing}`} checked={length === l.id} onChange={() => setLength(l.id)} />
                    {l.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-medium text-slate-700">Tone</legend>
              <div className="mt-2 grid gap-2">
                {TONES.map((t) => (
                  <label key={t.id} className={chip(tone === t.id)}>
                    <input type="radio" name={`${uid}-tn`} className={`accent-primary ${focusRing}`} checked={tone === t.id} onChange={() => setTone(t.id)} />
                    {t.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" role="switch" aria-checked={sections} className={`h-4 w-4 accent-primary ${focusRing}`} checked={sections} onChange={(e) => setSections(e.target.checked)} />
            Add a section-by-section digest
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className={btnPrimary} disabled={busy || reading}>
              {busy ? "Summarising…" : "Summarise"}
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
                  setLength(sampleInput.length);
                  setTone(sampleInput.tone);
                  setSections(sampleInput.sections);
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
          <p className="text-xs text-slate-600">When you press Summarise, the text is sent to our server and to the AI provider. Files are read in your browser first. Limit: {LIMIT_TEXT}.</p>
        </form>
      </section>

      {failure && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between">
          <p>{failure.message}</p>
          {failure.retry && (
            <button type="button" className={btnSecondary} onClick={() => void summarise()} disabled={busy}>
              Try again
            </button>
          )}
        </div>
      )}

      <section className={`${card} min-h-64`} aria-labelledby={`${uid}-out`} aria-busy={busy}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={`${uid}-out`} ref={heading} tabIndex={-1} className="text-lg font-semibold focus:outline-none">
            Summary
          </h2>
          {isSample && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Example result (nothing was sent)</span>}
          {!isSample && result.cached && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Answered from a short-lived cache</span>}
        </div>
        <div aria-live="polite" className="mt-3 space-y-4">
          {busy && <p className="text-sm text-slate-700">Reading and summarising… this can take up to half a minute for long documents.</p>}
          {notice && <p className="text-sm text-slate-700">{notice}</p>}
          {result.status === "ok" ? (
            <>
              <p className="text-sm text-slate-700">
                Original: {result.stats.originalWords.toLocaleString("en-US")} words · Summary: {result.stats.summaryWords.toLocaleString("en-US")} words · {result.stats.reductionPercent}% shorter
              </p>
              {(result.unverifiedFigures > 0 || result.unverifiedQuotes > 0) && (
                <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  {result.unverifiedFigures > 0 && `${result.unverifiedFigures} figure${result.unverifiedFigures === 1 ? " is" : "s are"} not found in your text and ${result.unverifiedFigures === 1 ? "is" : "are"} highlighted: check ${result.unverifiedFigures === 1 ? "it" : "them"}. `}
                  {result.unverifiedQuotes > 0 && `${result.unverifiedQuotes} key point${result.unverifiedQuotes === 1 ? "'s quote" : "s' quotes"} could not be found in your text (marked “not verified”).`}
                </p>
              )}
              <div dir="auto" className="space-y-3 text-sm leading-relaxed text-slate-800">
                {result.summary.split(/\n\s*\n/).map((p, i) => (
                  <p key={i}>
                    <Marked text={p} figures={result.summaryFigures} />
                  </p>
                ))}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Key points</h3>
                <ul className="mt-2 space-y-2">
                  {result.keyPoints.map((k, i) => (
                    <li key={i} className="rounded-xl border border-slate-200 p-3 text-sm">
                      <p dir="auto">
                        <Marked text={k.text} figures={k.figures} />
                        {!k.verified && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">not verified</span>}
                      </p>
                      <p dir="auto" className="mt-1 border-l-2 border-slate-200 pl-2 text-xs text-slate-600">
                        “{k.quote.replace(/\s+/g, " ")}”
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
              {result.sections.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Section by section</h3>
                  <dl className="mt-2 space-y-3 text-sm">
                    {result.sections.map((s, i) => (
                      <div key={i}>
                        <dt dir="auto" className="font-semibold">
                          {s.heading}
                        </dt>
                        <dd dir="auto" className="mt-0.5 text-slate-800">
                          <Marked text={s.summary} figures={s.figures} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <button type="button" className={btnSecondary} onClick={() => void copy(toPlainText(result))}>
                  Copy
                </button>
                <button type="button" className={btnSecondary} onClick={() => save(toMarkdown(result), "summary.md", "text/markdown;charset=utf-8")}>
                  Download Markdown
                </button>
                <button type="button" className={btnSecondary} onClick={() => save(toPlainText(result), "summary.txt", "text/plain;charset=utf-8")}>
                  Download text
                </button>
              </div>
            </>
          ) : (
            <div className={`rounded-xl border p-4 text-sm ${result.status === "refused" ? "border-slate-200 bg-slate-50" : "border-blue-200 bg-primary-soft"}`}>
              <p className="font-semibold">{result.status === "refused" ? "This does not look like a document to summarise" : "The AI needs one more detail"}</p>
              <p className="mt-1">{result.message}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

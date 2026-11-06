"use client";

import { useEffect, useId, useRef, useState } from "react";
import { sampleInput } from "../fixtures/sampleInput";
import { sampleResult } from "../fixtures/sampleResult";
import { LANGUAGES, LIMIT_TEXT, MAX_FILE_BYTES, MAX_TITLE_CHARS, MAX_TRANSCRIPT_CHARS, RECORDING_NOTE, type LanguageId } from "./limits";
import { decodeText, limitText, sniff } from "./logic/docFile";
import { toActionsCsv, toChecklist, toMarkdown, toPlainText } from "./logic/render";
import { detectFormat, normaliseTranscript } from "./logic/transcript";
import type { ApiResponse, MinutesResult } from "./types";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const ENDPOINT = "/api/tools/meeting-minutes-generator-from-transcript";
const label = "block text-sm font-medium text-slate-700";

const todayIso = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function save(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function MeetingMinutesGeneratorFromTranscriptTool() {
  const uid = useId();
  const [transcript, setTranscript] = useState(sampleInput.transcript);
  const [title, setTitle] = useState(sampleInput.title);
  const [date, setDate] = useState(sampleInput.date);
  const [language, setLanguage] = useState<LanguageId>(sampleInput.language);
  const [referenceDate, setReferenceDate] = useState(sampleInput.referenceDate);
  const [timestamps, setTimestamps] = useState(false);
  const [result, setResult] = useState<MinutesResult>(sampleResult);
  const [isSample, setIsSample] = useState(true);
  const [failure, setFailure] = useState<{ message: string; retry: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const touched = useRef(false);

  useEffect(() => () => abort.current?.abort(), []);

  // The sample has its own reference date; the visitor's own transcript is counted from today.
  const touch = () => {
    if (!touched.current) {
      touched.current = true;
      setReferenceDate(todayIso());
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFailure(null);
    touch();
    if (file.size > MAX_FILE_BYTES) return setFailure({ message: `The file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB.`, retry: false });
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
        return setFailure({ message: "This Word file could not be read. Save it again as .docx, or copy the text and paste it.", retry: false });
      } finally {
        setReading(false);
      }
    } else {
      const dec = decodeText(bytes);
      if (!dec.ok) return setFailure({ message: dec.error, retry: false });
      raw = dec.text;
    }
    const n = normaliseTranscript(raw, { timestamps });
    const lim = limitText(n.text, MAX_TRANSCRIPT_CHARS);
    if (!lim.ok) return setFailure({ message: lim.error, retry: false });
    setTranscript(lim.text);
    setNotice(n.format === "text" ? `${file.name} opened.` : `${file.name}: ${n.cues} subtitle cues turned into text${n.speakers.length ? ` (speakers: ${n.speakers.join(", ")})` : " (no speaker labels found)"}.`);
  };

  const generate = async () => {
    let text = transcript;
    if (detectFormat(text) !== "text") {
      text = normaliseTranscript(text, { timestamps }).text;
      setTranscript(text);
    }
    if (text.trim().length < 80) return setFailure({ message: "Paste a longer transcript (a few exchanges at least).", retry: false });
    if (text.length > MAX_TRANSCRIPT_CHARS) return setFailure({ message: `The transcript is longer than ${MAX_TRANSCRIPT_CHARS.toLocaleString("en-US")} characters (about 90 minutes of talk). This version does not split long meetings: send it in parts.`, retry: false });
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setFailure(null);
    setNotice(null);
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ transcript: text, title, date, language, referenceDate }), signal: ctrl.signal });
      const body = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!body) throw new Error("The minutes service did not answer properly. Please try again.");
      if (body.ok) {
        setResult(body.data);
        setIsSample(false);
        setTimeout(() => heading.current?.focus(), 0);
      } else setFailure({ message: body.error.message, retry: res.status === 502 || res.status === 500 });
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setFailure({ message: e instanceof Error && !(e instanceof TypeError) ? e.message : "Could not reach the minutes service. Check your connection and try again.", retry: true });
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

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${what} copied.`);
    } catch {
      setNotice("Your browser blocked clipboard access. Use the downloads instead.");
    }
  };

  const downloadDocx = async () => {
    if (result.status !== "ok") return;
    const { docxBlob } = await import("./logic/toDocx");
    save(await docxBlob(result), "meeting-minutes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  };

  const over = transcript.length > MAX_TRANSCRIPT_CHARS;
  const adj = result.status === "ok" ? result.adjustments : null;
  const dropped = adj ? adj.droppedDecisions + adj.droppedActions + adj.droppedQuestions : 0;

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <h2 id={`${uid}-in`} className="text-lg font-semibold">
          Transcript
        </h2>
        <form
          className="mt-3 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <div>
            <label htmlFor={`${uid}-t`} className={label}>
              Meeting transcript <span className="font-normal text-slate-600">(text only; audio is not supported)</span>
            </label>
            <textarea
              id={`${uid}-t`}
              dir="auto"
              className={`${inputCls} mt-1 min-h-64 font-mono leading-5`}
              value={transcript}
              onChange={(e) => {
                touch();
                setTranscript(e.target.value);
              }}
              placeholder={"Ana: Let's start with the budget.\nBen: I'll send the numbers by Friday."}
              aria-describedby={`${uid}-tc`}
              aria-invalid={over || undefined}
            />
            <p id={`${uid}-tc`} className={`mt-1 text-xs ${over ? "font-semibold text-red-800" : "text-slate-600"}`}>
              {transcript.length.toLocaleString("en-US")} / {MAX_TRANSCRIPT_CHARS.toLocaleString("en-US")} characters (about 90 minutes). Longer meetings are not split in this version.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-f`} className={label}>
                Or open a .txt, .vtt, .srt or .docx file
              </label>
              <input id={`${uid}-f`} type="file" accept=".txt,.vtt,.srt,.docx,text/plain,text/vtt,application/x-subrip,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className={`mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold ${focusRing}`} onChange={(e) => void onFile(e.target.files?.[0])} />
              {reading && <p className="mt-1 text-xs text-slate-700">Reading the Word file…</p>}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm sm:pt-6">
              <input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={timestamps} onChange={(e) => setTimestamps(e.target.checked)} />
              Keep subtitle times as [mm:ss]
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor={`${uid}-ti`} className={label}>
                Meeting title <span className="font-normal text-slate-600">(optional)</span>
              </label>
              <input id={`${uid}-ti`} className={`${inputCls} mt-1`} maxLength={MAX_TITLE_CHARS} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label htmlFor={`${uid}-d`} className={label}>
                Meeting date <span className="font-normal text-slate-600">(optional)</span>
              </label>
              <input id={`${uid}-d`} type="date" className={`${inputCls} mt-1`} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label htmlFor={`${uid}-l`} className={label}>
                Language of the minutes
              </label>
              <select id={`${uid}-l`} className={`${inputCls} mt-1`} value={language} onChange={(e) => setLanguage(e.target.value as LanguageId)}>
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-r`} className={label}>
                Count deadlines from
              </label>
              <input id={`${uid}-r`} type="date" required className={`${inputCls} mt-1`} value={referenceDate} onChange={(e) => setReferenceDate(e.target.value)} />
            </div>
          </div>
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{RECORDING_NOTE}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className={btnPrimary} disabled={busy || reading}>
              {busy ? "Writing the minutes…" : "Write minutes"}
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
                    touched.current = false;
                    setTranscript(sampleInput.transcript);
                    setTitle(sampleInput.title);
                    setDate(sampleInput.date);
                    setLanguage(sampleInput.language);
                    setReferenceDate(sampleInput.referenceDate);
                    setResult(sampleResult);
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
                    touch();
                    setTranscript("");
                    setTitle("");
                    setDate("");
                    setFailure(null);
                    setNotice(null);
                  }}
                >
                  Clear
                </button>
              </>
            )}
          </div>
          <p className="text-xs text-slate-600">When you press Write minutes, the transcript is sent to our server and to the AI provider. Files are read in your browser first. Limit: {LIMIT_TEXT}.</p>
        </form>
      </section>

      {failure && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between">
          <p>{failure.message}</p>
          {failure.retry && (
            <button type="button" className={btnSecondary} onClick={() => void generate()} disabled={busy}>
              Try again
            </button>
          )}
        </div>
      )}

      <section className={`${card} min-h-64`} aria-labelledby={`${uid}-out`} aria-busy={busy}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={`${uid}-out`} ref={heading} tabIndex={-1} className="text-lg font-semibold focus:outline-none">
            Minutes
          </h2>
          {isSample && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Example result (nothing was sent)</span>}
          {!isSample && result.cached && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Answered from a short-lived cache</span>}
        </div>
        <div aria-live="polite" className="mt-3 space-y-4">
          {busy && <p className="text-sm text-slate-700">Reading the transcript… a long meeting can take up to a minute.</p>}
          {notice && <p className="text-sm text-slate-700">{notice}</p>}
          {result.status === "ok" ? (
            <>
              {adj && (dropped > 0 || adj.attendeesRemoved > 0 || adj.ownersCleared > 0 || adj.datesCleared > 0 || adj.titleCleared || adj.dateCleared) && (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                  Checked against the transcript:{" "}
                  {[
                    dropped > 0 && `${dropped} item${dropped === 1 ? "" : "s"} removed because the quoted sentence is not in the transcript`,
                    adj.attendeesRemoved > 0 && `${adj.attendeesRemoved} attendee${adj.attendeesRemoved === 1 ? "" : "s"} not named in it removed`,
                    adj.ownersCleared > 0 && `${adj.ownersCleared} owner${adj.ownersCleared === 1 ? "" : "s"} not named in it shown as Unassigned`,
                    adj.datesCleared > 0 && `${adj.datesCleared} due date${adj.datesCleared === 1 ? "" : "s"} cleared (invalid or more than 5 years away)`,
                    (adj.titleCleared || adj.dateCleared) && "a title or date that is not in the transcript left out",
                  ]
                    .filter(Boolean)
                    .join("; ")}
                  .
                </p>
              )}
              <div>
                <p className="text-base font-semibold" dir="auto">
                  {result.title ?? "Meeting minutes"}
                </p>
                <p className="text-sm text-slate-700">{result.date ? `Date: ${result.date}` : "Date: not stated"} · Deadlines counted from {result.referenceDate}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Attendees</h3>
                <p className="mt-1 text-sm" dir="auto">
                  {result.attendees.length ? result.attendees.map((a) => `${a.name}${a.role ? ` (${a.role})` : ""}`).join(", ") : "Not stated in the transcript."}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Agenda</h3>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
                  {result.agenda.map((t, i) => (
                    <li key={i} dir="auto">
                      <span className="font-semibold">{t.topic}.</span> {t.summary}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Decisions ({result.decisions.length})</h3>
                  <ul className="mt-1 space-y-2 text-sm">
                    {result.decisions.length ? result.decisions.map((d, i) => (
                      <li key={i} className="rounded-xl border border-slate-200 p-2" dir="auto">
                        {d.text}
                        <p className="mt-1 border-l-2 border-slate-200 pl-2 text-xs text-slate-600">“{d.quote}”</p>
                      </li>
                    )) : <li className="text-slate-600">None recorded.</li>}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Open questions ({result.openQuestions.length})</h3>
                  <ul className="mt-1 space-y-2 text-sm">
                    {result.openQuestions.length ? result.openQuestions.map((d, i) => (
                      <li key={i} className="rounded-xl border border-slate-200 p-2" dir="auto">
                        {d.text}
                        <p className="mt-1 border-l-2 border-slate-200 pl-2 text-xs text-slate-600">“{d.quote}”</p>
                      </li>
                    )) : <li className="text-slate-600">None.</li>}
                  </ul>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Action items ({result.actionItems.length})</h3>
                <div className="mt-1 overflow-x-auto rounded-xl border border-slate-200" tabIndex={0} role="region" aria-label="Action items">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs text-slate-700">
                      <tr>
                        <th className="px-2 py-1.5">Task</th>
                        <th className="px-2 py-1.5">Owner</th>
                        <th className="px-2 py-1.5">Due</th>
                        <th className="px-2 py-1.5">Said</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.actionItems.map((i, k) => (
                        <tr key={k} className="border-t border-slate-100 align-top">
                          <td className="px-2 py-1.5" dir="auto">
                            {i.task}
                          </td>
                          <td className="px-2 py-1.5" dir="auto">
                            {i.owner ?? <span className="text-slate-600">Unassigned</span>}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5">{i.dueDate ?? (i.dueText ? <span className="text-slate-600">{i.dueText}</span> : "—")}</td>
                          <td className="min-w-48 px-2 py-1.5 text-xs text-slate-600" dir="auto">
                            “{i.quote}”
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <button type="button" className={btnSecondary} onClick={() => void copy(toPlainText(result), "Minutes")}>
                  Copy
                </button>
                <button type="button" className={btnSecondary} onClick={() => save(toMarkdown(result), "meeting-minutes.md", "text/markdown;charset=utf-8")}>
                  Download Markdown
                </button>
                <button type="button" className={btnSecondary} onClick={() => void downloadDocx()}>
                  Download Word (.docx)
                </button>
                <button type="button" className={btnSecondary} onClick={() => save(toActionsCsv(result), "action-items.csv", "text/csv;charset=utf-8")}>
                  Action items (CSV)
                </button>
                <button type="button" className={btnSecondary} onClick={() => void copy(toChecklist(result), "Checklist")}>
                  Copy checklist
                </button>
              </div>
            </>
          ) : (
            <div className={`rounded-xl border p-4 text-sm ${result.status === "refused" ? "border-slate-200 bg-slate-50" : "border-blue-200 bg-primary-soft"}`}>
              <p className="font-semibold">{result.status === "refused" ? "This does not look like a meeting transcript" : "The AI needs one more detail"}</p>
              <p className="mt-1">{result.message}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

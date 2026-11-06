"use client";

import { useEffect, useId, useRef, useState } from "react";
import { sampleInput } from "../fixtures/sampleInput";
import { sampleResult } from "../fixtures/sampleResult";
import { LIMIT_TEXT, MAX_SHEET_CHARS, MAX_TASK_CHARS } from "./limits";
import { QUOTA_DOC, QUOTAS_CHECKED } from "./logic/quotas";
import { SCOPES_CHECKED } from "./logic/scopes";
import { TRIGGER_EXPLAINER, TRIGGER_INFO, TRIGGERS, type TriggerId } from "./logic/triggers";
import type { ApiResponse, GeneratorResult } from "./types";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const ENDPOINT = "/api/tools/google-apps-script-automation-generator";
const linkCls = `text-primary-dark underline underline-offset-2 ${focusRing}`;

type Failure = { message: string; retry: boolean };
type Ok = Extract<GeneratorResult, { status: "ok" }>;

function save(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/javascript;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ReviewBox({ r }: { r: Ok }) {
  const danger = r.review.filter((i) => i.level === "danger");
  const checks = r.review.filter((i) => i.level === "check");
  const problems = danger.length > 0 || !r.syntax.ok || r.triggerWarnings.length > 0;
  return (
    <div role={problems ? "alert" : undefined} className={`rounded-xl border p-3 text-sm sm:p-4 ${problems ? "border-red-200 bg-red-50 text-red-950" : "border-amber-300 bg-amber-50 text-amber-950"}`}>
      <h3 className="font-semibold">Review before you run</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {!r.syntax.ok && (
          <li>
            <span className="font-semibold">Syntax error on line {r.syntax.line}, column {r.syntax.column}:</span> {r.syntax.message}. The script will not save until this is fixed.
          </li>
        )}
        {danger.map((i, k) => (
          <li key={`d${k}`}>
            <span className="font-semibold">Unexpected{i.line ? ` (line ${i.line})` : ""}:</span> {i.text}
          </li>
        ))}
        {r.triggerWarnings.map((w, k) => (
          <li key={`t${k}`}>
            <span className="font-semibold">Trigger:</span> {w}
          </li>
        ))}
        {checks.map((i, k) => (
          <li key={`c${k}`}>
            {i.text}
            {i.line ? ` (line ${i.line})` : ""}
          </li>
        ))}
        {r.review.length === 0 && r.syntax.ok && r.triggerWarnings.length === 0 && <li>Our checks found nothing unusual. Still read the code before you authorise it.</li>}
      </ul>
    </div>
  );
}

export default function GoogleAppsScriptAutomationGeneratorTool() {
  const uid = useId();
  const [task, setTask] = useState(sampleInput.task);
  const [sheet, setSheet] = useState(sampleInput.sheet);
  const [trigger, setTrigger] = useState<TriggerId>(sampleInput.trigger);
  const [result, setResult] = useState<GeneratorResult>(sampleResult);
  const [isSample, setIsSample] = useState(true);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const taskRef = useRef<HTMLTextAreaElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const generate = async () => {
    if (task.trim().length < 10) {
      setFailure({ message: "Describe what the script should do (a sentence at least).", retry: false });
      taskRef.current?.focus();
      return;
    }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setFailure(null);
    setNotice(null);
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task, sheet, trigger }), signal: ctrl.signal });
      const body = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!body) throw new Error("The script service did not answer properly. Please try again.");
      if (body.ok) {
        setResult(body.data);
        setIsSample(false);
        setTimeout(() => heading.current?.focus(), 0);
      } else {
        setFailure({ message: body.error.message, retry: res.status === 502 || res.status === 500 });
      }
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setFailure({ message: e instanceof Error && !(e instanceof TypeError) ? e.message : "Could not reach the script service. Check your connection and try again.", retry: true });
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
      setNotice("Your browser blocked clipboard access. Use Download Code.gs instead.");
    }
  };

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <h2 id={`${uid}-in`} className="text-lg font-semibold">
          Describe the automation
        </h2>
        <form
          className="mt-3 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <div>
            <label htmlFor={`${uid}-t`} className="block text-sm font-medium text-slate-700">
              What should the script do?
            </label>
            <textarea id={`${uid}-t`} ref={taskRef} className={`${inputCls} mt-1 min-h-24`} value={task} maxLength={MAX_TASK_CHARS} onChange={(e) => setTask(e.target.value)} placeholder="e.g. Every Monday, email me the number of rows with Status Open" aria-describedby={`${uid}-tc`} />
            <p id={`${uid}-tc`} className="mt-1 text-xs text-slate-600">
              {task.length.toLocaleString("en-US")} / {MAX_TASK_CHARS.toLocaleString("en-US")} characters
            </p>
          </div>
          <div>
            <label htmlFor={`${uid}-s`} className="block text-sm font-medium text-slate-700">
              Sheet structure <span className="font-normal text-slate-600">(sheet names, columns, header row)</span>
            </label>
            <textarea id={`${uid}-s`} className={`${inputCls} mt-1 min-h-16`} value={sheet} maxLength={MAX_SHEET_CHARS} onChange={(e) => setSheet(e.target.value)} placeholder='e.g. Sheet "Tasks": A ID, B Task, C Email, D Status. Header in row 1.' />
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">When should it run?</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {TRIGGERS.map((t) => (
                <label key={t} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${trigger === t ? "border-primary bg-primary-soft" : "border-slate-300"}`}>
                  <input type="radio" name={`${uid}-tr`} className={`accent-primary ${focusRing}`} checked={trigger === t} onChange={() => setTrigger(t)} />
                  {TRIGGER_INFO[t].label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className={btnPrimary} disabled={busy}>
              {busy ? "Writing the script…" : "Generate script"}
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
                  setTask(sampleInput.task);
                  setSheet(sampleInput.sheet);
                  setTrigger(sampleInput.trigger);
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
          <p className="text-xs text-slate-600">When you press Generate script, your description and sheet structure are sent to our server and to the AI provider to write the script. Limit: {LIMIT_TEXT}.</p>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm sm:p-6" aria-labelledby={`${uid}-why`}>
        <h2 id={`${uid}-why`} className="font-semibold">
          Simple or installable trigger?
        </h2>
        <p className="mt-2 text-slate-800">
          <span className="font-semibold">Simple: </span>
          {TRIGGER_EXPLAINER.simple}
        </p>
        <p className="mt-2 text-slate-800">
          <span className="font-semibold">Installable: </span>
          {TRIGGER_EXPLAINER.installable}
        </p>
        <p className="mt-2 text-slate-700">
          <span className="font-semibold">Your choice ({TRIGGER_INFO[trigger].label}): </span>
          {TRIGGER_INFO[trigger].howToInstall}
        </p>
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
            Your script
          </h2>
          {isSample && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Example result (nothing was sent)</span>}
          {!isSample && result.cached && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Answered from a short-lived cache</span>}
        </div>
        <div aria-live="polite" className="mt-3 space-y-4">
          {busy && <p className="text-sm text-slate-700">Writing and checking your script… this can take up to half a minute.</p>}
          {notice && <p className="text-sm text-slate-700">{notice}</p>}
          {result.status === "ok" ? (
            <>
              <p className="text-sm leading-relaxed text-slate-800">{result.summary}</p>
              <ReviewBox r={result} />
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-700">Code.gs</h3>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={btnSecondary} onClick={() => void copy(result.script, "Script")}>
                      Copy script
                    </button>
                    <button type="button" className={btnSecondary} onClick={() => save(result.script, "Code.gs")}>
                      Download Code.gs
                    </button>
                  </div>
                </div>
                <pre className="mt-2 max-h-[32rem] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[13px] leading-5 text-navy" tabIndex={0} aria-label="Generated Apps Script">
                  {result.script}
                </pre>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700">How to install it</h3>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-800">
                  {result.installSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Permissions it will ask for</h3>
                <p className="mt-1 text-xs text-slate-600">Detected by our own code from the services the script uses (scope table checked {SCOPES_CHECKED}).</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {result.scopes.map((s) => (
                    <li key={s.scope} className="rounded-lg border border-slate-200 p-2">
                      <span className="font-semibold">{s.service}</span>: {s.why}
                      <code className="mt-1 block break-all font-mono text-xs text-slate-700">{s.scope}</code>
                    </li>
                  ))}
                  {result.scopes.length === 0 && <li className="text-slate-700">No permission is needed.</li>}
                </ul>
                {result.scopeDifference && (
                  <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-950">
                    <p className="font-semibold">The AI listed different permissions. The list above is our own detection.</p>
                    {result.scopeDifference.extra.length > 0 && <p className="mt-1 break-words">Listed by the AI but not used by the code: {result.scopeDifference.extra.join(", ")}</p>}
                    {result.scopeDifference.missing.length > 0 && <p className="mt-1 break-words">Used by the code but missing from the AI&apos;s list: {result.scopeDifference.missing.join(", ")}</p>}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Quotas to know</h3>
                <div role="region" aria-label="Quotas" tabIndex={0} className={`mt-2 overflow-x-auto rounded-lg ${focusRing}`}>
                  <table className="w-full min-w-[22rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-600">
                        <th className="py-1 pr-3 font-medium">Limit</th>
                        <th className="py-1 pr-3 font-medium">Gmail account</th>
                        <th className="py-1 font-medium">Workspace</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.quotas.map((q) => (
                        <tr key={q.id} className="border-b border-slate-100">
                          <td className="py-1 pr-3">{q.topic}</td>
                          <td className="py-1 pr-3">{q.consumer}</td>
                          <td className="py-1">{q.workspace}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  From Google&apos;s{" "}
                  <a className={linkCls} href={QUOTA_DOC} target="_blank" rel="noopener noreferrer">
                    Apps Script quotas page
                  </a>{" "}
                  (checked {QUOTAS_CHECKED}). Google changes these limits; check the current numbers there.
                </p>
              </div>
              {result.assumptions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Assumptions the AI made</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800">
                    {result.assumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : result.status === "needs_clarification" ? (
            <div className="rounded-xl border border-blue-200 bg-primary-soft p-4 text-sm">
              <p className="font-semibold">The AI needs one more detail</p>
              <p className="mt-1">{result.message}</p>
              <button type="button" className={`${btnSecondary} mt-3`} onClick={() => taskRef.current?.focus()}>
                Add it to the description
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-semibold">This request was not accepted</p>
              <p className="mt-1">{result.message}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

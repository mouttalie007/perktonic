"use client";

import { useEffect, useId, useRef, useState } from "react";
import { sampleInput } from "../fixtures/sampleInput";
import { sampleResult } from "../fixtures/sampleResult";
import { LIMIT_TEXT, MAX_COLUMNS_CHARS, MAX_REQUEST_CHARS } from "./limits";
import { PLATFORMS, type Platform } from "./logic/checks";
import { textReport } from "./logic/report";
import { toSemicolons } from "./logic/separators";
import type { ApiResponse, CheckSummary, GeneratorResult } from "./types";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const ENDPOINT = "/api/tools/excel-formula-generator";

type Failure = { message: string; retry: boolean };

function save(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Warnings({ summary }: { summary: CheckSummary }) {
  if (!summary.warnings.length) return null;
  return (
    <ul role="alert" className="mt-2 space-y-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      {summary.warnings.map((w, i) => (
        <li key={i}>
          <span className="font-semibold">{w.id === "unverified" ? "Unverified function. " : w.id === "new-function" ? "Version warning. " : "Check this. "}</span>
          {w.text}
        </li>
      ))}
    </ul>
  );
}

function FormulaBox({ label, formula, onCopy }: { label: string; formula: string; onCopy: () => void }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-700">{label}</h4>
        <button type="button" className={btnSecondary} onClick={onCopy}>
          Copy {label.toLowerCase()}
        </button>
      </div>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-sm text-navy" tabIndex={0} aria-label={label}>
        {formula}
      </pre>
    </div>
  );
}

export default function ExcelFormulaGeneratorTool() {
  const uid = useId();
  const [request, setRequest] = useState(sampleInput.request);
  const [platform, setPlatform] = useState<Platform>(sampleInput.platform);
  const [columns, setColumns] = useState(sampleInput.columns);
  const [result, setResult] = useState<GeneratorResult>(sampleResult);
  const [isSample, setIsSample] = useState(true);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const [semicolons, setSemicolons] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const requestRef = useRef<HTMLTextAreaElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const generate = async () => {
    if (request.trim().length < 3) {
      setFailure({ message: "Describe what the formula should do (a few words at least).", retry: false });
      requestRef.current?.focus();
      return;
    }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setFailure(null);
    setNotice(null);
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ request, platform, columns }), signal: ctrl.signal });
      const body = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!body) throw new Error("The formula service did not answer properly. Please try again.");
      if (body.ok) {
        setResult(body.data);
        setIsSample(false);
        setTimeout(() => heading.current?.focus(), 0);
      } else {
        setFailure({ message: body.error.message, retry: res.status === 502 || res.status === 500 });
      }
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setFailure({ message: e instanceof Error && !(e instanceof TypeError) ? e.message : "Could not reach the formula service. Check your connection and try again.", retry: true });
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
      setNotice("Your browser blocked clipboard access. Select the text and copy it by hand.");
    }
  };

  const shown = (f: string) => (semicolons ? toSemicolons(f) : f);

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <h2 id={`${uid}-in`} className="text-lg font-semibold">
          Describe the formula
        </h2>
        <form
          className="mt-3 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <div>
            <label htmlFor={`${uid}-r`} className="block text-sm font-medium text-slate-700">
              What should the formula do?
            </label>
            <textarea
              id={`${uid}-r`}
              ref={requestRef}
              className={`${inputCls} mt-1 min-h-24`}
              value={request}
              maxLength={MAX_REQUEST_CHARS}
              onChange={(e) => setRequest(e.target.value)}
              placeholder="e.g. Count the orders in column D that are over 100"
              aria-describedby={`${uid}-rc`}
            />
            <p id={`${uid}-rc`} className="mt-1 text-xs text-slate-600">
              {request.length.toLocaleString("en-US")} / {MAX_REQUEST_CHARS.toLocaleString("en-US")} characters
            </p>
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Spreadsheet app</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4">
              {PLATFORMS.map((p) => (
                <label key={p.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${platform === p.id ? "border-primary bg-primary-soft" : "border-slate-300"}`}>
                  <input type="radio" name={`${uid}-p`} className={`accent-primary ${focusRing}`} checked={platform === p.id} onChange={() => setPlatform(p.id)} />
                  {p.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor={`${uid}-c`} className="block text-sm font-medium text-slate-700">
              Your columns <span className="font-normal text-slate-600">(optional)</span>
            </label>
            <textarea id={`${uid}-c`} className={`${inputCls} mt-1 min-h-16`} value={columns} maxLength={MAX_COLUMNS_CHARS} onChange={(e) => setColumns(e.target.value)} placeholder="e.g. A: Date, B: Region, C: Sales, rows 2 to 500" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className={btnPrimary} disabled={busy}>
              {busy ? "Generating…" : "Generate formula"}
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
                  setRequest(sampleInput.request);
                  setPlatform(sampleInput.platform);
                  setColumns(sampleInput.columns);
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
          <p className="text-xs text-slate-600">
            When you press Generate formula, your text is sent to our server and to the AI provider to write the formula. Limit: {LIMIT_TEXT}.
          </p>
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
            Result
          </h2>
          {isSample && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Example result (nothing was sent)</span>}
          {!isSample && result.cached && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Answered from a short-lived cache</span>}
        </div>
        <div aria-live="polite" className="mt-3">
          {busy && <p className="mb-3 text-sm text-slate-700">Writing your formula… this usually takes a few seconds.</p>}
          {notice && <p className="mb-3 text-sm text-slate-700">{notice}</p>}
          {result.status === "ok" ? (
            <div className="space-y-4">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" role="switch" aria-checked={semicolons} className={`h-4 w-4 accent-primary ${focusRing}`} checked={semicolons} onChange={(e) => setSemicolons(e.target.checked)} />
                Use semicolons (for locales such as German, French or Spanish)
              </label>
              <div>
                <FormulaBox label="Formula" formula={shown(result.formula)} onCopy={() => void copy(shown(result.formula), "Formula")} />
                <Warnings summary={result.checks.formula} />
              </div>
              <p className="text-sm leading-relaxed text-slate-800">{result.explanation}</p>
              {result.alternative && (
                <div className="rounded-xl border border-slate-200 p-3">
                  <FormulaBox label="Alternative" formula={shown(result.alternative.formula)} onCopy={() => void copy(shown(result.alternative!.formula), "Alternative")} />
                  {result.checks.alternative && <Warnings summary={result.checks.alternative} />}
                  <p className="mt-2 text-sm text-slate-800">{result.alternative.whenToPrefer}</p>
                </div>
              )}
              {result.notes.length > 0 && (
                <ul role="alert" className="space-y-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  {result.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
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
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <button type="button" className={btnSecondary} onClick={() => save(textReport(result, semicolons), "formula.txt")}>
                  Download as .txt
                </button>
                <p className="self-center text-xs text-slate-600">Function names and brackets are checked by our own code; test the formula on a copy of your data.</p>
              </div>
            </div>
          ) : result.status === "needs_clarification" ? (
            <div className="rounded-xl border border-blue-200 bg-primary-soft p-4 text-sm">
              <p className="font-semibold">The AI needs one more detail</p>
              <p className="mt-1">{result.message}</p>
              <button type="button" className={`${btnSecondary} mt-3`} onClick={() => requestRef.current?.focus()}>
                Add it to the request
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-semibold">Not a spreadsheet formula request</p>
              <p className="mt-1">{result.message}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

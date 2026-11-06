"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { sampleInput } from "../fixtures/sampleInput";
import { sampleResult } from "../fixtures/sampleResult";
import { LIMIT_TEXT, MAX_DESCRIPTION_CHARS, MAX_FORMULA_CHARS } from "./limits";
import { PLATFORMS, type Platform } from "./logic/checks";
import { diff } from "./logic/diff";
import { diagnose, ERROR_KINDS, ERROR_LABEL, type ErrorKind, type RankedFinding } from "./logic/rules";
import type { AiDiagnosis, ApiResponse } from "./types";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const ENDPOINT = "/api/tools/excel-formula-debugger";

const LEVEL_CLS: Record<RankedFinding["level"], string> = {
  High: "bg-red-50 text-red-900 border-red-200",
  Medium: "bg-amber-50 text-amber-950 border-amber-300",
  Low: "bg-slate-50 text-slate-700 border-slate-200",
};

type Failure = { message: string; retry: boolean };

function save(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Diff({ before, after, label }: { before: string; after: string; label: string }) {
  return (
    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[13px] leading-6 text-navy" tabIndex={0} aria-label={label}>
      {diff(before, after).map((p, i) =>
        p.type === "same" ? (
          <span key={i}>{p.text}</span>
        ) : p.type === "del" ? (
          <del key={i} className="rounded bg-red-100 text-red-900 decoration-red-700">
            <span className="sr-only">removed: </span>
            {p.text}
          </del>
        ) : (
          <ins key={i} className="rounded bg-green-100 text-green-900 no-underline">
            <span className="sr-only">added: </span>
            {p.text}
          </ins>
        ),
      )}
    </pre>
  );
}

function report(formula: string, error: ErrorKind, findings: RankedFinding[], ai: AiDiagnosis | null): string {
  const out = ["# Formula error report", "", "```", formula, "```", "", `Error shown: ${ERROR_LABEL[error]}`, "", "## Likely causes (rule-based)", ""];
  if (!findings.length) out.push("No rule matched.", "");
  findings.forEach((f, i) => {
    out.push(`${i + 1}. **${f.title}** (${f.level} confidence)`, `   ${f.cause}`, `   Fix: ${f.fix}`);
    if (f.corrected) out.push(`   Corrected: \`${f.corrected}\``);
    out.push("");
  });
  if (ai?.status === "ok") {
    out.push("## AI diagnosis", "", ai.diagnosis, "");
    if (ai.correctedFormula) out.push(`Corrected formula: \`${ai.correctedFormula}\``, "");
    if (ai.assumptions.length) out.push("Assumptions:", ...ai.assumptions.map((a) => `- ${a}`), "");
    if (ai.preventionTips.length) out.push("Prevention tips:", ...ai.preventionTips.map((a) => `- ${a}`), "");
    if (ai.warnings.length || ai.notes.length) out.push("Warnings:", ...[...ai.warnings.map((w) => w.text), ...ai.notes].map((w) => `- ${w}`), "");
  }
  return out.join("\n") + "\n";
}

export default function ExcelFormulaDebuggerTool() {
  const uid = useId();
  const [formula, setFormula] = useState(sampleInput.formula);
  const [error, setError] = useState<ErrorKind>(sampleInput.error);
  const [platform, setPlatform] = useState<Platform>(sampleInput.platform);
  const [cell, setCell] = useState(sampleInput.cell);
  const [description, setDescription] = useState(sampleInput.description);
  const [ai, setAi] = useState<AiDiagnosis | null>(sampleResult);
  const [aiFor, setAiFor] = useState(`${sampleInput.formula}\u0000${sampleInput.error}`);
  const [isSample, setIsSample] = useState(true);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const aiHeading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const deferred = useDeferredValue(formula);
  const findings = useMemo(() => (deferred.trim() ? diagnose({ formula: deferred, error, platform, cell: cell.trim() || undefined }) : []), [deferred, error, platform, cell]);
  const stale = ai !== null && aiFor !== `${formula}\u0000${error}`;

  const ask = async () => {
    if (formula.trim().length < 2) {
      setFailure({ message: "Paste the formula that shows the error.", retry: false });
      return;
    }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setFailure(null);
    setNotice(null);
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ formula, error, platform, cell, description }), signal: ctrl.signal });
      const body = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!body) throw new Error("The AI diagnosis is temporarily unavailable. The rule-based causes above still apply.");
      if (body.ok) {
        setAi(body.data);
        setAiFor(`${formula}\u0000${error}`);
        setIsSample(false);
        setTimeout(() => aiHeading.current?.focus(), 0);
      } else {
        setFailure({ message: body.error.message, retry: res.status === 502 || res.status === 500 });
      }
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setFailure({ message: e instanceof Error && !(e instanceof TypeError) ? e.message : "Could not reach the AI service. The rule-based causes above still apply.", retry: true });
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
    setNotice("Request cancelled.");
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${what} copied.`);
    } catch {
      setNotice("Your browser blocked clipboard access. Select the formula and copy it by hand.");
    }
  };

  const loadSample = () => {
    setFormula(sampleInput.formula);
    setError(sampleInput.error);
    setPlatform(sampleInput.platform);
    setCell(sampleInput.cell);
    setDescription(sampleInput.description);
    setAi(sampleResult);
    setAiFor(`${sampleInput.formula}\u0000${sampleInput.error}`);
    setIsSample(true);
    setFailure(null);
    setNotice(null);
  };

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <h2 id={`${uid}-in`} className="text-lg font-semibold">
          Broken formula
        </h2>
        <form
          className="mt-3 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
        >
          <div>
            <label htmlFor={`${uid}-f`} className="block text-sm font-medium text-slate-700">
              Formula that shows the error
            </label>
            <textarea id={`${uid}-f`} className={`${inputCls} mt-1 min-h-20 font-mono`} value={formula} maxLength={MAX_FORMULA_CHARS} spellCheck={false} onChange={(e) => setFormula(e.target.value)} placeholder="=VLOOKUP(A2,Products!A:C,3)" />
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Error shown in the cell</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {ERROR_KINDS.map((k) => (
                <label key={k} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 font-mono text-sm ${error === k ? "border-primary bg-primary-soft" : "border-slate-300"}`}>
                  <input type="radio" name={`${uid}-e`} className={`accent-primary ${focusRing}`} checked={error === k} onChange={() => setError(k)} />
                  <span className={k === "circular" || k === "###" ? "font-sans" : ""}>{ERROR_LABEL[k]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-p`} className="block text-sm font-medium text-slate-700">
                Spreadsheet app
              </label>
              <select id={`${uid}-p`} className={`${inputCls} mt-1`} value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
                {PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-c`} className="block text-sm font-medium text-slate-700">
                Cell the formula is in <span className="font-normal text-slate-600">(optional, for circular references)</span>
              </label>
              <input id={`${uid}-c`} className={`${inputCls} mt-1 font-mono`} value={cell} maxLength={40} onChange={(e) => setCell(e.target.value)} placeholder="e.g. D20" spellCheck={false} autoCapitalize="characters" />
            </div>
          </div>
          <div>
            <label htmlFor={`${uid}-d`} className="block text-sm font-medium text-slate-700">
              Describe your data <span className="font-normal text-slate-600">(optional, only used when you ask the AI)</span>
            </label>
            <textarea id={`${uid}-d`} className={`${inputCls} mt-1 min-h-16`} value={description} maxLength={MAX_DESCRIPTION_CHARS} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Column A holds product codes imported from our shop system" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className={btnPrimary} disabled={busy}>
              {busy ? "Asking the AI…" : "Ask the AI"}
            </button>
            {busy ? (
              <button type="button" className={btnSecondary} onClick={cancel}>
                Cancel
              </button>
            ) : (
              <button type="button" className={btnSecondary} onClick={loadSample}>
                Try an example
              </button>
            )}
          </div>
          <p className="text-xs text-slate-600">The likely causes below are found instantly in your browser. Only when you press Ask the AI are the formula, the error, the cell and your description sent to our server and to the AI provider. Limit: {LIMIT_TEXT}.</p>
        </form>
      </section>

      <section className={`${card} min-h-40`} aria-labelledby={`${uid}-r`}>
        <h2 id={`${uid}-r`} className="text-lg font-semibold">
          Likely causes <span className="text-sm font-normal text-slate-600">(instant, rule-based)</span>
        </h2>
        <div aria-live="polite" className="mt-3">
          {!formula.trim() && <p className="text-sm text-slate-700">Paste a formula and pick the error to see the likely causes.</p>}
          {formula.trim() && findings.length === 0 && <p className="text-sm text-slate-700">None of our {ERROR_LABEL[error]} rules matched this formula. Describe your data and ask the AI.</p>}
          {findings.length > 0 && (
            <ol className="space-y-3">
              {findings.map((f) => (
                <li key={f.id} className="rounded-xl border border-slate-200 p-3 sm:p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${LEVEL_CLS[f.level]}`}>{f.level} confidence</span>
                    <h3 className="text-sm font-semibold">{f.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-slate-800">{f.cause}</p>
                  <p className="mt-1 text-sm text-slate-800">
                    <span className="font-semibold">Fix: </span>
                    {f.fix}
                  </p>
                  {f.corrected && (
                    <div className="mt-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-700">Mechanical fix (changes highlighted)</p>
                        <button type="button" className={btnSecondary} onClick={() => void copy(f.corrected!, "Corrected formula")}>
                          Copy fixed formula
                        </button>
                      </div>
                      <Diff before={formula} after={f.corrected} label={`Fix for: ${f.title}`} />
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {failure && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between">
          <p>{failure.message}</p>
          {failure.retry && (
            <button type="button" className={btnSecondary} onClick={() => void ask()} disabled={busy}>
              Try again
            </button>
          )}
        </div>
      )}

      <section className={`${card} min-h-40`} aria-labelledby={`${uid}-ai`} aria-busy={busy}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={`${uid}-ai`} ref={aiHeading} tabIndex={-1} className="text-lg font-semibold focus:outline-none">
            AI diagnosis
          </h2>
          {isSample && ai && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Example result (nothing was sent)</span>}
          {!isSample && ai?.cached && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Answered from a short-lived cache</span>}
        </div>
        <div aria-live="polite" className="mt-3 space-y-3">
          {busy && <p className="text-sm text-slate-700">Asking the AI… this usually takes a few seconds.</p>}
          {notice && <p className="text-sm text-slate-700">{notice}</p>}
          {!ai && !busy && <p className="text-sm text-slate-700">When the rules are not enough, describe your data and press Ask the AI.</p>}
          {ai && stale && <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">This answer is for an earlier formula or error. Press Ask the AI to update it.</p>}
          {ai?.status === "ok" && (
            <>
              <p className="text-sm leading-relaxed text-slate-800">{ai.diagnosis}</p>
              {ai.correctedFormula && (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-700">Suggested formula (changes highlighted)</h3>
                    <button type="button" className={btnSecondary} onClick={() => void copy(ai.correctedFormula!, "Suggested formula")}>
                      Copy suggested formula
                    </button>
                  </div>
                  <Diff before={ai.formula} after={ai.correctedFormula} label="Suggested formula" />
                </div>
              )}
              {(ai.warnings.length > 0 || ai.notes.length > 0) && (
                <ul role="alert" className="space-y-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  {ai.warnings.map((w, i) => (
                    <li key={`w${i}`}>
                      <span className="font-semibold">{w.id === "unverified" ? "Unverified function. " : "Check this. "}</span>
                      {w.text}
                    </li>
                  ))}
                  {ai.notes.map((n, i) => (
                    <li key={`n${i}`}>{n}</li>
                  ))}
                </ul>
              )}
              {ai.assumptions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">{ai.correctedFormula ? "This fix assumes" : "Assumptions"}</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800">
                    {ai.assumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
              {ai.preventionTips.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">How to prevent it</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800">
                    {ai.preventionTips.map((a, i) => (
                      <li key={i} className="break-words">
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          {ai && ai.status !== "ok" && (
            <div className={`rounded-xl border p-4 text-sm ${ai.status === "refused" ? "border-slate-200 bg-slate-50" : "border-blue-200 bg-primary-soft"}`}>
              <p className="font-semibold">{ai.status === "refused" ? "Not a formula problem" : "The AI needs one more detail"}</p>
              <p className="mt-1">{ai.message}</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <button type="button" className={btnSecondary} disabled={!formula.trim()} onClick={() => save(report(formula, error, findings, stale ? null : ai), "formula-error-report.md")}>
              Download report
            </button>
            <p className="text-xs text-slate-600">Fixes are suggestions: test them on a copy of your file.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

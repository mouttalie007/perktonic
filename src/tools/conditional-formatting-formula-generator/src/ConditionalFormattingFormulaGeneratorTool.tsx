"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { sampleInput } from "../fixtures/sampleInput";
import { sampleResult } from "../fixtures/sampleResult";
import { APPS, LIMIT_TEXT, MAX_DESCRIPTION_CHARS, type App } from "./limits";
import { buildRule, COLOURS, defaultParams, findTemplate, TEMPLATES, type Built, type ColourId, type ParamKey, type Params } from "./logic/templates";
import type { AiRule, ApiResponse } from "./types";
import { btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const ENDPOINT = "/api/tools/conditional-formatting-formula-generator";

const START_TEMPLATE = "row-by-value";
const GROUPS = [...new Set(TEMPLATES.map((t) => t.group))];
type Failure = { message: string; retry: boolean };

function save(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ruleText(title: string, formula: string | null, appliesTo: string, format: string | null, stepsExcel: string[], stepsSheets: string[], notes: string[]): string {
  return [title, "", formula ? `Formula: ${formula}` : "No formula needed (built-in rule).", `Applies to: ${appliesTo}`, format ? `Format: ${format}` : "", "", "Excel:", ...stepsExcel.map((s, i) => `${i + 1}. ${s}`), "", "Google Sheets:", ...stepsSheets.map((s, i) => `${i + 1}. ${s}`), ...(notes.length ? ["", "Notes:", ...notes.map((n) => `- ${n}`)] : [])].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n") + "\n";
}

function Steps({ excel, sheets }: { excel: string[]; sheets: string[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[
        ["In Excel", excel],
        ["In Google Sheets", sheets],
      ].map(([label, steps]) => (
        <div key={label as string} className="min-w-0 rounded-xl border border-slate-200 p-3">
          <h4 className="text-sm font-semibold">{label as string}</h4>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-800">
            {(steps as string[]).map((s, i) => (
              <li key={i} className="[overflow-wrap:anywhere]">
                {s}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

function FormulaBox({ formula, onCopy, label }: { formula: string; onCopy: () => void; label: string }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-700">{label}</h4>
        <button type="button" className={btnSecondary} onClick={onCopy}>
          Copy formula
        </button>
      </div>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-sm text-navy" tabIndex={0} aria-label={label}>
        {formula}
      </pre>
    </div>
  );
}

export default function ConditionalFormattingFormulaGeneratorTool() {
  const uid = useId();
  // Part 1: rule library (in the browser).
  const [templateId, setTemplateId] = useState(START_TEMPLATE);
  const [params, setParams] = useState<Params>(defaultParams(findTemplate(START_TEMPLATE)!));
  // Part 2: AI.
  const [description, setDescription] = useState(sampleInput.description);
  const [range, setRange] = useState(sampleInput.range);
  const [app, setApp] = useState<App>(sampleInput.platform);
  const [ai, setAi] = useState<AiRule>(sampleResult);
  const [isSample, setIsSample] = useState(true);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const aiHeading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const template = findTemplate(templateId)!;
  const built = useMemo(() => buildRule(templateId, params), [templateId, params]);

  const pick = (id: string) => {
    setTemplateId(id);
    setParams(defaultParams(findTemplate(id)!));
  };
  const set = (k: ParamKey, v: string) => setParams((p) => ({ ...p, [k]: v }));

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${what} copied.`);
    } catch {
      setNotice("Your browser blocked clipboard access. Select the formula and copy it by hand.");
    }
  };

  const ask = async () => {
    if (description.trim().length < 5) return setFailure({ message: "Describe the rule you need (a few words at least).", retry: false });
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setFailure(null);
    setNotice(null);
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ description, range, platform: app }), signal: ctrl.signal });
      const body = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!body) throw new Error("The AI rule writer is temporarily unavailable. The rule library above still works.");
      if (body.ok) {
        setAi(body.data);
        setIsSample(false);
        setTimeout(() => aiHeading.current?.focus(), 0);
      } else setFailure({ message: body.error.message, retry: res.status === 502 || res.status === 500 });
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setFailure({ message: e instanceof Error && !(e instanceof TypeError) ? e.message : "Could not reach the AI rule writer. The rule library above still works offline.", retry: true });
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

  const rule: Built | null = built.ok ? built.rule : null;

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-lib`}>
        <h2 id={`${uid}-lib`} className="text-lg font-semibold">
          Rule library <span className="text-sm font-normal text-slate-600">(works in your browser)</span>
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor={`${uid}-t`} className="block text-sm font-medium text-slate-700">
              Rule
            </label>
            <select id={`${uid}-t`} className={`${inputCls} mt-1`} value={templateId} onChange={(e) => pick(e.target.value)}>
              {GROUPS.map((g) => (
                <optgroup key={g} label={g}>
                  {TEMPLATES.filter((t) => t.group === g).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          {(Object.entries(template.params) as [ParamKey, string][]).map(([k, label]) =>
            k === "colour" ? (
              <div key={k}>
                <label htmlFor={`${uid}-p-${k}`} className="block text-sm font-medium text-slate-700">
                  {label}
                </label>
                <select id={`${uid}-p-${k}`} className={`${inputCls} mt-1`} value={params.colour} onChange={(e) => set("colour", e.target.value as ColourId)}>
                  {(Object.keys(COLOURS) as ColourId[]).map((c) => (
                    <option key={c} value={c}>
                      {COLOURS[c].label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div key={k}>
                <label htmlFor={`${uid}-p-${k}`} className="block text-sm font-medium text-slate-700">
                  {label}
                </label>
                <input id={`${uid}-p-${k}`} className={`${inputCls} mt-1 ${k === "range" || k === "column" || k === "source" ? "font-mono" : ""}`} value={params[k]} maxLength={120} onChange={(e) => set(k, e.target.value)} spellCheck={false} aria-invalid={!built.ok ? true : undefined} />
              </div>
            ),
          )}
        </div>

        <div className="mt-5 min-h-40 space-y-4" aria-live="polite">
          {!built.ok && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              {built.error}
            </p>
          )}
          {rule && (
            <>
              {rule.formula ? <FormulaBox formula={rule.formula} label={rule.kind === "cf" ? "Conditional formatting formula" : "Validation formula or source"} onCopy={() => void copy(rule.formula!, "Formula")} /> : <p className="text-sm text-slate-800">No formula needed: this is a built-in rule. Follow the steps below.</p>}
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-slate-700">Applies to</dt>
                  <dd className="font-mono">{rule.appliesTo}</dd>
                </div>
                {rule.format && (
                  <div>
                    <dt className="font-semibold text-slate-700">Format</dt>
                    <dd className="flex items-center gap-2">
                      <span aria-hidden="true" className="inline-block h-4 w-8 rounded border border-slate-300" style={{ backgroundColor: COLOURS[params.colour].fill }} />
                      {rule.format}
                    </dd>
                  </div>
                )}
              </dl>
              <Steps excel={rule.stepsExcel} sheets={rule.stepsSheets} />
              {rule.notes.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {rule.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnSecondary} onClick={() => save(ruleText(template.title, rule.formula, rule.appliesTo, rule.format, rule.stepsExcel, rule.stepsSheets, rule.notes), `${template.id}.txt`)}>
                  Download rule (.txt)
                </button>
                <button type="button" className={btnSecondary} onClick={() => pick(START_TEMPLATE)}>
                  Try an example
                </button>
              </div>
            </>
          )}
          {notice && <p className="text-sm text-slate-700">{notice}</p>}
        </div>
      </section>

      <section className={card} aria-labelledby={`${uid}-ai-in`}>
        <h2 id={`${uid}-ai-in`} className="text-lg font-semibold">
          Describe your own rule <span className="text-sm font-normal text-slate-600">(AI)</span>
        </h2>
        <form
          className="mt-3 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
        >
          <div>
            <label htmlFor={`${uid}-d`} className="block text-sm font-medium text-slate-700">
              What should the rule do?
            </label>
            <textarea id={`${uid}-d`} className={`${inputCls} mt-1 min-h-20`} value={description} maxLength={MAX_DESCRIPTION_CHARS} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Colour the row when the invoice is unpaid and older than 30 days" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-r`} className="block text-sm font-medium text-slate-700">
                Range the rule applies to
              </label>
              <input id={`${uid}-r`} className={`${inputCls} mt-1 font-mono`} value={range} maxLength={80} onChange={(e) => setRange(e.target.value)} placeholder="A2:F100" spellCheck={false} />
            </div>
            <div>
              <label htmlFor={`${uid}-a`} className="block text-sm font-medium text-slate-700">
                App
              </label>
              <select id={`${uid}-a`} className={`${inputCls} mt-1`} value={app} onChange={(e) => setApp(e.target.value as App)}>
                {APPS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className={btnPrimary} disabled={busy}>
              {busy ? "Writing the rule…" : "Describe your own rule"}
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
                  setDescription(sampleInput.description);
                  setRange(sampleInput.range);
                  setApp(sampleInput.platform);
                  setAi(sampleResult);
                  setIsSample(true);
                  setFailure(null);
                }}
              >
                Try an example
              </button>
            )}
          </div>
          <p className="text-xs text-slate-600">The library above never leaves your browser. When you press Describe your own rule, the description, range and app are sent to our server and to the AI provider. Limit: {LIMIT_TEXT}.</p>
        </form>
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

      <section className={`${card} min-h-48`} aria-labelledby={`${uid}-ai-out`} aria-busy={busy}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={`${uid}-ai-out`} ref={aiHeading} tabIndex={-1} className="text-lg font-semibold focus:outline-none">
            Your custom rule
          </h2>
          {isSample && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Example result (nothing was sent)</span>}
          {!isSample && ai.cached && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Answered from a short-lived cache</span>}
        </div>
        <div aria-live="polite" className="mt-3 space-y-4">
          {busy && <p className="text-sm text-slate-700">Writing your rule… this usually takes a few seconds.</p>}
          {ai.status === "ok" ? (
            <>
              <p className="text-sm text-slate-700">{ai.kind === "conditional_formatting" ? "Conditional formatting" : "Data validation"} rule for {ai.appliesTo}</p>
              <FormulaBox formula={ai.formula} label="Rule formula" onCopy={() => void copy(ai.formula, "Formula")} />
              {ai.warnings.length > 0 && (
                <ul role="alert" className="space-y-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  {ai.warnings.map((w, i) => (
                    <li key={i}>
                      <span className="font-semibold">Check this. </span>
                      {w}
                    </li>
                  ))}
                </ul>
              )}
              {ai.formatSuggestion && <p className="text-sm text-slate-800">Format: {ai.formatSuggestion}</p>}
              <Steps excel={ai.stepsExcel} sheets={ai.stepsSheets} />
              {[...ai.notes, ...ai.assumptions].length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {ai.notes.map((n, i) => (
                    <li key={`n${i}`}>{n}</li>
                  ))}
                  {ai.assumptions.map((n, i) => (
                    <li key={`a${i}`}>Assumed: {n}</li>
                  ))}
                </ul>
              )}
              <button type="button" className={btnSecondary} onClick={() => save(ruleText("Custom rule", ai.formula, ai.appliesTo, ai.formatSuggestion, ai.stepsExcel, ai.stepsSheets, [...ai.notes, ...ai.warnings.map((w) => `Warning: ${w}`)]), "custom-rule.txt")}>
                Download rule (.txt)
              </button>
            </>
          ) : (
            <div className={`rounded-xl border p-4 text-sm ${ai.status === "refused" ? "border-slate-200 bg-slate-50" : "border-blue-200 bg-primary-soft"}`}>
              <p className="font-semibold">{ai.status === "refused" ? "Not a formatting or validation rule" : "The AI needs one more detail"}</p>
              <p className="mt-1">{ai.message}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

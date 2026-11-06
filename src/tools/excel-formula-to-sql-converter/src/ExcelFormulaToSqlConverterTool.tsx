"use client";

import { useEffect, useId, useRef, useState } from "react";
import { sampleInput } from "../fixtures/sampleInput";
import { sampleResult } from "../fixtures/sampleResult";
import { LIMIT_TEXT, MAX_SCHEMA_CHARS, MAX_SOURCE_CHARS, TARGETS, type Target } from "./limits";
import type { ApiResponse, ConvertResult } from "./types";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const ENDPOINT = "/api/tools/excel-formula-to-sql-converter";

type Failure = { message: string; retry: boolean };
type Ok = Extract<ConvertResult, { status: "ok" }>;

function save(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CheckBadge({ r }: { r: Ok }) {
  const label = TARGETS.find((t) => t.id === r.target)!.label;
  if (r.check.kind === "pandas") {
    const p = r.check.result;
    return (
      <div className={`rounded-xl border p-3 text-sm ${p.balanced ? "border-slate-200 bg-slate-50 text-slate-800" : "border-amber-300 bg-amber-50 text-amber-950"}`} role={p.balanced ? undefined : "alert"}>
        <p className="font-semibold">Python: not run, not syntax-checked.</p>
        <p className="mt-1">{p.balanced ? "Brackets and quotes are balanced." : `Check this: ${p.message}`}</p>
        <p className="mt-1">Import lines: {p.imports.length ? p.imports.map((i) => <code key={i} className="mr-2 font-mono text-xs">{i}</code>) : "none found. Add the imports the code needs (pandas as pd, numpy as np)."}</p>
      </div>
    );
  }
  const s = r.check.result;
  if (s.status === "ok") return <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900">SQL syntax checked as {label}: no errors found. The query was not run.</p>;
  if (s.status === "skipped") return <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">SQL syntax not checked: {s.reason}</p>;
  return (
    <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <p className="font-semibold">
        The {label} syntax check failed{s.line ? ` on line ${s.line}` : ""}. The code is shown anyway; fix it before running.
      </p>
      <p className="mt-1 break-words font-mono text-xs">{s.message}</p>
    </div>
  );
}

export default function ExcelFormulaToSqlConverterTool() {
  const uid = useId();
  const [source, setSource] = useState(sampleInput.source);
  const [schema, setSchema] = useState(sampleInput.schema);
  const [target, setTarget] = useState<Target>(sampleInput.target);
  const [result, setResult] = useState<ConvertResult>(sampleResult);
  const [isSample, setIsSample] = useState(true);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const convert = async () => {
    if (source.trim().length < 3) return setFailure({ message: "Paste a formula or describe the spreadsheet logic.", retry: false });
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setFailure(null);
    setNotice(null);
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source, schema, target }), signal: ctrl.signal });
      const body = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!body) throw new Error("The converter did not answer properly. Please try again.");
      if (body.ok) {
        setResult(body.data);
        setIsSample(false);
        setTimeout(() => heading.current?.focus(), 0);
      } else setFailure({ message: body.error.message, retry: res.status === 502 || res.status === 500 });
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setFailure({ message: e instanceof Error && !(e instanceof TypeError) ? e.message : "Could not reach the converter. Check your connection and try again.", retry: true });
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

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Code copied.");
    } catch {
      setNotice("Your browser blocked clipboard access. Use the download instead.");
    }
  };

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <h2 id={`${uid}-in`} className="text-lg font-semibold">
          Spreadsheet logic to convert
        </h2>
        <form
          className="mt-3 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void convert();
          }}
        >
          <div>
            <label htmlFor={`${uid}-s`} className="block text-sm font-medium text-slate-700">
              Formula or description
            </label>
            <textarea id={`${uid}-s`} className={`${inputCls} mt-1 min-h-24 font-mono`} value={source} maxLength={MAX_SOURCE_CHARS} spellCheck={false} onChange={(e) => setSource(e.target.value)} placeholder='=SUMIFS(C:C,A:A,"North")' aria-describedby={`${uid}-sc`} />
            <p id={`${uid}-sc`} className="mt-1 text-xs text-slate-600">
              {source.length.toLocaleString("en-US")} / {MAX_SOURCE_CHARS.toLocaleString("en-US")} characters
            </p>
          </div>
          <div>
            <label htmlFor={`${uid}-t`} className="block text-sm font-medium text-slate-700">
              Table and columns <span className="font-normal text-slate-600">(optional, with types)</span>
            </label>
            <textarea id={`${uid}-t`} className={`${inputCls} mt-1 min-h-16 font-mono`} value={schema} maxLength={MAX_SCHEMA_CHARS} spellCheck={false} onChange={(e) => setSchema(e.target.value)} placeholder="sales(region text, order_date date, amount numeric)" />
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Convert to</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-5">
              {TARGETS.map((t) => (
                <label key={t.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${target === t.id ? "border-primary bg-primary-soft" : "border-slate-300"}`}>
                  <input type="radio" name={`${uid}-tg`} className={`accent-primary ${focusRing}`} checked={target === t.id} onChange={() => setTarget(t.id)} />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className={btnPrimary} disabled={busy}>
              {busy ? "Converting…" : "Convert"}
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
                  setSource(sampleInput.source);
                  setSchema(sampleInput.schema);
                  setTarget(sampleInput.target);
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
          <p className="text-xs text-slate-600">When you press Convert, the formula and table description are sent to our server and to the AI provider. The tool never runs the code and never connects to a database. Limit: {LIMIT_TEXT}.</p>
        </form>
      </section>

      {failure && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between">
          <p>{failure.message}</p>
          {failure.retry && (
            <button type="button" className={btnSecondary} onClick={() => void convert()} disabled={busy}>
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
        <div aria-live="polite" className="mt-3 space-y-4">
          {busy && <p className="text-sm text-slate-700">Converting… this usually takes a few seconds.</p>}
          {notice && <p className="text-sm text-slate-700">{notice}</p>}
          {result.status === "ok" ? (
            <>
              <CheckBadge r={result} />
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-700">{TARGETS.find((t) => t.id === result.target)!.label} code</h3>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={btnSecondary} onClick={() => void copy(result.code)}>
                      Copy code
                    </button>
                    <button type="button" className={btnSecondary} onClick={() => save(result.code + "\n", result.target === "pandas" ? "converted.py" : "converted.sql")}>
                      Download {result.target === "pandas" ? ".py" : ".sql"}
                    </button>
                  </div>
                </div>
                <pre className="mt-2 max-h-[28rem] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[13px] leading-5 text-navy" tabIndex={0} aria-label="Converted code">
                  {result.code}
                </pre>
              </div>
              {(result.warnings.length > 0 || result.notes.length > 0) && (
                <ul role="alert" className="space-y-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  {[...result.notes, ...result.warnings].map((w, i) => (
                    <li key={i}>
                      <span className="font-semibold">No exact equivalent / check this. </span>
                      {w}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-sm leading-relaxed text-slate-800">{result.explanation}</p>
              <div>
                <h3 className="text-sm font-semibold text-slate-700">What became what</h3>
                <div role="region" aria-label="Mapping table" tabIndex={0} className={`mt-2 overflow-x-auto rounded-lg ${focusRing}`}>
                  <table className="w-full min-w-[34rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-600">
                        <th className="py-1 pr-3 font-medium">Spreadsheet</th>
                        <th className="py-1 pr-3 font-medium">{result.target === "pandas" ? "pandas" : "SQL"}</th>
                        <th className="py-1 font-medium">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.mapping.map((m, i) => (
                        <tr key={i} className="border-b border-slate-100 align-top">
                          <td className="py-1.5 pr-3 font-mono text-xs">{m.spreadsheet}</td>
                          <td className="py-1.5 pr-3 font-mono text-xs">{m.target}</td>
                          <td className="py-1.5">{m.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {result.assumptions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Assumptions</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800">
                    {result.assumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className={`rounded-xl border p-4 text-sm ${result.status === "refused" ? "border-slate-200 bg-slate-50" : "border-blue-200 bg-primary-soft"}`}>
              <p className="font-semibold">{result.status === "refused" ? "Not a conversion request" : "The AI needs one more detail"}</p>
              <p className="mt-1">{result.message}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

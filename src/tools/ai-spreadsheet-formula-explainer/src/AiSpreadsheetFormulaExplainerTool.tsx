"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { sampleInput } from "../fixtures/sampleInput";
import { sampleResult } from "../fixtures/sampleResult";
import { LIMIT_TEXT, MAX_FORMULA_CHARS, MAX_SAMPLE_CHARS } from "./limits";
import { FUNCTION_COUNT } from "./logic/functionInfo";
import { analyse, caretWindow, outline, type TreeNode } from "./logic/tree";
import type { ApiResponse, Narration } from "./types";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const ENDPOINT = "/api/tools/ai-spreadsheet-formula-explainer";

const KIND_CLS: Record<TreeNode["kind"], string> = {
  function: "bg-primary-soft text-primary-dark",
  call: "bg-primary-soft text-primary-dark",
  operator: "bg-slate-100 text-slate-800",
  reference: "bg-emerald-50 text-emerald-900",
  table: "bg-emerald-50 text-emerald-900",
  name: "bg-violet-50 text-violet-900",
  number: "bg-amber-50 text-amber-950",
  text: "bg-amber-50 text-amber-950",
  logical: "bg-amber-50 text-amber-950",
  error: "bg-red-50 text-red-900",
  array: "bg-amber-50 text-amber-950",
  group: "bg-slate-100 text-slate-800",
  empty: "bg-slate-100 text-slate-600",
};

type Failure = { message: string; retry: boolean };
type OpenMode = "default" | "all" | "none";

function save(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function NodeLine({ node }: { node: TreeNode }) {
  return (
    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
      {node.argName && <span className="text-xs font-medium text-slate-600">{node.argName}</span>}
      <code className={`max-w-full break-all rounded-md px-1.5 py-0.5 font-mono text-[13px] ${KIND_CLS[node.kind]} ${node.known ? "" : "ring-1 ring-amber-400"}`}>{node.kind === "function" ? `${node.label}( )` : node.label}</code>
      <span className="text-sm text-slate-700">
        {node.description}
        {node.returns && <span className="text-slate-600"> Returns {node.returns}.</span>}
      </span>
    </span>
  );
}

function TreeItem({ node, depth, mode }: { node: TreeNode; depth: number; mode: OpenMode }) {
  if (!node.children.length) {
    return (
      <li className="py-1 pl-5">
        <NodeLine node={node} />
      </li>
    );
  }
  const open = mode === "all" || (mode === "default" && depth < 4);
  return (
    <li className="py-1">
      <details open={open}>
        <summary className={`flex cursor-pointer list-none gap-1 rounded-md ${focusRing}`}>
          <span aria-hidden="true" className="w-4 shrink-0 select-none text-slate-500 transition-transform motion-reduce:transition-none [details[open]>summary>&]:rotate-90">
            ▸
          </span>
          <NodeLine node={node} />
        </summary>
        <ul className="ml-2 border-l border-slate-200 pl-2 sm:ml-3 sm:pl-3">
          {node.children.map((c) => (
            <TreeItem key={c.id} node={c} depth={depth + 1} mode={mode} />
          ))}
        </ul>
      </details>
    </li>
  );
}

function markdown(formula: string, root: TreeNode | null, n: Narration | null): string {
  const parts = ["# Formula explanation", "", "```", formula, "```", ""];
  if (root) parts.push("## Structure", "", outline(root), "");
  if (n?.status === "ok") {
    parts.push("## In plain English", "", n.summary, "");
    n.steps.forEach((s, i) => parts.push(`${i + 1}. \`${s.part}\`: ${s.text}`));
    parts.push("");
  }
  parts.push("Generated with the Formula Explainer on perktonic.com. The tool does not calculate values.");
  return parts.join("\n") + "\n";
}

export default function AiSpreadsheetFormulaExplainerTool() {
  const uid = useId();
  const [formula, setFormula] = useState(sampleInput.formula);
  const [samples, setSamples] = useState(sampleInput.sampleValues);
  const [narration, setNarration] = useState<Narration | null>(sampleResult);
  const [isSample, setIsSample] = useState(true);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<OpenMode>("default");
  const [treeKey, setTreeKey] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const narrHeading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const deferred = useDeferredValue(formula);
  const analysis = useMemo(() => (deferred.trim() ? analyse(deferred) : null), [deferred]);
  const caret = analysis && !analysis.ok ? caretWindow(deferred, analysis.pos) : null;
  const stale = narration !== null && narration.formula.trim() !== formula.trim();

  const explain = async () => {
    if (!formula.trim()) {
      setFailure({ message: "Paste a formula first.", retry: false });
      return;
    }
    const check = analyse(formula);
    if (!check.ok) {
      setFailure({ message: `Fix the formula first: ${check.message}`, retry: false });
      return;
    }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setFailure(null);
    setNotice(null);
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ formula, sampleValues: samples }), signal: ctrl.signal });
      const body = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!body) throw new Error("The plain-English explanation is temporarily unavailable. The structure view still works.");
      if (body.ok) {
        setNarration(body.data);
        setIsSample(false);
        setTimeout(() => narrHeading.current?.focus(), 0);
      } else {
        setFailure({ message: body.error.message, retry: res.status === 502 || res.status === 500 });
      }
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setFailure({ message: e instanceof Error && !(e instanceof TypeError) ? e.message : "Could not reach the explanation service. The structure view still works offline.", retry: true });
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
      setNotice("Your browser blocked clipboard access. Use the download instead.");
    }
  };

  const expandAll = (m: OpenMode) => {
    setMode(m);
    setTreeKey((k) => k + 1);
  };

  const root = analysis?.ok ? analysis.root : null;

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <h2 id={`${uid}-in`} className="text-lg font-semibold">
          Formula to explain
        </h2>
        <form
          className="mt-3 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void explain();
          }}
        >
          <div>
            <label htmlFor={`${uid}-f`} className="block text-sm font-medium text-slate-700">
              Formula (Excel, Google Sheets or LibreOffice, English function names)
            </label>
            <textarea
              id={`${uid}-f`}
              className={`${inputCls} mt-1 min-h-28 font-mono`}
              value={formula}
              maxLength={MAX_FORMULA_CHARS}
              spellCheck={false}
              onChange={(e) => setFormula(e.target.value)}
              placeholder='=IFERROR(VLOOKUP(A2,Prices!A:C,3,FALSE),"Not found")'
              aria-describedby={`${uid}-fc`}
              aria-invalid={analysis && !analysis.ok ? true : undefined}
            />
            <p id={`${uid}-fc`} className="mt-1 text-xs text-slate-600">
              {formula.length.toLocaleString("en-US")} / {MAX_FORMULA_CHARS.toLocaleString("en-US")} characters. The structure below updates as you type and never leaves your browser.
            </p>
          </div>
          <div>
            <label htmlFor={`${uid}-s`} className="block text-sm font-medium text-slate-700">
              Sample values or notes <span className="font-normal text-slate-600">(optional, only used for the plain-English explanation)</span>
            </label>
            <textarea id={`${uid}-s`} className={`${inputCls} mt-1 min-h-16`} value={samples} maxLength={MAX_SAMPLE_CHARS} onChange={(e) => setSamples(e.target.value)} placeholder="e.g. Column A holds order IDs, column C holds amounts" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className={btnPrimary} disabled={busy}>
              {busy ? "Explaining…" : "Explain in plain English"}
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
                  setFormula(sampleInput.formula);
                  setSamples(sampleInput.sampleValues);
                  setNarration(sampleResult);
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
            The structure view runs in your browser. Only when you press Explain in plain English are the formula and your notes sent to our server and to the AI provider. Limit: {LIMIT_TEXT}.
          </p>
        </form>
      </section>

      <section className={`${card} min-h-48`} aria-labelledby={`${uid}-tree`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={`${uid}-tree`} className="text-lg font-semibold">
            Structure <span className="text-sm font-normal text-slate-600">(works offline)</span>
          </h2>
          {root && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnSecondary} onClick={() => expandAll("all")}>
                Expand all
              </button>
              <button type="button" className={btnSecondary} onClick={() => expandAll("none")}>
                Collapse all
              </button>
              <button type="button" className={btnSecondary} onClick={() => void copy(outline(root), "Outline")}>
                Copy outline
              </button>
            </div>
          )}
        </div>
        {!analysis && <p className="mt-3 text-sm text-slate-700">Paste a formula above to see its structure: every function with its purpose, its arguments and what it returns.</p>}
        {analysis && !analysis.ok && caret && (
          <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <p className="font-semibold">The formula does not parse at position {analysis.pos + 1}.</p>
            <p className="mt-1">{analysis.message}</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-2 font-mono text-[13px] leading-5 text-navy" aria-label="Where parsing stopped" tabIndex={0}>
              {caret.line}
              {"\n"}
              <span className="text-red-700">{caret.caret}</span>
            </pre>
          </div>
        )}
        {analysis?.ok && (
          <>
            <p className="mt-2 text-sm text-slate-700">
              {analysis.functionCount} function{analysis.functionCount === 1 ? "" : "s"}, nested {analysis.depth} level{analysis.depth === 1 ? "" : "s"} deep. Descriptions come from our dictionary of {FUNCTION_COUNT} common functions; the tool does not calculate values.
            </p>
            <ul key={treeKey} className="mt-3 overflow-x-auto" aria-label="Formula structure">
              <TreeItem node={analysis.root} depth={0} mode={mode} />
            </ul>
          </>
        )}
      </section>

      {failure && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between">
          <p>{failure.message}</p>
          {failure.retry && (
            <button type="button" className={btnSecondary} onClick={() => void explain()} disabled={busy}>
              Try again
            </button>
          )}
        </div>
      )}

      <section className={`${card} min-h-48`} aria-labelledby={`${uid}-n`} aria-busy={busy}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={`${uid}-n`} ref={narrHeading} tabIndex={-1} className="text-lg font-semibold focus:outline-none">
            In plain English
          </h2>
          {isSample && narration && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Example result (nothing was sent)</span>}
          {!isSample && narration?.cached && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Answered from a short-lived cache</span>}
        </div>
        <div aria-live="polite" className="mt-3 space-y-3">
          {busy && <p className="text-sm text-slate-700">Writing the explanation… this usually takes a few seconds.</p>}
          {notice && <p className="text-sm text-slate-700">{notice}</p>}
          {!narration && !busy && <p className="text-sm text-slate-700">Press Explain in plain English to get a short summary and a step-by-step reading of the formula.</p>}
          {narration && stale && <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">This explanation is for an earlier version of the formula. Press Explain in plain English to update it.</p>}
          {narration?.status === "ok" && (
            <>
              <p className="text-sm leading-relaxed text-slate-800">{narration.summary}</p>
              <ol className="list-decimal space-y-2 pl-5 text-sm">
                {narration.steps.map((s, i) => (
                  <li key={i}>
                    <code className="break-all rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-navy">{s.part}</code>
                    <span className="text-slate-800"> {s.text}</span>
                  </li>
                ))}
              </ol>
              {narration.dropped > 0 && (
                <p className="text-sm text-slate-700">
                  {narration.dropped} step{narration.dropped === 1 ? " was" : "s were"} left out because {narration.dropped === 1 ? "it quoted" : "they quoted"} text that is not in your formula.
                </p>
              )}
              <p className="text-xs text-slate-600">Explanations describe what each part returns; they do not calculate values. Check important results in your spreadsheet.</p>
            </>
          )}
          {narration && narration.status !== "ok" && (
            <div className={`rounded-xl border p-4 text-sm ${narration.status === "refused" ? "border-slate-200 bg-slate-50" : "border-blue-200 bg-primary-soft"}`}>
              <p className="font-semibold">{narration.status === "refused" ? "Not a formula to explain" : "The AI needs one more detail"}</p>
              <p className="mt-1">{narration.message}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <button type="button" className={btnSecondary} disabled={!root} onClick={() => save(markdown(formula, root, stale ? null : narration), "formula-explanation.md")}>
              Download as Markdown
            </button>
            {narration?.status === "ok" && !stale && (
              <button type="button" className={btnSecondary} onClick={() => void copy([narration.summary, ...narration.steps.map((s, i) => `${i + 1}. ${s.part}: ${s.text}`)].join("\n"), "Explanation")}>
                Copy explanation
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

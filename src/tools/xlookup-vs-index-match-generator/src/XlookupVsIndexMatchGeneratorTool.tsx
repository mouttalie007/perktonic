"use client";

import { useId, useMemo, useState } from "react";
import { COMPARISON, comparisonCsv, type Verdict } from "./logic/compare";
import { convertAll, ConvertError, type ConversionResult, type Style } from "./logic/convert";
import { MAX_FORMULA_LENGTH } from "./logic/formula";
import { EXAMPLES } from "../fixtures/examples";
import { btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";


const VERDICT: Record<Verdict, { label: string; cls: string }> = {
  yes: { label: "Yes", cls: "bg-green-100 text-green-900" },
  partly: { label: "Partly", cls: "bg-amber-100 text-amber-900" },
  no: { label: "No", cls: "bg-red-100 text-red-900" },
};

type Target = "XLOOKUP" | "INDEX-MATCH" | "VLOOKUP";

const MATCH_LABEL = { exact: "Exact match", nextSmaller: "Exact or next smaller (approximate)", nextLarger: "Exact or next larger", wildcard: "Wildcard match (* and ?)" } as const;

export default function XlookupVsIndexMatchGeneratorTool() {
  const uid = useId();
  const [formula, setFormula] = useState(EXAMPLES[0].formula);
  const [target, setTarget] = useState<Target>("XLOOKUP");
  const [exampleIndex, setExampleIndex] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);

  const state = useMemo((): { kind: "empty" } | { kind: "error"; message: string } | { kind: "done"; result: ConversionResult } => {
    if (formula.trim() === "") return { kind: "empty" };
    if (formula.length > MAX_FORMULA_LENGTH) return { kind: "error", message: `The formula is ${formula.length.toLocaleString("en-US")} characters long. Excel allows at most ${MAX_FORMULA_LENGTH.toLocaleString("en-US")}.` };
    try {
      return { kind: "done", result: convertAll(formula) };
    } catch (e) {
      return { kind: "error", message: e instanceof ConvertError ? e.message : "This formula could not be read. Check the parentheses and commas." };
    }
  }, [formula]);

  const tryExample = () => {
    const ex = EXAMPLES[exampleIndex % EXAMPLES.length];
    setExampleIndex((i) => i + 1);
    setFormula(ex.formula);
    setNotice(null);
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${what} copied.`);
    } catch {
      setNotice("Your browser blocked clipboard access. Select the formula and press Ctrl+C or Cmd+C.");
    }
  };

  const downloadCsv = () => {
    const url = URL.createObjectURL(new Blob([comparisonCsv()], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "lookup-comparison.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const result = state.kind === "done" ? state.result : null;
  const ordered = result
    ? [...result.outputs].sort((a, b) => (a.style === target || (target === "VLOOKUP" && a.style === "HLOOKUP") ? -1 : b.style === target || (target === "VLOOKUP" && b.style === "HLOOKUP") ? 1 : 0))
    : [];
  const isTarget = (s: Style) => s === target || (target === "VLOOKUP" && s === "HLOOKUP");

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-in`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>1</span>Your lookup formula</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={tryExample}>Try an example</button>
            <button type="button" className={btnSecondary} onClick={() => setFormula("")} disabled={formula === ""}>Clear</button>
          </div>
        </div>
        <label htmlFor={`${uid}-f`} className="mt-4 block text-sm font-medium">Paste a VLOOKUP, HLOOKUP, INDEX/MATCH or XLOOKUP formula</label>
        <textarea
          id={`${uid}-f`}
          className={`${inputCls} mt-1 h-24 resize-y font-mono`}
          value={formula}
          onChange={(e) => {
            setFormula(e.target.value);
            setNotice(null);
          }}
          placeholder='=VLOOKUP(A2, Products!$A$2:$D$500, 3, FALSE)'
          spellCheck={false}
          aria-describedby={`${uid}-help`}
          aria-invalid={state.kind === "error" ? true : undefined}
        />
        <p id={`${uid}-help`} className="mt-1 text-xs text-slate-ink">
          Up to {MAX_FORMULA_LENGTH.toLocaleString("en-US")} characters. Formulas with ; as separator work too. IFERROR/IFNA around the lookup and formulas around it are kept. Converted in your browser; nothing is uploaded.
        </p>
        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Convert to</legend>
          <div className="mt-2 inline-flex flex-wrap rounded-xl border border-slate-300 p-1">
            {(["XLOOKUP", "INDEX-MATCH", "VLOOKUP"] as const).map((t) => (
              <label key={t} className={`cursor-pointer rounded-lg px-4 py-1.5 text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${target === t ? "bg-primary text-white" : "text-navy hover:bg-slate-50"}`}>
                <input type="radio" className="sr-only" name={`${uid}-target`} checked={target === t} onChange={() => setTarget(t)} />
                {t === "VLOOKUP" ? "VLOOKUP / HLOOKUP" : t}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className={card} aria-labelledby={`${uid}-out`}>
        <h2 id={`${uid}-out`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>2</span>Converted formulas</h2>
        <div aria-live="polite" className="mt-3 min-h-6 text-sm text-slate-ink">
          {state.kind === "empty" && "Paste a formula or try an example. The equivalent in every lookup style appears here."}
          {result && `Found a ${result.spec.source} lookup: ${MATCH_LABEL[result.spec.match].toLowerCase()}, ${result.spec.orientation === "vertical" ? "searching down a column" : "searching across a row"}${result.spec.ifNotFound !== null ? `, with ${result.spec.ifNotFound} when nothing is found` : ""}.${result.embedded ? " The rest of your formula is kept around it." : ""}`}
          {notice && <span className="block text-navy">{notice}</span>}
        </div>
        {state.kind === "error" && <div role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.message}</div>}

        <div className="mt-4 min-h-48 space-y-3">
          {ordered.map((o) => (
            <div key={o.style} className={`rounded-xl border p-3 ${isTarget(o.style) ? "border-primary bg-primary-soft/40" : "border-slate-200"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{o.style}{isTarget(o.style) && <span className="ml-2 text-xs font-normal text-primary-dark">your choice</span>}{o.style === result?.spec.source && <span className="ml-2 text-xs font-normal text-slate-ink">(original style)</span>}</h3>
                {o.formula && <button type="button" className={isTarget(o.style) ? btnPrimary : btnSecondary} onClick={() => copy(o.formula!, `${o.style} formula`)}>Copy</button>}
              </div>
              {o.formula ? (
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-white p-2 font-mono text-sm">{o.formula}</pre>
              ) : (
                <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900"><strong>Not possible:</strong> {o.impossible}</p>
              )}
              {o.notes.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-ink">{o.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
            </div>
          ))}
          {state.kind !== "done" && <p className="text-sm text-slate-ink">{state.kind === "empty" ? "No formula yet." : "Fix the formula above to see the conversions."}</p>}
        </div>
      </section>

      <section className={card} aria-labelledby={`${uid}-cmp`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-cmp`} className="text-lg font-semibold">XLOOKUP vs INDEX-MATCH vs VLOOKUP</h2>
          <button type="button" className={btnSecondary} onClick={downloadCsv}>Download table (CSV)</button>
        </div>
        <p className="mt-1 text-sm text-slate-ink">HLOOKUP behaves like VLOOKUP turned on its side: it searches the first row and returns a row below.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th scope="col" className="py-2 pr-3 font-semibold">Topic</th>
                {(["VLOOKUP", "INDEX-MATCH", "XLOOKUP"] as const).map((s) => <th key={s} scope="col" className="px-3 py-2 font-semibold">{s === "VLOOKUP" ? "VLOOKUP / HLOOKUP" : s}</th>)}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((r) => (
                <tr key={r.topic} className="border-b border-slate-100 align-top">
                  <th scope="row" className="py-2 pr-3 font-medium">{r.topic}</th>
                  {(["VLOOKUP", "INDEX-MATCH", "XLOOKUP"] as const).map((s) => (
                    <td key={s} className="px-3 py-2">
                      <span className={`mr-1 inline-block rounded px-1.5 text-xs font-semibold ${VERDICT[r.cells[s].verdict].cls}`}>{VERDICT[r.cells[s].verdict].label}</span>
                      {r.cells[s].text}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

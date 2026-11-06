"use client";

import { useId, useMemo, useState } from "react";
import { ALLOWED, LANGS, MAX_FORMULA_CHARS, PLATFORMS, type Lang, type Platform } from "./logic/settings";
import { FormulaError, translate, type Translation } from "./logic/translate";
import { EXAMPLES } from "../fixtures/examples";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";


const NAME: Record<Platform, string> = { excel: "Excel", sheets: "Google Sheets", calc: "LibreOffice Calc" };
const STATUS: Record<Translation["functions"][number]["status"], { label: string; cls: string }> = {
  same: { label: "same", cls: "bg-slate-100 text-slate-700" },
  localized: { label: "translated name", cls: "bg-blue-100 text-blue-800" },
  renamed: { label: "renamed", cls: "bg-blue-100 text-blue-800" },
  rewritten: { label: "rewritten", cls: "bg-amber-100 text-amber-900" },
  unsupported: { label: "no equivalent", cls: "bg-red-100 text-red-800" },
  unknown: { label: "not in dictionary", cls: "bg-red-100 text-red-800" },
};

function pointer(formula: string, index: number): string {
  const src = formula.trim().replace(/^\{/, "");
  const withEq = src.startsWith("=") || src.startsWith("+") ? src : `=${src}`;
  const start = Math.max(0, index - 40);
  return `${withEq.slice(start, start + 80)}\n${" ".repeat(index - start)}^`;
}

export default function ConvertExcelFormulaToGoogleSheetsTool() {
  const uid = useId();
  const first = EXAMPLES[0];
  const [formula, setFormula] = useState(first.formula);
  const [from, setFrom] = useState<Platform>(first.from);
  const [to, setTo] = useState<Platform>(first.to);
  const [fromLang, setFromLang] = useState<Lang>(first.fromLang);
  const [toLang, setToLang] = useState<Lang>(first.toLang);
  const [calcEnglishNames, setCalcEnglishNames] = useState(true);
  const [example, setExample] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);

  const targets = ALLOWED.filter(([f]) => f === from).map(([, t]) => t);

  const result = useMemo((): { ok: true; value: Translation } | { ok: false; message: string; pointer: string | null } | null => {
    if (formula.trim() === "" || formula.trim() === "=") return null;
    try {
      return { ok: true, value: translate({ formula, from, to, fromLang, toLang, calcEnglishNames }) };
    } catch (e) {
      if (e instanceof FormulaError) return { ok: false, message: e.message, pointer: e.index > 0 ? pointer(formula, e.index) : null };
      return { ok: false, message: "This formula could not be read. Check the brackets and quotes.", pointer: null };
    }
  }, [formula, from, to, fromLang, toLang, calcEnglishNames]);

  const changeFrom = (p: Platform) => {
    setFrom(p);
    const allowed = ALLOWED.filter(([f]) => f === p).map(([, t]) => t);
    if (!allowed.includes(to)) setTo(allowed[0]);
  };

  const swap = () => {
    if (!result?.ok || !ALLOWED.some(([f, t]) => f === to && t === from)) return;
    setFormula(result.value.formula);
    setFrom(to);
    setTo(from);
    setFromLang(toLang);
    setToLang(fromLang);
  };

  const tryExample = () => {
    const e = EXAMPLES[example % EXAMPLES.length];
    setFormula(e.formula);
    setFrom(e.from);
    setTo(e.to);
    setFromLang(e.fromLang);
    setToLang(e.toLang);
    setExample(example + 1);
  };

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  const copy = async () => {
    if (!result?.ok) return;
    try {
      await navigator.clipboard.writeText(result.value.formula);
      flash("Formula copied.");
    } catch {
      flash("Copying was blocked by the browser. Select the formula and copy it by hand.");
    }
  };

  const download = () => {
    if (!result?.ok) return;
    const r = result.value;
    const text = [`From ${NAME[from]} (${fromLang}): ${formula.trim()}`, `To ${NAME[to]} (${toLang}): ${r.formula}`, "", ...r.warnings.map((w) => `Warning: ${w}`), ...r.notes.map((n) => `Note: ${n}`)].join("\r\n");
    const url = URL.createObjectURL(new Blob([text + "\r\n"], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "translated-formula.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const sheetsLocaleLabel = (p: Platform) => (p === "sheets" ? "Spreadsheet locale (separators; names stay English)" : p === "calc" ? "Language" : "Excel language");

  return (
    <div className="space-y-6">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-in`} className="text-lg font-semibold text-navy">Formula</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={tryExample}>
              Try an example
            </button>
            <button type="button" className={btnSecondary} onClick={() => setFormula("")} disabled={formula === ""}>
              Clear
            </button>
          </div>
        </div>
        <label htmlFor={`${uid}-f`} className="mt-3 block text-sm text-slate-600">
          Paste a formula (with or without the leading =; {"{=…}"} for a Ctrl+Shift+Enter array formula)
        </label>
        <textarea id={`${uid}-f`} className={`${inputCls} mt-2 h-28 font-mono`} value={formula} maxLength={MAX_FORMULA_CHARS} onChange={(e) => setFormula(e.target.value)} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="mb-1 text-sm font-semibold text-navy">From</legend>
            <div>
              <label htmlFor={`${uid}-fp`} className="block text-xs text-slate-600">
                Program
              </label>
              <select id={`${uid}-fp`} className={`${inputCls} mt-1`} value={from} onChange={(e) => changeFrom(e.target.value as Platform)}>
                {PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-fl`} className="block text-xs text-slate-600">
                {sheetsLocaleLabel(from)}
              </label>
              <select id={`${uid}-fl`} className={`${inputCls} mt-1`} value={fromLang} onChange={(e) => setFromLang(e.target.value as Lang)}>
                {LANGS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>
          <button type="button" className={`${btnSecondary} sm:mb-0.5`} onClick={swap} disabled={!result?.ok || !ALLOWED.some(([f, t]) => f === to && t === from)} aria-label="Swap: translate the result back the other way">
            ⇄ Swap
          </button>
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="mb-1 text-sm font-semibold text-navy">To</legend>
            <div>
              <label htmlFor={`${uid}-tp`} className="block text-xs text-slate-600">
                Program
              </label>
              <select id={`${uid}-tp`} className={`${inputCls} mt-1`} value={to} onChange={(e) => setTo(e.target.value as Platform)}>
                {targets.map((p) => (
                  <option key={p} value={p}>
                    {NAME[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-tl`} className="block text-xs text-slate-600">
                {sheetsLocaleLabel(to)}
              </label>
              <select id={`${uid}-tl`} className={`${inputCls} mt-1`} value={toLang} onChange={(e) => setToLang(e.target.value as Lang)}>
                {LANGS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>
        </div>
        {(from === "calc" || to === "calc") && (
          <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className={`h-4 w-4 rounded ${focusRing}`} checked={calcEnglishNames} onChange={(e) => setCalcEnglishNames(e.target.checked)} />
            LibreOffice uses English function names (Tools ▸ Options ▸ Calc ▸ Formula)
          </label>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Up to {MAX_FORMULA_CHARS.toLocaleString("en-US")} characters. Translated in your browser with a dictionary of 230+ functions; nothing is sent anywhere.
        </p>
      </section>

      <div aria-live="polite" className="space-y-6">
        {result && !result.ok && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p>
              <strong>This formula could not be read:</strong> {result.message}
            </p>
            {result.pointer && <pre className="mt-2 overflow-x-auto rounded-lg bg-white/70 p-2 font-mono text-xs leading-5">{result.pointer}</pre>}
          </div>
        )}
        {result?.ok && (
          <section className={card} aria-labelledby={`${uid}-out`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id={`${uid}-out`} className="text-lg font-semibold text-navy">
                {NAME[to]} formula
              </h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnPrimary} onClick={copy}>
                  Copy formula
                </button>
                <button type="button" className={btnSecondary} onClick={download}>
                  Download with notes
                </button>
              </div>
            </div>
            {notice && <p className="mt-2 text-sm text-slate-600">{notice}</p>}
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-slate-900 p-4 font-mono text-sm text-slate-100">
              <code>{result.value.formula}</code>
            </pre>
            {result.value.warnings.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <h3 className="font-semibold">Compatibility warnings</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {result.value.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.value.notes.length > 0 && (
              <div className="mt-4 text-sm text-slate-700">
                <h3 className="font-semibold text-navy">Differences to know about</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {result.value.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.value.functions.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-navy">Functions</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {result.value.functions.map((f) => (
                    <li key={f.name} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-xs">
                      <span className="font-mono text-navy">{f.name}</span>
                      <span className={`rounded px-1.5 py-0.5 ${STATUS[f.status].cls}`}>{STATUS[f.status].label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
        {!result && <p className="text-sm text-slate-600">Paste a formula to translate it.</p>}
      </div>
    </div>
  );
}

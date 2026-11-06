"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { entitiesCsv, entitiesJson } from "./logic/export";
import { CATEGORIES, COUNTRIES, CUSTOM_TIMEOUT_MS, MAX_FILE_BYTES, MAX_PASTE_BYTES, type Entity, type Options } from "./logic/types";
import type { Source, WorkerRequest, WorkerResponse } from "./worker/extract.worker";
import { SAMPLE } from "../fixtures/sample";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const btnSmall = `inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-navy hover:bg-slate-50 disabled:opacity-50 ${focusRing}`;
const SHOWN = 200;

function save(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function EntityList({ id, label, rule, items, onCopy }: { id: string; label: string; rule: string; items: Entity[]; onCopy: (text: string, what: string) => void }) {
  const total = items.reduce((n, e) => n + e.count, 0);
  return (
    <section id={`cat-${id}`} className={card} aria-label={label}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-navy">
          {label} <span className="text-sm font-normal text-slate-600">· {items.length.toLocaleString("en-US")} unique{total !== items.length ? `, ${total.toLocaleString("en-US")} in total` : ""}</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSmall} onClick={() => onCopy(items.map((e) => e.normalized).join("\n"), label)}>
            Copy
          </button>
          <button type="button" className={btnSmall} onClick={() => save(entitiesCsv(items), `${id}.csv`, "text/csv;charset=utf-8")}>
            CSV
          </button>
          <button type="button" className={btnSmall} onClick={() => save(entitiesJson(id, items), `${id}.json`, "application/json")}>
            JSON
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">Duplicates: {rule}.</p>
      <ul className="mt-3 divide-y divide-slate-100">
        {items.slice(0, SHOWN).map((e, i) => (
          <li key={i} className="flex flex-col gap-0.5 py-1.5 text-sm sm:flex-row sm:items-baseline sm:gap-3">
            <span className="break-all font-mono text-navy">{e.normalized}</span>
            {e.normalized !== e.value && <span className="break-all text-xs text-slate-500">as written: {e.value}</span>}
            {e.count > 1 && <span className="w-fit rounded bg-slate-100 px-1.5 text-xs text-slate-700">×{e.count}</span>}
            {e.note && <span className="text-xs text-amber-800">{e.note}</span>}
          </li>
        ))}
      </ul>
      {items.length > SHOWN && <p className="mt-1 text-xs text-slate-500">First {SHOWN} of {items.length.toLocaleString("en-US")}; Copy and the downloads include all of them.</p>}
    </section>
  );
}

type Extracted = Extract<WorkerResponse, { type: "extracted" }>;

export default function TextDataParserAndNormalizerTool() {
  const uid = useId();
  const [text, setText] = useState(SAMPLE);
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState<Options>({ country: "GB", dayFirst: true, dedupe: true });
  const [result, setResult] = useState<Extracted | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ label: string; fraction: number } | null>(null);
  const [slow, setSlow] = useState(false);
  const [pattern, setPattern] = useState(String.raw`#[A-Z]-\d+`);
  const [patternFlags, setPatternFlags] = useState("gi");
  const [custom, setCustom] = useState<{ items: Entity[]; ms: number } | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revive, setRevive] = useState(0);

  const mainWorker = useRef<Worker | null>(null);
  const customWorker = useRef<Worker | null>(null);
  const job = useRef(0);
  const customJob = useRef(0);
  const customTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const makeWorker = useCallback((which: "main" | "custom") => {
    const ref = which === "main" ? mainWorker : customWorker;
    if (!ref.current) {
      const w = new Worker(new URL("./worker/extract.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const m = event.data;
        if (which === "main") {
          if (m.jobId !== job.current) return;
          if (m.type === "progress") return setBusy({ label: m.label, fraction: m.fraction });
          setBusy(null);
          setSlow(false);
          if (m.type === "extracted") {
            setResult(m);
            setError(null);
          } else if (m.type === "error") {
            setResult(null);
            setError(m.message);
          }
        } else {
          if (m.jobId !== customJob.current) return;
          if (customTimer.current) clearTimeout(customTimer.current);
          if (m.type === "custom") {
            setCustom({ items: m.result, ms: m.ms });
            setCustomError(null);
          } else if (m.type === "error") {
            setCustom(null);
            setCustomError(m.message);
          }
        }
      };
      ref.current = w;
    }
    return ref.current;
  }, []);

  useEffect(
    () => () => {
      mainWorker.current?.terminate();
      customWorker.current?.terminate();
      if (customTimer.current) clearTimeout(customTimer.current);
    },
    [],
  );

  const source = useCallback((): Source | null => (file ? { kind: "file", file } : text.trim() === "" ? null : { kind: "text", text }), [file, text]);

  // Built-in extraction.
  useEffect(() => {
    const t = setTimeout(
      () => {
        const jobId = ++job.current;
        const src = source();
        if (!src) {
          setResult(null);
          setError(null);
          setBusy(null);
          return;
        }
        if (src.kind === "text" && src.text.length * 3 > MAX_PASTE_BYTES && new TextEncoder().encode(src.text).length > MAX_PASTE_BYTES) {
          setResult(null);
          setError("The pasted text is larger than 5 MB. Save it as a .txt file and open it instead (up to 50 MB).");
          return;
        }
        setBusy({ label: "Reading", fraction: 0 });
        setSlow(false);
        setTimeout(() => {
          if (job.current === jobId) setSlow(true);
        }, 1000);
        makeWorker("main").postMessage({ type: "extract", jobId, source: src, options } satisfies WorkerRequest);
      },
      file ? 0 : 400,
    );
    return () => clearTimeout(t);
  }, [source, file, options, revive, makeWorker]);

  // The visitor's own pattern, in its own worker with a time limit.
  useEffect(() => {
    const t = setTimeout(() => {
      const jobId = ++customJob.current;
      if (customTimer.current) clearTimeout(customTimer.current);
      const src = source();
      if (!src || pattern === "") {
        setCustom(null);
        setCustomError(null);
        return;
      }
      try {
        new RegExp(pattern, patternFlags);
      } catch (e) {
        setCustom(null);
        setCustomError(`This pattern is not valid: ${(e as Error).message.replace(/^Invalid regular expression: /, "")}`);
        return;
      }
      makeWorker("custom").postMessage({ type: "custom", jobId, source: src, pattern, flags: patternFlags, dedupe: options.dedupe } satisfies WorkerRequest);
      customTimer.current = setTimeout(() => {
        if (customJob.current !== jobId) return;
        customWorker.current?.terminate();
        customWorker.current = null;
        setCustom(null);
        setCustomError(`Your pattern was stopped after ${CUSTOM_TIMEOUT_MS / 1000} seconds. It probably backtracks catastrophically (nested repetition such as (a+)+); make the repeated parts unambiguous.`);
      }, CUSTOM_TIMEOUT_MS);
    }, 400);
    return () => clearTimeout(t);
  }, [source, pattern, patternFlags, options.dedupe, makeWorker]);

  const cancel = () => {
    mainWorker.current?.terminate();
    mainWorker.current = null;
    job.current++;
    setBusy(null);
    setSlow(false);
    setResult(null);
    setError("Stopped. Press “Extract again” to start over.");
  };

  const onFile = (f: File | null) => {
    if (!f) return;
    if (fileInput.current) fileInput.current.value = "";
    if (f.size > MAX_FILE_BYTES) {
      setError(`This file is ${(f.size / 1048576).toFixed(1)} MB. The limit is 50 MB.`);
      return;
    }
    setFile(f);
    setText("");
  };

  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${what} copied.`);
    } catch {
      setNotice("Copying was blocked by the browser. Use the CSV or JSON download instead.");
    }
    setTimeout(() => setNotice(null), 2500);
  };

  const r = result?.result;
  const found = r ? CATEGORIES.filter((c) => r[c.id].length > 0) : [];
  const total = r ? CATEGORIES.reduce((n, c) => n + r[c.id].length, 0) : 0;

  return (
    <div className="space-y-6">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-in`} className="text-lg font-semibold text-navy">Text</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => {
                setFile(null);
                setText(SAMPLE);
                setOptions((o) => ({ ...o, country: "GB", dayFirst: true }));
                setRevive((n) => n + 1);
              }}
            >
              Try an example
            </button>
            <button type="button" className={btnSecondary} onClick={() => fileInput.current?.click()}>
              Open a text file
            </button>
            <button
              type="button"
              className={btnSecondary}
              disabled={text === "" && !file}
              onClick={() => {
                setFile(null);
                setText("");
              }}
            >
              Clear
            </button>
          </div>
        </div>
        <input ref={fileInput} type="file" accept=".txt,.csv,.log,.md,.json,.eml,.html,text/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        {file ? (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            File: <span className="font-semibold text-navy">{file.name}</span> ({(file.size / 1048576).toFixed(2)} MB), read in your browser, not uploaded.
          </p>
        ) : (
          <>
            <label htmlFor={`${uid}-text`} className="mt-3 block text-sm text-slate-600">
              Paste text: emails, chat logs, notes, exports…
            </label>
            <textarea id={`${uid}-text`} className={`${inputCls} mt-2 h-48 font-mono`} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
          </>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={`${uid}-country`} className="block text-sm text-slate-600">
              Default country for phone numbers
            </label>
            <select id={`${uid}-country`} className={`${inputCls} mt-1`} value={options.country} onChange={(e) => setOptions((o) => ({ ...o, country: e.target.value }))}>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${uid}-order`} className="block text-sm text-slate-600">
              Dates like 03/04/2026 are
            </label>
            <select id={`${uid}-order`} className={`${inputCls} mt-1`} value={options.dayFirst ? "dmy" : "mdy"} onChange={(e) => setOptions((o) => ({ ...o, dayFirst: e.target.value === "dmy" }))}>
              <option value="dmy">day/month (3 April)</option>
              <option value="mdy">month/day (March 4)</option>
            </select>
          </div>
          <label className="inline-flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
            <input type="checkbox" className={`h-4 w-4 rounded ${focusRing}`} checked={options.dedupe} onChange={(e) => setOptions((o) => ({ ...o, dedupe: e.target.checked }))} />
            Remove duplicates
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Paste up to 5 MB or open a text file up to 50 MB. Finds emails, URLs, phone numbers, dates, money amounts, hashtags, @mentions, IPv4/IPv6 addresses and IBAN-like numbers with fixed rules. People, company and place names are not extracted in this version. Nothing leaves your browser.
        </p>
      </section>

      <section className={card} aria-labelledby={`${uid}-re`}>
        <h2 id={`${uid}-re`} className="text-lg font-semibold text-navy">Your own pattern (optional)</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_8rem]">
          <div>
            <label htmlFor={`${uid}-pat`} className="block text-sm text-slate-600">
              Regular expression (JavaScript syntax)
            </label>
            <input id={`${uid}-pat`} className={`${inputCls} mt-1 font-mono`} value={pattern} onChange={(e) => setPattern(e.target.value)} spellCheck={false} maxLength={2000} placeholder="e.g. INV-\d{5}" />
          </div>
          <div>
            <label htmlFor={`${uid}-flags`} className="block text-sm text-slate-600">
              Flags
            </label>
            <input id={`${uid}-flags`} className={`${inputCls} mt-1 font-mono`} value={patternFlags} onChange={(e) => setPatternFlags(e.target.value.replace(/[^gimsuy]/g, "").slice(0, 6))} spellCheck={false} />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">Runs in a separate background thread and is stopped after {CUSTOM_TIMEOUT_MS / 1000} seconds, so a slow pattern cannot freeze the page.</p>
        {customError && (
          <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {customError}
          </div>
        )}
      </section>

      <div aria-live="polite" className="min-h-6 text-sm text-slate-700">
        {busy && (
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span>Extracting: {busy.label}…</span>
              {slow && (
                <button type="button" className={btnSecondary} onClick={cancel}>
                  Cancel
                </button>
              )}
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Extraction progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(busy.fraction * 100)}>
              <div className="h-full rounded-full bg-primary motion-safe:transition-all" style={{ width: `${Math.max(4, Math.round(busy.fraction * 100))}%` }} />
            </div>
          </div>
        )}
        {notice && <p>{notice}</p>}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{error}</p>
          <button type="button" className={`${btnSecondary} mt-2`} onClick={() => setRevive((n) => n + 1)}>
            Extract again
          </button>
        </div>
      )}

      <div aria-live="polite" className="space-y-4">
        {result && r && (
          <section className={card} aria-labelledby={`${uid}-sum`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id={`${uid}-sum`} className="text-lg font-semibold text-navy">
                Found <span className="text-sm font-normal text-slate-600">· {total.toLocaleString("en-US")} items in {result.chars.toLocaleString("en-US")} characters · {result.ms.toLocaleString("en-US")} ms</span>
              </h2>
              <button type="button" className={btnPrimary} onClick={() => save(JSON.stringify({ ...Object.fromEntries(CATEGORIES.map((c) => [c.id, r[c.id]])), ...(custom ? { custom: custom.items } : {}) }, null, 2), "extracted-data.json", "application/json")} disabled={total === 0 && !custom?.items.length}>
                Download all (JSON)
              </button>
            </div>
            {found.length === 0 && !custom?.items.length && <p className="mt-2 text-sm text-slate-700">Nothing recognised in this text.</p>}
            <ul className="mt-3 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <li key={c.id}>
                  <a href={`#cat-${c.id}`} className={`inline-flex rounded-lg border px-2.5 py-1 text-xs ${focusRing} ${r[c.id].length ? "border-primary bg-primary-soft font-semibold text-primary-dark" : "pointer-events-none border-slate-200 text-slate-400"}`} aria-disabled={r[c.id].length === 0}>
                    {c.label} ({r[c.id].length})
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
        {custom && (
          <EntityList id="custom" label={`Your pattern /${pattern}/${patternFlags}`} rule={patternFlags.includes("i") ? "case-insensitive (i flag)" : "exact"} items={custom.items} onCopy={copy} />
        )}
        {r && found.map((c) => <EntityList key={c.id} id={c.id} label={c.label} rule={c.dedupeRule} items={r[c.id]} onCopy={copy} />)}
      </div>
    </div>
  );
}

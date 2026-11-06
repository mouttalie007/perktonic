"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormatOptions, Indent, TreeChild } from "./logic/format";
import { MAX_PASTE_BYTES } from "./logic/input";
import type { Draft } from "./logic/schema";
import type { Located, WorkerRequest, WorkerResponse } from "./worker/json.worker";
import { EXAMPLE_JSON, EXAMPLE_SCHEMA } from "../fixtures/examples";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

type Parsed = Extract<WorkerResponse, { type: "parsed" }>;
type SchemaResult = Extract<WorkerResponse, { type: "schema" }>;

const MAX_DISPLAY = 200_000;
const MAX_COPY = 5 * 1024 * 1024;
const SCHEMA_TIMEOUT_MS = 2000;


function ErrorBox({ title, error }: { title: string; error: Located }) {
  return (
    <div role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <p><strong>{title} at line {error.line}, column {error.column}:</strong> {error.message}</p>
      <pre className="mt-2 overflow-x-auto rounded-lg bg-white/70 p-2 font-mono text-xs leading-5">{error.pointer}</pre>
    </div>
  );
}

export default function JsonDataFormatterAndValidatorTool() {
  const uid = useId();
  const [text, setText] = useState(EXAMPLE_JSON);
  const [file, setFile] = useState<File | null>(null);
  const [sourceId, setSourceId] = useState(0);
  const [mode, setMode] = useState<Indent | "minify">(2);
  const [sortKeys, setSortKeys] = useState(false);
  const [lenient, setLenient] = useState(false);
  const [schema, setSchema] = useState(EXAMPLE_SCHEMA);
  const [draft, setDraft] = useState<Draft>("auto");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [output, setOutput] = useState("");
  const [syntaxError, setSyntaxError] = useState<Located | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ label: string; fraction: number | null } | null>(null);
  const [slow, setSlow] = useState(false);
  const [schemaResult, setSchemaResult] = useState<SchemaResult | null>(null);
  const [schemaError, setSchemaError] = useState<Located | string | null>(null);
  const [view, setView] = useState<"text" | "tree">("text");
  const [tree, setTree] = useState<Record<string, { children: TreeChild[]; total: number }>>({});
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [revive, setRevive] = useState(0);

  const workerRef = useRef<Worker | null>(null);
  // One counter for every request, so a reply can always be matched to the job that asked for it.
  const seq = useRef(0);
  const parseJob = useRef(-1);
  const schemaJob = useRef(-1);
  const formatJob = useRef(-1);
  const next = () => ++seq.current;
  const schemaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formatOpts: FormatOptions = { indent: mode === "minify" ? null : mode, sortKeys };

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const w = new Worker(new URL("./worker/json.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const m = event.data;
        if (m.type === "schema" || m.type === "schemaInvalid" || (m.type === "error" && m.jobId === schemaJob.current)) {
          if (m.jobId !== schemaJob.current) return;
          if (schemaTimer.current) clearTimeout(schemaTimer.current);
          if (m.type === "schema") {
            setSchemaResult(m);
            setSchemaError(null);
          } else if (m.type === "schemaInvalid") {
            setSchemaResult(null);
            setSchemaError(m.error);
          } else setSchemaError(m.message);
          return;
        }
        if (m.type === "tree") {
          setTree((t) => ({ ...t, [m.key]: { children: m.offset === 0 ? m.children : [...(t[m.key]?.children ?? []), ...m.children], total: m.total } }));
          return;
        }
        if (m.type === "formatted") {
          if (m.jobId === formatJob.current) setOutput(m.output);
          return;
        }
        if (m.jobId !== parseJob.current) return;
        if (m.type === "progress") {
          setBusy({ label: m.label, fraction: m.fraction });
          return;
        }
        setBusy(null);
        setSlow(false);
        if (m.type === "parsed") {
          setParsed(m);
          setOutput(m.output);
          setSyntaxError(null);
          setError(null);
          setTree({});
          setOpen(new Set());
        } else if (m.type === "invalid") {
          setParsed(null);
          setOutput("");
          setSyntaxError(m.error);
          setError(null);
        } else if (m.type === "error") {
          setParsed(null);
          setError(m.message);
        }
      };
      w.onerror = () => {
        setBusy(null);
        setError("The JSON worker stopped unexpectedly, possibly out of memory. Try a smaller file.");
        workerRef.current = null;
      };
      workerRef.current = w;
    }
    return workerRef.current;
  }, []);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const post = useCallback((req: WorkerRequest) => getWorker().postMessage(req), [getWorker]);

  // Parse whenever the input or lenient mode changes (formatting options are applied without re-parsing).
  const formatRef = useRef(formatOpts);
  useEffect(() => {
    formatRef.current = { indent: mode === "minify" ? null : mode, sortKeys };
  }, [mode, sortKeys]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (!file && text.trim() === "") {
        parseJob.current = next();
        setParsed(null);
        setOutput("");
        setSyntaxError(null);
        setError(null);
        setBusy(null);
        return;
      }
      if (!file && new TextEncoder().encode(text).length > MAX_PASTE_BYTES) {
        parseJob.current = next();
        setParsed(null);
        setError("The pasted text is larger than 5 MB. Save it as a .json file and choose it instead (up to 50 MB).");
        return;
      }
      const jobId = next();
      parseJob.current = jobId;
      setBusy({ label: "Parsing", fraction: null });
      setTimeout(() => {
        if (parseJob.current === jobId) setSlow(true);
      }, 1000);
      post({ type: "parse", jobId, source: file ? { kind: "file", file } : { kind: "text", text }, lenient, format: formatRef.current });
    }, file ? 0 : 300);
    return () => clearTimeout(t);
  }, [text, file, sourceId, lenient, revive, post]);

  useEffect(() => {
    if (!parsed) return;
    const jobId = next();
    formatJob.current = jobId;
    post({ type: "format", jobId, format: { indent: mode === "minify" ? null : mode, sortKeys } });
  }, [mode, sortKeys, parsed, post]);

  // Schema validation, in the worker with a 2 s limit because a schema "pattern" is a user-supplied regex.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!parsed || schema.trim() === "") {
        schemaJob.current = next();
        setSchemaResult(null);
        setSchemaError(null);
        return;
      }
      const jobId = next();
      schemaJob.current = jobId;
      post({ type: "schema", jobId, schema, draft, lenient });
      if (schemaTimer.current) clearTimeout(schemaTimer.current);
      schemaTimer.current = setTimeout(() => {
        if (schemaJob.current !== jobId) return;
        workerRef.current?.terminate();
        workerRef.current = null;
        setSchemaResult(null);
        setSchemaError("Schema validation took more than 2 seconds and was stopped. A \"pattern\" in the schema may be too complex.");
        setRevive((n) => n + 1);
      }, SCHEMA_TIMEOUT_MS);
    }, 300);
    return () => clearTimeout(t);
  }, [schema, draft, lenient, parsed, post]);

  const cancel = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    parseJob.current = next();
    setBusy(null);
    setSlow(false);
    setError("Cancelled. Change the input or an option to try again.");
  };

  const toggle = (child: TreeChild, steps: (string | number)[]) => {
    const key = child.positions.join(".");
    const expanded = new Set(open);
    if (expanded.has(key)) expanded.delete(key);
    else {
      expanded.add(key);
      if (!tree[key]) post({ type: "tree", jobId: next(), positions: child.positions, steps, offset: 0 });
    }
    setOpen(expanded);
  };

  useEffect(() => {
    if (view === "tree" && parsed && !tree[""]) post({ type: "tree", jobId: next(), positions: [], steps: [], offset: 0 });
  }, [view, parsed, tree, post]);

  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${what} copied.`);
    } catch {
      setNotice("Your browser blocked clipboard access. Select the text and copy it manually.");
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([output], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = file ? file.name.replace(/(\.jsonc?)?$/i, mode === "minify" ? ".min.json" : ".formatted.json") : mode === "minify" ? "data.min.json" : "data.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const stepsOf = (child: TreeChild, parentSteps: (string | number)[]) => [...parentSteps, child.key];

  const renderLevel = (key: string, steps: (string | number)[], positions: number[], depth: number): React.ReactNode => {
    const level = tree[key];
    if (!level) return <li className="pl-5 text-xs text-slate-ink">Loading…</li>;
    return (
      <>
        {level.children.map((c) => {
          const ck = c.positions.join(".");
          const isOpen = open.has(ck);
          const childSteps = stepsOf(c, steps);
          return (
            <li key={ck} role="treeitem" aria-expanded={c.expandable ? isOpen : undefined} aria-level={depth + 1} aria-selected={false}>
              <div className="group flex items-start gap-1 rounded px-1 py-0.5 hover:bg-slate-50">
                {c.expandable ? (
                  <button type="button" className={`w-5 shrink-0 rounded text-slate-ink ${focusRing}`} aria-label={`${isOpen ? "Collapse" : "Expand"} ${c.path}`} onClick={() => toggle(c, childSteps)}>{isOpen ? "▾" : "▸"}</button>
                ) : (
                  <span className="w-5 shrink-0" />
                )}
                <span className="min-w-0 break-all font-mono text-xs">
                  <span className="font-semibold text-primary-dark">{typeof c.key === "number" ? c.key : JSON.stringify(c.key)}</span>
                  <span className="text-slate-ink">: </span>
                  <span className={c.type === "string" ? "text-green-800" : c.type === "number" ? "text-amber-800" : "text-navy"}>{c.summary}</span>
                </span>
                <button type="button" className={`ml-auto shrink-0 rounded px-1.5 text-xs text-slate-ink hover:text-primary-dark ${focusRing}`} onClick={() => copy(c.path, `Path ${c.path}`)} aria-label={`Copy path ${c.path}`}>copy path</button>
              </div>
              {c.expandable && isOpen && <ul role="group" className="ml-4 border-l border-slate-200 pl-1">{renderLevel(ck, childSteps, c.positions, depth + 1)}</ul>}
            </li>
          );
        })}
        {level.total > level.children.length && (
          <li className="pl-6">
            <button type="button" className={`${btnSecondary} my-1 text-xs`} onClick={() => post({ type: "tree", jobId: next(), positions, steps, offset: level.children.length })}>
              Show more ({level.total - level.children.length} left)
            </button>
          </li>
        )}
      </>
    );
  };

  const shown = output.length > MAX_DISPLAY ? output.slice(0, MAX_DISPLAY) : output;
  const bigInts = parsed?.stats.bigIntegers ?? 0;

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-in`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>1</span>Your JSON</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={() => { setFile(null); setText(EXAMPLE_JSON); setSchema(EXAMPLE_SCHEMA); setSourceId((n) => n + 1); }}>Try an example</button>
            <button type="button" className={btnSecondary} onClick={() => { setFile(null); setText(""); setSchema(""); }} disabled={!file && text === ""}>Clear</button>
          </div>
        </div>
        <label htmlFor={`${uid}-text`} className="mt-4 block text-sm font-medium">Paste JSON</label>
        <textarea id={`${uid}-text`} className={`${inputCls} mt-1 h-44 resize-y font-mono text-xs`} value={text} onChange={(e) => { setFile(null); setText(e.target.value); }} placeholder='{"name": "Ada", "tags": ["math"]}' spellCheck={false} aria-invalid={syntaxError ? true : undefined} />
        <div className="mt-3">
          <label htmlFor={`${uid}-file`} className="block text-sm font-medium">Or choose a .json file</label>
          <input id={`${uid}-file`} type="file" accept=".json,.jsonc,.txt,.geojson,application/json" className={`mt-1 block max-w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:font-semibold file:text-primary-dark ${focusRing}`} onChange={(e) => { const f = e.target.files?.[0]; if (f) { setText(""); setFile(f); setSourceId((n) => n + 1); } }} />
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor={`${uid}-mode`} className="block text-sm font-medium">Output</label>
            <select id={`${uid}-mode`} className={`${inputCls} mt-1`} value={String(mode)} onChange={(e) => setMode(e.target.value === "minify" ? "minify" : e.target.value === "tab" ? "tab" : (Number(e.target.value) as 2 | 4))}>
              <option value="2">Beautify, 2 spaces</option>
              <option value="4">Beautify, 4 spaces</option>
              <option value="tab">Beautify, tabs</option>
              <option value="minify">Minify</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={sortKeys} onChange={(e) => setSortKeys(e.target.checked)} />Sort keys A→Z</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={lenient} onChange={(e) => setLenient(e.target.checked)} />Allow comments and trailing commas (JSONC)</label>
        </div>
        <p className="mt-3 text-xs text-slate-ink">Limits: pasted text up to 5 MB, files up to 50 MB. Everything runs in your browser; nothing is uploaded.</p>
      </section>

      <section className={card} aria-labelledby={`${uid}-out`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-out`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>2</span>Result</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} disabled={!parsed || output.length > MAX_COPY} onClick={() => copy(output, "Formatted JSON")}>Copy</button>
            <button type="button" className={btnSecondary} disabled={!parsed} onClick={download}>Download .json</button>
          </div>
        </div>
        <div aria-live="polite" className="mt-3 min-h-6 text-sm text-slate-ink">
          {!parsed && !syntaxError && !error && !busy && "Paste JSON, choose a file or try the example."}
          {busy && !slow && `${busy.label}…`}
          {parsed && !busy && (
            <>
              <strong className="text-green-800">Valid JSON.</strong> {parsed.stats.objects} object(s), {parsed.stats.arrays} array(s), {parsed.stats.values} value(s), depth {parsed.stats.maxDepth}, {(parsed.bytes / 1024).toFixed(1)} KB.
              {bigInts > 0 && ` ${bigInts} integer(s) larger than 2^53 kept exactly.`}
            </>
          )}
          {notice && <span className="block text-navy">{notice}</span>}
        </div>
        {busy && slow && (
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={busy.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={busy.fraction != null ? Math.round(busy.fraction * 100) : undefined}>
              <div className={`h-full bg-primary ${busy.fraction == null ? "w-1/3 motion-safe:animate-pulse" : ""}`} style={busy.fraction != null ? { width: `${Math.round(busy.fraction * 100)}%` } : undefined} />
            </div>
            <span className="text-xs text-slate-ink">{busy.label}</span>
            <button type="button" className={btnSecondary} onClick={cancel}>Cancel</button>
          </div>
        )}
        {syntaxError && <ErrorBox title="Not valid JSON" error={syntaxError} />}
        {error && <div role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {parsed && (parsed.notes.comments > 0 || parsed.notes.trailingCommas > 0 || parsed.duplicates.length > 0) && (
          <ul className="mt-2 list-disc space-y-1 rounded-xl bg-amber-50 p-3 pl-7 text-sm text-amber-900">
            {(parsed.notes.comments > 0 || parsed.notes.trailingCommas > 0) && <li>This is JSONC, not JSON: {parsed.notes.comments} comment(s) and {parsed.notes.trailingCommas} trailing comma(s). The output below is strict JSON without them.</li>}
            {parsed.duplicates.map((d) => <li key={`${d.line}:${d.column}`}>Duplicate key &quot;{d.key}&quot; at line {d.line}, column {d.column}. Most parsers keep only the last one.</li>)}
          </ul>
        )}

        <div className="mt-4 flex gap-1 border-b border-slate-200" role="tablist" aria-label="Result view">
          {(["text", "tree"] as const).map((v) => (
            <button key={v} type="button" role="tab" id={`${uid}-tab-${v}`} aria-selected={view === v} aria-controls={`${uid}-panel-${v}`} onClick={() => setView(v)} className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-semibold ${view === v ? "border-primary text-primary-dark" : "border-transparent text-slate-ink hover:text-navy"} ${focusRing}`}>
              {v === "text" ? (mode === "minify" ? "Minified" : "Formatted") : "Tree"}
            </button>
          ))}
        </div>
        <div className="mt-3 min-h-72">
          {view === "text" ? (
            <div id={`${uid}-panel-text`} role="tabpanel" aria-labelledby={`${uid}-tab-text`}>
              <label htmlFor={`${uid}-output`} className="sr-only">Formatted JSON</label>
              <textarea id={`${uid}-output`} readOnly className={`${inputCls} h-80 resize-y bg-slate-50 font-mono text-xs`} value={shown} placeholder="The formatted JSON appears here." spellCheck={false} />
              {output.length > MAX_DISPLAY && <p className="mt-1 text-xs text-slate-ink">Showing the first 200,000 characters; Download has everything.{output.length > MAX_COPY ? " Too large to copy." : ""}</p>}
            </div>
          ) : (
            <div id={`${uid}-panel-tree`} role="tabpanel" aria-labelledby={`${uid}-tab-tree`} className="max-h-[32rem] overflow-auto rounded-xl border border-slate-200 p-2">
              {parsed ? (
                <ul role="tree" aria-label="JSON tree">{renderLevel("", [], [], 0)}</ul>
              ) : (
                <p className="p-2 text-sm text-slate-ink">The tree appears here for valid JSON. Expand objects and arrays, and copy any path such as $.items[0].sku.</p>
              )}
            </div>
          )}
        </div>
      </section>

      <section className={card} aria-labelledby={`${uid}-schema`}>
        <h2 id={`${uid}-schema`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>3</span>Validate against a JSON Schema (optional)</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <label htmlFor={`${uid}-schema-text`} className="block text-sm font-medium">Schema</label>
            <textarea id={`${uid}-schema-text`} className={`${inputCls} mt-1 h-40 resize-y font-mono text-xs`} value={schema} onChange={(e) => setSchema(e.target.value)} placeholder='{"type": "object", "required": ["id"]}' spellCheck={false} />
          </div>
          <div>
            <label htmlFor={`${uid}-draft`} className="block text-sm font-medium">Draft</label>
            <select id={`${uid}-draft`} className={`${inputCls} mt-1`} value={draft} onChange={(e) => setDraft(e.target.value as Draft)}>
              <option value="auto">From $schema (default 2020-12)</option>
              <option value="2020-12">2020-12</option>
              <option value="2019-09">2019-09</option>
              <option value="7">Draft-07</option>
              <option value="4">Draft-04</option>
            </select>
          </div>
        </div>
        <div aria-live="polite" className="mt-3 min-h-6 text-sm">
          {!schema.trim() && <span className="text-slate-ink">Paste a schema to check the JSON against it.</span>}
          {schema.trim() && !parsed && <span className="text-slate-ink">Fix the JSON above first.</span>}
          {schemaResult?.valid && <span className="font-semibold text-green-800">The JSON matches the schema (draft {schemaResult.draft}).</span>}
          {schemaResult && !schemaResult.valid && <span className="font-semibold text-red-800">{schemaResult.issues.length} problem(s) found (draft {schemaResult.draft}).</span>}
        </div>
        {schemaError && (typeof schemaError === "string" ? <div role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{schemaError}</div> : <ErrorBox title="The schema is not valid JSON" error={schemaError} />)}
        {schemaResult && !schemaResult.valid && (
          <ul className="mt-2 space-y-2">
            {schemaResult.issues.map((i, n) => (
              <li key={n} className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="break-all font-mono text-xs font-semibold">{i.path}</code>
                  <span className="text-xs">line {i.line}, column {i.column} · {i.keyword}</span>
                  <button type="button" className={`ml-auto rounded px-1.5 text-xs underline ${focusRing}`} onClick={() => copy(i.path, `Path ${i.path}`)}>copy path</button>
                </div>
                <p className="mt-1">{i.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Indent, TreeChild } from "./logic/format";
import { MAX_PASTE_BYTES } from "./logic/input";
import { PROVIDERS, type Check, type ProviderId } from "./logic/providers";
import type { Choice, Located, WorkerRequest, WorkerResponse } from "./worker/inspect.worker";
import { BROKEN, SAMPLES } from "../fixtures/samples";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

type Viewed = Extract<WorkerResponse, { type: "view" }>;

const MAX_DISPLAY = 200_000;
const MAX_COPY = 5 * 1024 * 1024;

const btnLink = `shrink-0 rounded px-1.5 text-xs text-slate-600 underline-offset-2 hover:text-primary-dark hover:underline ${focusRing}`;

const LEVEL: Record<Check["level"], { icon: string; label: string; cls: string }> = {
  pass: { icon: "✓", label: "Matches the docs", cls: "border-green-200 bg-green-50 text-green-900" },
  warn: { icon: "!", label: "Differs from the docs", cls: "border-amber-300 bg-amber-50 text-amber-950" },
  info: { icon: "i", label: "Note", cls: "border-slate-200 bg-slate-50 text-slate-800" },
};

const plural = (n: number, word: string) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;

function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function WebhookJsonPayloadFormatterTool() {
  const uid = useId();
  const [text, setText] = useState(SAMPLES.stripe);
  const [file, setFile] = useState<File | null>(null);
  const [sourceId, setSourceId] = useState(0);
  const [choice, setChoice] = useState<Choice>("auto");
  const [mask, setMask] = useState(true);
  const [indent, setIndent] = useState<Indent>(2);
  const [result, setResult] = useState<Viewed | null>(null);
  const [syntaxError, setSyntaxError] = useState<Located | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ label: string; fraction: number | null } | null>(null);
  const [slow, setSlow] = useState(false);
  const [view, setView] = useState<"tree" | "text">("tree");
  const [tree, setTree] = useState<Record<string, { children: TreeChild[]; total: number }>>({});
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [showPassed, setShowPassed] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const seq = useRef(0);
  const mainJob = useRef(-1);
  const pathsJob = useRef(-1);
  const next = () => ++seq.current;
  const settings = useRef({ choice, mask, indent });

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const w = new Worker(new URL("./worker/inspect.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const m = event.data;
        if (m.type === "tree") {
          setTree((t) => ({ ...t, [m.key]: { children: m.offset === 0 ? m.children : [...(t[m.key]?.children ?? []), ...m.children], total: m.total } }));
          return;
        }
        if (m.type === "paths" || (m.type === "error" && m.jobId === pathsJob.current)) {
          if (m.jobId !== pathsJob.current) return;
          if (m.type === "paths") {
            download(m.csv, "payload-paths.csv", "text/csv;charset=utf-8");
            setNotice(`${m.rows.toLocaleString("en-US")} paths downloaded${m.capped ? " (stopped at 200,000)" : ""}.`);
          } else setNotice(m.message);
          return;
        }
        if (m.jobId !== mainJob.current) return;
        if (m.type === "progress") {
          setBusy({ label: m.label, fraction: m.fraction });
          return;
        }
        setBusy(null);
        setSlow(false);
        if (m.type === "view") {
          setResult(m);
          setSyntaxError(null);
          setError(null);
          setTree({});
        } else if (m.type === "invalid") {
          setResult(null);
          setSyntaxError(m.error);
          setError(null);
        } else if (m.type === "error") {
          setResult(null);
          setError(m.message);
        }
      };
      w.onerror = () => {
        setBusy(null);
        setError("The background worker stopped unexpectedly, possibly out of memory. Try a smaller file.");
        workerRef.current = null;
      };
      workerRef.current = w;
    }
    return workerRef.current;
  }, []);

  useEffect(() => () => workerRef.current?.terminate(), []);
  const post = useCallback((req: WorkerRequest) => getWorker().postMessage(req), [getWorker]);

  useEffect(() => {
    settings.current = { choice, mask, indent };
  }, [choice, mask, indent]);

  // Parse when the payload changes.
  useEffect(() => {
    const t = setTimeout(
      () => {
        const jobId = next();
        mainJob.current = jobId;
        if (!file && text.trim() === "") {
          setResult(null);
          setSyntaxError(null);
          setError(null);
          setBusy(null);
          return;
        }
        if (!file && text.length * 3 > MAX_PASTE_BYTES && new TextEncoder().encode(text).length > MAX_PASTE_BYTES) {
          setResult(null);
          setSyntaxError(null);
          setError("The pasted text is larger than 5 MB. Save it as a .json file and open it instead (up to 50 MB).");
          return;
        }
        setBusy({ label: "Parsing", fraction: null });
        setTimeout(() => {
          if (mainJob.current === jobId) setSlow(true);
        }, 1000);
        post({ type: "load", jobId, source: file ? { kind: "file", file } : { kind: "text", text }, ...settings.current });
      },
      file ? 0 : 300,
    );
    return () => clearTimeout(t);
  }, [text, file, sourceId, post]);

  // Provider, masking and indent are applied to the parsed payload without parsing again.
  const loaded = result !== null;
  useEffect(() => {
    if (!loaded) return;
    const jobId = next();
    mainJob.current = jobId;
    post({ type: "view", jobId, choice, mask, indent });
  }, [choice, mask, indent, loaded, post]);

  useEffect(() => {
    if (view === "tree" && result && !tree[""]) post({ type: "tree", jobId: next(), positions: [], steps: [], offset: 0 });
  }, [view, result, tree, post]);

  const cancel = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    mainJob.current = next();
    setBusy(null);
    setSlow(false);
    setResult(null);
    setError("Stopped. Paste or open the payload again to start over.");
  };

  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${what} copied.`);
    } catch {
      setNotice("Your browser blocked clipboard access. Use Download instead.");
    }
  };

  const load = (sample: string) => {
    setFile(null);
    setText(sample);
    setSourceId((n) => n + 1);
    setNotice(null);
  };

  const onFile = (f: File | null) => {
    if (!f) return;
    if (fileInput.current) fileInput.current.value = "";
    setText("");
    setFile(f);
    setSourceId((n) => n + 1);
  };

  const goToError = () => {
    const el = textRef.current;
    if (!el || !syntaxError) return;
    el.focus();
    el.setSelectionRange(syntaxError.offset, Math.min(text.length, syntaxError.offset + 1));
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

  const keyPaths = new Set(result?.inspection.keyPaths ?? []);

  const renderLevel = (key: string, steps: (string | number)[], positions: number[], depth: number): React.ReactNode => {
    const level = tree[key];
    if (!level) return <li className="pl-5 text-xs text-slate-600">Loading…</li>;
    return (
      <>
        {level.children.map((c) => {
          const ck = c.positions.join(".");
          const isOpen = open.has(ck);
          const childSteps = [...steps, c.key];
          const isKey = keyPaths.has(c.path);
          return (
            <li key={ck} role="treeitem" aria-expanded={c.expandable ? isOpen : undefined} aria-level={depth + 1} aria-selected={false}>
              <div className={`flex items-start gap-1 rounded px-1 py-0.5 hover:bg-slate-50 ${isKey ? "bg-blue-50" : ""}`}>
                {c.expandable ? (
                  <button type="button" className={`w-5 shrink-0 rounded text-slate-600 ${focusRing}`} aria-label={`${isOpen ? "Collapse" : "Expand"} ${c.path}`} onClick={() => toggle(c, childSteps)}>
                    {isOpen ? "▾" : "▸"}
                  </button>
                ) : (
                  <span className="w-5 shrink-0" />
                )}
                <span className="min-w-0 break-all font-mono text-xs">
                  <span className="font-semibold text-primary-dark">{typeof c.key === "number" ? c.key : JSON.stringify(c.key)}</span>
                  <span className="text-slate-600">: </span>
                  <span className={c.type === "string" ? "text-green-800" : c.type === "number" ? "text-amber-800" : "text-navy"}>{c.summary}</span>
                  {isKey && <span className="ml-2 rounded bg-primary px-1 py-px font-sans text-[10px] font-semibold uppercase tracking-wide text-white">key field</span>}
                </span>
                <button type="button" className={`ml-auto ${btnLink}`} onClick={() => copy(c.path, `Path ${c.path}`)} aria-label={`Copy path ${c.path}`}>
                  copy path
                </button>
              </div>
              {c.expandable && isOpen && (
                <ul role="group" className="ml-4 border-l border-slate-200 pl-1">
                  {renderLevel(ck, childSteps, c.positions, depth + 1)}
                </ul>
              )}
            </li>
          );
        })}
        {level.total > level.children.length && (
          <li className="pl-6">
            <button type="button" className={`${btnSecondary} my-1 text-xs`} onClick={() => post({ type: "tree", jobId: next(), positions, steps, offset: level.children.length })}>
              Show more ({(level.total - level.children.length).toLocaleString("en-US")} left)
            </button>
          </li>
        )}
      </>
    );
  };

  const output = result?.output ?? "";
  const shown = output.length > MAX_DISPLAY ? output.slice(0, MAX_DISPLAY) : output;
  const ins = result?.inspection;
  const checks = ins?.checks ?? [];
  const warns = checks.filter((c) => c.level === "warn").length;
  const passes = checks.filter((c) => c.level === "pass").length;
  const visibleChecks = showPassed ? checks : checks.filter((c) => c.level !== "pass");
  const providerLabel = ins?.provider ? PROVIDERS.find((p) => p.id === ins.provider)!.label : null;
  const maskedAny = result ? result.masked.tokens + result.masked.emails + result.masked.cards > 0 : false;
  const baseName = file ? file.name.replace(/\.json$/i, "") : (ins?.provider ?? "webhook") + "-payload";

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-in`} className="text-lg font-semibold">
            Payload
          </h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={() => fileInput.current?.click()}>
              Open a JSON file
            </button>
            <button type="button" className={btnSecondary} disabled={!file && text === ""} onClick={() => load("")}>
              Clear
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-labelledby={`${uid}-ex`}>
          <span id={`${uid}-ex`} className="text-sm text-slate-600">
            Try an example:
          </span>
          {PROVIDERS.map((p) => (
            <button key={p.id} type="button" className={`${btnSecondary} px-2.5 py-1`} onClick={() => load(SAMPLES[p.id as ProviderId])}>
              {p.label}
            </button>
          ))}
          <button type="button" className={`${btnSecondary} px-2.5 py-1`} onClick={() => load(BROKEN)}>
            Broken JSON
          </button>
        </div>
        <input ref={fileInput} type="file" accept=".json,.txt,application/json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        {file ? (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            File: <span className="font-semibold text-navy">{file.name}</span> ({(file.size / 1048576).toFixed(2)} MB), read in your browser, not uploaded.
          </p>
        ) : (
          <>
            <label htmlFor={`${uid}-text`} className="mt-3 block text-sm text-slate-600">
              Paste the webhook body (JSON)
            </label>
            <textarea
              ref={textRef}
              id={`${uid}-text`}
              className={`${inputCls} mt-1 h-56 resize-y font-mono text-xs`}
              value={text}
              onChange={(e) => {
                setFile(null);
                setText(e.target.value);
              }}
              spellCheck={false}
              aria-invalid={syntaxError ? true : undefined}
              placeholder='{"id": "evt_…", "type": "payment_intent.succeeded", …}'
            />
          </>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={`${uid}-prov`} className="block text-sm text-slate-600">
              Provider checks
            </label>
            <select id={`${uid}-prov`} className={`${inputCls} mt-1`} value={choice} onChange={(e) => setChoice(e.target.value as Choice)}>
              <option value="auto">Detect automatically</option>
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              <option value="none">None (format only)</option>
            </select>
          </div>
          <div>
            <label htmlFor={`${uid}-indent`} className="block text-sm text-slate-600">
              Indentation
            </label>
            <select id={`${uid}-indent`} className={`${inputCls} mt-1`} value={String(indent)} onChange={(e) => setIndent(e.target.value === "tab" ? "tab" : (Number(e.target.value) as 2 | 4))}>
              <option value="2">2 spaces</option>
              <option value="4">4 spaces</option>
              <option value="tab">Tabs</option>
            </select>
          </div>
          <label className="flex items-start gap-2 self-end pb-1 text-sm text-slate-700">
            <input type="checkbox" className={`mt-0.5 h-4 w-4 shrink-0 accent-primary ${focusRing}`} checked={mask} onChange={(e) => setMask(e.target.checked)} />
            <span>Mask secrets (tokens, emails, card-like numbers) in the view, copies and downloads</span>
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-600">Paste up to 5 MB or open a file up to 50 MB. Nothing is sent anywhere: the payload is read and checked in your browser.</p>
      </section>

      <div aria-live="polite" className="min-h-6 text-sm text-slate-700">
        {busy && !slow && <span>{busy.label}…</span>}
        {busy && slow && (
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={busy.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={busy.fraction != null ? Math.round(busy.fraction * 100) : undefined}>
              <div className={`h-full bg-primary ${busy.fraction == null ? "w-1/3 motion-safe:animate-pulse" : ""}`} style={busy.fraction != null ? { width: `${Math.round(busy.fraction * 100)}%` } : undefined} />
            </div>
            <span className="text-xs text-slate-600">{busy.label}</span>
            <button type="button" className={btnSecondary} onClick={cancel}>
              Cancel
            </button>
          </div>
        )}
        {!busy && !result && !syntaxError && !error && <span>Paste a webhook body, open a file or try an example.</span>}
        {notice && <span className="ml-3 text-navy">{notice}</span>}
      </div>

      {syntaxError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>
            <strong>
              Not valid JSON at line {syntaxError.line}, column {syntaxError.column}:
            </strong>{" "}
            {syntaxError.message}
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-white/70 p-2 font-mono text-xs leading-5">{syntaxError.pointer}</pre>
          {!file && (
            <button type="button" className={`${btnSecondary} mt-2`} onClick={goToError}>
              Go to the error
            </button>
          )}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {result && ins && (
        <>
          <section className={card} aria-labelledby={`${uid}-sum`}>
            <h2 id={`${uid}-sum`} className="text-lg font-semibold">
              {providerLabel ? `${providerLabel} payload` : "Valid JSON"}
              {ins.event && <span className="ml-2 break-all font-mono text-sm font-normal text-slate-700">{ins.event}</span>}
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              {(result.bytes / 1024).toFixed(1)} KB · {plural(result.stats.values, "value")} · {plural(result.stats.objects, "object")} · {plural(result.stats.arrays, "array")} · depth {result.stats.maxDepth}
              {result.duplicates > 0 && ` · ${plural(result.duplicates, "duplicate key")}: most parsers keep only the last one`}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {ins.detectedBy === "auto" && providerLabel && `Provider detected from the payload's fields. `}
              {ins.detectedBy === "manual" && providerLabel && `Provider chosen by you. `}
              {ins.detectedBy === "auto" && !providerLabel && "No Stripe, GitHub, Shopify or Slack shape recognised: choose a provider above to run its checks anyway. "}
              {mask ? (maskedAny ? `Masked: ${result.maskedText}.` : "Masking is on; nothing sensitive was found.") : <strong className="text-amber-900">Masking is off: copies and downloads contain the original values.</strong>}
            </p>
          </section>

          {checks.length > 0 && (
            <section className={card} aria-labelledby={`${uid}-chk`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id={`${uid}-chk`} className="text-lg font-semibold">
                  Checks against {providerLabel}&apos;s docs{" "}
                  <span className="text-sm font-normal text-slate-600">
                    · {passes} as documented, {warns} to look at
                  </span>
                </h2>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={showPassed} onChange={(e) => setShowPassed(e.target.checked)} />
                  Show passed checks
                </label>
              </div>
              <p className="mt-1 text-xs text-slate-600">Advisory only. Each check was written from the public documentation page it names. Providers add fields and versions over time, so a difference is a hint to look, not proof of a bug.</p>
              <ul className="mt-3 space-y-2">
                {visibleChecks.map((c, i) => (
                  <li key={i} className={`rounded-xl border p-3 text-sm ${LEVEL[c.level].cls}`}>
                    <div className="flex flex-wrap items-start gap-2">
                      <span aria-hidden="true" className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/80 text-xs font-bold">
                        {LEVEL[c.level].icon}
                      </span>
                      <span className="sr-only">{LEVEL[c.level].label}: </span>
                      <span className="min-w-0 flex-1 break-words font-semibold">{c.title}</span>
                      <button type="button" className={btnLink} onClick={() => copy(c.path, `Path ${c.path}`)} aria-label={`Copy path ${c.path}`}>
                        copy path
                      </button>
                    </div>
                    <p className="mt-1 break-words pl-7">{c.detail}</p>
                    <p className="mt-1 pl-7 text-xs">
                      Source:{" "}
                      <a href={c.doc.url} target="_blank" rel="noopener noreferrer" className={`underline ${focusRing}`}>
                        {c.doc.title}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </p>
                  </li>
                ))}
                {visibleChecks.length === 0 && <li className="text-sm text-slate-700">Every field checked matches the documentation. Tick “Show passed checks” to see them.</li>}
              </ul>
            </section>
          )}

          {result.keyFields.length > 0 && (
            <section className={card} aria-labelledby={`${uid}-key`}>
              <h2 id={`${uid}-key`} className="text-lg font-semibold">
                Key fields
              </h2>
              <div className={`relative mt-3 overflow-x-auto rounded ${focusRing}`} role="region" aria-label="Key fields table" tabIndex={0}>
                <table className="w-full min-w-[28rem] text-left text-xs">
                  <caption className="sr-only">Key fields of this payload, with their paths</caption>
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600">
                      <th scope="col" className="py-1 pr-3 font-semibold">
                        Path
                      </th>
                      <th scope="col" className="py-1 pr-3 font-semibold">
                        Value
                      </th>
                      <th scope="col" className="py-1 font-semibold">
                        <span className="sr-only">Copy</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.keyFields.map((k) => (
                      <tr key={k.path} className="border-b border-slate-100 align-top">
                        <td className="py-1.5 pr-3 font-mono text-primary-dark">{k.path}</td>
                        <td className="break-all py-1.5 pr-3 font-mono">{k.summary}</td>
                        <td className="py-1.5 text-right">
                          <button type="button" className={btnLink} onClick={() => copy(k.path, `Path ${k.path}`)} aria-label={`Copy path ${k.path}`}>
                            copy path
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className={card} aria-labelledby={`${uid}-out`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id={`${uid}-out`} className="text-lg font-semibold">
                Formatted payload
              </h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnPrimary} disabled={output.length > MAX_COPY} onClick={() => copy(output, mask ? "Formatted JSON (masked)" : "Formatted JSON")}>
                  Copy{mask ? " (masked)" : ""}
                </button>
                <button type="button" className={btnSecondary} onClick={() => download(output, `${baseName}${mask ? ".masked" : ""}.json`, "application/json")}>
                  Download .json
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    const jobId = next();
                    pathsJob.current = jobId;
                    post({ type: "paths", jobId });
                  }}
                >
                  All paths (CSV)
                </button>
              </div>
            </div>
            <div className="mt-4 flex gap-1 border-b border-slate-200" role="tablist" aria-label="Payload view">
              {(["tree", "text"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  id={`${uid}-tab-${v}`}
                  aria-selected={view === v}
                  aria-controls={`${uid}-panel-${v}`}
                  onClick={() => setView(v)}
                  className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-semibold ${view === v ? "border-primary text-primary-dark" : "border-transparent text-slate-600 hover:text-navy"} ${focusRing}`}
                >
                  {v === "tree" ? "Tree with paths" : "Formatted text"}
                </button>
              ))}
            </div>
            <div className="mt-3">
              {view === "text" ? (
                <div id={`${uid}-panel-text`} role="tabpanel" aria-labelledby={`${uid}-tab-text`}>
                  <label htmlFor={`${uid}-output`} className="sr-only">
                    Formatted JSON
                  </label>
                  <textarea id={`${uid}-output`} readOnly className={`${inputCls} h-80 resize-y bg-slate-50 font-mono text-xs`} value={shown} spellCheck={false} />
                  {output.length > MAX_DISPLAY && (
                    <p className="mt-1 text-xs text-slate-600">
                      Showing the first 200,000 characters; Download has everything.{output.length > MAX_COPY ? " Too large to copy." : ""}
                    </p>
                  )}
                </div>
              ) : (
                <div id={`${uid}-panel-tree`} role="tabpanel" aria-labelledby={`${uid}-tab-tree`} className="max-h-[32rem] overflow-auto rounded-xl border border-slate-200 p-2">
                  <p className="px-1 pb-1 text-xs text-slate-600">
                    Root: {result.rootSummary}. Key fields are marked; “copy path” gives a JSONPath such as $.data.object.id.
                  </p>
                  <ul role="tree" aria-label="Payload tree">
                    {renderLevel("", [], [], 0)}
                  </ul>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

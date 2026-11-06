"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { Located } from "./logic/input";
import type { FriendlyError } from "./logic/jq-errors";
import { explainJq } from "./logic/jq-explain";
import { ExpressionError, explainJsonPath, type Step } from "./logic/jsonpath-explain";
import { MAX_DISPLAY_CHARS, MAX_EXPRESSION_CHARS, MAX_FILE_BYTES, MAX_PASTE_BYTES, timeLimitMs } from "./logic/limits";
import type { JqOptions, Language, QueryResult } from "./logic/run";
import type { WorkerRequest, WorkerResponse } from "./worker/query.worker";
import { EXAMPLES, SAMPLE_JSON } from "../fixtures/examples";
import { focusRing, btnPrimary, btnSecondary, card } from "../../_shared/ui";

type Source = { id: number; kind: "text"; text: string } | { id: number; kind: "file"; file: File };
type Doc = { bytes: number; summary: string; name: string | null };
type Shown = { result: QueryResult; ms: number; language: Language; options: JqOptions };


const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ErrorBox({ title, error }: { title: string; error: FriendlyError | Located }) {
  return (
    <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <p>
        <strong>{title}{error.line !== null && error.column !== null ? ` (line ${error.line}, column ${error.column})` : ""}:</strong> {error.message}
      </p>
      {"hint" in error && error.hint && <p className="mt-1">{error.hint}</p>}
      {error.pointer && <pre className="mt-2 overflow-x-auto rounded-lg bg-white/70 p-2 font-mono text-xs leading-5">{error.pointer}</pre>}
    </div>
  );
}

export default function JsonpathTesterTool() {
  const uid = useId();
  const [language, setLanguage] = useState<Language>("jsonpath");
  const [text, setText] = useState(SAMPLE_JSON);
  const [file, setFile] = useState<File | null>(null);
  const [expression, setExpression] = useState(EXAMPLES.jsonpath[0].expression);
  const [compact, setCompact] = useState(false);
  const [raw, setRaw] = useState(false);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [docError, setDocError] = useState<Located | string | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [exampleIndex, setExampleIndex] = useState(1);
  const [retry, setRetry] = useState(0);

  const workerRef = useRef<Worker | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const seq = useRef(0);
  const loadJob = useRef(-1);
  const queryJob = useRef(-1);
  const sourceRef = useRef<Source | null>(null);
  /** Which source the current worker holds; null after it was terminated. */
  const loadedId = useRef<number | null>(null);
  const docBytes = useRef(0);
  const loadPending = useRef(false);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const next = () => ++seq.current;

  const stopTimers = () => {
    if (watchdog.current) clearTimeout(watchdog.current);
    watchdog.current = null;
  };

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const w = new Worker(new URL("./worker/query.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const m = event.data;
        if (m.jobId === loadJob.current) {
          if (m.type === "progress") {
            setBusy(m.label);
            return;
          }
          setBusy(null);
          setSlow(false);
          loadPending.current = false;
          if (m.type === "loaded") {
            docBytes.current = m.bytes;
            setDoc({ bytes: m.bytes, summary: m.summary, name: m.name });
            setDocError(null);
          } else if (m.type === "invalid") {
            setDoc(null);
            setDocError(m.error);
          } else if (m.type === "error") {
            setDoc(null);
            setDocError(m.message);
          }
          return;
        }
        if (m.jobId !== queryJob.current) return;
        if (m.type === "progress") {
          setBusy(m.label);
          return;
        }
        stopTimers();
        setBusy(null);
        setSlow(false);
        if (m.type === "result") {
          setShown({ result: m.result, ms: m.ms, language: queryLang.current, options: queryOpts.current });
          setQueryError(null);
        } else if (m.type === "error") {
          setShown(null);
          setQueryError(m.message);
        }
      };
      w.onerror = () => {
        stopTimers();
        setBusy(null);
        setSlow(false);
        setQueryError("The query worker stopped unexpectedly, possibly out of memory. Try a smaller document.");
        workerRef.current = null;
        loadedId.current = null;
      };
      workerRef.current = w;
    }
    return workerRef.current;
  }, []);

  const queryLang = useRef<Language>("jsonpath");
  const queryOpts = useRef<JqOptions>({ compact: false, raw: false });

  useEffect(
    () => () => {
      stopTimers();
      workerRef.current?.terminate();
    },
    [],
  );

  const post = useCallback((req: WorkerRequest) => getWorker().postMessage(req), [getWorker]);

  const ensureLoaded = useCallback(() => {
    const src = sourceRef.current;
    if (!src || loadedId.current === src.id) return;
    const jobId = next();
    loadJob.current = jobId;
    loadedId.current = src.id;
    loadPending.current = true;
    setTimeout(() => {
      if (loadJob.current === jobId && loadPending.current) setSlow(true);
    }, 1000);
    post({ type: "load", jobId, source: src.kind === "text" ? { kind: "text", text: src.text } : { kind: "file", file: src.file } });
  }, [post]);

  // Load the document whenever the pasted text or the chosen file changes.
  useEffect(() => {
    const t = setTimeout(
      () => {
        if (!file && text.trim() === "") {
          sourceRef.current = null;
          loadJob.current = next();
          setDoc(null);
          setDocError(null);
          setShown(null);
          setBusy(null);
          return;
        }
        if (!file && text.length * 3 > MAX_PASTE_BYTES && new TextEncoder().encode(text).length > MAX_PASTE_BYTES) {
          sourceRef.current = null;
          loadJob.current = next();
          setDoc(null);
          setDocError("The pasted text is larger than 5 MB. Save it as a .json file and open it instead (up to 50 MB).");
          return;
        }
        const id = next();
        sourceRef.current = file ? { id, kind: "file", file } : { id, kind: "text", text };
        setBusy("Reading the JSON");
        ensureLoaded();
      },
      file ? 0 : 300,
    );
    return () => clearTimeout(t);
  }, [text, file, ensureLoaded]);

  const steps = useMemo((): { steps: Step[] | null; error: FriendlyError | null } => {
    if (expression.trim() === "") return { steps: null, error: null };
    try {
      return { steps: language === "jsonpath" ? explainJsonPath(expression) : explainJq(expression), error: null };
    } catch (e) {
      if (!(e instanceof ExpressionError)) throw e;
      const lead = expression.length - expression.trimStart().length;
      const at = Math.min(e.index + lead, expression.length);
      const before = expression.slice(0, at).split("\n");
      const line = before.length;
      const column = before[before.length - 1].length + 1;
      const src = (expression.split("\n")[line - 1] ?? "").slice(0, 200);
      return { steps: null, error: { message: e.message, hint: null, line, column, pointer: `${src}\n${" ".repeat(column - 1)}^` } };
    }
  }, [expression, language]);

  // Run the query 250 ms after the last change, once the document is loaded.
  useEffect(() => {
    const t = setTimeout(() => {
      stopTimers();
      if (!doc || expression.trim() === "" || expression.length > MAX_EXPRESSION_CHARS) {
        queryJob.current = next();
        setShown(null);
        setQueryError(null);
        if (doc) setBusy(null);
        return;
      }
      ensureLoaded();
      const jobId = next();
      queryJob.current = jobId;
      queryLang.current = language;
      queryOpts.current = { compact, raw: language === "jq" && raw };
      post({ type: "query", jobId, language, expression, options: queryOpts.current });
      setBusy("Running the query");
      setSlow(false);
      const limit = timeLimitMs(docBytes.current);
      setTimeout(() => {
        if (queryJob.current === jobId) setSlow(true);
      }, 1000);
      watchdog.current = setTimeout(() => {
        if (queryJob.current !== jobId) return;
        workerRef.current?.terminate();
        workerRef.current = null;
        loadedId.current = null;
        queryJob.current = next();
        setBusy(null);
        setSlow(false);
        setShown(null);
        setQueryError(`The query took longer than ${(limit / 1000).toFixed(limit % 1000 ? 1 : 0)} seconds and was stopped. A regular expression or a recursive step may be too expensive; try a narrower query.`);
      }, limit);
    }, 250);
    return () => clearTimeout(t);
  }, [expression, language, compact, raw, doc, retry, post, ensureLoaded]);

  const cancel = () => {
    stopTimers();
    workerRef.current?.terminate();
    workerRef.current = null;
    const wasLoading = loadPending.current;
    loadPending.current = false;
    loadedId.current = null;
    queryJob.current = next();
    loadJob.current = next();
    setBusy(null);
    setSlow(false);
    if (wasLoading) {
      sourceRef.current = null;
      setDoc(null);
      setDocError("Loading was cancelled. Paste or open the JSON again to continue.");
    } else {
      setShown(null);
      setQueryError("The query was cancelled. Edit it to run it again.");
    }
  };

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  const copy = async () => {
    if (!shown) return;
    try {
      await navigator.clipboard.writeText(shown.result.output);
      flash("Copied to the clipboard.");
    } catch {
      flash("Copying was blocked by the browser. Select the result and copy it by hand.");
    }
  };

  const loadSample = () => {
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
    setText(SAMPLE_JSON);
  };

  const tryExample = () => {
    // Alternate between the two languages so both are one click away.
    const lang: Language = exampleIndex % 2 === 0 ? "jsonpath" : "jq";
    const list = EXAMPLES[lang];
    const ex = list[Math.floor(exampleIndex / 2) % list.length];
    loadSample();
    setLanguage(lang);
    setRaw(ex.expression.includes("@csv"));
    setExpression(ex.expression);
    setExampleIndex(exampleIndex + 1);
  };

  const pickExample = (expr: string) => {
    if (!doc && !file && text.trim() === "") loadSample();
    if (language === "jq") setRaw(expr.includes("@csv"));
    setExpression(expr);
  };

  const onFile = (f: File | null) => {
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      setDoc(null);
      setDocError(`This file is ${formatBytes(f.size)}; the limit is 50 MB.`);
      return;
    }
    setText("");
    setFile(f);
  };

  const switchLanguage = (lang: Language) => {
    if (lang === language) return;
    setLanguage(lang);
    setExpression("");
    setShown(null);
  };

  const result = shown?.result;
  const output = result?.output ?? "";
  const display = output.length > MAX_DISPLAY_CHARS ? output.slice(0, MAX_DISPLAY_CHARS) : output;
  const isJsonOutput = shown ? !(shown.language === "jq" && shown.options.raw) : true;
  const countLabel = result
    ? shown!.language === "jq" && shown!.options.raw
      ? `${result.count.toLocaleString("en-US")} line${result.count === 1 ? "" : "s"}`
      : shown!.language === "jsonpath"
        ? `${result.count.toLocaleString("en-US")} match${result.count === 1 ? "" : "es"}`
        : `${result.count.toLocaleString("en-US")} output${result.count === 1 ? "" : "s"}`
    : "";

  return (
    <div className="space-y-6">
      <section className={card} aria-labelledby={`${uid}-json`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-json`} className="text-lg font-semibold text-navy"><span className="tool-step" aria-hidden>1</span>JSON data</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} onClick={tryExample}>
              Try an example
            </button>
            <button type="button" className={btnSecondary} onClick={() => fileInput.current?.click()}>
              Open a .json file
            </button>
            <button
              type="button"
              className={btnSecondary}
              disabled={text === "" && !file}
              onClick={() => {
                setText("");
                setFile(null);
                if (fileInput.current) fileInput.current.value = "";
              }}
            >
              Clear
            </button>
          </div>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json,.txt,text/plain"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            File: <span className="font-semibold text-navy">{file.name}</span> ({formatBytes(file.size)}). The file is read in your browser and is not uploaded.
          </p>
        ) : (
          <>
            <label htmlFor={`${uid}-text`} className="mt-3 block text-sm text-slate-600">
              Paste JSON
            </label>
            <textarea
              id={`${uid}-text`}
              className={`mt-2 h-48 w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-sm text-navy ${focusRing}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              placeholder={"{\n  \"orders\": [{ \"id\": 1, \"total\": 54.5 }]\n}"}
            />
          </>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Paste up to 5 MB or open a file up to 50 MB. Everything runs in your browser; nothing is uploaded.
        </p>
        {doc && !docError && (
          <p className="mt-2 text-sm text-slate-700">
            Valid JSON: {doc.summary}, {formatBytes(doc.bytes)}.
          </p>
        )}
        {docError && (typeof docError === "string" ? (
          <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{docError}</div>
        ) : (
          <ErrorBox title="The JSON is not valid" error={docError} />
        ))}
      </section>

      <section className={card} aria-labelledby={`${uid}-expr`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-expr`} className="text-lg font-semibold text-navy"><span className="tool-step" aria-hidden>2</span>Expression</h2>
          <div role="radiogroup" aria-label="Query language" className="inline-flex rounded-xl border border-slate-300 bg-white p-1">
            {(["jsonpath", "jq"] as const).map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={language === l}
                onClick={() => switchLanguage(l)}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${focusRing} ${language === l ? "bg-primary text-white" : "text-navy hover:bg-slate-50"}`}
              >
                {l === "jsonpath" ? "JSONPath" : "jq"}
              </button>
            ))}
          </div>
        </div>
        <label htmlFor={`${uid}-q`} className="mt-3 block text-sm text-slate-600">
          {language === "jsonpath" ? "JSONPath expression" : "jq filter"}
        </label>
        <textarea
          id={`${uid}-q`}
          rows={language === "jq" ? 3 : 1}
          maxLength={MAX_EXPRESSION_CHARS}
          className={`mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white p-3 font-mono text-sm text-navy ${focusRing}`}
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={language === "jsonpath" ? "$.orders[?(@.total > 50)].id" : ".orders[] | select(.total > 50) | .id"}
        />
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} className={`h-4 w-4 rounded ${focusRing}`} />
            {language === "jq" ? "Compact output (-c)" : "One match per line"}
          </label>
          {language === "jq" && (
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={raw} onChange={(e) => setRaw(e.target.checked)} className={`h-4 w-4 rounded ${focusRing}`} />
              Raw strings (-r)
            </label>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Up to {MAX_EXPRESSION_CHARS.toLocaleString("en-US")} characters. Each query is stopped after 2 seconds (a little longer for documents over 2 MB).
          {language === "jq" ? " jq 1.8 runs as WebAssembly and loads the first time you use it (about 330 KB)." : " JSONPath uses the jsonpath-plus syntax; filters run without eval."}
        </p>

        <div className="mt-4">
          <h3 className="text-sm font-semibold text-navy">Examples (for the sample data)</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES[language].map((ex) => (
              <li key={ex.expression}>
                <button type="button" className={`rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-xs text-slate-700 hover:border-primary hover:bg-primary-soft ${focusRing}`} onClick={() => pickExample(ex.expression)} title={ex.expression}>
                  {ex.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {(steps.steps || steps.error) && (
        <section className={card} aria-labelledby={`${uid}-explain`}>
          <h2 id={`${uid}-explain`} className="text-lg font-semibold text-navy">What this expression does</h2>
          {steps.error && <ErrorBox title="The expression has a problem" error={steps.error} />}
          {steps.steps && (
            <ol className="mt-3 space-y-2">
              {steps.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm" style={{ paddingLeft: `${s.depth * 1.25}rem` }}>
                  <span className="mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary-soft px-1.5 text-xs font-semibold text-primary" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span>
                    {s.code && <code className="mr-2 break-all rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-navy">{s.code.length > 120 ? `${s.code.slice(0, 117)}…` : s.code}</code>}
                    <span className="text-slate-700">{s.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <div aria-live="polite" className="min-h-6 text-sm text-slate-600">
        {busy && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-block h-4 w-4 rounded-full border-2 border-primary border-t-transparent motion-safe:animate-spin" aria-hidden="true" />
            <span>{busy}…</span>
            {slow && (
              <button type="button" className={btnSecondary} onClick={cancel}>
                Cancel
              </button>
            )}
          </div>
        )}
        {!busy && !doc && !docError && expression.trim() !== "" && <p>Paste or open some JSON to see the result.</p>}
      </div>

      {queryError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{queryError}</p>
          <button type="button" className={`${btnSecondary} mt-2`} onClick={() => setRetry((n) => n + 1)}>
            Run again
          </button>
        </div>
      )}

      <div aria-live="polite">
        {shown && result && (
          <section className={card} aria-labelledby={`${uid}-result`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id={`${uid}-result`} className="text-lg font-semibold text-navy">
                Result <span className="text-sm font-normal text-slate-600">· {countLabel} · {shown.ms.toLocaleString("en-US")} ms</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnPrimary} onClick={copy} disabled={output === ""}>
                  Copy result
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={output === ""}
                  onClick={() => download(output, isJsonOutput && !(shown.options.compact && result.count > 1) ? "result.json" : "result.txt", isJsonOutput ? "application/json" : "text/plain;charset=utf-8")}
                >
                  Download
                </button>
              </div>
            </div>
            {notice && <p className="mt-2 text-sm text-slate-600">{notice}</p>}
            {result.error && <ErrorBox title={shown.language === "jq" ? "jq reported an error" : "JSONPath could not run"} error={result.error} />}
            {output !== "" ? (
              <pre className="mt-3 max-h-[32rem] overflow-auto rounded-xl bg-slate-900 p-4 font-mono text-xs leading-5 text-slate-100 sm:text-sm">
                <code>{display}</code>
              </pre>
            ) : (
              !result.error && <p className="mt-3 text-sm text-slate-700">{shown.language === "jsonpath" ? "No matches. Check the property names: JSONPath is case-sensitive." : "jq produced no output (for example, select() matched nothing)."}</p>
            )}
            {display.length < output.length && (
              <p className="mt-2 text-xs text-slate-500">
                Showing the first {MAX_DISPLAY_CHARS.toLocaleString("en-US")} of {output.length.toLocaleString("en-US")} characters. Copy or download to get all of it.
              </p>
            )}
            {result.paths.length > 0 && (
              <details className="mt-3 text-sm text-slate-700">
                <summary className={`cursor-pointer rounded font-semibold text-navy ${focusRing}`}>Paths of the matches</summary>
                <ul className="mt-2 max-h-60 space-y-1 overflow-auto font-mono text-xs">
                  {result.paths.slice(0, 200).map((p, i) => (
                    <li key={i} className="break-all">{p}</li>
                  ))}
                </ul>
                {result.paths.length > 200 && <p className="mt-1 text-xs text-slate-500">First 200 of {result.paths.length.toLocaleString("en-US")} paths.</p>}
              </details>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Result } from "./logic/convert";
import { TARGETS, type Target } from "./logic/generate";
import { tooLarge } from "./logic/model";
import type { WorkerRequest, WorkerResponse } from "./worker/convert.worker";
import { EXAMPLES } from "../fixtures/examples";
import { focusRing, btnPrimary, btnSecondary, card } from "../../_shared/ui";

const MAX_DISPLAY = 200_000;


function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function CurlToPythonConverterTool() {
  const uid = useId();
  const [text, setText] = useState(EXAMPLES[0].text);
  const [target, setTarget] = useState<Target>("python");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [example, setExample] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const job = useRef(0);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const w = new Worker(new URL("./worker/convert.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const m = event.data;
        if (m.jobId !== job.current) return;
        setBusy(false);
        setSlow(false);
        if (m.ok) {
          setResult(m.result);
          setError(null);
        } else {
          setResult(null);
          setError(m.message);
        }
      };
      w.onerror = () => {
        setBusy(false);
        setSlow(false);
        setResult(null);
        setError("The converter stopped unexpectedly. Try a shorter command.");
        workerRef.current = null;
      };
      workerRef.current = w;
    }
    return workerRef.current;
  }, []);

  useEffect(() => () => workerRef.current?.terminate(), []);

  useEffect(() => {
    const t = setTimeout(() => {
      const jobId = ++job.current;
      setBusy(false);
      setSlow(false);
      if (text.trim() === "") {
        setResult(null);
        setError(null);
        return;
      }
      const big = tooLarge(text);
      if (big) {
        setResult(null);
        setError(big);
        return;
      }
      const req: WorkerRequest = { jobId, text, target };
      getWorker().postMessage(req);
      setBusy(true);
      setTimeout(() => {
        if (job.current === jobId) setSlow(true);
      }, 1000);
    }, 200);
    return () => clearTimeout(t);
  }, [text, target, getWorker]);

  const cancel = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    job.current++;
    setBusy(false);
    setSlow(false);
    setResult(null);
    setError("Conversion cancelled. Edit the input or choose another language to try again.");
  };

  const output = result ? (result.direction === "to-code" ? result.output.code : result.curl) : "";
  const ext = result?.direction === "to-curl" ? "sh" : TARGETS.find((x) => x.id === target)!.ext;
  const outputLabel = result?.direction === "to-curl" ? "curl command" : TARGETS.find((x) => x.id === target)!.label;

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      flash("Copied to the clipboard.");
    } catch {
      flash("Copying was blocked by the browser. Select the code and copy it by hand.");
    }
  };

  const tryExample = () => {
    setText(EXAMPLES[example].text);
    setExample((example + 1) % EXAMPLES.length);
  };

  const req = result?.request;
  const shown = output.length > MAX_DISPLAY ? output.slice(0, MAX_DISPLAY) : output;
  const notes = result?.direction === "to-code" ? result.output.notes : [];

  return (
    <div className="space-y-6">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-in`} className="text-lg font-semibold text-navy">Paste a curl command</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={tryExample}>
              Try an example
            </button>
            <button type="button" className={btnSecondary} onClick={() => setText("")} disabled={text === ""}>
              Clear
            </button>
          </div>
        </div>
        <label htmlFor={`${uid}-text`} className="mt-3 block text-sm text-slate-600">
          curl command, or a Python <code>requests</code> / JavaScript <code>fetch</code> snippet to turn back into curl
        </label>
        <textarea
          id={`${uid}-text`}
          className={`mt-2 h-44 w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-sm text-navy ${focusRing}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={"curl -X POST https://api.example.com/v1/orders \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"qty\": 2}'"}
        />
        <p className="mt-2 text-xs text-slate-500">
          Up to 5 MB of pasted text. Converted in your browser: the request is never run or sent, and nothing you paste leaves this page.
        </p>

        <fieldset className="mt-4">
          <legend className="text-sm font-semibold text-navy">Output language</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {TARGETS.map((t) => (
              <label
                key={t.id}
                className={`cursor-pointer rounded-xl border px-3 py-2 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${target === t.id ? "border-primary bg-primary/10 font-semibold text-navy" : "border-slate-300 bg-white text-slate-700"}`}
              >
                <input type="radio" name={`${uid}-target`} value={t.id} checked={target === t.id} onChange={() => setTarget(t.id)} className="sr-only" />
                {t.label}
              </label>
            ))}
          </div>
          {result?.direction === "to-curl" && (
            <p className="mt-2 text-xs text-slate-500">This input is {result.source === "python" ? "Python" : "JavaScript"} code, so it is turned into curl; the language choice applies to curl input.</p>
          )}
        </fieldset>
      </section>

      <div aria-live="polite" className="min-h-6 text-sm text-slate-600">
        {busy && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-block h-4 w-4 rounded-full border-2 border-primary border-t-transparent motion-safe:animate-spin" aria-hidden="true" />
            <span>Converting…</span>
            {slow && (
              <button type="button" className={btnSecondary} onClick={cancel}>
                Cancel
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">This could not be converted</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      <div aria-live="polite">
        {result && req && (
          <section className={card} aria-labelledby={`${uid}-out`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id={`${uid}-out`} className="text-lg font-semibold text-navy">
                {outputLabel}
              </h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnPrimary} onClick={copy}>
                  Copy code
                </button>
                <button type="button" className={btnSecondary} onClick={() => download(output, `request.${ext}`)}>
                  Download .{ext}
                </button>
              </div>
            </div>
            {notice && <p className="mt-2 text-sm text-slate-600">{notice}</p>}
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-mono font-semibold text-navy">{req.method}</span> <span className="break-all font-mono">{req.url}</span>
              {req.headers.length > 0 && <> · {req.headers.length} header{req.headers.length === 1 ? "" : "s"}</>}
              {req.body && <> · {req.body.kind === "json" ? "JSON" : req.body.kind === "form" ? "form" : req.body.kind === "multipart" ? "multipart" : req.body.kind === "file" ? "file" : "raw"} body</>}
            </p>
            <pre className="mt-3 max-h-[32rem] overflow-auto rounded-xl bg-slate-900 p-4 font-mono text-xs leading-5 text-slate-100 sm:text-sm">
              <code>{shown}</code>
            </pre>
            {shown.length < output.length && (
              <p className="mt-2 text-xs text-slate-500">
                Showing the first {MAX_DISPLAY.toLocaleString("en-US")} of {output.length.toLocaleString("en-US")} characters. Copy or download to get all of it.
              </p>
            )}

            {req.warnings.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <h3 className="font-semibold">Check before you use it</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {req.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {req.unmapped.length > 0 && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <h3 className="font-semibold text-navy">Not converted</h3>
                <ul className="mt-1 space-y-1">
                  {req.unmapped.map((u, i) => (
                    <li key={`${u.option}-${i}`}>
                      <code className="font-mono text-navy">{u.option}</code>: {u.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {notes.length > 0 && (
              <div className="mt-4 text-sm text-slate-700">
                <h3 className="font-semibold text-navy">Notes on this translation</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { sampleInput } from "../fixtures/sampleInput";
import { sampleResult } from "../fixtures/sampleResult";
import { DISCLAIMER, LIMIT_TEXT, MAX_CODE_CHARS, MAX_DESCRIPTION_CHARS } from "./limits";
import { detect, type SafetyFlag } from "./logic/detector";
import { splitLines } from "./logic/vbaText";
import type { ApiResponse, MacroResult, Risk } from "./types";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const ENDPOINT = "/api/tools/excel-vba-macro-generator";

const SAMPLE_DESCRIPTION = "Copy every row of Sheet1 whose Status in column C is Paid to the sheet named Paid, below the rows already there. Row 1 has headers.";
const SEV: Record<SafetyFlag["severity"], { label: string; cls: string }> = {
  high: { label: "High", cls: "border-red-300 bg-red-100 text-red-900" },
  medium: { label: "Medium", cls: "border-amber-300 bg-amber-100 text-amber-950" },
  low: { label: "Low", cls: "border-slate-300 bg-slate-100 text-slate-800" },
};

type Mode = "explain" | "generate";
type Failure = { message: string; retry: boolean };

function save(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function FlagList({ flags }: { flags: SafetyFlag[] }) {
  if (!flags.length) return <p className="text-sm">Our detector found none of the risky operations it looks for (file deletion, Shell, external connections, registry, API calls, auto-run…).</p>;
  return (
    <ul className="space-y-2">
      {flags.map((f, i) => (
        <li key={i} className="text-sm">
          <span className={`mr-2 inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${SEV[f.severity].cls}`}>{SEV[f.severity].label}</span>
          <span className="font-semibold">
            Line {f.line}: {f.title}.
          </span>{" "}
          {f.what}
          <code className="mt-1 block break-all rounded bg-white/70 px-2 py-1 font-mono text-xs text-navy">{f.excerpt}</code>
        </li>
      ))}
    </ul>
  );
}

function SafetyReview({ result }: { result: MacroResult }) {
  const high = result.safety.some((f) => f.severity === "high");
  const risks: Risk[] = result.status === "ok" ? result.modelRisks : [];
  return (
    <div role={high ? "alert" : undefined} className={`rounded-xl border p-3 sm:p-4 ${high ? "border-red-200 bg-red-50 text-red-950" : "border-amber-300 bg-amber-50 text-amber-950"}`}>
      <h3 className="font-semibold">Safety review</h3>
      <p className="mt-1 text-sm">{DISCLAIMER}</p>
      <h4 className="mt-3 text-sm font-semibold">Found by our detector ({result.safety.length})</h4>
      <div className="mt-1">
        <FlagList flags={result.safety} />
      </div>
      {risks.length > 0 && (
        <>
          <h4 className="mt-3 text-sm font-semibold">Also noted by the AI</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {risks.map((r, i) => (
              <li key={i}>
                {r.line ? `Line ${r.line}: ` : ""}
                {r.text}
              </li>
            ))}
          </ul>
        </>
      )}
      {result.platformNotes.length > 0 && (
        <>
          <h4 className="mt-3 text-sm font-semibold">Windows, Mac and 64-bit</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {result.platformNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function CodeView({ code, flagged, label, start = 1 }: { code: string; flagged: Set<number>; label: string; start?: number }) {
  const lines = splitLines(code);
  return (
    <pre className="max-h-[32rem] overflow-auto rounded-xl border border-slate-200 bg-slate-50 py-2 font-mono text-[13px] leading-5 text-navy" tabIndex={0} aria-label={label}>
      {lines.map((l, i) => (
        <div key={i} className={`flex ${flagged.has(i + start) ? "bg-red-100" : ""}`}>
          <span className="w-10 shrink-0 select-none pr-2 text-right text-slate-500">{i + start}</span>
          <span className="whitespace-pre pr-3">{l || " "}</span>
        </div>
      ))}
    </pre>
  );
}

function explainMarkdown(r: Extract<MacroResult, { mode: "explain"; status: "ok" }>): string {
  const src = splitLines(r.code);
  const out = ["# VBA explanation", "", r.summary, "", "## Safety review", "", DISCLAIMER, ""];
  out.push(...(r.safety.length ? r.safety.map((f) => `- [${f.severity}] Line ${f.line}: ${f.title}. ${f.what}`) : ["- Our detector found no risky operation."]));
  out.push(...r.modelRisks.map((x) => `- (AI) ${x.line ? `Line ${x.line}: ` : ""}${x.text}`), ...r.platformNotes.map((n) => `- ${n}`), "", "## Line by line", "");
  for (const l of r.lines) out.push(`### Lines ${l.from}${l.to > l.from ? `–${l.to}` : ""}`, "", "```vb", ...src.slice(l.from - 1, l.to), "```", "", l.text, "");
  return out.join("\n");
}

export default function ExcelVbaMacroGeneratorTool() {
  const uid = useId();
  const [mode, setMode] = useState<Mode>("explain");
  const [code, setCode] = useState(sampleInput.mode === "explain" ? sampleInput.code : "");
  const [description, setDescription] = useState(SAMPLE_DESCRIPTION);
  const [result, setResult] = useState<MacroResult>(sampleResult);
  const [isSample, setIsSample] = useState(true);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const deferredCode = useDeferredValue(code);
  const liveFlags = useMemo(() => (mode === "explain" && deferredCode.trim() ? detect(deferredCode) : []), [mode, deferredCode]);
  const showLive = mode === "explain" && code.trim() !== "" && !(result.mode === "explain" && result.status === "ok" && result.code === code);

  const submit = async () => {
    const body = mode === "explain" ? { mode, code } : { mode, description };
    if (mode === "explain" && code.trim().length < 5) return setFailure({ message: "Paste the VBA code to explain.", retry: false });
    if (mode === "generate" && description.trim().length < 10) return setFailure({ message: "Describe what the macro should do (a sentence at least).", retry: false });
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setFailure(null);
    setNotice(null);
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
      const json = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!json) throw new Error("The macro service did not answer properly. Please try again.");
      if (json.ok) {
        setResult(json.data);
        setIsSample(false);
        setTimeout(() => heading.current?.focus(), 0);
      } else setFailure({ message: json.error.message, retry: res.status === 502 || res.status === 500 });
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setFailure({ message: e instanceof Error && !(e instanceof TypeError) ? e.message : "Could not reach the macro service. Check your connection and try again.", retry: true });
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

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${what} copied.`);
    } catch {
      setNotice("Your browser blocked clipboard access. Use the download instead.");
    }
  };

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      id={`${uid}-tab-${m}`}
      aria-selected={mode === m}
      aria-controls={`${uid}-panel`}
      tabIndex={mode === m ? 0 : -1}
      className={`rounded-lg px-4 py-2 text-sm font-semibold ${focusRing} ${mode === m ? "bg-white text-navy shadow-sm" : "text-slate-700 hover:text-navy"}`}
      onClick={() => setMode(m)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          const next = m === "explain" ? "generate" : "explain";
          setMode(next);
          document.getElementById(`${uid}-tab-${next}`)?.focus();
        }
      }}
    >
      {label}
    </button>
  );

  const flaggedLines = new Set(result.safety.map((f) => f.line));

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-label="VBA input">
        <div role="tablist" aria-label="Mode" className="inline-flex rounded-xl bg-slate-100 p-1">
          {tab("explain", "Explain VBA")}
          {tab("generate", "Generate a macro")}
        </div>
        <form
          id={`${uid}-panel`}
          role="tabpanel"
          aria-labelledby={`${uid}-tab-${mode}`}
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {mode === "explain" ? (
            <div>
              <label htmlFor={`${uid}-code`} className="block text-sm font-medium text-slate-700">
                VBA code to explain
              </label>
              <textarea id={`${uid}-code`} className={`${inputCls} mt-1 min-h-48 font-mono`} value={code} maxLength={MAX_CODE_CHARS} spellCheck={false} onChange={(e) => setCode(e.target.value)} placeholder={"Sub Example()\n    ...\nEnd Sub"} aria-describedby={`${uid}-cc`} />
              <p id={`${uid}-cc`} className="mt-1 text-xs text-slate-600">
                {code.length.toLocaleString("en-US")} / {MAX_CODE_CHARS.toLocaleString("en-US")} characters. The safety scan runs in your browser as you paste.
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor={`${uid}-desc`} className="block text-sm font-medium text-slate-700">
                What should the macro do?
              </label>
              <textarea id={`${uid}-desc`} className={`${inputCls} mt-1 min-h-28`} value={description} maxLength={MAX_DESCRIPTION_CHARS} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Save every sheet as a separate PDF in a folder next to the workbook" aria-describedby={`${uid}-dc`} />
              <p id={`${uid}-dc`} className="mt-1 text-xs text-slate-600">
                {description.length.toLocaleString("en-US")} / {MAX_DESCRIPTION_CHARS.toLocaleString("en-US")} characters
              </p>
            </div>
          )}
          {showLive && (
            <div className={`rounded-xl border p-3 ${liveFlags.some((f) => f.severity === "high") ? "border-red-200 bg-red-50 text-red-950" : "border-slate-200 bg-slate-50 text-slate-900"}`}>
              <h3 className="text-sm font-semibold">Instant safety scan of the pasted code ({liveFlags.length})</h3>
              <div className="mt-1">
                <FlagList flags={liveFlags} />
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className={btnPrimary} disabled={busy}>
              {busy ? "Working…" : mode === "explain" ? "Explain code" : "Generate macro"}
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
                  setMode("explain");
                  setCode(sampleInput.mode === "explain" ? sampleInput.code : "");
                  setDescription(SAMPLE_DESCRIPTION);
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
          <p className="text-xs text-slate-600">When you press the button, your {mode === "explain" ? "code" : "description"} is sent to our server and to the AI provider. Limit: {LIMIT_TEXT}.</p>
        </form>
      </section>

      {failure && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between">
          <p>{failure.message}</p>
          {failure.retry && (
            <button type="button" className={btnSecondary} onClick={() => void submit()} disabled={busy}>
              Try again
            </button>
          )}
        </div>
      )}

      <section className={`${card} min-h-64`} aria-labelledby={`${uid}-out`} aria-busy={busy}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={`${uid}-out`} ref={heading} tabIndex={-1} className="text-lg font-semibold focus:outline-none">
            {result.mode === "explain" ? "Explanation" : "Your macro"}
          </h2>
          {isSample && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Example result (nothing was sent)</span>}
          {!isSample && result.cached && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Answered from a short-lived cache</span>}
        </div>
        <div aria-live="polite" className="mt-3 space-y-4">
          {busy && <p className="text-sm text-slate-700">Working on it… this can take up to half a minute.</p>}
          {notice && <p className="text-sm text-slate-700">{notice}</p>}
          {result.status === "ok" && <SafetyReview result={result} />}
          {result.status === "ok" && result.mode === "generate" && (
            <>
              <p className="text-sm leading-relaxed text-slate-800">{result.summary}</p>
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-700">VBA module</h3>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={btnSecondary} onClick={() => void copy(result.code, "Code")}>
                      Copy code
                    </button>
                    <button type="button" className={btnSecondary} onClick={() => save(`Attribute VB_Name = "Module1"\r\n${result.code.replace(/\r?\n/g, "\r\n")}\r\n`, "Module1.bas", "text/plain;charset=utf-8")}>
                      Download .bas
                    </button>
                  </div>
                </div>
                <div className="mt-2">
                  <CodeView code={result.code} flagged={flaggedLines} label="Generated VBA module" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700">How to run it</h3>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-800">
                  {result.howToRun.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
              {result.assumptions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Assumptions the AI made</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800">
                    {result.assumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          {result.status === "ok" && result.mode === "explain" && (
            <>
              <p className="text-sm leading-relaxed text-slate-800">{result.summary}</p>
              <ol className="space-y-3">
                {result.lines.map((l, i) => (
                  <li key={i} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-xs font-semibold text-slate-600">
                      Line{l.to > l.from ? `s ${l.from}–${l.to}` : ` ${l.from}`}
                    </p>
                    <div className="mt-1">
                      <CodeView code={splitLines(result.code).slice(l.from - 1, l.to).join("\n")} start={l.from} flagged={flaggedLines} label={`Code of lines ${l.from} to ${l.to}`} />
                    </div>
                    <p className="mt-2 text-sm text-slate-800">{l.text}</p>
                  </li>
                ))}
              </ol>
              {(result.dropped > 0 || result.unexplained.length > 0) && (
                <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  {result.dropped > 0 && `${result.dropped} explanation${result.dropped === 1 ? " was" : "s were"} left out because ${result.dropped === 1 ? "it pointed" : "they pointed"} at lines that are not in your code. `}
                  {result.unexplained.length > 0 && `Not explained: line${result.unexplained.length === 1 ? "" : "s"} ${result.unexplained.join(", ")}.`}
                </p>
              )}
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <button type="button" className={btnSecondary} onClick={() => save(explainMarkdown(result), "vba-explanation.md", "text/markdown;charset=utf-8")}>
                  Download as Markdown
                </button>
                <button type="button" className={btnSecondary} onClick={() => void copy(explainMarkdown(result), "Explanation")}>
                  Copy explanation
                </button>
              </div>
            </>
          )}
          {result.status !== "ok" && (
            <>
              {result.safety.length > 0 && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-950">
                  <h3 className="font-semibold">Safety review of the pasted code</h3>
                  <p className="mt-1 text-sm">{DISCLAIMER}</p>
                  <div className="mt-2">
                    <FlagList flags={result.safety} />
                  </div>
                </div>
              )}
              <div className={`rounded-xl border p-4 text-sm ${result.status === "refused" ? "border-slate-200 bg-slate-50" : "border-blue-200 bg-primary-soft"}`}>
                <p className="font-semibold">{result.status === "refused" ? "This request was not accepted" : "The AI needs one more detail"}</p>
                <p className="mt-1">{result.message}</p>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

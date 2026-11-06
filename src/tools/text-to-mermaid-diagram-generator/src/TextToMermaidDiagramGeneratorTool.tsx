"use client";

import { useEffect, useId, useRef, useState } from "react";
import { checkInput, detectKind, formatMermaidError, LARGE_CHARS, MAX_CHARS, strictModeNotes, type DiagramError, type Theme } from "./logic/diagram";
import { exportName } from "./logic/svg";
import { downloadPng, downloadSvg, mountSvg, printPdf, RenderError, renderDiagram } from "./render/mermaidRenderer";
import { TEMPLATES, type DiagramKind } from "../fixtures/templates";
import { btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

type Status = "empty" | "loading" | "done" | "error" | "stale";


export default function TextToMermaidDiagramGeneratorTool() {
  const uid = useId();
  const [code, setCode] = useState(TEMPLATES.flowchart.code);
  const [theme, setTheme] = useState<Theme>("light");
  const [template, setTemplate] = useState<DiagramKind>("flowchart");
  const [status, setStatus] = useState<Status>("empty");
  const [svg, setSvg] = useState<string | null>(null);
  const [kind, setKind] = useState<DiagramKind | null>(null);
  const [error, setError] = useState<DiagramError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [renderRequest, setRenderRequest] = useState(0);
  const lastRequest = useRef(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const jobRef = useRef(0);

  useEffect(() => {
    const job = ++jobRef.current;
    const trimmed = code.trim();
    const requested = renderRequest !== lastRequest.current;
    lastRequest.current = renderRequest;
    // Mermaid lays diagrams out on the main thread (it needs the DOM to measure text), so big
    // diagrams only re-render on request; typing stays smooth.
    const manual = code.length > LARGE_CHARS && !requested;
    const delay = trimmed === "" || requested ? 0 : 350;
    const timer = setTimeout(() => {
      setSlow(false);
      if (manual && trimmed !== "") {
        setStatus("stale");
        return;
      }
      if (trimmed === "") {
        setStatus("empty");
        setSvg(null);
        setError(null);
        previewRef.current?.replaceChildren();
        return;
      }
      const size = checkInput(code);
      if (!size.ok) {
        setStatus("error");
        setError({ line: null, message: size.error, source: null });
        return;
      }
      const detected = detectKind(code);
      if (!detected.ok) {
        setStatus("error");
        setError({ line: detected.line, message: detected.error, source: null });
        return;
      }
      setStatus("loading");
      const slowTimer = setTimeout(() => {
        if (jobRef.current === job) setSlow(true);
      }, 1000);
      renderDiagram(code, theme)
        .then((out) => {
          if (jobRef.current !== job || !previewRef.current) return;
          mountSvg(previewRef.current, out);
          setSvg(out);
          setKind(detected.kind);
          setError(null);
          setStatus("done");
        })
        .catch((err: unknown) => {
          if (jobRef.current !== job) return;
          const cause = err instanceof RenderError ? err.cause : err;
          const loadFailed = !(err instanceof RenderError);
          setError(
            loadFailed
              ? { line: null, message: "The diagram engine could not be loaded. Check your connection and reload the page.", source: null }
              : formatMermaidError(cause, code),
          );
          setStatus("error");
        })
        .finally(() => {
          clearTimeout(slowTimer);
          if (jobRef.current === job) setSlow(false);
        });
    }, delay);
    return () => clearTimeout(timer);
  }, [code, theme, renderRequest]);

  const cancel = () => {
    jobRef.current++;
    setSlow(false);
    setStatus(svg ? "done" : "empty");
    setNotice("Rendering stopped. Edit the code to try again.");
  };

  const notes = strictModeNotes(code);
  const name = (ext: "svg" | "png" | "pdf" | "mmd") => exportName(kind ?? "mermaid", ext);
  const ready = (status === "done" || status === "stale") && svg !== null;

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${what} copied to the clipboard.`);
    } catch {
      setNotice("Your browser blocked clipboard access. Select the text and press Ctrl+C or Cmd+C.");
    }
  };

  const exportAction = async (fn: () => void | Promise<void>, done: string) => {
    try {
      await fn();
      setNotice(done);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "The export failed in this browser. Try the SVG download instead.");
    }
  };

  const loadTemplate = (k: DiagramKind) => {
    setTemplate(k);
    setNotice(null);
    setCode(TEMPLATES[k].code);
  };

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-code-h`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-code-h`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>1</span>Mermaid code</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={() => loadTemplate("flowchart")}>Try an example</button>
            <button type="button" className={btnSecondary} onClick={() => setCode("")} disabled={code === ""}>Clear</button>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-tpl`} className="block text-sm font-medium">Start from a template</label>
            <div className="mt-1 flex gap-2">
              <select id={`${uid}-tpl`} className={inputCls} value={template} onChange={(e) => setTemplate(e.target.value as DiagramKind)}>
                {(Object.keys(TEMPLATES) as DiagramKind[]).map((k) => <option key={k} value={k}>{TEMPLATES[k].label}</option>)}
              </select>
              <button type="button" className={btnSecondary} onClick={() => loadTemplate(template)}>Insert</button>
            </div>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Theme</legend>
            <div className="mt-1 inline-flex rounded-xl border border-slate-300 p-1">
              {(["light", "dark"] as const).map((t) => (
                <label key={t} className={`cursor-pointer rounded-lg px-4 py-1.5 text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${theme === t ? "bg-primary text-white" : "text-navy hover:bg-slate-50"}`}>
                  <input type="radio" className="sr-only" name={`${uid}-theme`} checked={theme === t} onChange={() => setTheme(t)} />
                  {t === "light" ? "Light" : "Dark"}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <label htmlFor={`${uid}-editor`} className="mt-4 block text-sm font-medium">Code (flowchart, sequence, ER, Gantt, state or class diagram)</label>
        <textarea
          id={`${uid}-editor`}
          className={`${inputCls} mt-1 h-80 resize-y font-mono text-xs leading-5`}
          value={code}
          onChange={(e) => {
            setNotice(null);
            setCode(e.target.value);
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={"flowchart TD\n    A[Start] --> B{Decision}\n    B -- Yes --> C[Do it]\n    B -- No --> D[Skip]"}
          aria-describedby={`${uid}-count`}
          aria-invalid={status === "error" ? true : undefined}
        />
        <p id={`${uid}-count`} className={`mt-1 text-xs ${code.length > MAX_CHARS ? "text-red-800" : "text-slate-ink"}`}>
          {code.length.toLocaleString("en-US")} / {MAX_CHARS.toLocaleString("en-US")} characters. Rendered in your browser in strict mode; nothing is uploaded.
        </p>
        {notes.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 rounded-xl bg-amber-50 p-3 pl-7 text-sm text-amber-900">
            {notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        )}
      </section>

      <section className={card} aria-labelledby={`${uid}-out-h`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-out-h`} className="text-lg font-semibold"><span className="tool-step" aria-hidden>2</span>Preview and export</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} disabled={!ready} onClick={() => svg && exportAction(() => downloadPng(svg, theme, name("png")), "PNG saved at 2× size.")}>PNG (2×)</button>
            <button type="button" className={btnSecondary} disabled={!ready} onClick={() => svg && exportAction(() => downloadSvg(svg, theme, name("svg")), "SVG saved.")}>SVG</button>
            <button type="button" className={btnSecondary} disabled={!ready} onClick={() => svg && exportAction(() => printPdf(svg, theme, name("pdf")), "Print dialog opened: choose “Save as PDF” as the printer.")}>PDF</button>
            <button type="button" className={btnSecondary} disabled={!ready} onClick={() => svg && copy(svg, "SVG code")}>Copy SVG</button>
            <button type="button" className={btnSecondary} disabled={code.trim() === ""} onClick={() => copy(code, "Mermaid code")}>Copy code</button>
          </div>
        </div>

        <div aria-live="polite" className="mt-3 min-h-6 text-sm text-slate-ink">
          {status === "empty" && "Type Mermaid code, insert a template or try the example. The diagram appears here."}
          {status === "loading" && (slow ? "Still rendering… large diagrams take a few seconds." : "Rendering…")}
          {status === "done" && kind && `${TEMPLATES[kind].label} rendered. Export it as PNG, SVG or PDF.`}
          {status === "stale" && (
            <span className="flex flex-wrap items-center gap-3">
              Large diagram ({code.length.toLocaleString("en-US")} characters): the preview updates when you click Render.
              <button type="button" className={btnPrimary} onClick={() => setRenderRequest((n) => n + 1)}>Render</button>
            </span>
          )}
          {notice && <span className="block text-navy">{notice}</span>}
        </div>
        {status === "loading" && slow && (
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Rendering diagram">
              <div className="h-full w-1/3 bg-primary motion-safe:animate-pulse" />
            </div>
            <button type="button" className={btnSecondary} onClick={cancel}>Cancel</button>
          </div>
        )}
        {status === "error" && error && (
          <div role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p>{error.message}</p>
            {error.source && <pre className="mt-2 overflow-x-auto rounded-lg bg-white/70 p-2 font-mono text-xs">{error.source}</pre>}
            {svg && <p className="mt-2 text-xs">The last working version is still shown below.</p>}
          </div>
        )}

        <div
          className={`relative mt-4 min-h-96 overflow-auto rounded-xl border border-slate-200 p-4 ${theme === "dark" ? "bg-[#1f2430]" : "bg-white"}`}
          role="img"
          aria-label={status === "done" && kind ? `${TEMPLATES[kind].label} preview` : "Diagram preview"}
        >
          <div ref={previewRef} className="flex justify-center [&_svg]:h-auto [&_svg]:max-w-full" />
          {status === "empty" && <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-slate-ink">No diagram yet.</p>}
        </div>
      </section>
    </div>
  );
}

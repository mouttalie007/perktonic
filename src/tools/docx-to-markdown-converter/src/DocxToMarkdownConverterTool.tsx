"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { MAX_FILE_BYTES, type Direction, type DocStats, type ImageMode, type Warning } from "./logic/types";
import type { WorkerRequest, WorkerResponse } from "./worker/convert.worker";
import { SAMPLE_MARKDOWN } from "../fixtures/sampleMarkdown";
import { SAMPLE_RESULT } from "../fixtures/sampleResult";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

type MdDone = Extract<WorkerResponse, { type: "markdown" }>;
type DocxDone = Extract<WorkerResponse, { type: "docx" }>;

const MAX_DISPLAY = 200_000;

/** The example's real conversion result (kept identical by a test), so the converter loads only when needed. */
const PRECOMPUTED: MdDone = { type: "markdown", jobId: -1, name: "checkout-brief", zip: null, ms: -1, bytes: 0, ...SAMPLE_RESULT };


const LEVEL: Record<Warning["level"], { label: string; cls: string }> = {
  lost: { label: "Not converted", cls: "border-red-200 bg-red-50 text-red-900" },
  changed: { label: "Changed", cls: "border-amber-300 bg-amber-50 text-amber-950" },
  info: { label: "Note", cls: "border-slate-200 bg-slate-50 text-slate-800" },
};

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function Warnings({ list, uid }: { list: Warning[]; uid: string }) {
  return (
    <section className={card} aria-labelledby={`${uid}-warn`}>
      <h2 id={`${uid}-warn`} className="text-lg font-semibold">
        What changed in the conversion
      </h2>
      {list.length === 0 ? (
        <p className="mt-2 text-sm text-green-800">Nothing was left out: every part of the document has a Markdown equivalent.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {list.map((w) => (
            <li key={w.feature + w.action} className={`rounded-xl border p-3 text-sm ${LEVEL[w.level].cls}`}>
              <span className="font-semibold">
                {w.feature} ({w.count.toLocaleString("en-US")})
              </span>
              <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold">{LEVEL[w.level].label}</span>
              <p className="mt-1">{w.action}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function statsLine(s: DocStats): string {
  const parts: [number, string][] = [
    [s.headings, "heading"],
    [s.lists, "list"],
    [s.tables, "table"],
    [s.images, "image"],
    [s.links, "link"],
    [s.codeBlocks, "code block"],
    [s.footnotes, "footnote"],
  ];
  return parts
    .filter(([n]) => n > 0)
    .map(([n, w]) => `${n.toLocaleString("en-US")} ${w}${n === 1 ? "" : "s"}`)
    .join(" · ");
}

export default function DocxToMarkdownConverterTool() {
  const uid = useId();
  const [dir, setDir] = useState<Direction>("toMarkdown");
  const [docxFile, setDocxFile] = useState<File | null>(null);
  const [imageMode, setImageMode] = useState<ImageMode>("zip");
  const [mdText, setMdText] = useState(SAMPLE_MARKDOWN);
  const [mdFile, setMdFile] = useState<File | null>(null);
  const [mdResult, setMdResult] = useState<MdDone | null>(PRECOMPUTED);
  // False until the visitor does something that needs the converter, which keeps the first page load small.
  const [active, setActive] = useState(false);
  const pendingDownload = useRef(false);
  const [docxResult, setDocxResult] = useState<DocxDone | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ label: string; fraction: number } | null>(null);
  const [slow, setSlow] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [revive, setRevive] = useState(0);

  const workerRef = useRef<Worker | null>(null);
  const seq = useRef(0);
  const job = useRef(-1);
  const docxInput = useRef<HTMLInputElement | null>(null);
  const mdInput = useRef<HTMLInputElement | null>(null);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const w = new Worker(new URL("./worker/convert.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const m = event.data;
        if (m.jobId !== job.current) return;
        if (m.type === "progress") return setBusy({ label: m.label, fraction: m.fraction });
        setBusy(null);
        setSlow(false);
        if (m.type === "markdown") {
          setMdResult(m);
          setError(null);
          if (pendingDownload.current && m.zip) save(m.zip, `${m.name}-markdown.zip`);
          pendingDownload.current = false;
        } else if (m.type === "docx") {
          setDocxResult(m);
          setError(null);
        } else if (m.type === "error") setError(m.message);
      };
      w.onerror = () => {
        setBusy(null);
        setError("The converter stopped unexpectedly, possibly out of memory. Try a smaller document.");
        workerRef.current = null;
      };
      workerRef.current = w;
    }
    return workerRef.current;
  }, []);
  useEffect(() => () => workerRef.current?.terminate(), []);

  const start = useCallback(
    (
      req:
        | { type: "toMarkdown"; source: { kind: "sample" } | { kind: "file"; file: File }; imageMode: ImageMode }
        | { type: "toDocx"; source: { kind: "text"; text: string } | { kind: "file"; file: File } },
    ) => {
      const jobId = ++seq.current;
      job.current = jobId;
      setBusy({ label: "Starting", fraction: 0 });
      setSlow(false);
      setError(null);
      setNotice(null);
      setTimeout(() => {
        if (job.current === jobId) setSlow(true);
      }, 1000);
      getWorker().postMessage({ ...req, jobId } as WorkerRequest);
    },
    [getWorker],
  );

  // Word → Markdown: the example or the chosen file, again when the image option changes.
  useEffect(() => {
    if (dir !== "toMarkdown" || !active) return;
    const t = setTimeout(() => start({ type: "toMarkdown", source: docxFile ? { kind: "file", file: docxFile } : { kind: "sample" }, imageMode }), 0);
    return () => clearTimeout(t);
  }, [dir, docxFile, imageMode, revive, active, start]);

  // Markdown → Word: shortly after typing stops.
  useEffect(() => {
    if (dir !== "toDocx") return;
    const t = setTimeout(
      () => {
        if (!mdFile && mdText.trim() === "") {
          job.current = ++seq.current;
          setDocxResult(null);
          setBusy(null);
          return;
        }
        start({ type: "toDocx", source: mdFile ? { kind: "file", file: mdFile } : { kind: "text", text: mdText } });
      },
      mdFile ? 0 : 600,
    );
    return () => clearTimeout(t);
  }, [dir, mdText, mdFile, revive, start]);

  const cancel = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    job.current = ++seq.current;
    setBusy(null);
    setSlow(false);
    setError("Cancelled.");
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${what} copied.`);
    } catch {
      setNotice("Your browser blocked clipboard access. Use the download instead.");
    }
  };

  const pick = (f: File | null, kind: "docx" | "md") => {
    if (!f) return;
    if (docxInput.current) docxInput.current.value = "";
    if (mdInput.current) mdInput.current.value = "";
    if (f.size > MAX_FILE_BYTES) return setError(`${f.name} is ${(f.size / 1048576).toFixed(1)} MB. The limit is 50 MB.`);
    setActive(true);
    if (kind === "docx") {
      setMdResult(null);
      setDocxFile(f);
    } else {
      setDocxResult(null);
      setMdFile(f);
      setMdText("");
    }
  };

  const md = mdResult?.markdown ?? "";

  return (
    <div className="space-y-6 text-navy">
      <div className="flex gap-1 border-b border-slate-200" role="tablist" aria-label="Direction">
        {(["toMarkdown", "toDocx"] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            id={`${uid}-tab-${d}`}
            aria-selected={dir === d}
            aria-controls={`${uid}-panel`}
            onClick={() => {
              setDir(d);
              setError(null);
              setNotice(null);
            }}
            className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-semibold ${dir === d ? "border-primary text-primary-dark" : "border-transparent text-slate-600 hover:text-navy"} ${focusRing}`}
          >
            {d === "toMarkdown" ? "Word → Markdown" : "Markdown → Word"}
          </button>
        ))}
      </div>

      <section id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${dir}`} className={card}>
        {dir === "toMarkdown" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Word document</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    setDocxFile(null);
                    setActive(true);
                    setRevive((n) => n + 1);
                  }}
                >
                  Try an example
                </button>
                <button type="button" className={btnPrimary} onClick={() => docxInput.current?.click()}>
                  Open a .docx file
                </button>
              </div>
            </div>
            <input
              ref={docxInput}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => pick(e.target.files?.[0] ?? null, "docx")}
            />
            <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {docxFile ? (
                <>
                  File: <span className="font-semibold text-navy">{docxFile.name}</span> ({(docxFile.size / 1048576).toFixed(2)} MB), read in your browser, not uploaded.
                </>
              ) : (
                <>
                  Example: <span className="font-semibold text-navy">checkout-brief.docx</span>, a one-page brief with headings, lists, a table, an image, footnotes, a comment, a tracked change, an
                  equation and a text box.
                </>
              )}
            </p>
            <fieldset className="mt-4">
              <legend className="text-sm font-medium">Images</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["zip", "Extract into a ZIP", "document.md plus an images/ folder"],
                    ["inline", "Keep inside the Markdown", "as data: URIs; one file, but large"],
                  ] as const
                ).map(([v, label, hint]) => (
                  <label key={v} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${imageMode === v ? "border-primary bg-primary-soft" : "border-slate-200"}`}>
                    <input
                      type="radio"
                      name={`${uid}-img`}
                      className={`mt-0.5 accent-primary ${focusRing}`}
                      checked={imageMode === v}
                      onChange={() => {
                        setActive(true);
                        setImageMode(v);
                      }}
                    />
                    <span>
                      <span className="font-semibold">{label}</span>
                      <span className="block text-xs text-slate-600">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="mt-3 text-xs text-slate-600">
              .docx files up to 50 MB. Old .doc files and PDFs are not supported. The conversion runs in a background thread of your browser; nothing is uploaded.
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Markdown</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    setMdFile(null);
                    setMdText(SAMPLE_MARKDOWN);
                  }}
                >
                  Try an example
                </button>
                <button type="button" className={btnSecondary} onClick={() => mdInput.current?.click()}>
                  Open a .md file
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={!mdFile && mdText === ""}
                  onClick={() => {
                    setMdFile(null);
                    setMdText("");
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
            <input
              ref={mdInput}
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => pick(e.target.files?.[0] ?? null, "md")}
            />
            {mdFile ? (
              <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                File: <span className="font-semibold text-navy">{mdFile.name}</span> ({(mdFile.size / 1048576).toFixed(2)} MB), read in your browser, not uploaded.
              </p>
            ) : (
              <>
                <label htmlFor={`${uid}-md`} className="mt-3 block text-sm text-slate-600">
                  Paste Markdown (GitHub-flavoured: tables, task lists, footnotes)
                </label>
                <textarea id={`${uid}-md`} className={`${inputCls} mt-1 h-56 resize-y font-mono text-xs`} value={mdText} onChange={(e) => setMdText(e.target.value)} spellCheck={false} />
              </>
            )}
            <p className="mt-3 text-xs text-slate-600">
              Paste up to 5 MB or open a file up to 50 MB. Images are embedded only when they are inside the Markdown as data: URIs; nothing is downloaded from other sites.
            </p>
          </>
        )}
      </section>

      <div aria-live="polite" className="min-h-6 text-sm text-slate-700">
        {busy && (
          <div className="flex flex-wrap items-center gap-3">
            <span>{busy.label}…</span>
            <div
              className="h-2 w-40 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-label={busy.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(busy.fraction * 100)}
            >
              <div className="h-full bg-primary" style={{ width: `${Math.max(4, Math.round(busy.fraction * 100))}%` }} />
            </div>
            {slow && (
              <button type="button" className={btnSecondary} onClick={cancel}>
                Cancel
              </button>
            )}
          </div>
        )}
        {!busy && notice}
        {!busy && dir === "toDocx" && !docxResult && !error && !notice && "Paste Markdown or open a .md file to build a Word document."}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {dir === "toMarkdown" && mdResult && !error && (
        <>
          <Warnings list={mdResult.warnings} uid={uid} />
          <section className={card} aria-labelledby={`${uid}-out`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id={`${uid}-out`} className="text-lg font-semibold">
                {mdResult.name}.md{" "}
                <span className="text-sm font-normal text-slate-600">
                  · {statsLine(mdResult.stats)}
                  {mdResult.ms >= 0 && ` · ${mdResult.ms.toLocaleString("en-US")} ms`}
                </span>
              </h2>
              <div className="flex flex-wrap gap-2">
                {mdResult.zip || (mdResult.ms === -1 && imageMode === "zip") ? (
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={!!busy}
                    onClick={() => {
                      if (mdResult.zip) return save(mdResult.zip, `${mdResult.name}-markdown.zip`);
                      // The opening example has no ZIP yet: build it, then download.
                      pendingDownload.current = true;
                      setActive(true);
                    }}
                  >
                    Download ZIP ({mdResult.imageCount} image{mdResult.imageCount === 1 ? "" : "s"})
                  </button>
                ) : (
                  <button type="button" className={btnPrimary} onClick={() => save(new Blob([md], { type: "text/markdown;charset=utf-8" }), `${mdResult.name}.md`)}>
                    Download .md
                  </button>
                )}
                <button type="button" className={btnSecondary} disabled={md.length > 5 * 1048576} onClick={() => copy(md, "Markdown")}>
                  Copy Markdown
                </button>
              </div>
            </div>
            <label htmlFor={`${uid}-res`} className="sr-only">
              Markdown result
            </label>
            <textarea
              id={`${uid}-res`}
              readOnly
              className={`${inputCls} mt-3 h-96 resize-y bg-slate-50 font-mono text-xs`}
              value={md.length > MAX_DISPLAY ? md.slice(0, MAX_DISPLAY) : md}
              spellCheck={false}
            />
            {md.length > MAX_DISPLAY && <p className="mt-1 text-xs text-slate-600">Showing the first 200,000 characters; the download has everything.</p>}
          </section>
        </>
      )}

      {dir === "toDocx" && docxResult && !error && (
        <>
          <section className={card} aria-labelledby={`${uid}-dout`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id={`${uid}-dout`} className="text-lg font-semibold">
                {docxResult.name}.docx{" "}
                <span className="text-sm font-normal text-slate-600">
                  · {statsLine(docxResult.stats)} · {(docxResult.docx.size / 1024).toFixed(1)} KB · {docxResult.ms.toLocaleString("en-US")} ms
                </span>
              </h2>
              <button type="button" className={btnPrimary} onClick={() => save(docxResult.docx, `${docxResult.name}.docx`)}>
                Download .docx
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-700">
              Headings use Word&apos;s Heading 1–6 styles, so the navigation pane and a table of contents work. Code blocks use a “Source Code” style in Courier New.
            </p>
          </section>
          <Warnings list={docxResult.warnings} uid={`${uid}-d`} />
          <section className={card} aria-labelledby={`${uid}-back`}>
            <h2 id={`${uid}-back`} className="text-lg font-semibold">
              Check: the Word file read back as Markdown
            </h2>
            <p className="mt-1 text-xs text-slate-600">The new .docx was converted back to show what Word will contain.</p>
            <label htmlFor={`${uid}-rb`} className="sr-only">
              Word file read back as Markdown
            </label>
            <textarea id={`${uid}-rb`} readOnly className={`${inputCls} mt-3 h-72 resize-y bg-slate-50 font-mono text-xs`} value={docxResult.readBack.slice(0, MAX_DISPLAY)} spellCheck={false} />
          </section>
        </>
      )}
    </div>
  );
}

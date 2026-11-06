"use client";

import { useEffect, useId, useRef, useState } from "react";
import { samplePage } from "../fixtures/sampleResult";
import { MAX_BYTES, MAX_PDF_PAGES, MAX_WIDTH, PDF_SCALE } from "./limits";
import { checkFile } from "./logic/file";
import { addColumn, addRow, mergeColumns, mergeRows, removeColumn, removeRow, setText, splitColumn, splitRow } from "./logic/grid";
import type { PageResult } from "./logic/page";
import type { PrepareOptions } from "./logic/preprocess";
import { LOW_CONFIDENCE, reconstruct, type Grid } from "./logic/table";
import { LANGUAGES, loadRecogniser, OcrUnavailableError, type LangId } from "./ocr/engine";
import type { ImageLike, Recognise } from "./ocr/types";
import type { PrepareRequest, PrepareResult } from "./worker/prepare.worker";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const btnSmall = `inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-navy hover:bg-slate-50 disabled:opacity-40 ${focusRing}`;
const label = "block text-sm font-medium text-slate-700";

type Progress = { page: number; pages: number; stage: string; fraction: number };

function save(data: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toCanvasData(source: CanvasImageSource, w: number, h: number): ImageData {
  const scale = Math.min(1, MAX_WIDTH / w);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function dataUrl(img: ImageLike): string {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return canvas.toDataURL("image/jpeg", 0.85);
}

async function pdfPages(file: File, onPage: (n: number, total: number) => void): Promise<ImageData[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerPort ??= new Worker(new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url), { type: "module" });
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), verbosity: 0 }).promise;
  if (doc.numPages > MAX_PDF_PAGES) throw new Error(`This PDF has ${doc.numPages} pages. The limit is ${MAX_PDF_PAGES} pages: split it first.`);
  const out: ImageData[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    onPage(n, doc.numPages);
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: PDF_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    await page.render({ canvas, viewport: vp }).promise;
    out.push(toCanvasData(canvas, canvas.width, canvas.height));
  }
  return out;
}

/** Cell width from its longest line (classes, not inline styles, for the site's content-security policy). */
function widthClass(text: string, span: number): string {
  if (span > 1) return "min-w-24";
  const n = Math.max(0, ...text.split("\n").map((l) => l.length));
  return n > 24 ? "min-w-64" : n > 14 ? "min-w-48" : n > 8 ? "min-w-32" : "min-w-24";
}

function ImagePanel({ page, selected }: { page: PageResult; selected: { r: number; c: number } | null }) {
  const box = selected ? page.grid.rows[selected.r]?.[selected.c]?.box : null;
  const low = page.words.filter((w) => w.confidence < LOW_CONFIDENCE).length;
  return (
    <figure>
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        {/* eslint-disable-next-line @next/next/no-img-element -- a data URL made in the browser */}
        <img src={page.imageUrl} alt={`Page ${page.page} as read by the tool`} className="block h-auto w-full" />
        <svg viewBox={`0 0 ${page.width} ${page.height}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          {page.words.map((w, i) => (
            <rect key={i} x={w.bbox.x0 - 2} y={w.bbox.y0 - 2} width={w.bbox.x1 - w.bbox.x0 + 4} height={w.bbox.y1 - w.bbox.y0 + 4} fill={w.confidence < LOW_CONFIDENCE ? "rgba(245,158,11,0.18)" : "none"} stroke={w.confidence < LOW_CONFIDENCE ? "#d97706" : "rgba(11,92,255,0.45)"} strokeWidth={w.confidence < LOW_CONFIDENCE ? 3 : 1.5} />
          ))}
          {box && <rect x={box.x0 - 6} y={box.y0 - 6} width={box.x1 - box.x0 + 12} height={box.y1 - box.y0 + 12} fill="rgba(11,92,255,0.12)" stroke="#0b5cff" strokeWidth={4} />}
        </svg>
      </div>
      <figcaption className="mt-1 text-xs text-slate-600">
        {page.words.length} words recognised{low ? `; ${low} with low confidence (amber)` : ""}.{page.skew ? ` Straightened by ${page.skew}°.` : ""}
      </figcaption>
    </figure>
  );
}

export default function ConvertScannedTableToSpreadsheetTool({ recognise }: { recognise?: Recognise }) {
  const uid = useId();
  const [pages, setPages] = useState<PageResult[]>([samplePage]);
  const [current, setCurrent] = useState(0);
  const [isSample, setIsSample] = useState(true);
  const [fileName, setFileName] = useState("sample-stock-count.jpg");
  const [lang, setLang] = useState<LangId>("eng");
  const [rtl, setRtl] = useState(false);
  const [opts, setOpts] = useState<PrepareOptions>({ contrast: true, deskew: true, threshold: false });
  const [header, setHeader] = useState(true);
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const cancelled = useRef(false);
  const worker = useRef<Worker | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => () => worker.current?.terminate(), []);

  const page = pages[current];
  const grid = page?.grid;
  const setGrid = (g: Grid) => setPages((ps) => ps.map((p, i) => (i === current ? { ...p, grid: g } : p)));

  const prepareImage = (img: ImageData): Promise<PrepareResult> =>
    new Promise((resolve, reject) => {
      worker.current ??= new Worker(new URL("./worker/prepare.worker.ts", import.meta.url), { type: "module" });
      const w = worker.current;
      w.onmessage = (e: MessageEvent<PrepareResult>) => resolve(e.data);
      w.onerror = () => reject(new Error("The image could not be prepared."));
      const req: PrepareRequest = { width: img.width, height: img.height, buffer: img.data.buffer.slice(0) as ArrayBuffer, options: opts };
      w.postMessage(req, [req.buffer]);
    });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFailure(null);
    setNotice(null);
    const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    const check = checkFile(file.size, head);
    if (!check.ok) return setFailure(check.error);
    cancelled.current = false;
    setProgress({ page: 1, pages: 1, stage: "Opening the file", fraction: 0 });
    try {
      let images: ImageData[];
      if (check.kind === "pdf") images = await pdfPages(file, (n, total) => setProgress({ page: n, pages: total, stage: "Rendering the PDF page", fraction: 0 }));
      else {
        const bitmap = await createImageBitmap(file);
        images = [toCanvasData(bitmap, bitmap.width, bitmap.height)];
        bitmap.close();
      }
      const ocr = recognise ?? (await loadRecogniser());
      const results: PageResult[] = [];
      for (const [i, img] of images.entries()) {
        if (cancelled.current) return;
        setProgress({ page: i + 1, pages: images.length, stage: "Cleaning the image", fraction: 0 });
        const prep = await prepareImage(img);
        if (cancelled.current) return;
        const ready = { width: prep.width, height: prep.height, data: new Uint8ClampedArray(prep.buffer) };
        setProgress({ page: i + 1, pages: images.length, stage: "Reading the text", fraction: 0 });
        const words = await ocr(ready, lang, (f) => setProgress({ page: i + 1, pages: images.length, stage: "Reading the text", fraction: f }));
        if (cancelled.current) return;
        results.push({ page: i + 1, imageUrl: dataUrl(ready), width: prep.width, height: prep.height, skew: prep.skew, words, grid: reconstruct(words, { rtl, rules: prep.rules }) });
      }
      if (!results.some((r) => r.words.length)) {
        setFailure("No text was recognised. Check the language, try Black and white for photos with shadows, or take a sharper photo.");
        return;
      }
      setPages(results);
      setCurrent(0);
      setSelected(null);
      setIsSample(false);
      setFileName(file.name);
      setTimeout(() => heading.current?.focus(), 0);
    } catch (e) {
      if (cancelled.current) return;
      setFailure(e instanceof OcrUnavailableError ? e.message : e instanceof Error && /pages/.test(e.message) ? e.message : "This file could not be read. Try another image or a sharper photo.");
    } finally {
      if (!cancelled.current) setProgress(null);
    }
  };

  const cancel = () => {
    cancelled.current = true;
    worker.current?.terminate();
    worker.current = null;
    setProgress(null);
    setNotice("Cancelled. The previous result is still shown.");
  };

  const exportAs = async (kind: "xlsx" | "csv") => {
    const { gridCsv, gridXlsx } = await import("./logic/export");
    const all = pages.map((p) => ({ grid: p.grid, page: p.page }));
    const base = fileName.replace(/\.[^.]+$/, "") || "table";
    if (kind === "xlsx") save(gridXlsx(all, header), `${base}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    else save(gridCsv(all), `${base}.csv`, "text/csv;charset=utf-8");
    setNotice(`Downloaded ${base}.${kind}.`);
  };

  const copy = async () => {
    if (!grid) return;
    const { gridTsv } = await import("./logic/export");
    try {
      await navigator.clipboard.writeText(gridTsv(grid));
      setNotice("Table copied. Paste it into a spreadsheet.");
    } catch {
      setNotice("Your browser blocked clipboard access. Use the downloads instead.");
    }
  };

  const busy = progress !== null;
  const sel = selected;
  const act = (fn: (g: Grid) => Grid) => grid && setGrid(fn(grid));
  const cols = grid ? Math.max(0, ...grid.rows.map((r) => r.length)) : 0;

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <h2 id={`${uid}-in`} className="text-lg font-semibold">
          Image or scanned PDF
        </h2>
        <div className="mt-3 space-y-4">
          <div>
            <label htmlFor={`${uid}-f`} className={label}>
              Photo or scan of a table <span className="font-normal text-slate-600">(JPG, PNG, WebP up to {MAX_BYTES / 1024 / 1024} MB, or a scanned PDF up to {MAX_PDF_PAGES} pages)</span>
            </label>
            <input id={`${uid}-f`} type="file" accept="image/jpeg,image/png,image/webp,.pdf,application/pdf" capture="environment" className={`mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold ${focusRing}`} onChange={(e) => void onFile(e.target.files?.[0])} disabled={busy} />
            <p className="mt-1 text-xs text-slate-600">The image is read in your browser and never uploaded. The first time you use a language, its OCR data is downloaded from this site.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-l`} className={label}>
                Language of the table
              </label>
              <select
                id={`${uid}-l`}
                className={`${inputCls} mt-1`}
                value={lang}
                onChange={(e) => {
                  const l = e.target.value as LangId;
                  setLang(l);
                  setRtl(l === "ara");
                }}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="text-sm">
              <legend className={label}>Options</legend>
              <div className="mt-1 grid gap-1">
                <label className="flex items-center gap-2">
                  <input type="checkbox" role="switch" aria-checked={rtl} className={`h-4 w-4 accent-primary ${focusRing}`} checked={rtl} onChange={(e) => setRtl(e.target.checked)} />
                  Right-to-left table (columns start on the right)
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={opts.deskew} onChange={(e) => setOpts({ ...opts, deskew: e.target.checked })} />
                  Straighten a tilted photo
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={opts.contrast} onChange={(e) => setOpts({ ...opts, contrast: e.target.checked })} />
                  Boost contrast
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={opts.threshold} onChange={(e) => setOpts({ ...opts, threshold: e.target.checked })} />
                  Black and white (helps with shadows)
                </label>
              </div>
            </fieldset>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {busy ? (
              <button type="button" className={btnSecondary} onClick={cancel}>
                Cancel
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    setPages([samplePage]);
                    setCurrent(0);
                    setIsSample(true);
                    setFileName("sample-stock-count.jpg");
                    setSelected(null);
                    setFailure(null);
                    setNotice(null);
                  }}
                >
                  Try an example
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    setPages([]);
                    setIsSample(false);
                    setSelected(null);
                    setFailure(null);
                    setNotice(null);
                  }}
                >
                  Clear
                </button>
              </>
            )}
          </div>
          {busy && progress && (
            <div aria-live="polite">
              <p className="text-sm text-slate-700">
                Page {progress.page} of {progress.pages}: {progress.stage}…
              </p>
              <progress className="mt-1 h-2 w-full accent-primary" max={1} value={(progress.page - 1 + progress.fraction) / progress.pages} />
            </div>
          )}
        </div>
      </section>

      {failure && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {failure}
        </div>
      )}

      <section className={`${card} min-h-64`} aria-labelledby={`${uid}-out`} aria-busy={busy}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={`${uid}-out`} ref={heading} tabIndex={-1} className="text-lg font-semibold focus:outline-none">
            Original and recognised table
          </h2>
          {isSample && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Example result (no OCR was run)</span>}
        </div>
        <p className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">OCR can misread digits (0 and O, 1 and l, 5 and S). Cells in amber have low confidence: check them against the image before you export.</p>
        <div aria-live="polite" className="mt-2 text-sm text-slate-700">
          {notice && <p>{notice}</p>}
        </div>
        {!page ? (
          <p className="mt-4 text-sm text-slate-700">No image yet. Choose a photo or scan of a table above, or press Try an example.</p>
        ) : (
          <>
            {pages.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Pages">
                {pages.map((p, i) => (
                  <button key={p.page} type="button" role="tab" aria-selected={i === current} className={`${btnSmall} ${i === current ? "border-primary bg-primary-soft" : ""}`} onClick={() => (setCurrent(i), setSelected(null))}>
                    Page {p.page}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 grid gap-6 lg:grid-cols-[2fr_3fr]">
              <ImagePanel page={page} selected={sel} />
              <div className="min-w-0">
                <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Edit the table">
                  <button type="button" className={btnSmall} disabled={!sel} onClick={() => sel && act((g) => addRow(g, sel.r))}>
                    + Row below
                  </button>
                  <button type="button" className={btnSmall} disabled={!sel} onClick={() => sel && (act((g) => removeRow(g, sel.r)), setSelected(null))}>
                    − Row
                  </button>
                  <button type="button" className={btnSmall} disabled={!sel} onClick={() => sel && act((g) => mergeRows(g, sel.r))}>
                    Merge with next row
                  </button>
                  <button type="button" className={btnSmall} disabled={!sel} onClick={() => sel && act((g) => splitRow(g, sel.r))}>
                    Split row
                  </button>
                  <button type="button" className={btnSmall} disabled={!sel} onClick={() => sel && act((g) => addColumn(g, sel.c))}>
                    + Column after
                  </button>
                  <button type="button" className={btnSmall} disabled={!sel} onClick={() => sel && (act((g) => removeColumn(g, sel.c)), setSelected(null))}>
                    − Column
                  </button>
                  <button type="button" className={btnSmall} disabled={!sel} onClick={() => sel && act((g) => mergeColumns(g, sel.c))}>
                    Merge with next column
                  </button>
                  <button type="button" className={btnSmall} disabled={!sel} onClick={() => sel && act((g) => splitColumn(g, sel.c))}>
                    Split column
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-600">{sel ? `Selected: row ${sel.r + 1}, column ${sel.c + 1}. Its region is outlined on the image.` : "Click a cell to see where it is on the image and to edit rows and columns."}</p>
                <div className="mt-2 max-h-[32rem] overflow-auto rounded-xl border border-slate-200" tabIndex={0} role="region" aria-label="Recognised table">
                  <table dir={grid.rtl ? "rtl" : "ltr"} className="min-w-full border-collapse text-sm">
                    <tbody>
                      {grid.rows.map((row, r) => (
                        <tr key={r}>
                          {row.map((cell, c) =>
                            cell.span === 0 ? null : (
                              <td key={c} colSpan={cell.span > 1 ? cell.span : undefined} className="border border-slate-200 p-0 align-top">
                                <textarea
                                  dir="auto"
                                  rows={Math.max(1, cell.text.split("\n").length)}
                                  aria-label={`Row ${r + 1}, column ${c + 1}${cell.confidence !== null && cell.confidence < LOW_CONFIDENCE ? " (low confidence)" : ""}`}
                                  className={`block w-full ${widthClass(cell.text, cell.span)} resize-none px-2 py-1 text-sm ${focusRing} ${cell.confidence !== null && cell.confidence < LOW_CONFIDENCE ? "bg-amber-100 ring-1 ring-inset ring-amber-500" : r === 0 && header ? "bg-slate-50 font-semibold" : "bg-white"} ${sel?.r === r && sel?.c === c ? "outline outline-2 outline-primary" : ""}`}
                                  value={cell.text}
                                  onFocus={() => setSelected({ r, c })}
                                  onChange={(e) => setGrid(setText(grid, r, c, e.target.value))}
                                />
                              </td>
                            ),
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {grid.rows.length} rows × {cols} columns. Edited cells are no longer flagged.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <label className="mr-2 flex items-center gap-2 text-sm">
                    <input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={header} onChange={(e) => setHeader(e.target.checked)} />
                    First row is a header
                  </label>
                  <button type="button" className={btnPrimary} onClick={() => void exportAs("xlsx")}>
                    Download .xlsx
                  </button>
                  <button type="button" className={btnSecondary} onClick={() => void exportAs("csv")}>
                    Download .csv
                  </button>
                  <button type="button" className={btnSecondary} onClick={() => void copy()}>
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

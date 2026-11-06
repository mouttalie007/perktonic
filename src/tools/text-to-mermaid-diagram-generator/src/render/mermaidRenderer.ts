import { findUnsafeSvg, pngSize, standaloneSvg, svgSize } from "../logic/svg";
import type { Theme } from "../logic/diagram";

type MermaidApi = typeof import("mermaid").default;
type Purify = typeof import("dompurify").default;

let engine: Promise<{ mermaid: MermaidApi; purify: Purify }> | null = null;

/** Loads Mermaid and DOMPurify on first use; they are far too big for the initial bundle. */
export function loadEngine() {
  if (!engine) {
    engine = Promise.all([import("mermaid"), import("dompurify")]).then(([m, p]) => ({ mermaid: m.default, purify: p.default }));
    engine.catch(() => {
      engine = null;
    });
  }
  return engine;
}

export const BACKGROUNDS: Record<Theme, string> = { light: "#ffffff", dark: "#1f2430" };

// Mermaid keeps global state, so renders must not overlap.
let queue: Promise<unknown> = Promise.resolve();
let counter = 0;

export class RenderError extends Error {
  constructor(public readonly cause: unknown) {
    super("render failed");
  }
}

export function renderDiagram(code: string, theme: Theme): Promise<string> {
  const job = queue.then(async () => {
    const { mermaid, purify } = await loadEngine();
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      // Keys a %%{init}%% directive in the user's code is not allowed to change.
      secure: ["secure", "securityLevel", "startOnLoad", "maxTextSize", "htmlLabels", "suppressErrorRendering"],
      theme: theme === "dark" ? "dark" : "default",
      // SVG text instead of HTML labels: no foreignObject, so the PNG export canvas is never tainted.
      htmlLabels: false,
      flowchart: { htmlLabels: false },
      fontFamily: "Arial, Helvetica, sans-serif",
      maxTextSize: 25_000,
      suppressErrorRendering: true,
    });
    try {
      await mermaid.parse(code);
    } catch (err) {
      throw new RenderError(err);
    }
    let svg: string;
    try {
      svg = (await mermaid.render(`mmd-${++counter}`, code)).svg;
    } catch (err) {
      throw new RenderError(err);
    }
    const clean = purify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, ADD_TAGS: ["style"] });
    if (findUnsafeSvg(clean).length > 0) throw new RenderError(new Error("The diagram contained content that is not allowed, so it was not shown."));
    return clean;
  });
  queue = job.catch(() => undefined);
  return job;
}

/** Puts sanitised SVG into the page as DOM nodes (never via innerHTML of user text). */
export function mountSvg(container: HTMLElement, svg: string) {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.documentElement;
  if (root.nodeName !== "svg") throw new RenderError(new Error("Mermaid returned something that is not an SVG."));
  container.replaceChildren(document.importNode(root, true));
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSvg(svg: string, theme: Theme, name: string) {
  download(new Blob([standaloneSvg(svg, BACKGROUNDS[theme])], { type: "image/svg+xml" }), name);
}

export async function downloadPng(svg: string, theme: Theme, name: string): Promise<void> {
  const size = svgSize(svg);
  if (!size) throw new Error("Could not read the diagram size.");
  const target = pngSize(size, 2);
  const url = URL.createObjectURL(new Blob([standaloneSvg(svg, BACKGROUNDS[theme])], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("The browser could not draw the SVG."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot create a canvas.");
    ctx.fillStyle = BACKGROUNDS[theme];
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.drawImage(img, 0, 0, target.width, target.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("The browser could not create the PNG.");
    download(blob, name);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Opens the print dialog for just the diagram; "Save as PDF" there produces a vector PDF. */
export function printPdf(svg: string, theme: Theme, title: string) {
  const size = svgSize(svg) ?? { width: 800, height: 600 };
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    throw new Error("This browser blocked the print window.");
  }
  doc.open();
  doc.close();
  doc.title = title;
  const style = doc.createElement("style");
  const landscape = size.width > size.height;
  style.textContent = `@page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 12mm; } html, body { margin: 0; background: ${BACKGROUNDS[theme]}; -webkit-print-color-adjust: exact; print-color-adjust: exact; } svg { width: 100%; height: auto; max-height: 100vh; }`;
  doc.head.appendChild(style);
  const node = new DOMParser().parseFromString(standaloneSvg(svg, BACKGROUNDS[theme]), "image/svg+xml").documentElement;
  node.removeAttribute("height");
  doc.body.appendChild(doc.importNode(node, true));
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => iframe.remove(), 60_000);
  }, 50);
}

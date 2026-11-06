import { createDocument } from "@mixmark-io/domino";
import { strToU8, unzipSync, zipSync } from "fflate";
import mammoth from "mammoth";
import { scanDocx, warningsFor, type DocxParts } from "./features";
import { htmlStats, htmlToMarkdown, STYLE_MAP, type DomDocument } from "./toMarkdown";
import type { DocStats, ImageMode, Warning } from "./types";

export class ConvertError extends Error {}

/** Checks the first bytes: a .docx is a ZIP; old .doc files and PDFs are refused with a clear message. */
export function checkDocxHead(head: Uint8Array): void {
  const starts = (sig: number[]) => sig.every((b, i) => head[i] === b);
  if (starts([0xd0, 0xcf, 0x11, 0xe0])) throw new ConvertError("This is an old Word .doc file (Word 97–2003). Open it in Word or LibreOffice and save it as .docx, then try again.");
  if (starts([0x25, 0x50, 0x44, 0x46])) throw new ConvertError("This is a PDF, not a Word document. PDFs cannot be converted here.");
  if (starts([0x7b, 0x5c, 0x72, 0x74, 0x66])) throw new ConvertError("This is an RTF file. Save it as .docx in Word or LibreOffice first.");
  if (!starts([0x50, 0x4b, 0x03, 0x04])) throw new ConvertError("This is not a .docx file. Choose a Word document saved as .docx.");
}

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/bmp": "bmp", "image/svg+xml": "svg", "image/webp": "webp", "image/tiff": "tif", "image/x-emf": "emf", "image/x-wmf": "wmf" };

export interface FromDocxResult {
  markdown: string;
  warnings: Warning[];
  stats: DocStats;
  /** The ZIP (document.md + images/) when images are extracted. */
  zip: Uint8Array | null;
  imageCount: number;
}

export async function docxToMarkdown(bytes: Uint8Array, imageMode: ImageMode, onStep: (label: string, fraction: number) => void = () => {}): Promise<FromDocxResult> {
  checkDocxHead(bytes);
  onStep("Reading the document", 0.1);
  let parts: DocxParts;
  try {
    const files = unzipSync(bytes, { filter: (f) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(f.name) });
    const dec = new TextDecoder();
    parts = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, dec.decode(v)]));
  } catch {
    throw new ConvertError("This .docx file is damaged: it could not be unzipped.");
  }
  if (!parts["word/document.xml"]) throw new ConvertError("This ZIP file is not a Word document (it has no word/document.xml). Excel and PowerPoint files are not supported.");
  const counts = scanDocx(parts);

  onStep("Converting with mammoth", 0.3);
  const images: { name: string; data: Uint8Array }[] = [];
  const result = await mammoth.convertToHtml(
    // The browser build of mammoth reads `arrayBuffer`, the Node build (used by the tests) reads `buffer`.
    { arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, buffer: bytes } as { arrayBuffer: ArrayBuffer },
    {
      styleMap: STYLE_MAP,
      convertImage: mammoth.images.imgElement(async (image) => {
        const type = image.contentType;
        if (imageMode === "inline") return { src: `data:${type};base64,${await image.read("base64")}` };
        const buf = await image.read();
        const name = `images/image${images.length + 1}.${EXT[type] ?? "bin"}`;
        images.push({ name, data: new Uint8Array(buf as unknown as ArrayBuffer) });
        return { src: name };
      }),
    },
  );

  onStep("Writing Markdown", 0.7);
  const doc = createDocument(`<!doctype html><html><body>${result.value}</body></html>`) as unknown as DomDocument;
  const stats = htmlStats(doc);
  const { markdown, headerlessTables } = htmlToMarkdown(doc);

  const warnings = warningsFor(counts);
  if (headerlessTables) warnings.push({ feature: "Tables without a header row", count: headerlessTables, level: "changed", action: "Markdown tables need a header, so the first row was used as the header." });
  const unsupportedImages = images.filter((i) => /\.(emf|wmf|tif|bin)$/.test(i.name)).length;
  if (unsupportedImages) warnings.push({ feature: "Images in formats browsers cannot show", count: unsupportedImages, level: "info", action: "Kept as they are (EMF, WMF or TIFF); most Markdown viewers will not display them." });
  // Mammoth's own messages, grouped so 200 identical warnings read as one line.
  const grouped = new Map<string, number>();
  for (const m of result.messages) {
    const text = m.message.replace(/^An unrecognised element was ignored: \{[^}]*\}oMath(Para)?$/, "") || null;
    if (text === null) continue;
    const key = text.replace(/Unrecognised (paragraph|run) style: '([^']*)'.*/, "Unknown $1 style “$2”, converted as normal text");
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }
  for (const [message, n] of grouped) warnings.push({ feature: "Converter note", count: n, level: "info", action: message });

  let zip: Uint8Array | null = null;
  if (imageMode === "zip") {
    onStep("Packing the ZIP", 0.9);
    const entries: Record<string, Uint8Array> = { "document.md": strToU8(markdown) };
    for (const img of images) entries[img.name] = img.data;
    // Images are already compressed, so store them; only the Markdown is deflated.
    zip = zipSync(Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, [v, { level: k.endsWith(".md") ? 6 : 0 }]])));
  }
  return { markdown, warnings, stats, zip, imageCount: imageMode === "zip" ? images.length : stats.images };
}

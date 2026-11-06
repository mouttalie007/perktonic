// Turning what the browser read (a PDF text layer or OCR words) into plain text lines.
import type { OcrWord } from "../ocr/types";

interface Item {
  str: string;
  transform: number[];
  width: number;
}

/** pdf.js text items → lines (top to bottom, left to right), with wide gaps kept as spaces. */
export function linesFromPdfItems(items: unknown[]): string {
  const its = (items as Item[]).filter((i) => typeof i.str === "string" && i.str.trim() && Array.isArray(i.transform));
  const rows: { y: number; parts: Item[] }[] = [];
  for (const it of [...its].sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4])) {
    const size = Math.hypot(it.transform[2], it.transform[3]) || 10;
    const row = rows.find((r) => Math.abs(r.y - it.transform[5]) <= size * 0.4);
    if (row) row.parts.push(it);
    else rows.push({ y: it.transform[5], parts: [it] });
  }
  return rows
    .map((r) =>
      r.parts
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map((p, i, arr) => {
          if (i === 0) return p.str;
          const prev = arr[i - 1];
          const gap = p.transform[4] - (prev.transform[4] + prev.width);
          const size = Math.hypot(p.transform[2], p.transform[3]) || 10;
          return (gap > size * 1.5 ? "    " : gap > size * 0.15 ? " " : "") + p.str;
        })
        .join("")
        .replace(/[ \t]+$/g, ""),
    )
    .join("\n");
}

/** OCR words → lines by vertical centre (reading order: right to left for Arabic lines). */
export function textFromWords(words: OcrWord[]): string {
  const cy = (w: OcrWord) => (w.bbox.y0 + w.bbox.y1) / 2;
  const hs = words.map((w) => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b);
  const h = hs[Math.floor(hs.length / 2)] || 10;
  const lines: OcrWord[][] = [];
  for (const w of [...words].sort((a, b) => cy(a) - cy(b))) {
    const line = lines.at(-1);
    if (line && Math.abs(cy(line[0]) - cy(w)) <= h * 0.5) line.push(w);
    else lines.push([w]);
  }
  return lines
    .map((l) => {
      const rtl = l.filter((w) => /[֐-ࣿ]/.test(w.text)).length * 2 > l.length;
      const s = l.sort((a, b) => (rtl ? b.bbox.x0 - a.bbox.x0 : a.bbox.x0 - b.bbox.x0));
      return s.map((w, i) => (i && Math.abs((rtl ? s[i - 1].bbox.x0 - w.bbox.x1 : w.bbox.x0 - s[i - 1].bbox.x1)) > h * 1.5 ? "    " : i ? " " : "") + w.text).join("");
    })
    .join("\n");
}

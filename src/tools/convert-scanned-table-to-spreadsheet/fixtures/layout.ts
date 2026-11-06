// Builds OCR word boxes for a table laid out on a page (fixtures for the reconstruction tests).
import type { OcrWord } from "../src/ocr/types";

export interface LayoutOptions {
  /** Left x of each column (or right x when `right` is set for that column). */
  cols: number[];
  right?: boolean[];
  top: number;
  rowH: number;
  charW?: number;
  textH?: number;
  /** Confidence for a given word text (default 92). */
  confidence?: Record<string, number>;
  /** Right-to-left: words of a cell are placed from the right edge. */
  rtl?: boolean;
}

export function layout(rows: (string | null)[][], o: LayoutOptions): OcrWord[] {
  const cw = o.charW ?? 9;
  const th = o.textH ?? 16;
  const out: OcrWord[] = [];
  rows.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (!cell) return;
      const words = cell.split(" ");
      const total = cell.length * cw;
      const y0 = o.top + r * o.rowH + (o.rowH - th) / 2;
      let x = o.right?.[c] || o.rtl ? o.cols[c] - total : o.cols[c];
      const order = o.rtl ? [...words].reverse() : words;
      for (const w of order) {
        out.push({ text: w, confidence: o.confidence?.[w] ?? 92, bbox: { x0: x, y0, x1: x + w.length * cw, y1: y0 + th } });
        x += (w.length + 1) * cw;
      }
    }),
  );
  return out;
}

/** A table spanning header: one phrase centred over two columns. */
export function centred(text: string, xMid: number, y0: number, opts: { rtl?: boolean; cw?: number; th?: number; confidence?: number } = {}): OcrWord[] {
  const { cw = 9, th = 16, confidence = 92 } = opts;
  const words = opts.rtl ? text.split(" ").reverse() : text.split(" ");
  let x = xMid - (text.length * cw) / 2;
  return words.map((w) => {
    const b = { text: w, confidence, bbox: { x0: x, y0, x1: x + w.length * cw, y1: y0 + th } };
    x += (w.length + 1) * cw;
    return b;
  });
}

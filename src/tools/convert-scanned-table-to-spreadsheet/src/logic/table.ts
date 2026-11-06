// Table reconstruction from OCR word boxes: rows by vertical centre, columns by gaps shared by most
// rows (or by ruled lines when the image has them). Every word ends up in a cell: nothing is dropped.
import type { OcrWord } from "../ocr/types";

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Cell {
  text: string;
  /** Lowest OCR confidence of the words in the cell; null for an empty or hand-edited cell. */
  confidence: number | null;
  /** Region of the image the cell's words came from (null when empty or added by hand). */
  box: Box | null;
  /** Number of columns this cell spans (merged cell); covered cells have span 0. */
  span: number;
}

export interface Grid {
  rows: Cell[][];
  rtl: boolean;
}

export const LOW_CONFIDENCE = 70;

const emptyCell = (): Cell => ({ text: "", confidence: null, box: null, span: 1 });
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const union = (ws: OcrWord[]): Box => ({ x0: Math.min(...ws.map((w) => w.bbox.x0)), y0: Math.min(...ws.map((w) => w.bbox.y0)), x1: Math.max(...ws.map((w) => w.bbox.x1)), y1: Math.max(...ws.map((w) => w.bbox.y1)) });

function cellOf(words: OcrWord[], rtl: boolean): Cell {
  if (!words.length) return emptyCell();
  const h = median(words.map((w) => w.bbox.y1 - w.bbox.y0));
  const lines: OcrWord[][] = [];
  for (const w of [...words].sort((a, b) => a.bbox.y0 + a.bbox.y1 - b.bbox.y0 - b.bbox.y1)) {
    const cy = (w.bbox.y0 + w.bbox.y1) / 2;
    const line = lines.at(-1);
    if (line && Math.abs((line[0].bbox.y0 + line[0].bbox.y1) / 2 - cy) <= h * 0.5) line.push(w);
    else lines.push([w]);
  }
  const text = lines.map((l) => l.sort((a, b) => (rtl ? b.bbox.x0 - a.bbox.x0 : a.bbox.x0 - b.bbox.x0)).map((w) => w.text).join(" ")).join("\n");
  return { text, confidence: Math.min(...words.map((w) => w.confidence)), box: union(words), span: 1 };
}

/** Right-to-left when most words with letters are Arabic or Hebrew. */
export function looksRtl(words: OcrWord[]): boolean {
  const rtl = words.filter((w) => /[֐-ࣿ]/.test(w.text)).length;
  const ltr = words.filter((w) => /[A-Za-zÀ-ɏ]/.test(w.text)).length;
  return rtl > ltr;
}

export interface ReconstructOptions {
  rtl: boolean;
  /** Ruled lines found in the image (pixel positions), used as cell borders when present. */
  rules?: { h: number[]; v: number[] };
}

export function reconstruct(input: OcrWord[], o: ReconstructOptions): Grid {
  const words = input.filter((w) => w.text.trim());
  if (!words.length) return { rows: [], rtl: o.rtl };
  const hMed = median(words.map((w) => w.bbox.y1 - w.bbox.y0)) || 10;
  const cy = (w: OcrWord) => (w.bbox.y0 + w.bbox.y1) / 2;

  // Rows: by horizontal rules when there are at least two, else by vertical centre.
  const byCentre = (ws: OcrWord[]) => {
    const out: OcrWord[][] = [];
    for (const w of [...ws].sort((a, b) => cy(a) - cy(b))) {
      const row = out.at(-1);
      if (row && Math.abs(median(row.map(cy)) - cy(w)) <= hMed * 0.55) row.push(w);
      else out.push([w]);
    }
    return out;
  };
  let rowsOfWords: OcrWord[][];
  const hr = (o.rules?.h ?? []).slice().sort((a, b) => a - b);
  // Lines above or below a ruled table (a title, a note) do not fit the grid: each becomes one row with one spanning cell.
  let above: OcrWord[][] = [];
  let below: OcrWord[][] = [];
  if (hr.length >= 2) {
    const bands: OcrWord[][] = Array.from({ length: hr.length - 1 }, () => []);
    for (const w of words) {
      const y = cy(w);
      if (y < hr[0]) continue;
      if (y > hr[hr.length - 1]) continue;
      bands[Math.min(bands.length - 1, hr.filter((h) => h < y).length - 1)].push(w);
    }
    rowsOfWords = bands.filter((b) => b.length);
    above = byCentre(words.filter((w) => cy(w) < hr[0]));
    below = byCentre(words.filter((w) => cy(w) > hr[hr.length - 1]));
  } else rowsOfWords = byCentre(words);

  // Chunks: words of a row that sit close together (one cell candidate).
  const chunksOf = (ws: OcrWord[]) => {
    const sorted = [...ws].sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const out: OcrWord[][] = [];
    for (const w of sorted) {
      const c = out.at(-1);
      if (c && w.bbox.x0 - Math.max(...c.map((x) => x.bbox.x1)) < hMed * 0.9) c.push(w);
      else out.push([w]);
    }
    return out;
  };
  const rowChunks = rowsOfWords.map(chunksOf);

  // Column borders: vertical rules, or gaps that (almost) no chunk covers, shared by most rows.
  let borders: number[];
  const vr = (o.rules?.v ?? []).slice().sort((a, b) => a - b);
  if (vr.length >= 2) borders = vr.slice(1, -1);
  else borders = gapBorders(rowChunks.filter((r) => r.length >= 2).map((r) => r.map(union)), hMed);
  const C = borders.length + 1;
  const colOf = (x: number) => borders.filter((b) => b < x).length;

  const rows: Cell[][] = rowChunks.map((chunks) => {
    const perCol: OcrWord[][] = Array.from({ length: C }, () => []);
    const spans = new Map<number, number>();
    for (const c of chunks) {
      const b = union(c);
      const first = colOf(b.x0 + 1);
      const last = colOf(b.x1 - 1);
      // A chunk that crosses a border on most of its width is a merged cell; otherwise its words are split by column.
      // Word spacing inside one phrase is about a third of the line height; wider gaps separate columns.
      const tight = c.every((w, i) => i === 0 || w.bbox.x0 - c[i - 1].bbox.x1 < hMed * 0.65);
      if (last > first && vr.length < 2 && tight) {
        perCol[first].push(...c);
        spans.set(first, last - first + 1);
      } else for (const w of c) perCol[colOf((w.bbox.x0 + w.bbox.x1) / 2)].push(w);
    }
    const cells = perCol.map((ws) => cellOf(ws, o.rtl));
    for (const [col, span] of spans) {
      cells[col].span = span;
      for (let k = col + 1; k < col + span && k < C; k++) {
        // Words already in a covered cell stay there (nothing is dropped): then the span is cut.
        if (cells[k].text) {
          cells[col].span = k - col;
          break;
        }
        cells[k].span = 0;
      }
    }
    return cells;
  });
  const lone = (ws: OcrWord[]): Cell[] => [{ ...cellOf(ws, o.rtl), span: C }, ...Array.from({ length: C - 1 }, () => ({ ...emptyCell(), span: 0 }))];
  const body = o.rtl ? mirror(rows) : rows;
  return { rows: [...above.map(lone), ...body, ...below.map(lone)], rtl: o.rtl };
}

type Gap = [number, number];

/** Intervals that no box of the given rows covers (at least `min` wide), between the leftmost and rightmost box. */
function freeGaps(rows: Box[][], min: number): Gap[] {
  const spans = rows.flat().sort((a, b) => a.x0 - b.x0);
  const out: Gap[] = [];
  let reach = spans[0]?.x1 ?? 0;
  for (const b of spans.slice(1)) {
    if (b.x0 - reach >= min) out.push([reach, b.x0]);
    reach = Math.max(reach, b.x1);
  }
  return out;
}

/**
 * Column borders from gaps shared by every row with two or more chunks. A merged header (one of the
 * first two rows) may cross a gap that all the other rows share: that gap still separates columns.
 */
function gapBorders(rows: Box[][], hMed: number): number[] {
  if (!rows.length) return [];
  const min = hMed * 0.6;
  const found = freeGaps(rows, min);
  for (let h = 0; h < Math.min(2, rows.length); h++) {
    const others = rows.filter((_, i) => i !== h);
    if (others.length < 2) continue;
    for (const g of freeGaps(others, min)) {
      if (found.some((f) => f[0] < g[1] && g[0] < f[1])) continue;
      const crossing = rows[h].some((b) => b.x0 < g[0] && b.x1 > g[1]);
      const support = others.filter((r) => r.some((b) => b.x1 <= g[0] + 1) && r.some((b) => b.x0 >= g[1] - 1)).length;
      if (crossing && support >= 2) found.push(g);
    }
  }
  return found.map((g) => (g[0] + g[1]) / 2).sort((a, b) => a - b);
}

/** Column 1 becomes the rightmost column (right-to-left tables). */
function mirror(rows: Cell[][]): Cell[][] {
  return rows.map((r) => {
    const out = [...r].reverse().map((c) => ({ ...c }));
    // A spanning cell must stay the first cell of its span after mirroring.
    for (let i = 0; i < out.length; i++) {
      const orig = r.length - 1 - i;
      if (r[orig].span > 1) {
        const span = r[orig].span;
        const target = i - span + 1;
        const moved = out[i];
        out[i] = { ...emptyCell(), span: 0 };
        out[target] = { ...moved, span };
        for (let k = target + 1; k <= i; k++) if (k !== target) out[k] = { ...emptyCell(), span: 0 };
      }
    }
    return out;
  });
}

/** Every word placed in the grid exactly once (used by tests: nothing is dropped). */
export const gridText = (g: Grid) => g.rows.flat().map((c) => c.text).join(" ");

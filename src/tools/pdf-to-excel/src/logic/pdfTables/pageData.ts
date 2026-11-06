import type { PageData, Rule, TextRun } from "./types";

/** The parts of a pdf.js page proxy we use (kept structural so this folder never imports pdf.js). */
export interface PageLike {
  getViewport(o: { scale: number }): { width: number; height: number; transform: number[] };
  getTextContent(): Promise<{ items: unknown[] }>;
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[] }>;
}

/** pdf.js operator codes we need (pass `pdfjs.OPS`). */
export interface OpsLike {
  save: number;
  restore: number;
  transform: number;
  constructPath: number;
  stroke: number;
  closeStroke: number;
  fill: number;
  eoFill: number;
  fillStroke: number;
  eoFillStroke: number;
  closeFillStroke: number;
  closeEOFillStroke: number;
}

type M = [number, number, number, number, number, number];
const mul = (a: M, b: M): M => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const apply = (m: M, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

const RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/;

/** Text runs in display coordinates. Runs with two or more spaces inside are split there. */
export function runsFromText(items: unknown[], vp: M): TextRun[] {
  const out: TextRun[] = [];
  for (const raw of items) {
    const it = raw as { str?: string; transform?: number[]; width?: number; height?: number; dir?: string };
    if (typeof it.str !== "string" || !it.transform || !it.str.trim()) continue;
    const m = mul(vp, it.transform as M);
    // Only horizontal text (after page rotation) can belong to a table row.
    if (Math.abs(m[1]) > Math.abs(m[0]) * 0.1 || m[0] <= 0) continue;
    const size = Math.hypot(m[2], m[3]) || it.height || 10;
    const scale = Math.hypot(m[0], m[1]) / (Math.hypot(it.transform[0], it.transform[1]) || 1);
    const width = (it.width ?? 0) * scale;
    const x0 = m[4];
    const y = m[5];
    const rtl = it.dir === "rtl" || RTL.test(it.str);
    // Split "A    B" (one text show with spaces used as column padding) into separate runs.
    const pieces = [...it.str.matchAll(/\S+(?: \S+)*/g)];
    const per = it.str.length ? width / it.str.length : 0;
    for (const p of pieces) {
      const start = p.index ?? 0;
      out.push({ text: p[0], x0: x0 + start * per, x1: x0 + (start + p[0].length) * per, y, size, rtl });
    }
  }
  return out;
}

const STROKES = (o: OpsLike) => new Set([o.stroke, o.closeStroke, o.fillStroke, o.eoFillStroke, o.closeFillStroke, o.closeEOFillStroke]);
const FILLS = (o: OpsLike) => new Set([o.fill, o.eoFill]);

/** Rules from the operator list: stroked straight segments and thin filled rectangles. */
export function rulesFromOps(ol: { fnArray: number[]; argsArray: unknown[] }, ops: OpsLike, vp: M): Rule[] {
  const rules: Rule[] = [];
  const strokes = STROKES(ops);
  const fills = FILLS(ops);
  let ctm: M = [1, 0, 0, 1, 0, 0];
  const stack: M[] = [];
  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i];
    const args = ol.argsArray[i] as unknown[];
    if (fn === ops.save) stack.push(ctm);
    else if (fn === ops.restore) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (fn === ops.transform) ctm = mul(ctm, args as unknown as M);
    else if (fn === ops.constructPath) {
      const paint = args[0] as number;
      const data = (args[1] as ArrayLike<number>[] | undefined)?.[0];
      if (!data || !(strokes.has(paint) || fills.has(paint))) continue;
      const full = mul(vp, ctm);
      // Path data: 0 moveTo x y, 1 lineTo x y, 2 curveTo (6 numbers), 3 quadraticCurveTo (4), 4 closePath.
      const pts: [number, number][][] = [];
      let cur: [number, number][] = [];
      for (let k = 0; k < data.length; ) {
        const op = data[k];
        if (op === 0) {
          if (cur.length) pts.push(cur);
          cur = [apply(full, data[k + 1], data[k + 2])];
          k += 3;
        } else if (op === 1) {
          cur.push(apply(full, data[k + 1], data[k + 2]));
          k += 3;
        } else if (op === 2) {
          if (cur.length) pts.push(cur);
          cur = [apply(full, data[k + 5], data[k + 6])];
          k += 7;
        } else if (op === 3) {
          if (cur.length) pts.push(cur);
          cur = [apply(full, data[k + 3], data[k + 4])];
          k += 5;
        } else {
          if (cur.length) cur.push(cur[0]);
          k += 1;
        }
      }
      if (cur.length) pts.push(cur);
      for (const poly of pts) {
        if (strokes.has(paint)) {
          for (let j = 1; j < poly.length; j++) addSegment(rules, poly[j - 1], poly[j]);
        } else if (poly.length >= 4) {
          // A thin filled rectangle is drawn as a rule.
          const xs = poly.map((p) => p[0]);
          const ys = poly.map((p) => p[1]);
          const w = Math.max(...xs) - Math.min(...xs);
          const h = Math.max(...ys) - Math.min(...ys);
          if (h <= 2.5 && w > 4) rules.push({ dir: "h", at: (Math.max(...ys) + Math.min(...ys)) / 2, from: Math.min(...xs), to: Math.max(...xs) });
          else if (w <= 2.5 && h > 4) rules.push({ dir: "v", at: (Math.max(...xs) + Math.min(...xs)) / 2, from: Math.min(...ys), to: Math.max(...ys) });
        }
      }
    }
  }
  return rules;
}

function addSegment(rules: Rule[], a: [number, number], b: [number, number]) {
  const dx = Math.abs(a[0] - b[0]);
  const dy = Math.abs(a[1] - b[1]);
  if (dy <= 1 && dx > 2) rules.push({ dir: "h", at: (a[1] + b[1]) / 2, from: Math.min(a[0], b[0]), to: Math.max(a[0], b[0]) });
  else if (dx <= 1 && dy > 2) rules.push({ dir: "v", at: (a[0] + b[0]) / 2, from: Math.min(a[1], b[1]), to: Math.max(a[1], b[1]) });
}

export async function readPage(page: PageLike, pageNumber: number, ops: OpsLike): Promise<PageData> {
  const vp = page.getViewport({ scale: 1 });
  const t = vp.transform as M;
  const [tc, ol] = await Promise.all([page.getTextContent(), page.getOperatorList()]);
  return { page: pageNumber, width: vp.width, height: vp.height, runs: runsFromText(tc.items, t), rules: rulesFromOps(ol, ops, t) };
}

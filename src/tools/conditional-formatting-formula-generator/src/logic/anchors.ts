// Does a rule formula point at the first cell of the range it applies to, with the right $ signs?

import { colNumber, colLetters, parseRange, type Range } from "./range";
import { tokenize } from "./tokenize";

interface CellRef {
  text: string;
  col: number;
  row: number;
  colAbs: boolean;
  rowAbs: boolean;
}

function parseCell(part: string): CellRef | null {
  const m = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})$/.exec(part);
  if (!m) return null;
  return { text: part, col: colNumber(m[2]), row: Number(m[4]), colAbs: m[1] === "$", rowAbs: m[3] === "$" };
}

/** Warnings about anchors; empty when the formula is anchored on the first row and column of appliesTo. */
export function anchorWarnings(formula: string, appliesTo: Range): string[] {
  let tokens;
  try {
    tokens = tokenize(formula);
  } catch {
    return [];
  }
  const out: string[] = [];
  const singles: CellRef[] = [];
  for (const t of tokens) {
    if (t.type !== "ref") continue;
    const body = t.value.slice(t.value.lastIndexOf("!") + 1);
    const parts = body.split(":");
    if (parts.length === 2) {
      const a = parseCell(parts[0]);
      const b = parseCell(parts[1]);
      if (a && b && (!a.rowAbs || !b.rowAbs) && a.row !== b.row) out.push(`The range ${t.value} has no $ before its row numbers, so it moves down one row for every row of the rule. Write it as $${colLetters(a.col)}$${a.row}:$${colLetters(b.col)}$${b.row}.`);
      continue;
    }
    const c = parseCell(parts[0]);
    if (c) singles.push(c);
  }
  const firstRow = appliesTo.r1;
  const firstCol = appliesTo.c1;
  const rowRel = singles.filter((c) => !c.rowAbs);
  if (singles.length && rowRel.length === 0 && appliesTo.r2 > appliesTo.r1 && !/\b(ROW|COLUMN)\s*\(\s*\)/i.test(formula)) out.push("Every cell reference has a $ before the row number, so every row of the range tests the same cell. Remove the $ before the row number of the cell the rule should check row by row.");
  if (rowRel.length && !rowRel.some((c) => c.row === firstRow || c.row === firstRow - 1)) out.push(`The formula does not refer to row ${firstRow}, the first row of the range: relative references are read from the first cell, so the rule will look at the wrong row.`);
  const colRel = singles.filter((c) => !c.colAbs);
  for (const c of colRel) if (c.col !== firstCol && appliesTo.c2 > appliesTo.c1) out.push(`${c.text} has no $ before the column, and the range starts in column ${colLetters(firstCol)}: the other columns will test other cells. To test one column for the whole row, write $${c.text}.`);
  return [...new Set(out)];
}

export { parseRange };

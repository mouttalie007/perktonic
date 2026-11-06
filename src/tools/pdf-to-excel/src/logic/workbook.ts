import { guessStyle, looksLikeFormula, toValue, type NumberStyle, type Table } from "./pdfTables";
import type { XCell, XSheet } from "./xlsx";

export interface Selected {
  table: Table;
  /** Number shown to the visitor ("Table 2"). */
  index: number;
  header: boolean;
}

export const tableLabel = (s: Selected) => `Table ${s.index} (p${s.table.pages[0]}${s.table.pages.length > 1 ? `-${s.table.pages.at(-1)}` : ""})`;

/** Cells of one table as spreadsheet values: header rows stay text and bold; numbers become numbers. */
export function tableCells(s: Selected, numbers: NumberStyle): XCell[][] {
  const style = numbers === "auto" ? guessStyle(s.table.rows.flat()) : numbers;
  const header = s.header ? Math.max(1, s.table.headerRows) : 0;
  return s.table.rows.map((row, r) =>
    row.map((text): XCell => {
      if (!text) return null;
      if (r < header) return { t: "s", v: text, bold: true, protect: looksLikeFormula(text) };
      const v = toValue(text, style);
      return v.kind === "number" ? { t: "n", v: v.value, pct: v.percent } : { t: "s", v: text, protect: looksLikeFormula(text) };
    }),
  );
}

/** One sheet per table ("Table 1 (p2)"), or all tables stacked on one sheet with a title row each. */
export function buildSheets(selected: Selected[], numbers: NumberStyle, oneSheet: boolean): XSheet[] {
  if (!oneSheet)
    return selected.map((s) => ({
      name: tableLabel(s),
      rows: tableCells(s, numbers),
      merges: s.table.merges,
      rtl: s.table.rtl,
      freezeRows: s.header ? Math.max(1, s.table.headerRows) : 0,
    }));
  const rows: XCell[][] = [];
  const merges: XSheet["merges"] = [];
  for (const s of selected) {
    if (rows.length) rows.push([]);
    rows.push([{ t: "s", v: tableLabel(s), bold: true }]);
    const offset = rows.length;
    rows.push(...tableCells(s, numbers));
    merges.push(...s.table.merges.map((m) => ({ ...m, row: m.row + offset })));
  }
  return [{ name: "All tables", rows, merges, rtl: selected.every((s) => s.table.rtl) }];
}

/** Preview grid: a merged cell's text is repeated in every cell it covers. */
export function previewRows(t: Table): string[][] {
  const out = t.rows.map((r) => [...r]);
  for (const m of t.merges) for (let r = m.row; r < m.row + m.rowSpan; r++) for (let c = m.col; c < m.col + m.colSpan; c++) if (out[r]) out[r][c] = t.rows[m.row][m.col];
  return out;
}

/** Tab-separated text for "Copy" (pastes into a spreadsheet as cells). */
export function toTsv(t: Table): string {
  return previewRows(t)
    .map((r) => r.map((c) => c.replace(/[\t\r\n]+/g, " ")).join("\t"))
    .join("\n");
}

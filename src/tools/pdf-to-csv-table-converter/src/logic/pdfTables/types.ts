// Shared PDF table engine (tools 3.1 and 3.2). This folder imports nothing outside itself.

/** A run of text on the page, in display coordinates (origin top-left, y grows downward, points). */
export interface TextRun {
  text: string;
  x0: number;
  x1: number;
  /** Baseline. */
  y: number;
  size: number;
  rtl: boolean;
}

/** A horizontal or vertical rule (or the edge of a thin filled rectangle), display coordinates. */
export interface Rule {
  dir: "h" | "v";
  /** y for "h", x for "v". */
  at: number;
  from: number;
  to: number;
}

export interface PageData {
  page: number;
  width: number;
  height: number;
  runs: TextRun[];
  rules: Rule[];
}

export type Method = "ruled" | "aligned";
export type MethodChoice = "auto" | Method;

export interface Merge {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

export interface Table {
  /** Pages this table covers (several when continued). */
  pages: number[];
  method: Method;
  /** Rectangular grid of cell texts; a merged cell's text is in its top-left cell, covered cells are "". */
  rows: string[][];
  merges: Merge[];
  /** Rows at the top that look like a header (0 if none). */
  headerRows: number;
  rtl: boolean;
  /** Column edges on the first page, used to recognise a continuation on the next page. */
  edges: number[];
  /** Top of the table on its last page (to keep page order) and its bottom. */
  top: number;
  bottom: number;
  /** How many repeated header rows were dropped when pages were merged. */
  droppedHeaders: number;
}

export interface AnalyseOptions {
  method: MethodChoice;
}

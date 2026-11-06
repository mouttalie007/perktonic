import { applyRange, buildTable, parseRange, resolveAlignments, type Align, type AlignChoice, type Table } from "./table";
import { toHtml, toLatex, toMarkdown, type Format, type HtmlOptions, type LatexOptions, type MarkdownOptions } from "./writers";

export interface ConvertOptions {
  format: Format;
  hasHeader: boolean;
  range: string;
  defaultAlign: AlignChoice;
  columnAligns: AlignChoice[];
  autoRightNumbers: boolean;
  markdown: MarkdownOptions;
  html: HtmlOptions;
  latex: LatexOptions;
}

export const DEFAULT_OPTIONS: ConvertOptions = {
  format: "markdown",
  hasHeader: true,
  range: "",
  defaultAlign: "auto",
  columnAligns: [],
  autoRightNumbers: true,
  markdown: { pretty: true, escapeFormatting: false },
  html: { useThead: true, caption: "", indent: true },
  latex: { booktabs: true, boldHeader: true, floatEnv: true, caption: "", label: "tab:data" },
};

export const MAX_COLUMNS = 200;

export type ConvertResult =
  | { ok: true; text: string; warnings: string[]; table: Table; aligns: Align[] }
  | { ok: false; error: string };

export function convertGrid(grid: string[][], options: ConvertOptions): ConvertResult {
  let selected = grid;
  if (options.range.trim() !== "") {
    const range = parseRange(options.range);
    if ("error" in range) return { ok: false, error: range.error };
    selected = applyRange(grid, range);
    if (selected.length === 0) return { ok: false, error: `The range ${options.range.trim()} is outside the data, which has ${grid.length} rows.` };
  }
  const table = buildTable(selected, options.hasHeader);
  if (table.columnCount === 0) return { ok: false, error: "No table data found. Paste cells copied from a spreadsheet or upload a file." };
  if (table.columnCount > MAX_COLUMNS) {
    return { ok: false, error: `This table has ${table.columnCount} columns. The limit is ${MAX_COLUMNS}; select a smaller range.` };
  }
  const aligns = resolveAlignments(table, options.defaultAlign, options.columnAligns, options.autoRightNumbers);
  const written =
    options.format === "markdown"
      ? toMarkdown(table, aligns, options.markdown)
      : options.format === "html"
        ? toHtml(table, aligns, options.html)
        : toLatex(table, aligns, options.latex);
  return { ok: true, text: written.text, warnings: written.warnings, table, aligns };
}

export const FILE_EXTENSIONS: Record<Format, string> = { markdown: "md", html: "html", latex: "tex" };

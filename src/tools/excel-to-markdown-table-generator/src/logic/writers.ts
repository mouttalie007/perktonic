import type { Align, Table } from "./table";

export type Format = "markdown" | "html" | "latex";

export interface MarkdownOptions {
  /** Pad cells so the columns line up in the source. */
  pretty: boolean;
  /** Escape characters Markdown would treat as formatting: * _ ` [ ] < > etc. */
  escapeFormatting: boolean;
}

export interface HtmlOptions {
  useThead: boolean;
  caption: string;
  indent: boolean;
}

export interface LatexOptions {
  booktabs: boolean;
  boldHeader: boolean;
  /** Wrap the tabular in a floating table environment with caption and label. */
  floatEnv: boolean;
  caption: string;
  label: string;
}

export interface WriteResult {
  text: string;
  warnings: string[];
}

const LINE_BREAK_RE = /\r\n|\r|\n/g;
const HAS_BREAK_RE = /\r|\n/;

export function escapeMarkdownCell(value: string, escapeFormatting: boolean): string {
  let v = value;
  if (escapeFormatting) {
    v = v.replace(/\\/g, "\\\\").replace(/[*_`[\]~#]/g, (c) => "\\" + c).replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  // GitHub needs \| inside a cell even within code spans; line breaks become <br>.
  return v.replace(/\|/g, "\\|").replace(LINE_BREAK_RE, "<br>").trim();
}

/** Display width that treats wide East Asian characters and emoji as two columns. */
function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    const wide =
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe4f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0x1f300 && cp <= 0x1faff);
    w += wide ? 2 : 1;
  }
  return w;
}

function pad(s: string, width: number, align: Align): string {
  const gap = width - displayWidth(s);
  if (gap <= 0) return s;
  if (align === "right") return " ".repeat(gap) + s;
  if (align === "center") {
    const left = Math.floor(gap / 2);
    return " ".repeat(left) + s + " ".repeat(gap - left);
  }
  return s + " ".repeat(gap);
}

export function toMarkdown(table: Table, aligns: Align[], opts: MarkdownOptions): WriteResult {
  const warnings: string[] = [];
  const cols = table.columnCount;
  if (cols === 0) return { text: "", warnings };
  // Markdown tables always need a header row; an empty one keeps GitHub happy.
  const headerSrc = table.header ?? new Array<string>(cols).fill("");
  if (!table.header) warnings.push("Markdown tables need a header row, so an empty one was added.");

  const header = headerSrc.map((c) => escapeMarkdownCell(c, opts.escapeFormatting));
  const body = table.rows.map((r) => r.map((c) => escapeMarkdownCell(c, opts.escapeFormatting)));

  let breaks = 0;
  for (const r of [headerSrc, ...table.rows]) for (const c of r) if (HAS_BREAK_RE.test(c)) breaks++;
  if (breaks > 0) warnings.push(`${breaks} cell(s) contained line breaks; they were written as <br>.`);

  const widths = new Array<number>(cols).fill(3);
  if (opts.pretty) {
    for (const r of [header, ...body]) {
      r.forEach((c, i) => {
        widths[i] = Math.max(widths[i], displayWidth(c));
      });
    }
  }
  const sep = aligns.map((a, i) => {
    const w = opts.pretty ? widths[i] : 3;
    if (a === "center") return ":" + "-".repeat(Math.max(1, w - 2)) + ":";
    if (a === "right") return "-".repeat(Math.max(2, w - 1)) + ":";
    return ":" + "-".repeat(Math.max(2, w - 1));
  });
  const line = (r: string[]) =>
    "| " + r.map((c, i) => (opts.pretty ? pad(c, widths[i], aligns[i]) : c)).join(" | ") + " |";

  const lines = [line(header), "| " + sep.join(" | ") + " |", ...body.map(line)];
  return { text: lines.join("\n") + "\n", warnings };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function toHtml(table: Table, aligns: Align[], opts: HtmlOptions): WriteResult {
  const ind = (level: number) => (opts.indent ? "  ".repeat(level) : "");
  const nl = opts.indent ? "\n" : "";
  const cell = (tag: "th" | "td", value: string, i: number) => {
    const style = aligns[i] === "left" ? "" : ` style="text-align: ${aligns[i]}"`;
    const content = escapeHtml(value).replace(LINE_BREAK_RE, "<br>");
    return `<${tag}${style}>${content}</${tag}>`;
  };
  const out: string[] = [];
  out.push("<table>");
  if (opts.caption.trim()) out.push(`${ind(1)}<caption>${escapeHtml(opts.caption.trim())}</caption>`);
  if (table.header) {
    const tr = `${ind(2)}<tr>${table.header.map((c, i) => cell("th", c, i)).join("")}</tr>`;
    if (opts.useThead) out.push(`${ind(1)}<thead>`, tr, `${ind(1)}</thead>`);
    else out.push(tr.replace(/^ {2}/, ""));
  }
  if (opts.useThead) out.push(`${ind(1)}<tbody>`);
  const rowInd = opts.useThead ? 2 : 1;
  for (const r of table.rows) out.push(`${ind(rowInd)}<tr>${r.map((c, i) => cell("td", c, i)).join("")}</tr>`);
  if (opts.useThead) out.push(`${ind(1)}</tbody>`);
  out.push("</table>");
  return { text: out.join(nl) + "\n", warnings: [] };
}

const LATEX_MAP: Record<string, string> = {
  "&": "\\&",
  "%": "\\%",
  "$": "\\$",
  "#": "\\#",
  "_": "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
  "\\": "\\textbackslash{}",
};

export function escapeLatex(value: string): string {
  return value.replace(/[&%$#_{}~^\\]/g, (c) => LATEX_MAP[c]);
}

export function toLatex(table: Table, aligns: Align[], opts: LatexOptions): WriteResult {
  const warnings: string[] = [];
  let breaks = 0;
  const conv = (v: string) => {
    if (HAS_BREAK_RE.test(v)) breaks++;
    return escapeLatex(v.replace(LINE_BREAK_RE, " ").trim());
  };
  const spec = aligns.map((a) => (a === "center" ? "c" : a === "right" ? "r" : "l")).join(opts.booktabs ? "" : " ");
  const top = opts.booktabs ? "\\toprule" : "\\hline";
  const mid = opts.booktabs ? "\\midrule" : "\\hline";
  const bottom = opts.booktabs ? "\\bottomrule" : "\\hline";
  const out: string[] = [];
  const indent = opts.floatEnv ? "  " : "";
  if (opts.floatEnv) {
    out.push("\\begin{table}[htbp]", "  \\centering");
    if (opts.caption.trim()) out.push(`  \\caption{${escapeLatex(opts.caption.trim())}}`);
    if (opts.label.trim()) out.push(`  \\label{${opts.label.trim().replace(/[^A-Za-z0-9:._-]/g, "-")}}`);
  }
  out.push(`${indent}\\begin{tabular}{${opts.booktabs ? spec : "|" + spec.replace(/ /g, "|") + "|"}}`);
  out.push(`${indent}  ${top}`);
  if (table.header) {
    const cells = table.header.map((c) => {
      const v = conv(c);
      return opts.boldHeader && v !== "" ? `\\textbf{${v}}` : v;
    });
    out.push(`${indent}  ${cells.join(" & ")} \\\\`);
    out.push(`${indent}  ${mid}`);
  }
  for (const r of table.rows) out.push(`${indent}  ${r.map(conv).join(" & ")} \\\\`);
  out.push(`${indent}  ${bottom}`);
  out.push(`${indent}\\end{tabular}`);
  if (opts.floatEnv) out.push("\\end{table}");
  if (opts.booktabs) warnings.push("Uses the booktabs package: add \\usepackage{booktabs} to your preamble.");
  if (breaks > 0) warnings.push(`${breaks} cell(s) contained line breaks; LaTeX tabular cells cannot, so they became spaces.`);
  return { text: out.join("\n") + "\n", warnings };
}

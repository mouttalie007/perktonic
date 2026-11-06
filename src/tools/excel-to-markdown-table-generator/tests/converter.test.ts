import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import readXlsxFile from "read-excel-file/node";
import { detectDelimiter, parseAuto } from "../src/logic/csv";
import { convertGrid, DEFAULT_OPTIONS, type ConvertOptions } from "../src/logic/convert";
import { cellToText, decodeText, sniffFile } from "../src/logic/input";
import { buildTable, isNumeric, parseRange, resolveAlignments } from "../src/logic/table";
import { escapeHtml, escapeLatex, escapeMarkdownCell } from "../src/logic/writers";
import { EXAMPLE_TSV } from "../fixtures/example";

const fixture = (name: string) => readFileSync(join(__dirname, "..", "fixtures", name), "utf8");
const run = (text: string, patch: Partial<ConvertOptions> = {}) => {
  const result = convertGrid(parseAuto(text).rows, { ...DEFAULT_OPTIONS, ...patch });
  if (!result.ok) throw new Error(result.error);
  return result;
};

describe("Markdown output", () => {
  it("escapes pipes and turns newlines inside cells into <br>", () => {
    const out = run(fixture("multiline.csv"), { markdown: { pretty: false, escapeFormatting: false } });
    expect(out.text).toContain("Contains \\| pipe");
    expect(out.text).toContain("Line one<br>Line two");
    expect(out.text).toContain("She said \"wow\"");
    // Every line has the same number of unescaped pipes, so the table cannot break.
    const pipeCounts = out.text.trim().split("\n").map((l) => l.replace(/\\\|/g, "").split("|").length);
    expect(new Set(pipeCounts).size).toBe(1);
    expect(out.warnings.some((w) => w.includes("line breaks"))).toBe(true);
  });

  it("writes the exact GitHub table for the example, with numbers right-aligned", () => {
    const out = run("Item\tQty\nApple\t3\nPear\t12\n", { markdown: { pretty: true, escapeFormatting: false } });
    expect(out.text).toBe("| Item  | Qty |\n| :---- | --: |\n| Apple |   3 |\n| Pear  |  12 |\n");
  });

  it("optionally escapes Markdown formatting characters", () => {
    expect(escapeMarkdownCell("*bold* _x_ `code` <b>", true)).toBe("\\*bold\\* \\_x\\_ \\`code\\` &lt;b&gt;");
    expect(escapeMarkdownCell("*bold*", false)).toBe("*bold*");
  });

  it("adds an empty header row when the data has none", () => {
    const out = run("a,b\nc,d", { hasHeader: false, markdown: { pretty: false, escapeFormatting: false } });
    expect(out.text.split("\n")[0]).toBe("|  |  |");
    expect(out.text).toContain("| a | b |");
  });
});

describe("LaTeX output", () => {
  it("escapes & % $ # _ { } ~ ^ \\", () => {
    expect(escapeLatex("& % $ # _ { } ~ ^ \\")).toBe(
      "\\& \\% \\$ \\# \\_ \\{ \\} \\textasciitilde{} \\textasciicircum{} \\textbackslash{}",
    );
  });

  it("builds a booktabs table with a bold header, caption and label", () => {
    const out = run(fixture("latex-special.tsv"), {
      format: "latex",
      latex: { booktabs: true, boldHeader: true, floatEnv: true, caption: "Costs & notes", label: "tab:costs" },
    });
    expect(out.text).toContain("\\caption{Costs \\& notes}");
    expect(out.text).toContain("\\label{tab:costs}");
    expect(out.text).toContain("\\textbf{Symbol} & \\textbf{Cost} & \\textbf{Comment} \\\\");
    expect(out.text).toContain("50\\% off & \\$5 & use a\\_b \\& c\\#1 \\\\");
    expect(out.text).toContain("\\{x\\} & \\textasciitilde{}10 & 2\\textasciicircum{}3 = 8 \\textbackslash{} done \\\\");
    expect(out.text).toContain("\\toprule");
  });

  it("uses \\hline and vertical rules without booktabs", () => {
    const out = run("A,B\n1,2", { format: "latex", latex: { ...DEFAULT_OPTIONS.latex, booktabs: false, floatEnv: false } });
    expect(out.text.startsWith("\\begin{tabular}{|r|r|}\n  \\hline")).toBe(true);
  });
});

describe("HTML output", () => {
  it("escapes HTML so user text can never become markup", () => {
    const out = run(fixture("html-escape.csv"), { format: "html", hasHeader: false });
    expect(out.text).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(out.text).toContain("Tom &amp; Jerry");
    expect(out.text).not.toContain("<script>");
    expect(escapeHtml("\"'")).toBe("&quot;&#39;");
  });

  it("supports optional <thead> and <caption>", () => {
    const withHead = run("A,B\n1,x", { format: "html", html: { useThead: true, caption: "Q1 <draft>", indent: true } });
    expect(withHead.text).toContain("<caption>Q1 &lt;draft&gt;</caption>");
    expect(withHead.text).toContain("<thead>");
    expect(withHead.text).toContain("<th style=\"text-align: right\">A</th>");
    const noHead = run("A,B\n1,x", { format: "html", html: { useThead: false, caption: "", indent: false } });
    expect(noHead.text).not.toContain("<thead>");
    expect(noHead.text).not.toContain("<caption>");
    expect(noHead.text).toContain("<tr><th style=\"text-align: right\">A</th><th>B</th></tr>");
  });
});

describe("Alignment", () => {
  it("right-aligns numeric columns automatically, including currency, thousands and percent", () => {
    const table = buildTable(parseAuto(EXAMPLE_TSV).rows, true);
    expect(resolveAlignments(table, "auto", [], true)).toEqual(["left", "right", "right", "right", "left"]);
    expect(["1,284,500", "-6.2%", "$4.50", "(1,200)", ".5"].every(isNumeric)).toBe(true);
    expect(["12 apples", "2026-01-01", "N/A"].some(isNumeric)).toBe(false);
  });

  it("lets a per-column choice override the default", () => {
    const table = buildTable([["a", "b", "c"], ["1", "x", "y"]], true);
    expect(resolveAlignments(table, "center", ["auto", "right"], true)).toEqual(["center", "right", "center"]);
    const out = run("a,b,c\n1,x,y", { defaultAlign: "center", columnAligns: ["auto", "right"], markdown: { pretty: false, escapeFormatting: false } });
    expect(out.text.split("\n")[1]).toBe("| :-: | --: | :-: |");
  });
});

describe("Pasted spreadsheet data", () => {
  it("detects tab-separated clipboard data, including quoted multi-line cells", () => {
    const parsed = parseAuto(fixture("sheets-paste.tsv"));
    expect(parsed.delimiter).toBe("\t");
    expect(parsed.rows).toEqual([
      ["Name", "Score", "City"],
      ["Alice", "91.5", "Paris"],
      ["Bob", "78", "New\nYork"],
      ["Charlie", "1,204", "Oslo"],
    ]);
  });

  it("detects semicolon and pipe separated text", () => {
    expect(detectDelimiter("a;b;c\n1;2,5;3\n")).toBe(";");
    expect(detectDelimiter("a|b\n1|2\n")).toBe("|");
    expect(detectDelimiter("name,city\n\"Smith; John\",Rome\n")).toBe(",");
  });

  it("selects an Excel-style range", () => {
    const out = run(EXAMPLE_TSV, { range: "A1:B3", markdown: { pretty: false, escapeFormatting: false } });
    expect(out.table.header).toEqual(["Region", "Q1 revenue (USD)"]);
    expect(out.table.rows).toEqual([["North America", "1,284,500"], ["Europe", "962,300"]]);
    expect(parseRange("1A:B")).toHaveProperty("error");
    expect(convertGrid([["a"]], { ...DEFAULT_OPTIONS, range: "Z100:Z200" }).ok).toBe(false);
  });
});

describe("Files", () => {
  it("recognises files by magic bytes, not extension", () => {
    expect(sniffFile(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), 10)).toEqual({ ok: true, kind: "xlsx" });
    expect(sniffFile(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]), 10).ok).toBe(false);
    expect(sniffFile(new Uint8Array([0x25, 0x50, 0x44, 0x46]), 10).ok).toBe(false);
    expect(sniffFile(new Uint8Array([0x61, 0x00, 0x62]), 3).ok).toBe(false);
    expect(sniffFile(new TextEncoder().encode("a,b"), 51 * 1024 * 1024).ok).toBe(false);
    expect(sniffFile(new TextEncoder().encode("a,b"), 3)).toEqual({ ok: true, kind: "text" });
  });

  it("decodes BOM, UTF-16 and falls back to Windows-1252", () => {
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, 0x61])).text).toBe("a");
    expect(decodeText(new Uint8Array([0xff, 0xfe, 0x61, 0x00])).text).toBe("a");
    expect(decodeText(new Uint8Array([0x63, 0x61, 0x66, 0xe9]))).toEqual({ text: "café", encoding: "Windows-1252" });
  });

  it("reads every sheet of an .xlsx workbook", async () => {
    const sheets = await readXlsxFile(join(__dirname, "..", "fixtures", "budget.xlsx"));
    expect(sheets.map((s) => s.sheet)).toEqual(["Budget", "Notes"]);
    const grid = sheets[0].data.map((r) => r.map(cellToText));
    const out = convertGrid(grid, { ...DEFAULT_OPTIONS, markdown: { pretty: false, escapeFormatting: false } });
    expect(out.ok && out.text).toBe(
      "| Team | Budget | Spent |\n| :-- | :-- | --: |\n| Design | 12000 | 9850.5 |\n| Engineering | 48000 | 51230 |\n| Support | n/a | 4100 |\n",
    );
    expect(cellToText(new Date(Date.UTC(2026, 2, 4)))).toBe("2026-03-04");
    expect(cellToText(0.1 + 0.2)).toBe("0.3");
  });
});

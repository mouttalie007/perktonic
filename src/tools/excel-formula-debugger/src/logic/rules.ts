// Rule engine: each rule is a small pure function with an id, the errors it explains, a test,
// a plain-language cause, how to fix it and, when the fix is mechanical, the corrected formula.

import { checkBalance, checkFormula, knownFunctions, NEW_FUNCTIONS, type FormulaCheck, type Platform } from "./checks";
import { boundNames, functionCalls, parseFormula, walk, type Node } from "./parse";
import { separatorStyle, toCommas } from "./separators";
import { columnNumber, FormulaSyntaxError } from "./tokenize";

export const ERROR_KINDS = ["#VALUE!", "#REF!", "#N/A", "#NAME?", "#DIV/0!", "#NUM!", "#NULL!", "#SPILL!", "###", "circular"] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];
export const ERROR_LABEL: Record<ErrorKind, string> = {
  "#VALUE!": "#VALUE!",
  "#REF!": "#REF!",
  "#N/A": "#N/A",
  "#NAME?": "#NAME?",
  "#DIV/0!": "#DIV/0!",
  "#NUM!": "#NUM!",
  "#NULL!": "#NULL!",
  "#SPILL!": "#SPILL!",
  "###": "### (hashes)",
  circular: "Circular reference",
};

export interface DebugInput {
  formula: string;
  error: ErrorKind;
  platform: Platform;
  /** The cell that holds the formula, e.g. "C10" (optional; enables the self-reference rule). */
  cell?: string;
}

type Call = Node & { type: "call" };

export interface Ctx {
  input: DebugInput;
  src: string;
  ast: Node | null;
  parseError: { message: string; pos: number } | null;
  calls: Call[];
  check: FormulaCheck;
  names: { value: string; start: number; end: number; parent: Node | null; parentArg: number }[];
  bound: Set<string>;
}

export interface Finding {
  id: string;
  title: string;
  /** 0..1 before ranking. */
  confidence: number;
  cause: string;
  fix: string;
  corrected?: string;
}

export interface Rule {
  id: string;
  /** Errors this rule explains; "any" for problems that break every formula. */
  errors: ErrorKind[] | "any";
  test(ctx: Ctx): Omit<Finding, "id"> | null;
}

// ------------------------------------------------------------------ helpers

const LOOKUPS = new Set(["VLOOKUP", "HLOOKUP", "MATCH", "XLOOKUP", "XMATCH", "LOOKUP"]);
const DYNAMIC = new Set(["FILTER", "UNIQUE", "SORT", "SORTBY", "SEQUENCE", "RANDARRAY", "VSTACK", "HSTACK", "TOCOL", "TOROW", "TEXTSPLIT", "CHOOSECOLS", "CHOOSEROWS", "TAKE", "DROP", "EXPAND", "WRAPROWS", "WRAPCOLS", "MAKEARRAY", "MAP", "SCAN", "BYROW", "BYCOL", "GROUPBY", "PIVOTBY", "TRANSPOSE"]);
const MAX_ROW = 1048576;
const MAX_COL = 16384;

export interface Area {
  sheet: string | null;
  c1: number;
  r1: number;
  c2: number;
  r2: number;
}

/** "Sheet1!$A$2:C200" → columns 1..3, rows 2..200. Whole columns and rows are expanded. */
export function parseArea(text: string): Area | null {
  const bang = text.lastIndexOf("!");
  let sheet: string | null = bang >= 0 ? text.slice(0, bang) : null;
  if (sheet?.startsWith("'")) sheet = sheet.slice(1, -1).replace(/''/g, "'");
  const body = (bang >= 0 ? text.slice(bang + 1) : text).replace(/\$/g, "").replace(/#$/, "");
  const parts = body.split(":");
  const one = (p: string) => /^([A-Za-z]{1,3})?(\d{1,7})?$/.exec(p);
  const a = one(parts[0]);
  const b = one(parts[1] ?? parts[0]);
  if (!a || !b || (!a[1] && !a[2])) return null;
  const c1 = a[1] ? columnNumber(a[1]) : 1;
  const c2 = b[1] ? columnNumber(b[1]) : MAX_COL;
  const r1 = a[2] ? Number(a[2]) : 1;
  const r2 = b[2] ? Number(b[2]) : MAX_ROW;
  return { sheet, c1: Math.min(c1, c2), c2: Math.max(c1, c2), r1: Math.min(r1, r2), r2: Math.max(r1, r2) };
}

const height = (a: Area) => a.r2 - a.r1 + 1;
const width = (a: Area) => a.c2 - a.c1 + 1;
const areaOf = (n: Node | undefined): Area | null => (n?.type === "ref" ? parseArea(n.value) : null);
const numberOf = (n: Node | undefined): number | null => (n?.type === "number" ? Number(n.value.replace(",", ".")) : null);
const slice = (ctx: Ctx, n: Node) => ctx.src.slice(n.start, n.end);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function parses(src: string): boolean {
  try {
    parseFormula(src);
    return true;
  } catch {
    return false;
  }
}

function splice(src: string, start: number, end: number, text: string): string {
  return src.slice(0, start) + text + src.slice(end);
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export function closestFunction(name: string, platform: Platform): string | null {
  let best: string | null = null;
  let bestD = 3;
  let tie = false;
  for (const f of knownFunctions(platform)) {
    if (Math.abs(f.length - name.length) > 2) continue;
    const d = levenshtein(name, f);
    if (d < bestD) {
      bestD = d;
      best = f;
      tie = false;
    } else if (d === bestD) tie = true;
  }
  return best && !tie && bestD <= 2 ? best : null;
}

/** A1-style cell such as "C10" (optionally with a sheet) → its area. */
function cellArea(cell: string | undefined): Area | null {
  if (!cell) return null;
  const a = parseArea(cell.trim());
  return a && a.c1 === a.c2 && a.r1 === a.r2 && /\d/.test(cell) ? a : null;
}

function contains(outer: Area, inner: Area): boolean {
  return inner.c1 >= outer.c1 && inner.c2 <= outer.c2 && inner.r1 >= outer.r1 && inner.r2 <= outer.r2;
}

function refs(ctx: Ctx): (Node & { type: "ref" })[] {
  const out: (Node & { type: "ref" })[] = [];
  if (ctx.ast) walk(ctx.ast, (n) => {
    if (n.type === "ref") out.push(n as Node & { type: "ref" });
  });
  return out;
}

function binaries(ctx: Ctx, ops: string[]): (Node & { type: "binary" })[] {
  const out: (Node & { type: "binary" })[] = [];
  if (ctx.ast) walk(ctx.ast, (n) => n.type === "binary" && ops.includes(n.op) && out.push(n));
  return out;
}

const callsNamed = (ctx: Ctx, ...names: string[]) => ctx.calls.filter((c) => names.includes(c.name));

// ------------------------------------------------------------------ rules

export const RULES: Rule[] = [
  {
    id: "smart-quotes",
    errors: "any",
    test(ctx) {
      if (!/[“”„‟″‘’‚‛]/.test(ctx.src)) return null;
      const corrected = ctx.src.replace(/[“”„‟″]/g, '"').replace(/[‘’‚‛]/g, "'");
      return {
        title: "Curly quotes instead of straight quotes",
        confidence: 0.95,
        cause: "The formula contains curly quotes (“ ” or ‘ ’), usually from copying out of Word, an email or a web page. Spreadsheets only read straight quotes, so the text is not recognised and you get #NAME? or a syntax error.",
        fix: "Retype the quotes, or use the corrected formula below.",
        corrected: corrected !== ctx.src ? corrected : undefined,
      };
    },
  },
  {
    id: "unbalanced-brackets",
    errors: "any",
    test(ctx) {
      const b = checkBalance(ctx.src).find((x) => x.kind === "paren-missing" || x.kind === "paren-extra");
      if (!b) return null;
      let corrected: string | undefined;
      if (b.kind === "paren-missing") {
        const c = ctx.src.trimEnd() + ")".repeat(b.count);
        if (parses(c)) corrected = c;
      } else {
        const c = splice(ctx.src, b.pos, b.pos + 1, "");
        if (parses(c)) corrected = c;
      }
      return {
        title: b.kind === "paren-missing" ? "A bracket is never closed" : "A closing bracket too many",
        confidence: 0.9,
        cause: b.text,
        fix: corrected ? "Add or remove the bracket as shown. Check that each function still gets the arguments you meant." : "Count the brackets of each function; every ( needs a matching ).",
        corrected,
      };
    },
  },
  {
    id: "unclosed-quote",
    errors: "any",
    test(ctx) {
      const b = checkBalance(ctx.src).find((x) => x.kind === "quote-open" || x.kind === "sheet-quote-open");
      if (!b) return null;
      return { title: "A quote is never closed", confidence: 0.85, cause: b.text, fix: 'Close the text with a straight double quote ("). Inside text, write a quote mark as two quotes ("").' };
    },
  },
  {
    id: "separator-mismatch",
    errors: "any",
    test(ctx) {
      const style = separatorStyle(ctx.src);
      if (style !== "semicolon" && style !== "mixed") return null;
      const corrected = toCommas(ctx.src);
      return {
        title: style === "mixed" ? "Commas and semicolons mixed" : "Semicolons between arguments",
        confidence: style === "mixed" ? 0.85 : 0.5,
        cause:
          style === "mixed"
            ? "The formula separates arguments with both commas and semicolons. A spreadsheet accepts only one of them, depending on its locale."
            : "The formula uses semicolons between arguments. That is right for spreadsheets set to German, French, Spanish and many other locales, but an English-locale spreadsheet expects commas and rejects the formula.",
        fix: "Use the separator of your spreadsheet's locale. For English settings, the corrected formula uses commas (and decimal points).",
        corrected: corrected !== ctx.src && parses(corrected) ? corrected : undefined,
      };
    },
  },
  {
    id: "unknown-function",
    errors: ["#NAME?"],
    test(ctx) {
      const unknown = ctx.check.unknownFunctions;
      if (!unknown.length) return null;
      let corrected = ctx.src;
      const fixes: string[] = [];
      for (const fn of unknown) {
        const near = closestFunction(fn, ctx.input.platform);
        if (!near) continue;
        fixes.push(`${fn} → ${near}`);
        for (const c of ctx.calls.filter((x) => x.name === fn).sort((a, b) => b.start - a.start)) corrected = splice(corrected, c.start, c.start + fn.length, near);
        if (!ctx.ast) corrected = corrected.replace(new RegExp(`\\b${fn.replace(/\./g, "\\.")}\\(`, "gi"), `${near}(`);
      }
      return {
        title: `Unknown function: ${unknown.join(", ")}`,
        confidence: fixes.length ? 0.9 : 0.75,
        cause: `${unknown.join(", ")} ${unknown.length === 1 ? "is" : "are"} not a function of the app you picked. A typo, a function from another app, or a custom function or add-in that is not in this file gives #NAME?.`,
        fix: fixes.length ? `Probably a typo: ${fixes.join(", ")}.` : "Check the spelling, or pick the app you actually use.",
        corrected: fixes.length && corrected !== ctx.src ? corrected : undefined,
      };
    },
  },
  {
    id: "function-too-new",
    errors: ["#NAME?"],
    test(ctx) {
      const xlfn = /_xlfn\./i.test(ctx.src);
      const recent = ctx.calls.filter((c) => NEW_FUNCTIONS.has(c.name)).map((c) => c.name);
      const old = ctx.input.platform === "excel2019" || ctx.input.platform === "libreoffice";
      if (!xlfn && !(old && recent.length)) return null;
      const list = [...new Set(recent)].join(", ");
      return {
        title: "Function not available in this version",
        confidence: 0.85,
        cause: xlfn
          ? "The _xlfn. prefix means the file was saved by a newer Excel and this version does not know the function."
          : `${list} ${recent.length === 1 ? "needs" : "need"} Excel 2021, Microsoft 365 or a recent LibreOffice. Older versions show #NAME?.`,
        fix: "Open the file in Microsoft 365, or rewrite the part with classic functions (INDEX/MATCH instead of XLOOKUP, SUMPRODUCT or helper columns instead of FILTER). The Formula Generator can write the fallback.",
      };
    },
  },
  {
    id: "missing-colon",
    errors: ["#NAME?", "#VALUE!", "#REF!"],
    test(ctx) {
      const hit = ctx.names.find((n) => /^\$?[A-Za-z]{1,3}\$?\d+\$?[A-Za-z]{1,3}\$?\d+$/.test(n.value));
      if (!hit) return null;
      const m = /^(\$?[A-Za-z]{1,3}\$?\d+)(\$?[A-Za-z]{1,3}\$?\d+)$/.exec(hit.value)!;
      const corrected = splice(ctx.src, hit.start, hit.end, `${m[1]}:${m[2]}`);
      return { title: "A range without its colon", confidence: 0.9, cause: `"${hit.value}" looks like the range ${m[1]}:${m[2]} with the colon missing, so it is read as an unknown name.`, fix: "Put a colon between the first and last cell.", corrected: parses(corrected) ? corrected : undefined };
    },
  },
  {
    id: "text-without-quotes",
    errors: ["#NAME?"],
    test(ctx) {
      const hit = ctx.names.find((n) => !ctx.bound.has(n.value.toUpperCase()) && !n.value.includes("!") && n.parent?.type === "binary" && ["=", "<>"].includes(n.parent.op));
      const crit = ctx.names.find((n) => !ctx.bound.has(n.value.toUpperCase()) && n.parent?.type === "call" && ["COUNTIF", "SUMIF", "AVERAGEIF"].includes(n.parent.name) && n.parentArg === 1);
      const target = hit ?? crit;
      if (!target) return null;
      const corrected = splice(ctx.src, target.start, target.end, `"${target.value}"`);
      return {
        title: "Text written without quotes",
        confidence: 0.75,
        cause: `${target.value} is compared like a value but has no quotes, so the spreadsheet looks for a named range called ${target.value} and shows #NAME? when there is none.`,
        fix: `Put text in double quotes: "${target.value}".`,
        corrected: parses(corrected) ? corrected : undefined,
      };
    },
  },
  {
    id: "undefined-name",
    errors: ["#NAME?"],
    test(ctx) {
      const names = ctx.names.filter((n) => !ctx.bound.has(n.value.toUpperCase()) && !/^\$?[A-Za-z]{1,3}\$?\d+\$?[A-Za-z]{1,3}\$?\d+$/.test(n.value));
      if (!names.length) return null;
      const list = [...new Set(names.map((n) => n.value))].slice(0, 5).join(", ");
      return { title: "Name that may not exist", confidence: 0.5, cause: `${list} ${names.length === 1 ? "is" : "are"} read as named ranges. If no such name is defined in the workbook (Formulas > Name Manager), the result is #NAME?.`, fix: "Define the name, correct its spelling, or replace it with a cell reference or quoted text." };
    },
  },
  {
    id: "literal-ref-error",
    errors: ["#REF!"],
    test(ctx) {
      if (!/#REF!/i.test(ctx.src)) return null;
      return {
        title: "The formula itself contains #REF!",
        confidence: 0.95,
        cause: "A row, column or sheet that the formula pointed to was deleted (or cells were cut and pasted over it), so the spreadsheet replaced the reference with #REF!.",
        fix: "Undo the deletion if you can (Ctrl+Z), or type the correct reference in place of #REF!. The original reference cannot be recovered from the formula.",
      };
    },
  },
  {
    id: "column-index-out-of-range",
    errors: ["#REF!", "#VALUE!"],
    test(ctx) {
      for (const c of callsNamed(ctx, "VLOOKUP", "HLOOKUP")) {
        const area = areaOf(c.args[1]);
        const idx = numberOf(c.args[2]);
        if (!area || idx === null) continue;
        const size = c.name === "VLOOKUP" ? width(area) : height(area);
        const what = c.name === "VLOOKUP" ? "column" : "row";
        if (idx < 1) return { title: `${c.name} ${what} number below 1`, confidence: 0.9, cause: `The ${what} number is ${idx}; ${c.name} counts from 1 (the first ${what} of the table), so it gives #VALUE!.`, fix: `Use 1 for the first ${what} of ${slice(ctx, c.args[1])}.` };
        if (idx > size)
          return {
            title: `${c.name} asks for ${what} ${idx} of a ${size}-${what} table`,
            confidence: 0.92,
            cause: `${slice(ctx, c.args[1])} has only ${plural(size, what)}, but the formula asks for ${what} ${idx}, so ${c.name} returns #REF!.`,
            fix: `Widen the table range so it includes the ${what} you want, or lower the number. ${what === "column" ? "INDEX/MATCH or XLOOKUP avoid counting columns." : ""}`.trim(),
          };
      }
      for (const c of callsNamed(ctx, "INDEX")) {
        const area = areaOf(c.args[0]);
        const row = numberOf(c.args[1]);
        const col = numberOf(c.args[2]);
        if (!area) continue;
        if ((row !== null && row > height(area)) || (col !== null && col > width(area)))
          return { title: "INDEX position outside the range", confidence: 0.85, cause: `${slice(ctx, c.args[0])} has ${plural(height(area), "row")} and ${plural(width(area), "column")}; the row or column number points outside it, which gives #REF!.`, fix: "Use a position inside the range, or make the range bigger." };
      }
      return null;
    },
  },
  {
    id: "indirect-text-reference",
    errors: ["#REF!"],
    test(ctx) {
      const c = callsNamed(ctx, "INDIRECT", "OFFSET")[0];
      if (!c) return null;
      return c.name === "INDIRECT"
        ? { title: "INDIRECT builds an address that does not exist", confidence: 0.6, cause: "INDIRECT turns text into a reference. If the text names a sheet that does not exist, misses the quotes around a sheet name with spaces, or is not a valid address, the result is #REF!.", fix: `Check the text it builds; for sheet names with spaces use INDIRECT("'"&B1&"'!A1"). INDIRECT does not work on closed workbooks.` }
        : { title: "OFFSET moves outside the sheet", confidence: 0.55, cause: "OFFSET moves the starting cell by a number of rows and columns; a move above row 1 or left of column A gives #REF!.", fix: "Check the rows and cols arguments, especially negative values." };
    },
  },
  {
    id: "approximate-match",
    errors: ["#N/A"],
    test(ctx) {
      let corrected = ctx.src;
      const changes: string[] = [];
      const calls = [...callsNamed(ctx, "VLOOKUP", "HLOOKUP", "MATCH")].sort((a, b) => b.start - a.start);
      for (const c of calls) {
        const isMatch = c.name === "MATCH";
        const pos = isMatch ? 2 : 3;
        const arg = c.args[pos];
        const exact = isMatch ? "0" : "FALSE";
        if (c.args.length === pos) {
          corrected = splice(corrected, c.end - 1, c.end - 1, `,${exact}`);
          changes.push(`${c.name} has no ${isMatch ? "match_type" : "range_lookup"} argument`);
        } else if (arg && ((arg.type === "bool" && arg.value === "TRUE") || (arg.type === "number" && arg.value === "1"))) {
          corrected = splice(corrected, arg.start, arg.end, exact);
          changes.push(`${c.name} is set to approximate match`);
        }
      }
      if (!changes.length) return null;
      return {
        title: "Lookup in approximate-match mode",
        confidence: 0.7,
        cause: `${changes.join("; ")}. Approximate match expects the first column sorted in ascending order and returns #N/A (or a wrong row) when it is not.`,
        fix: "Ask for an exact match: FALSE as the last VLOOKUP/HLOOKUP argument, 0 for MATCH.",
        corrected: corrected !== ctx.src && parses(corrected) ? corrected : undefined,
      };
    },
  },
  {
    id: "number-stored-as-text",
    errors: ["#N/A", "#VALUE!"],
    test(ctx) {
      const lookups = ctx.calls.filter((c) => LOOKUPS.has(c.name));
      const quotedNumber = lookups.map((c) => c.args[0]).find((a) => a?.type === "string" && /^-?\d+(\.\d+)?$/.test(a.value));
      if (quotedNumber) {
        const corrected = splice(ctx.src, quotedNumber.start, quotedNumber.end, quotedNumber.type === "string" ? quotedNumber.value : "");
        return { title: "A number written as text", confidence: 0.8, cause: `The lookup value ${slice(ctx, quotedNumber)} is text in quotes. If the list holds real numbers, the text never matches and the result is #N/A.`, fix: "Remove the quotes so the value is a number (or keep them if your list really holds text numbers).", corrected: parses(corrected) ? corrected : undefined };
      }
      if (ctx.input.error === "#N/A" && lookups.length)
        return { title: "Numbers stored as text (or the reverse)", confidence: 0.55, cause: "The value looks the same but one side is a number and the other is text (cells with a green triangle, values imported from CSV, or IDs with leading zeros). A lookup treats 123 and \"123\" as different, so it returns #N/A.", fix: "Convert the column with Data > Text to Columns, or match like for like: VALUE(A2) when the list holds numbers, A2&\"\" when it holds text." };
      const math = binaries(ctx, ["+", "-", "*", "/", "^"]).some((b) => b.left.type === "ref" || b.right.type === "ref");
      if (ctx.input.error === "#VALUE!" && math)
        return { title: "A cell in the calculation holds text", confidence: 0.6, cause: "Arithmetic (+ - * /) on a cell that holds text, a space, or a number stored as text with extra characters gives #VALUE!. Cells can look like numbers and still be text.", fix: "Check each cell the formula uses with ISTEXT(); clean them with VALUE() or Text to Columns. SUM(A1:A3) skips text where A1+A2+A3 fails." };
      return null;
    },
  },
  {
    id: "text-in-arithmetic",
    errors: ["#VALUE!"],
    test(ctx) {
      const b = binaries(ctx, ["+", "-", "*", "/", "^"]).find((x) => (x.left.type === "string" && !/^-?\d+(\.\d+)?$/.test(x.left.value)) || (x.right.type === "string" && !/^-?\d+(\.\d+)?$/.test(x.right.value)));
      if (!b) return null;
      return { title: "Text used in arithmetic", confidence: 0.9, cause: `${slice(ctx, b)} does arithmetic on a text value, which gives #VALUE!.`, fix: "Use & to join text, or replace the text with a number." };
    },
  },
  {
    id: "lookup-extra-spaces",
    errors: ["#N/A"],
    test(ctx) {
      if (!ctx.calls.some((c) => LOOKUPS.has(c.name))) return null;
      return { title: "Extra spaces or invisible characters", confidence: 0.45, cause: "A trailing space, a non-breaking space (from web pages) or a line break makes \"North \" different from \"North\", so the lookup returns #N/A.", fix: "Clean the data with TRIM (and SUBSTITUTE(A2,CHAR(160),\"\") for non-breaking spaces), or look up TRIM(A2)." };
    },
  },
  {
    id: "value-not-in-list",
    errors: ["#N/A"],
    test(ctx) {
      if (!ctx.calls.some((c) => LOOKUPS.has(c.name))) return null;
      return { title: "The value really is not in the list", confidence: 0.35, cause: "#N/A is the honest answer when the lookup value does not exist in the search range, for example a new product code.", fix: "Check that the search range covers every row (a fixed range such as A2:A100 misses rows added below). If missing values are expected, IFNA(…, \"Not found\") can label them once the lookup itself is right." };
    },
  },
  {
    id: "misaligned-ranges",
    errors: ["#N/A", "#VALUE!", "#REF!"],
    test(ctx) {
      for (const c of callsNamed(ctx, "XLOOKUP")) {
        const a = areaOf(c.args[1]);
        const b = areaOf(c.args[2]);
        if (a && b && height(a) !== height(b) && width(a) === 1 && width(b) >= 1)
          return { title: "XLOOKUP ranges of different sizes", confidence: 0.9, cause: `lookup_array ${slice(ctx, c.args[1])} has ${plural(height(a), "row")} but return_array ${slice(ctx, c.args[2])} has ${plural(height(b), "row")}; XLOOKUP needs them the same size and gives #VALUE!.`, fix: "Make both ranges start and end on the same rows." };
      }
      for (const idx of callsNamed(ctx, "INDEX")) {
        const m = idx.args[1];
        if (m?.type !== "call" || m.name !== "MATCH") continue;
        const a = areaOf(idx.args[0]);
        const b = areaOf(m.args[1]);
        if (a && b && width(b) === 1 && (a.r1 !== b.r1 || height(a) !== height(b)))
          return { title: "INDEX and MATCH ranges do not line up", confidence: 0.8, cause: `INDEX uses ${slice(ctx, idx.args[0])} (rows ${a.r1}–${a.r2 === MAX_ROW ? "end" : a.r2}) but MATCH searches ${slice(ctx, m.args[1])} (rows ${b.r1}–${b.r2 === MAX_ROW ? "end" : b.r2}). MATCH returns a position in its own range, so INDEX returns the wrong row or #REF!.`, fix: "Use ranges that start on the same row and have the same height." };
      }
      return null;
    },
  },
  {
    id: "mismatched-sizes",
    errors: ["#VALUE!"],
    test(ctx) {
      for (const c of callsNamed(ctx, "SUMIFS", "COUNTIFS", "AVERAGEIFS", "MAXIFS", "MINIFS", "SUMIF", "AVERAGEIF")) {
        const rangeArgs = c.name === "COUNTIFS" ? c.args.filter((_, i) => i % 2 === 0) : c.name === "SUMIF" || c.name === "AVERAGEIF" ? [c.args[0], c.args[2]].filter(Boolean) : [c.args[0], ...c.args.filter((_, i) => i % 2 === 1)];
        const areas = rangeArgs.map(areaOf).filter((a): a is Area => !!a);
        if (areas.length > 1 && areas.some((a) => height(a) !== height(areas[0]) || width(a) !== width(areas[0])))
          return { title: `${c.name} ranges of different sizes`, confidence: c.name.endsWith("S") ? 0.9 : 0.5, cause: `The ranges given to ${c.name} (${rangeArgs.map((r) => slice(ctx, r)).join(", ")}) are not the same size. ${c.name.endsWith("S") ? "This gives #VALUE!." : "SUMIF quietly resizes them, which can add the wrong cells."}`, fix: "Make every range cover the same rows and the same number of columns." };
      }
      for (const c of callsNamed(ctx, "SUMPRODUCT")) {
        const areas = c.args.map(areaOf).filter((a): a is Area => !!a);
        if (areas.length > 1 && areas.some((a) => height(a) !== height(areas[0]) || width(a) !== width(areas[0])))
          return { title: "SUMPRODUCT arrays of different sizes", confidence: 0.9, cause: "SUMPRODUCT multiplies arrays item by item; arrays of different sizes give #VALUE!.", fix: "Make every array cover the same rows and columns." };
      }
      return null;
    },
  },
  {
    id: "old-excel-array-entry",
    errors: ["#VALUE!"],
    test(ctx) {
      if (ctx.input.platform !== "excel2019") return null;
      const b = binaries(ctx, ["+", "-", "*", "/", "=", ">", "<", ">=", "<=", "<>", "&"]).find((x) => [x.left, x.right].some((s) => {
        const a = areaOf(s);
        return !!a && (height(a) > 1 || width(a) > 1);
      }));
      if (!b || callsNamed(ctx, "SUMPRODUCT").length) return null;
      return { title: "Range calculation needs array entry in Excel 2019", confidence: 0.6, cause: `${slice(ctx, b)} works on a whole range. Excel 2019 and older only calculate it as an array when the formula is confirmed with Ctrl+Shift+Enter; otherwise it gives #VALUE! or a single value.`, fix: "Confirm the formula with Ctrl+Shift+Enter (braces appear around it), or wrap the calculation in SUMPRODUCT." };
    },
  },
  {
    id: "date-as-text",
    errors: ["#VALUE!"],
    test(ctx) {
      const c = callsNamed(ctx, "DATEVALUE", "TIMEVALUE", "DATEDIF", "NETWORKDAYS", "WORKDAY", "EDATE", "EOMONTH", "YEAR", "MONTH", "DAY", "WEEKDAY")[0];
      if (!c) return null;
      return { title: "A date that is really text", confidence: 0.55, cause: `${c.name} needs a real date. A date typed in another format than your locale (03/25/2026 on a day-first system) or imported as text gives #VALUE!.`, fix: "Check with ISNUMBER(cell): real dates are numbers. Convert text dates with DATE(year, month, day) or Data > Text to Columns." };
    },
  },
  {
    id: "division-by-empty",
    errors: ["#DIV/0!"],
    test(ctx) {
      const divs = binaries(ctx, ["/"]);
      if (!divs.length) return null;
      const d = divs[0];
      const divisor = slice(ctx, d.right);
      const simple = divs.length === 1 && (d.right.type === "ref" || (d.right.type === "call" && ["SUM", "COUNT", "COUNTA", "COUNTIF", "COUNTIFS", "SUMIF", "SUMIFS"].includes(d.right.name)));
      const top = ctx.ast && ctx.ast.type !== "call" ? true : ctx.ast?.type === "call" && !["IF", "IFERROR", "IFNA"].includes(ctx.ast.name);
      const body = ctx.src.replace(/^\s*=/, "");
      const corrected = simple && top ? `=IF(${divisor}=0,"",${body})` : undefined;
      return {
        title: "Division by an empty cell or zero",
        confidence: 0.85,
        cause: `The formula divides by ${divisor}. When that is empty or 0 (for example a month with no sales yet), the result is #DIV/0!.`,
        fix: `Make sure ${divisor} has a value, or test it first so the cell stays blank until it does.`,
        corrected: corrected && parses(corrected) ? corrected : undefined,
      };
    },
  },
  {
    id: "average-of-nothing",
    errors: ["#DIV/0!"],
    test(ctx) {
      const c = callsNamed(ctx, "AVERAGE", "AVERAGEIF", "AVERAGEIFS", "AVERAGEA")[0];
      if (!c) return null;
      return { title: `${c.name} found no numbers`, confidence: 0.8, cause: c.name === "AVERAGE" || c.name === "AVERAGEA" ? "AVERAGE divides by the count of numbers; when the range holds no numbers (empty, or numbers stored as text), it gives #DIV/0!." : `${c.name} found no rows that meet the conditions, so it divides by zero.`, fix: "Check the range and the conditions (spelling, spaces, dates stored as text). COUNTIFS with the same conditions tells you how many rows match." };
    },
  },
  {
    id: "null-intersection",
    errors: ["#NULL!"],
    test(ctx) {
      const b = binaries(ctx, [" "])[0];
      if (!b) return { title: "Ranges that do not overlap", confidence: 0.4, cause: "#NULL! means an intersection of two ranges that share no cell, usually caused by a space where a comma or colon was meant.", fix: "Look for a space between two references and replace it with a comma (two separate ranges) or a colon (one range)." };
      const corrected = splice(ctx.src, b.left.end, b.right.start, ",");
      return { title: "A space between two ranges", confidence: 0.9, cause: `${slice(ctx, b)} has a space between two references. A space is the intersection operator, and these ranges share no cell, so the result is #NULL!.`, fix: "Use a comma to include both ranges (or a colon for one continuous range).", corrected: parses(corrected) ? corrected : undefined };
    },
  },
  {
    id: "num-invalid-math",
    errors: ["#NUM!"],
    test(ctx) {
      const iter = callsNamed(ctx, "IRR", "XIRR", "RATE")[0];
      if (iter) return { title: `${iter.name} did not find an answer`, confidence: 0.75, cause: `${iter.name} searches for the rate by trial; it gives #NUM! when it does not converge after its attempts, often because the cash flows have no sign change (all positive or all negative).`, fix: `Check that the values include at least one negative and one positive amount, and give a guess argument such as 0.1.` };
      const math = callsNamed(ctx, "SQRT", "LOG", "LN", "LOG10")[0];
      if (math) return { title: `${math.name} of a negative number or zero`, confidence: 0.7, cause: `${math.name} has no real result for negative numbers${math.name === "SQRT" ? "" : " or zero"}, so it gives #NUM!.`, fix: "Check the sign of the value, or use ABS() if the sign does not matter." };
      const dd = callsNamed(ctx, "DATEDIF")[0];
      if (dd && dd.args.length >= 2) {
        const corrected = splice(splice(ctx.src, dd.args[1].start, dd.args[1].end, slice(ctx, dd.args[0])), dd.args[0].start, dd.args[0].end, slice(ctx, dd.args[1]));
        return { title: "DATEDIF start date after end date", confidence: 0.7, cause: "DATEDIF gives #NUM! when the start date is later than the end date.", fix: "Swap the two dates (only if the order is the problem).", corrected: parses(corrected) ? corrected : undefined };
      }
      return { title: "A number too large or an impossible argument", confidence: 0.35, cause: "#NUM! means a result too big for the spreadsheet (over about 1E+308) or an argument outside what the function accepts.", fix: "Check each numeric argument against the function's allowed range." };
    },
  },
  {
    id: "spill-blocked",
    errors: ["#SPILL!"],
    test(ctx) {
      const dyn = ctx.calls.find((c) => DYNAMIC.has(c.name));
      const rangeMath = binaries(ctx, ["+", "-", "*", "/", "&", "=", ">", "<"]).some((b) => [b.left, b.right].some((s) => {
        const a = areaOf(s);
        return !!a && (height(a) > 1 || width(a) > 1);
      }));
      if (!dyn && !rangeMath) return { title: "Spill range is not empty", confidence: 0.5, cause: "The formula returns several values that spill into the cells below or to the right, and one of those cells is not empty.", fix: "Select the formula cell, look at the dashed border, and clear the cells inside it." };
      return { title: "Spill range is not empty", confidence: 0.8, cause: `${dyn ? dyn.name : "The range calculation"} returns several values that spill into the cells below or to the right. A value, a space or a merged cell in that area blocks it.`, fix: "Clear (or unmerge) the cells inside the dashed spill border, or move the formula to an empty area." };
    },
  },
  {
    id: "spill-whole-column",
    errors: ["#SPILL!"],
    test(ctx) {
      const r = refs(ctx).find((x) => {
        const a = parseArea(x.value);
        return a && height(a) === MAX_ROW;
      });
      if (!r) return null;
      return { title: "Whole-column reference spills too far", confidence: 0.75, cause: `${r.value} covers all 1,048,576 rows. A formula placed below row 1 cannot spill that many results, so Excel shows #SPILL! (the spill range is too big).`, fix: "Use a bounded range such as A2:A1000, an Excel table column, or the trim-range reference A:.A in Microsoft 365." };
    },
  },
  {
    id: "spill-in-table",
    errors: ["#SPILL!"],
    test(ctx) {
      if (!/\w\[|\[@/.test(ctx.src)) return null;
      return { title: "Spilling inside an Excel table", confidence: 0.5, cause: "Dynamic-array formulas cannot spill inside an Excel table, so they show #SPILL! there.", fix: "Move the formula outside the table, or convert the table to a normal range (Table Design > Convert to Range)." };
    },
  },
  {
    id: "column-too-narrow",
    errors: ["###"],
    test() {
      return { title: "The column is too narrow", confidence: 0.8, cause: "### is not an error value: the result is a number or date that does not fit the column width.", fix: "Double-click the right edge of the column header to widen it, or choose a shorter number format." };
    },
  },
  {
    id: "negative-date-time",
    errors: ["###"],
    test(ctx) {
      const sub = binaries(ctx, ["-"]);
      const dateish = ctx.calls.some((c) => ["TODAY", "NOW", "DATE", "TIME", "EDATE", "EOMONTH"].includes(c.name));
      if (!sub.length) return null;
      return { title: "A negative date or time", confidence: dateish ? 0.75 : 0.55, cause: "Dates and times cannot be negative in Excel's 1900 date system. A subtraction such as end − start with the end earlier than the start shows ### in a date or time format.", fix: "Swap the order of the subtraction, use ABS(), or MOD(end-start,1) for times that pass midnight." };
    },
  },
  {
    id: "self-reference",
    errors: ["circular"],
    test(ctx) {
      const cell = cellArea(ctx.input.cell);
      if (!cell) return null;
      const r = refs(ctx).find((x) => {
        const a = parseArea(x.value);
        return a && (a.sheet === null || cell.sheet === a.sheet) && contains(a, cell);
      });
      if (!r) return null;
      return { title: "The formula refers to its own cell", confidence: 0.95, cause: `The formula is in ${ctx.input.cell!.toUpperCase()} and ${r.value} includes that cell, so it depends on its own result.`, fix: `Change the range so it stops before ${ctx.input.cell!.toUpperCase()} (for example a total in row 11 should sum rows 2 to 10), or move the formula outside the range.` };
    },
  },
  {
    id: "whole-column-circular",
    errors: ["circular"],
    test(ctx) {
      const cell = cellArea(ctx.input.cell);
      const r = refs(ctx).find((x) => {
        const a = parseArea(x.value);
        return a && height(a) === MAX_ROW;
      });
      if (!r || cell) return null;
      return { title: "Whole-column reference may include the formula", confidence: 0.6, cause: `${r.value} covers every row of the column. If the formula sits in that column, it includes itself.`, fix: "Move the formula to another column, or use a bounded range such as A2:A1000." };
    },
  },
  {
    id: "circular-chain",
    errors: ["circular"],
    test(ctx) {
      // Only when no direct self-reference explains it.
      if (RULES.find((r) => r.id === "self-reference")!.test(ctx)) return null;
      return { title: ctx.input.cell ? "Circular reference through other cells" : "Circular reference: which cell is it in?", confidence: ctx.input.cell ? 0.4 : 0.3, cause: ctx.input.cell ? "No reference in this formula points at its own cell directly, so the loop goes through another cell that refers back to this one." : "A circular reference means the formula depends on its own result, directly or through other cells. Enter the formula's cell above to check for a direct self-reference.", fix: "Use Formulas > Error Checking > Circular References to jump to each cell in the loop, and break it where a total includes itself." };
    },
  },
];

// ------------------------------------------------------------------ engine

export function buildContext(input: DebugInput): Ctx {
  const src = input.formula;
  let ast: Node | null = null;
  let parseError: Ctx["parseError"] = null;
  try {
    ast = parseFormula(src).ast;
  } catch (e) {
    if (!(e instanceof FormulaSyntaxError)) throw e;
    parseError = { message: e.message, pos: e.pos };
  }
  const calls = ast ? functionCalls(ast).map((c) => c.node) : [];
  const names: Ctx["names"] = [];
  if (ast) {
    const stack: [Node, Node | null, number][] = [[ast, null, -1]];
    while (stack.length) {
      const [n, parent, idx] = stack.pop()!;
      if (n.type === "name") names.push({ value: n.value, start: n.start, end: n.end, parent, parentArg: idx });
      const kids = n.type === "call" ? n.args : n.type === "binary" ? [n.left, n.right] : n.type === "unary" || n.type === "postfix" ? [n.operand] : n.type === "group" ? n.inner : n.type === "invoke" ? [n.callee, ...n.args] : [];
      kids.forEach((k, i) => stack.push([k, n, i]));
    }
  }
  return { input, src, ast, parseError, calls, check: checkFormula(src, input.platform), names, bound: ast ? boundNames(ast) : new Set() };
}

export interface RankedFinding extends Finding {
  /** Ranking score: confidence, halved for rules that do not usually cause the chosen error. */
  score: number;
  level: "High" | "Medium" | "Low";
  matchesError: boolean;
}

export function diagnose(input: DebugInput): RankedFinding[] {
  const ctx = buildContext(input);
  const out: RankedFinding[] = [];
  for (const rule of RULES) {
    const applies = rule.errors === "any" || rule.errors.includes(input.error);
    // Error-specific rules only run for their errors; "any" rules always run.
    if (!applies) continue;
    const hit = rule.test(ctx);
    if (!hit) continue;
    const score = hit.confidence;
    out.push({ id: rule.id, ...hit, score, level: score >= 0.75 ? "High" : score >= 0.5 ? "Medium" : "Low", matchesError: rule.errors !== "any" });
  }
  return out.sort((a, b) => b.score - a.score || RULES.findIndex((r) => r.id === a.id) - RULES.findIndex((r) => r.id === b.id));
}

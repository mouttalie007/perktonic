// Deterministic checks that run on every formula before it is shown (never trust the model for these).

import names from "./functionNames.json";
import { boundNames, functionCalls, parseFormula } from "./parse";
import { segments, separatorStyle } from "./separators";
import { FormulaSyntaxError } from "./tokenize";

export type Platform = "excel365" | "excel2019" | "sheets" | "libreoffice";

export const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "excel365", label: "Excel 365 / 2021" },
  { id: "excel2019", label: "Excel 2019 or older" },
  { id: "sheets", label: "Google Sheets" },
  { id: "libreoffice", label: "LibreOffice Calc" },
];

const LIST: Record<Platform, keyof typeof names> = { excel365: "excel", excel2019: "excel", sheets: "sheets", libreoffice: "libreoffice" };
const SETS: Record<keyof typeof names, Set<string>> = {
  excel: new Set(names.excel),
  sheets: new Set(names.sheets),
  libreoffice: new Set(names.libreoffice),
};

/**
 * Dynamic-array and other recent functions: missing from Excel 2019 and older, and only in recent
 * LibreOffice releases (24.8 for the first group, 25.8 for the second), when LibreOffice has them at all.
 */
const NEW_LO_248 = ["FILTER", "SORT", "SORTBY", "UNIQUE", "SEQUENCE", "RANDARRAY", "XLOOKUP", "XMATCH", "LET"];
const NEW_LO_258 = ["VSTACK", "HSTACK", "TOCOL", "TOROW", "CHOOSECOLS", "CHOOSEROWS", "WRAPROWS", "WRAPCOLS", "TAKE", "DROP", "EXPAND", "TEXTSPLIT", "TEXTBEFORE", "TEXTAFTER"];
const NEW_NOT_IN_LO = ["LAMBDA", "MAP", "REDUCE", "SCAN", "MAKEARRAY", "BYROW", "BYCOL", "ISOMITTED", "GROUPBY", "PIVOTBY", "PERCENTOF", "TRIMRANGE", "VALUETOTEXT", "ARRAYTOTEXT", "REGEXTEST", "REGEXEXTRACT", "REGEXREPLACE", "IMAGE", "STOCKHISTORY"];
export const NEW_FUNCTIONS = new Set([...NEW_LO_248, ...NEW_LO_258, ...NEW_NOT_IN_LO]);

export function isKnownFunction(name: string, platform: Platform): boolean {
  return SETS[LIST[platform]].has(name.toUpperCase());
}

export function knownFunctions(platform: Platform): string[] {
  return names[LIST[platform]];
}

export interface BalanceIssue {
  kind: "paren-missing" | "paren-extra" | "quote-open" | "sheet-quote-open" | "brace" | "bracket";
  pos: number;
  count: number;
  text: string;
}

/** Brackets, braces and quotes, counted outside text. Works on broken formulas too. */
export function checkBalance(src: string): BalanceIssue[] {
  const issues: BalanceIssue[] = [];
  const parens: number[] = [];
  let braces = 0;
  let bracketDepth = 0;
  let extraParens = 0;
  let firstExtra = -1;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      let closed = false;
      for (; j < src.length; j++) {
        if (src[j] === c) {
          if (src[j + 1] === c) {
            j++;
            continue;
          }
          closed = true;
          break;
        }
      }
      if (!closed) {
        issues.push(
          c === '"'
            ? { kind: "quote-open", pos: i, count: 1, text: `The text that starts at position ${i + 1} has no closing double quote (").` }
            : { kind: "sheet-quote-open", pos: i, count: 1, text: `The quote (') at position ${i + 1} is never closed. Sheet names with spaces are written 'My Sheet'!A1.` },
        );
        break;
      }
      i = j;
      continue;
    }
    if (c === "(") parens.push(i);
    else if (c === ")") {
      if (parens.length) parens.pop();
      else {
        extraParens++;
        if (firstExtra < 0) firstExtra = i;
      }
    } else if (c === "{") braces++;
    else if (c === "}") braces--;
    else if (c === "[") bracketDepth++;
    else if (c === "]") bracketDepth--;
  }
  if (parens.length) issues.push({ kind: "paren-missing", pos: parens[0], count: parens.length, text: `${parens.length} opening bracket${parens.length === 1 ? " is" : "s are"} never closed: add ${parens.length === 1 ? "a" : parens.length} ")".` });
  if (extraParens) issues.push({ kind: "paren-extra", pos: firstExtra, count: extraParens, text: `${extraParens === 1 ? "There is one" : `There are ${extraParens}`} ")" too many; the first is at position ${firstExtra + 1}.` });
  if (braces !== 0) issues.push({ kind: "brace", pos: Math.max(0, src.indexOf(braces > 0 ? "{" : "}")), count: Math.abs(braces), text: "The curly braces { } of an array constant do not pair up." });
  if (bracketDepth !== 0) issues.push({ kind: "bracket", pos: Math.max(0, src.indexOf(bracketDepth > 0 ? "[" : "]")), count: Math.abs(bracketDepth), text: "The square brackets [ ] of a table reference do not pair up." });
  return issues;
}

/** Names followed by "(" outside text, used when the formula does not parse. */
function callsByScan(src: string): string[] {
  const out: string[] = [];
  for (const s of segments(src)) {
    if (!s.code) continue;
    for (const m of s.text.matchAll(/(?:^|[^\w.$!])([A-Za-z_][\w.]*)\s*\(/g)) out.push(m[1].replace(/^(?:_xlfn\.|_xlws\.)/i, "").toUpperCase());
  }
  return out;
}

export interface FormulaWarning {
  id: "syntax" | "unverified" | "brackets" | "quotes" | "separator" | "new-function";
  text: string;
}

export interface FormulaCheck {
  formula: string;
  parseError: { message: string; pos: number } | null;
  functions: string[];
  unknownFunctions: string[];
  newFunctions: string[];
  balance: BalanceIssue[];
  separator: ReturnType<typeof separatorStyle>;
  warnings: FormulaWarning[];
}

function newFunctionNote(fn: string, platform: Platform): string | null {
  if (!NEW_FUNCTIONS.has(fn)) return null;
  if (platform === "excel2019") return `${fn} needs Excel 2021 or Microsoft 365; Excel 2019 and older show #NAME?.`;
  if (platform === "libreoffice") {
    if (NEW_LO_248.includes(fn)) return `${fn} needs LibreOffice 24.8 or newer.`;
    if (NEW_LO_258.includes(fn)) return `${fn} needs LibreOffice 25.8 or newer.`;
    return `${fn} is not available in LibreOffice Calc.`;
  }
  return null;
}

export function checkFormula(formula: string, platform: Platform): FormulaCheck {
  const warnings: FormulaWarning[] = [];
  let parseError: FormulaCheck["parseError"] = null;
  let calls: string[];
  let bound = new Set<string>();
  try {
    const { ast } = parseFormula(formula);
    calls = functionCalls(ast).map((c) => c.name);
    bound = boundNames(ast);
  } catch (e) {
    if (!(e instanceof FormulaSyntaxError)) throw e;
    parseError = { message: e.message, pos: e.pos };
    calls = callsByScan(formula);
  }
  const functions = [...new Set(calls)];
  const unknownFunctions = functions.filter((f) => !bound.has(f) && !isKnownFunction(f, platform));
  const newFunctions = functions.filter((f) => (platform === "excel2019" || platform === "libreoffice") && NEW_FUNCTIONS.has(f));
  const balance = checkBalance(formula);
  const separator = separatorStyle(formula);

  for (const b of balance) warnings.push({ id: b.kind.includes("quote") ? "quotes" : "brackets", text: b.text });
  if (parseError && balance.length === 0) warnings.push({ id: "syntax", text: `The formula does not parse: ${parseError.message}` });
  if (unknownFunctions.length) {
    const label = PLATFORMS.find((p) => p.id === platform)!.label;
    warnings.push({
      id: "unverified",
      text: `Unverified: ${unknownFunctions.join(", ")} ${unknownFunctions.length === 1 ? "is" : "are"} not in our list of ${label} functions. It may be a typo, a function from another app, or a custom function (a LAMBDA name or a macro) that must exist in your file.`,
    });
  }
  for (const fn of newFunctions) {
    const note = newFunctionNote(fn, platform);
    if (note) warnings.push({ id: "new-function", text: note });
  }
  if (separator === "mixed") warnings.push({ id: "separator", text: "The formula mixes commas and semicolons between arguments; use one kind only." });
  else if (separator === "semicolon") warnings.push({ id: "separator", text: "The formula separates arguments with semicolons, which only works in spreadsheets set to a locale that uses semicolons." });
  return { formula, parseError, functions, unknownFunctions, newFunctions, balance, separator, warnings };
}

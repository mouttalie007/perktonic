/** Excel's own limit for the length of a formula. */
export const MAX_FORMULA_LENGTH = 8192;

export type Node =
  | { kind: "call"; name: string; args: Node[]; start: number; end: number }
  | { kind: "leaf"; type: "number" | "string" | "bool" | "error" | "ref" | "name" | "array"; text: string; start: number; end: number }
  | { kind: "empty"; start: number; end: number }
  | { kind: "expr"; parts: Node[]; start: number; end: number };

export class FormulaError extends Error {
  constructor(
    message: string,
    public readonly position: number,
  ) {
    super(message);
  }
}

type Tok = { t: "num" | "str" | "bool" | "err" | "ref" | "name" | "func" | "array" | "op" | "(" | ")" | "sep"; text: string; start: number; end: number };

// A1 references, optionally with a sheet ('My Sheet'!A1 or Sheet1!A:A), whole columns (A:C) and whole rows (2:10).
const REF = "(?:(?:'(?:[^']|'')+'|[A-Za-z_][\\w.]*)!)?(?:\\$?[A-Za-z]{1,3}\\$?\\d+(?::\\$?[A-Za-z]{1,3}\\$?\\d+)?|\\$?[A-Za-z]{1,3}:\\$?[A-Za-z]{1,3}|\\$?\\d+:\\$?\\d+)";
const REF_RE = new RegExp(`^${REF}`);
const ERRORS = ["#NULL!", "#DIV/0!", "#VALUE!", "#REF!", "#NAME?", "#NUM!", "#N/A", "#GETTING_DATA", "#SPILL!", "#CALC!"];

/** Detects whether arguments are separated by ";" (many European locales) rather than ",". */
export function detectSeparator(formula: string): "," | ";" {
  let inStr = false;
  let depth = 0;
  let commas = 0;
  let semis = 0;
  for (const ch of formula) {
    if (ch === "\"") inStr = !inStr;
    if (inStr) continue;
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (depth === 0 && ch === ",") commas++;
    else if (depth === 0 && ch === ";") semis++;
  }
  return semis > 0 && commas === 0 ? ";" : ",";
}

function tokenize(src: string, sep: "," | ";"): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const start = i;
    if (ch === "\"") {
      i++;
      for (;;) {
        if (i >= src.length) throw new FormulaError("A text value is missing its closing quote (\").", start);
        if (src[i] === "\"" && src[i + 1] === "\"") i += 2;
        else if (src[i] === "\"") {
          i++;
          break;
        } else i++;
      }
      toks.push({ t: "str", text: src.slice(start, i), start, end: i });
      continue;
    }
    if (ch === "{") {
      const close = src.indexOf("}", i);
      if (close < 0) throw new FormulaError("An array constant is missing its closing }.", start);
      i = close + 1;
      toks.push({ t: "array", text: src.slice(start, i), start, end: i });
      continue;
    }
    if (ch === "#") {
      const err = ERRORS.find((e) => src.toUpperCase().startsWith(e, i));
      if (!err) throw new FormulaError(`“${src.slice(i, i + 8)}” is not a known error value.`, start);
      i += err.length;
      toks.push({ t: "err", text: src.slice(start, i), start, end: i });
      continue;
    }
    if (ch === "(" || ch === ")") {
      toks.push({ t: ch, text: ch, start, end: i + 1 });
      i++;
      continue;
    }
    if (ch === sep) {
      toks.push({ t: "sep", text: ch, start, end: i + 1 });
      i++;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === "<>" || two === "<=" || two === ">=") {
      toks.push({ t: "op", text: two, start, end: i + 2 });
      i += 2;
      continue;
    }
    if ("+-*/^&=<>%".includes(ch)) {
      toks.push({ t: "op", text: ch, start, end: i + 1 });
      i++;
      continue;
    }
    const rest = src.slice(i);
    const ref = REF_RE.exec(rest);
    // A reference must not run straight into more name characters (e.g. "A1B" or "LOG10(").
    if (ref && !/^[\w.([]/.test(rest.slice(ref[0].length))) {
      i += ref[0].length;
      toks.push({ t: "ref", text: ref[0], start, end: i });
      continue;
    }
    const num = /^(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:[eE][-+]?\d+)?/.exec(rest);
    if (num && !(sep === "," && num[0].includes(","))) {
      i += num[0].length;
      toks.push({ t: "num", text: num[0], start, end: i });
      continue;
    }
    // Names, functions (including _xlfn. prefixes) and structured references like Table1[Price] or Table1[[#Data],[Price]].
    const name = /^(?:_xlfn\.|_xlws\.)?[A-Za-z_\\][\w.]*(?:\[(?:[^\][]|\[[^\]]*\])*\])?/.exec(rest);
    if (name) {
      i += name[0].length;
      let j = i;
      while (j < src.length && src[j] === " ") j++;
      const upper = name[0].toUpperCase();
      if (src[j] === "(") toks.push({ t: "func", text: name[0], start, end: i });
      else if (upper === "TRUE" || upper === "FALSE") toks.push({ t: "bool", text: name[0], start, end: i });
      else toks.push({ t: "name", text: name[0], start, end: i });
      continue;
    }
    throw new FormulaError(`Unexpected character “${ch}”.`, start);
  }
  return toks;
}

/**
 * Parses a formula into calls and opaque expressions. Operators are kept as
 * a flat list of parts: the converter only needs to find lookup calls and
 * reuse their arguments verbatim, not to evaluate anything.
 */
export function parseFormula(formula: string, sep: "," | ";" = detectSeparator(formula)): Node {
  if (formula.length > MAX_FORMULA_LENGTH) throw new FormulaError(`The formula is longer than ${MAX_FORMULA_LENGTH} characters, which Excel does not allow.`, 0);
  const offset = formula.trimStart().startsWith("=") ? formula.indexOf("=") + 1 : 0;
  const toks = tokenize(formula.slice(offset), sep).map((t) => ({ ...t, start: t.start + offset, end: t.end + offset }));
  if (toks.length === 0) throw new FormulaError("The formula is empty.", offset);
  let p = 0;

  const expr = (stops: Tok["t"][]): Node => {
    const parts: Node[] = [];
    while (p < toks.length && !stops.includes(toks[p].t)) {
      const tok = toks[p];
      if (tok.t === "func") {
        p++;
        if (toks[p]?.t !== "(") throw new FormulaError(`${tok.text} must be followed by (.`, tok.end);
        p++;
        const args: Node[] = [];
        if (toks[p]?.t === ")") {
          p++;
        } else {
          for (;;) {
            const argStart = toks[p]?.start ?? formula.length;
            if (toks[p]?.t === "sep" || toks[p]?.t === ")") args.push({ kind: "empty", start: argStart, end: argStart });
            else args.push(expr(["sep", ")"]));
            const next = toks[p];
            if (!next) throw new FormulaError(`${tok.text}( is missing its closing parenthesis.`, formula.length);
            p++;
            if (next.t === ")") break;
          }
        }
        parts.push({ kind: "call", name: tok.text.replace(/^_xl(fn|ws)\./i, "").toUpperCase(), args, start: tok.start, end: toks[p - 1].end });
      } else if (tok.t === "(") {
        p++;
        const inner = expr([")"]);
        if (toks[p]?.t !== ")") throw new FormulaError("A parenthesis is not closed.", formula.length);
        p++;
        parts.push({ kind: "expr", parts: [inner], start: tok.start, end: toks[p - 1].end });
      } else if (tok.t === ")") {
        throw new FormulaError("There is a closing parenthesis without an opening one.", tok.start);
      } else if (tok.t === "sep") {
        throw new FormulaError(`Unexpected “${tok.text}” outside a function.`, tok.start);
      } else {
        p++;
        const type = tok.t === "num" ? "number" : tok.t === "str" ? "string" : tok.t === "bool" ? "bool" : tok.t === "err" ? "error" : tok.t === "ref" ? "ref" : tok.t === "array" ? "array" : "name";
        parts.push({ kind: "leaf", type: tok.t === "op" ? "name" : type, text: tok.text, start: tok.start, end: tok.end });
      }
    }
    if (parts.length === 0) {
      const at = toks[p]?.start ?? formula.length;
      return { kind: "empty", start: at, end: at };
    }
    return parts.length === 1 ? parts[0] : { kind: "expr", parts, start: parts[0].start, end: parts[parts.length - 1].end };
  };

  const root = expr([]);
  if (p < toks.length) throw new FormulaError("The formula has extra text after it ends.", toks[p].start);
  return root;
}

export function textOf(formula: string, n: Node): string {
  return formula.slice(n.start, n.end).trim();
}

/** Depth-first search for the outermost call matching the predicate. */
export function findCall(n: Node, pred: (c: Extract<Node, { kind: "call" }>) => boolean): Extract<Node, { kind: "call" }> | null {
  if (n.kind === "call") {
    if (pred(n)) return n;
    for (const a of n.args) {
      const f = findCall(a, pred);
      if (f) return f;
    }
  }
  if (n.kind === "expr") {
    for (const part of n.parts) {
      const f = findCall(part, pred);
      if (f) return f;
    }
  }
  return null;
}

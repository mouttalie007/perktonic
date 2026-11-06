import { MAX_EXPRESSION_CHARS } from "./limits";

export interface Step {
  /** The part of the expression this step describes. */
  code: string;
  text: string;
  /** Nesting level, for steps inside map(), select(), [ … ] and similar. */
  depth: number;
}

export class ExpressionError extends Error {
  constructor(message: string, readonly index: number) {
    super(message);
  }
}

const q = (s: string) => `“${s}”`;

/** Index just after the bracket/paren that closes the one at `open`, skipping quoted strings and /regex/ literals. */
export function matchClose(src: string, open: number): number {
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const stack: string[] = [];
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === "\"") {
      const end = skipString(src, i);
      if (end < 0) throw new ExpressionError(`The quote opened at character ${i + 1} is never closed.`, i);
      i = end - 1;
      continue;
    }
    if (c === "/" && stack.length > 0 && /[(,=!&|:\s]/.test(prevNonSpace(src, i))) {
      // A regex literal such as /^a.*/i inside a filter.
      let j = i + 1;
      while (j < src.length && src[j] !== "/") j += src[j] === "\\" ? 2 : 1;
      if (j < src.length) {
        i = j;
        continue;
      }
    }
    if (c in pairs) stack.push(pairs[c]);
    else if (c === ")" || c === "]" || c === "}") {
      if (stack.pop() !== c) throw new ExpressionError(`${q(c)} at character ${i + 1} does not match an opening bracket.`, i);
      if (stack.length === 0) return i + 1;
    }
  }
  throw new ExpressionError(`${q(src[open])} at character ${open + 1} is never closed.`, open);
}

function prevNonSpace(src: string, i: number): string {
  let j = i - 1;
  while (j >= 0 && /\s/.test(src[j])) j--;
  return j < 0 ? "(" : src[j];
}

/** Index after the closing quote of the string starting at `i`, or -1. */
export function skipString(src: string, i: number): number {
  const quote = src[i];
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === "\\") j++;
    else if (src[j] === quote) return j + 1;
  }
  return -1;
}

function unquote(s: string): string {
  const body = s.slice(1, -1);
  return body.replace(/\\(.)/g, "$1");
}

/** Plain-words version of a JSONPath filter or script such as `@.price < 10 && @.tags`. */
export function describeCondition(expr: string, self = "@"): string {
  const parts: string[] = [];
  let i = 0;
  const src = expr.trim();
  const ops: [string, string][] = [
    ["===", "equals"], ["!==", "is not"], ["==", "equals"], ["!=", "is not"], ["<=", "is at most"], [">=", "is at least"],
    ["<", "is less than"], [">", "is greater than"], ["&&", "and"], ["||", "or"], ["!", "not"],
    ["+", "plus"], ["-", "minus"], ["*", "times"], ["/", "divided by"], ["%", "modulo"],
  ];
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "'" || c === "\"") {
      const end = skipString(src, i);
      if (end < 0) throw new ExpressionError("A quote in the filter is never closed.", i);
      parts.push(`"${unquote(src.slice(i, end))}"`);
      i = end;
      continue;
    }
    if (c === self[0] && src.startsWith(self, i)) {
      let j = i + self.length;
      const word = /^(property|parentProperty|parent|path|root)\b/.exec(src.slice(j));
      if (self === "@" && word) {
        const names: Record<string, string> = { property: "its key or index", parentProperty: "the key of its parent", parent: "its parent", path: "its path", root: "the document root" };
        parts.push(names[word[1]]);
        i = j + word[0].length;
        continue;
      }
      const path: string[] = [];
      for (;;) {
        const dot = /^\.([A-Za-z_$][\w$]*)/.exec(src.slice(j));
        if (dot && src[j + dot[0].length] === "(") {
          // A method call such as .match(/x/) or .includes('a').
          const close = matchClose(src, j + dot[0].length);
          const arg = src.slice(j + dot[0].length + 1, close - 1).trim();
          const subject = path.length ? q(path.join(".")) : "the item";
          const verbs: Record<string, string> = { match: "matches", test: "matches", includes: "includes", startsWith: "starts with", endsWith: "ends with", indexOf: "position of", toLowerCase: "in lower case", toUpperCase: "in upper case" };
          const verb = verbs[dot[1]];
          parts.push(verb ? `${subject} ${verb}${arg ? ` ${arg}` : ""}` : `${subject}.${dot[1]}(${arg})`);
          path.length = 0;
          j = close;
          if (/^\.[A-Za-z_$]/.test(src.slice(j))) continue;
          break;
        }
        if (dot) {
          path.push(dot[1] === "length" && path.length ? "length" : dot[1]);
          j += dot[0].length;
          continue;
        }
        const br = /^\[\s*(['"])/.exec(src.slice(j));
        if (br) {
          const end = skipString(src, j + br[0].length - 1);
          if (end < 0) break;
          path.push(unquote(src.slice(j + br[0].length - 1, end)));
          j = src.indexOf("]", end) + 1;
          continue;
        }
        const idx = /^\[(-?\d+)\]/.exec(src.slice(j));
        if (idx) {
          path.push(`[${idx[1]}]`);
          j += idx[0].length;
          continue;
        }
        break;
      }
      if (path.length) parts.push(path[path.length - 1] === "length" && path.length > 1 ? `the length of ${q(path.slice(0, -1).join("."))}` : q(path.join(".").replace(/\.\[/g, "[")));
      else if (j === i + self.length) parts.push("the item");
      i = Math.max(j, i + 1);
      continue;
    }
    const op = ops.find(([o]) => src.startsWith(o, i));
    if (op) {
      parts.push(op[1]);
      i += op[0].length;
      continue;
    }
    if (c === "(" || c === ")") {
      parts.push(c);
      i++;
      continue;
    }
    if (c === "/") {
      let j = i + 1;
      while (j < src.length && src[j] !== "/") j += src[j] === "\\" ? 2 : 1;
      const flags = /^[a-z]*/.exec(src.slice(j + 1))![0];
      parts.push(`the pattern ${src.slice(i, j + 1 + flags.length)}`);
      i = j + 1 + flags.length;
      continue;
    }
    const tok = /^[^\s()=!<>&|+\-*/%'"]+/.exec(src.slice(i));
    parts.push(tok ? tok[0] : c);
    i += tok ? tok[0].length : 1;
  }
  let words = parts.join(" ").replace(/\( /g, "(").replace(/ \)/g, ")");
  // `@.tags` alone tests whether the value exists and is truthy.
  if (parts.length === 1 && /^“[^”]+”$/.test(parts[0])) words = `${parts[0]} exists and is not empty, 0, false or null`;
  return words.replace(/^not (“[^”]+”)$/, "$1 is missing, empty, 0, false or null");
}

function describeBracket(inner: string, recursive: boolean): string {
  const s = inner.trim();
  const where = recursive ? "at any depth, " : "";
  if (s === "*") return recursive ? "Take every value at every depth below this point." : "Take every item or property value.";
  if (s.startsWith("?(") && s.endsWith(")")) return `${recursive ? "At any depth, keep" : "Keep"} only the items where ${describeCondition(s.slice(2, -1))}.`;
  if (s.startsWith("?")) return `${recursive ? "At any depth, keep" : "Keep"} only the items where ${describeCondition(s.slice(1))}.`;
  if (s.startsWith("(") && s.endsWith(")")) return `${where}Take the item at the index or key computed by ${describeCondition(s.slice(1, -1))}.`;
  const slice = /^(-?\d*)\s*:\s*(-?\d*)(?:\s*:\s*(-?\d*))?$/.exec(s);
  if (slice) {
    const [, a, b, step] = slice;
    const from = a === "" ? "the start" : Number(a) < 0 ? `the ${-Number(a)}${ord(-Number(a))} item from the end` : `index ${a}`;
    const to = b === "" ? "the end" : Number(b) < 0 ? `the ${-Number(b)}${ord(-Number(b))} item from the end (not included)` : `index ${b} (not included)`;
    if (a !== "" && b === "" && Number(a) < 0 && !step) return a === "-1" ? `${where}Take the last item.` : `${where}Take the last ${-Number(a)} items.`;
    if (a === "" && b !== "" && Number(b) > 0 && !step) return `${where}Take the first ${b} item${b === "1" ? "" : "s"}.`;
    return `${where}Take the items from ${from} to ${to}${step ? `, every ${step}${ord(Number(step))} one` : ""}.`;
  }
  const items = splitTop(s, ",");
  const names = items.map((x) => x.trim());
  if (names.every((n) => /^-?\d+$/.test(n))) {
    const said = names.map((n) => (Number(n) < 0 ? (n === "-1" ? "the last item" : `item ${n} (counting from the end)`) : `item ${n}`));
    return `${where}Take ${list(said)} (counting from 0).`;
  }
  if (names.every((n) => /^(['"]).*\1$/.test(n))) {
    const keys = names.map((n) => q(unquote(n)));
    return recursive ? `Search at every depth for properties named ${list(keys, "or")}.` : `Go into the propert${keys.length > 1 ? "ies" : "y"} ${list(keys)}.`;
  }
  throw new ExpressionError(`${q(`[${inner}]`)} is not a valid selector. Use a number, a quoted name, *, a slice like 0:3, or a filter like ?(@.price < 10).`, 0);
}

function ord(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}

function list(items: string[], word = "and"): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${word} ${items[items.length - 1]}`;
}

/** Splits at top-level separators, ignoring those inside quotes and brackets. */
export function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'" || c === "\"") {
      const end = skipString(s, i);
      if (end < 0) break;
      i = end - 1;
    } else if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (depth === 0 && s.startsWith(sep, i)) {
      out.push(s.slice(start, i));
      start = i + sep.length;
      i += sep.length - 1;
    }
  }
  out.push(s.slice(start));
  return out;
}

/**
 * Explains a JSONPath expression step by step and checks its syntax, because
 * jsonpath-plus silently ignores some mistakes (an unclosed `[` simply stops
 * the path) and the visitor should hear about them.
 */
export function explainJsonPath(expr: string): Step[] {
  if (expr.length > MAX_EXPRESSION_CHARS) throw new ExpressionError(`The expression is ${expr.length.toLocaleString("en-US")} characters long; the limit is ${MAX_EXPRESSION_CHARS.toLocaleString("en-US")}.`, 0);
  const src = expr.trim();
  if (src === "") throw new ExpressionError("Type a JSONPath expression, for example $.orders[*].id", 0);
  const steps: Step[] = [];
  let i = 0;
  if (src[0] === "$") {
    steps.push({ code: "$", text: "Start at the root of the document.", depth: 0 });
    i = 1;
  } else if (src[0] === "@") {
    throw new ExpressionError("@ means “the current item” and only works inside a filter such as [?(@.price < 10)]. Start the path with $.", 0);
  } else {
    steps.push({ code: "", text: "Start at the root of the document (a path without $ is read as if it started with $.).", depth: 0 });
    if (src[0] !== "." && src[0] !== "[") i = -1;
  }
  while (i < src.length) {
    const start = i;
    let recursive = false;
    if (i === -1) {
      // A path such as store.book: treat the first name as `.store`.
      i = 0;
    } else if (src.startsWith("..", i)) {
      recursive = true;
      i += 2;
    } else if (src[i] === ".") {
      i += 1;
    } else if (src[i] === "[") {
      // handled below
    } else if (src[i] === "~") {
      steps.push({ code: "~", text: "Return the property names (or indexes) of the matches instead of their values.", depth: 0 });
      i++;
      continue;
    } else if (src[i] === "^") {
      steps.push({ code: "^", text: "Go up to the parent of each match.", depth: 0 });
      i++;
      continue;
    } else if (/\s/.test(src[i])) {
      throw new ExpressionError(`Unexpected space at character ${i + 1}. Put names with spaces in brackets: ['my name'].`, i);
    } else {
      throw new ExpressionError(`Unexpected ${q(src[i])} at character ${i + 1}. Use .name, ['name'], [0] or [*] after ${q(src.slice(0, i) || "$")}.`, i);
    }
    if (src[i] === "[") {
      const close = matchClose(src, i);
      const inner = src.slice(i + 1, close - 1);
      if (inner.trim() === "") throw new ExpressionError(`Empty brackets at character ${i + 1}. Put an index, a quoted name, * or a filter inside.`, i);
      try {
        steps.push({ code: src.slice(start, close), text: describeBracket(inner, recursive), depth: 0 });
      } catch (e) {
        if (e instanceof ExpressionError) throw new ExpressionError(e.message, e.index || i);
        throw e;
      }
      i = close;
      continue;
    }
    if (src[i] === "*") {
      steps.push({ code: src.slice(start, i + 1), text: recursive ? "Take every value at every depth below this point." : "Take every item or property value.", depth: 0 });
      i++;
      continue;
    }
    const name = /^[^.[\]()~^\s]+/.exec(src.slice(i));
    if (!name) {
      if (i >= src.length) throw new ExpressionError(`The expression ends with ${q(src.slice(start))}. Add a property name, * or [ … ] after it.`, start);
      throw new ExpressionError(`Expected a property name at character ${i + 1}.`, i);
    }
    if (/^['"]/.test(name[0])) throw new ExpressionError(`Quoted names go in brackets: [${name[0]}] instead of .${name[0]}.`, i);
    const n = name[0];
    let text: string;
    if (recursive) text = `Search at every depth for properties named ${q(n)}.`;
    else if (n === "length") text = "Take the length (for arrays: the number of items), or a property named “length”.";
    else text = `Go into the property ${q(n)}.`;
    steps.push({ code: src.slice(start, i + n.length) || n, text, depth: 0 });
    i += n.length;
  }
  if (steps.length === 1) steps[0] = { ...steps[0], text: "Return the whole document." };
  return steps;
}

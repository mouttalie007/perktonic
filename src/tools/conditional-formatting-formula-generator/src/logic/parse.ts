// Recursive-descent parser that turns tokens into a tree. Precedence follows Excel:
// ":" (range) > " " (intersection) > unary +/- and "@" > "%" > "^" > "* /" > "+ -" > "&" > comparisons.

import { FormulaSyntaxError, tokenize, type Token, type TokenizeOptions } from "./tokenize";

export type Node =
  | { type: "call"; name: string; args: Node[]; start: number; end: number }
  | { type: "invoke"; callee: Node; args: Node[]; start: number; end: number } // LAMBDA(x, x+1)(5)
  | { type: "binary"; op: string; left: Node; right: Node; start: number; end: number }
  | { type: "unary"; op: string; operand: Node; start: number; end: number }
  | { type: "postfix"; op: string; operand: Node; start: number; end: number }
  | { type: "group"; inner: Node[]; start: number; end: number } // (a) or a union (a, b)
  | { type: "array"; rows: Node[][]; start: number; end: number }
  | { type: "number" | "string" | "bool" | "error" | "ref" | "name" | "struct"; value: string; start: number; end: number }
  | { type: "empty"; start: number; end: number }; // an omitted argument: IF(A1,,0)

export const MAX_DEPTH = 1000;

const BINARY: Record<string, number> = { "=": 1, "<>": 1, "<": 1, ">": 1, "<=": 1, ">=": 1, "&": 2, "+": 3, "-": 3, "*": 4, "/": 4, "^": 5 };

export interface Parsed {
  ast: Node;
  tokens: Token[];
  separator: "," | ";";
}

export function parseFormula(src: string, opts: TokenizeOptions = {}): Parsed {
  const tokens = tokenize(src, opts);
  const separator = opts.separator ?? (tokens.find((t) => t.type === "sep")?.value === ";" ? ";" : ",");
  if (tokens.length === 0) throw new FormulaSyntaxError("The formula is empty.", Math.max(0, src.length - 1));
  let pos = 0;
  let depth = 0;
  const peek = () => tokens[pos];
  const endPos = () => (tokens.length ? tokens[tokens.length - 1].end : src.length);
  const describe = (t: Token | undefined) => (t ? `"${src.slice(t.start, t.end)}"` : "the end of the formula");

  const enter = (at: number) => {
    if (++depth > MAX_DEPTH) throw new FormulaSyntaxError(`The formula is nested more than ${MAX_DEPTH} levels deep.`, at);
  };

  function expression(minPrec = 1): Node {
    enter(peek()?.start ?? endPos());
    let left = unary();
    for (;;) {
      const t = peek();
      if (!t || t.type !== "op" || !(t.value in BINARY)) break;
      const prec = BINARY[t.value];
      if (prec < minPrec) break;
      pos++;
      // "^" is left-associative in Excel too, so every operator uses prec + 1.
      const right = expression(prec + 1);
      left = { type: "binary", op: t.value, left, right, start: left.start, end: right.end };
    }
    depth--;
    return left;
  }

  function unary(): Node {
    const t = peek();
    if (t && t.type === "op" && (t.value === "-" || t.value === "+" || t.value === "@")) {
      pos++;
      enter(t.start);
      const operand = unary();
      depth--;
      return { type: "unary", op: t.value, operand, start: t.start, end: operand.end };
    }
    return percent();
  }

  function percent(): Node {
    let node = intersection();
    while (peek()?.type === "op" && peek().value === "%") {
      const t = tokens[pos++];
      node = { type: "postfix", op: "%", operand: node, start: node.start, end: t.end };
    }
    return node;
  }

  function intersection(): Node {
    let node = range();
    while (peek()?.type === "op" && peek().value === " ") {
      pos++;
      const right = range();
      node = { type: "binary", op: " ", left: node, right, start: node.start, end: right.end };
    }
    return node;
  }

  function range(): Node {
    let node = primary();
    while (peek()?.type === "op" && peek().value === ":") {
      pos++;
      const right = primary();
      node = { type: "binary", op: ":", left: node, right, start: node.start, end: right.end };
    }
    return node;
  }

  function args(openTok: Token): { list: Node[]; end: number } {
    const list: Node[] = [];
    if (peek()?.type === "close") return { list, end: tokens[pos++].end };
    for (;;) {
      const t = peek();
      if (!t) throw new FormulaSyntaxError(`The bracket opened at position ${openTok.start + 1} is never closed: add ")".`, openTok.start);
      if (t.type === "sep" || t.type === "close") list.push({ type: "empty", start: t.start, end: t.start });
      else list.push(expression());
      const after = peek();
      if (!after) throw new FormulaSyntaxError(`The bracket opened at position ${openTok.start + 1} is never closed: add ")".`, openTok.start);
      if (after.type === "sep") {
        pos++;
        continue;
      }
      if (after.type === "close") return { list, end: tokens[pos++].end };
      throw new FormulaSyntaxError(`Expected "${separator}" or ")" but found ${describe(after)} at position ${after.start + 1}.`, after.start);
    }
  }

  function primary(): Node {
    const t = peek();
    if (!t) throw new FormulaSyntaxError("The formula ends where a value was expected.", endPos());
    pos++;
    let node: Node;
    switch (t.type) {
      case "number":
      case "string":
      case "bool":
      case "error":
      case "ref":
      case "name":
      case "struct":
        node = { type: t.type, value: t.value, start: t.start, end: t.end };
        break;
      case "func": {
        const open = tokens[pos++];
        enter(t.start);
        const a = args(open);
        depth--;
        node = { type: "call", name: t.value, args: a.list, start: t.start, end: a.end };
        break;
      }
      case "open": {
        enter(t.start);
        const inner: Node[] = [];
        for (;;) {
          if (!peek()) throw new FormulaSyntaxError(`The bracket opened at position ${t.start + 1} is never closed: add ")".`, t.start);
          inner.push(expression());
          const after = peek();
          if (after?.type === "sep" && after.value === ",") {
            pos++;
            continue;
          }
          if (after?.type === "close") break;
          if (!after) throw new FormulaSyntaxError(`The bracket opened at position ${t.start + 1} is never closed: add ")".`, t.start);
          throw new FormulaSyntaxError(`Expected ")" but found ${describe(after)} at position ${after.start + 1}.`, after.start);
        }
        depth--;
        node = { type: "group", inner, start: t.start, end: tokens[pos++].end };
        break;
      }
      case "arrayOpen": {
        const rows: Node[][] = [[]];
        for (;;) {
          const v = peek();
          if (!v) throw new FormulaSyntaxError(`The array constant opened at position ${t.start + 1} is never closed.`, t.start);
          if (v.type === "arrayClose" && rows[rows.length - 1].length === 0 && rows.length === 1) {
            throw new FormulaSyntaxError(`An array constant cannot be empty (position ${v.start + 1}).`, v.start);
          }
          let item: Node;
          const sign = v.type === "op" && v.value === "-" ? tokens[pos++] : null;
          const lit = peek();
          if (lit && ["number", "string", "bool", "error"].includes(lit.type)) {
            pos++;
            item = { type: lit.type as "number", value: (sign ? "-" : "") + lit.value, start: sign ? sign.start : lit.start, end: lit.end };
          } else {
            const where = lit ?? v;
            throw new FormulaSyntaxError(`Array constants may only hold numbers, text, TRUE/FALSE or error values; found ${describe(lit)} at position ${where.start + 1}.`, where.start);
          }
          rows[rows.length - 1].push(item);
          const sepTok = peek();
          if (!sepTok) throw new FormulaSyntaxError(`The array constant opened at position ${t.start + 1} is never closed.`, t.start);
          pos++;
          if (sepTok.type === "arrayCol") continue;
          if (sepTok.type === "arrayRow") {
            rows.push([]);
            continue;
          }
          if (sepTok.type === "arrayClose") {
            node = { type: "array", rows, start: t.start, end: sepTok.end };
            break;
          }
          throw new FormulaSyntaxError(`Unexpected ${describe(sepTok)} in an array constant at position ${sepTok.start + 1}.`, sepTok.start);
        }
        const widths = new Set(node.rows.map((r) => r.length));
        if (widths.size > 1) throw new FormulaSyntaxError(`Every row of the array constant at position ${t.start + 1} needs the same number of values.`, t.start);
        break;
      }
      default:
        if (t.type === "close") throw new FormulaSyntaxError(`Unexpected ")" at position ${t.start + 1}: there is no matching "(" or a value is missing before it.`, t.start);
        if (t.type === "sep") throw new FormulaSyntaxError(`A value is missing before "${t.value}" at position ${t.start + 1}.`, t.start);
        throw new FormulaSyntaxError(`Unexpected ${describe(t)} at position ${t.start + 1}.`, t.start);
    }
    // LAMBDA(...)(args) or a reference followed by a call, as Excel allows.
    while (peek()?.type === "open" && (node.type === "call" || node.type === "invoke")) {
      const open = tokens[pos++];
      const a = args(open);
      node = { type: "invoke", callee: node, args: a.list, start: node.start, end: a.end };
    }
    return node;
  }

  const ast = expression();
  if (pos < tokens.length) {
    const t = tokens[pos];
    if (t.type === "close") throw new FormulaSyntaxError(`Extra ")" at position ${t.start + 1}: it closes a bracket that was never opened.`, t.start);
    throw new FormulaSyntaxError(`Unexpected ${describe(t)} at position ${t.start + 1}: an operator such as + or & may be missing.`, t.start);
  }
  return { ast, tokens, separator };
}

/** Every function call in the tree, in source order. */
export function functionCalls(node: Node): { name: string; start: number; node: Node & { type: "call" } }[] {
  const out: { name: string; start: number; node: Node & { type: "call" } }[] = [];
  walk(node, (n) => {
    if (n.type === "call") out.push({ name: n.name, start: n.start, node: n });
  });
  return out.sort((a, b) => a.start - b.start);
}

/** Names that LET and LAMBDA bind, so calling them like functions is fine. */
export function boundNames(node: Node): Set<string> {
  const names = new Set<string>();
  walk(node, (n) => {
    if (n.type !== "call") return;
    if (n.name === "LET") n.args.forEach((a, i) => i % 2 === 0 && i < n.args.length - 1 && a.type === "name" && names.add(a.value.toUpperCase()));
    if (n.name === "LAMBDA") n.args.forEach((a, i) => i < n.args.length - 1 && a.type === "name" && names.add(a.value.toUpperCase()));
  });
  return names;
}

export function children(n: Node): Node[] {
  switch (n.type) {
    case "call":
      return n.args;
    case "invoke":
      return [n.callee, ...n.args];
    case "binary":
      return [n.left, n.right];
    case "unary":
    case "postfix":
      return [n.operand];
    case "group":
      return n.inner;
    case "array":
      return n.rows.flat();
    default:
      return [];
  }
}

/** Depth-first walk without recursion, so very deep formulas cannot overflow the stack. */
export function walk(root: Node, visit: (n: Node, depth: number) => void): void {
  const stack: [Node, number][] = [[root, 0]];
  while (stack.length) {
    const [n, d] = stack.pop()!;
    visit(n, d);
    const kids = children(n);
    for (let k = kids.length - 1; k >= 0; k--) stack.push([kids[k], d + 1]);
  }
}

export function maxCallDepth(root: Node): number {
  let max = 0;
  const stack: [Node, number][] = [[root, 0]];
  while (stack.length) {
    const [n, d] = stack.pop()!;
    const here = n.type === "call" ? d + 1 : d;
    if (here > max) max = here;
    for (const k of children(n)) stack.push([k, here]);
  }
  return max;
}

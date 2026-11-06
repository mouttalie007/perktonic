// Turns the parse tree into the labelled tree shown on the page (no values are calculated).

import { argumentName, functionInfo } from "./functionInfo";
import { maxCallDepth, parseFormula, type Node } from "./parse";
import { columnNumber, FormulaSyntaxError } from "./tokenize";

export type TreeKind = "function" | "call" | "operator" | "reference" | "name" | "table" | "number" | "text" | "logical" | "error" | "array" | "group" | "empty";

export interface TreeNode {
  id: string;
  kind: TreeKind;
  label: string;
  source: string;
  argName: string | null;
  /** One sentence about what this part is or does. */
  description: string;
  /** What a function hands back, in words (from the dictionary), or null. */
  returns: string | null;
  known: boolean;
  start: number;
  end: number;
  children: TreeNode[];
}

const OPERATORS: Record<string, string> = {
  "+": "Adds the two sides.",
  "-": "Subtracts the right side from the left side.",
  "*": "Multiplies the two sides. With TRUE/FALSE lists this works as AND (1 × 1 = 1).",
  "/": "Divides the left side by the right side.",
  "^": "Raises the left side to the power of the right side.",
  "&": "Joins the two sides into one text.",
  "=": "Compares: TRUE when both sides are equal (not case-sensitive for text).",
  "<>": "Compares: TRUE when the sides are different.",
  "<": "Compares: TRUE when the left side is smaller.",
  ">": "Compares: TRUE when the left side is larger.",
  "<=": "Compares: TRUE when the left side is smaller or equal.",
  ">=": "Compares: TRUE when the left side is larger or equal.",
  ":": "Makes one range from the first cell to the last cell.",
  " ": "Intersection: the cells that both ranges share.",
};
const OP_LABEL: Record<string, string> = { "+": "+ add", "-": "− subtract", "*": "× multiply", "/": "÷ divide", "^": "^ power", "&": "& join text", "=": "= equal to", "<>": "<> not equal to", "<": "< less than", ">": "> greater than", "<=": "<= at most", ">=": ">= at least", ":": ": range", " ": "space intersection" };

function plural(n: number, word: string) {
  return `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;
}

export function describeReference(text: string): string {
  const bang = /#REF!$/i.test(text) ? text.length - 6 : text.lastIndexOf("!");
  let sheet = bang >= 0 ? text.slice(0, bang) : "";
  const area = bang >= 0 ? text.slice(bang + 1) : text;
  sheet = sheet.startsWith("'") ? sheet.slice(1, -1).replace(/''/g, "'") : sheet;
  const where = sheet ? ` on sheet ${sheet}` : "";
  if (/^#REF!$/i.test(area)) return `A reference that no longer exists${where} (a row, column or sheet was deleted).`;
  const spill = area.endsWith("#");
  const parts = area.replace(/#$/, "").replace(/\$/g, "").split(":");
  if (spill) return `The whole spilled result of the dynamic-array formula in ${parts[0]}${where}.`;
  const cell = (p: string) => /^([A-Za-z]+)(\d+)$/.exec(p);
  if (parts.length === 1) return `Cell ${parts[0].toUpperCase()}${where}.`;
  const [a, b] = parts;
  const ca = cell(a);
  const cb = cell(b);
  if (ca && cb) {
    const rows = Math.abs(Number(cb[2]) - Number(ca[2])) + 1;
    const cols = Math.abs(columnNumber(cb[1]) - columnNumber(ca[1])) + 1;
    return `Range ${a.toUpperCase()}:${b.toUpperCase()}${where}: ${plural(rows, "row")} × ${plural(cols, "column")}.`;
  }
  if (/^[A-Za-z]+$/.test(a) && /^[A-Za-z]+$/.test(b)) return a.toUpperCase() === b.toUpperCase() ? `All of column ${a.toUpperCase()}${where}.` : `All of columns ${a.toUpperCase()} to ${b.toUpperCase()}${where}.`;
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) return a === b ? `All of row ${a}${where}.` : `All of rows ${a} to ${b}${where}.`;
  return `Range ${area}${where}.`;
}

export function describeTable(text: string): string {
  const m = /^([^[]*)\[(.*)\]$/.exec(text);
  if (!m) return "A table (structured) reference.";
  const table = m[1];
  const inner = m[2];
  const cols = [...inner.matchAll(/\[([^\]]+)\]/g)].map((x) => x[1]);
  const special = cols.filter((c) => c.startsWith("#"));
  const names = cols.filter((c) => !c.startsWith("#"));
  if (inner.startsWith("@")) return `The ${inner.slice(1).replace(/^\[|\]$/g, "")} value in the same row${table ? ` of table ${table}` : ""}.`;
  if (!cols.length) return inner.startsWith("#") ? `The ${inner} part of table ${table}.` : `Column ${inner}${table ? ` of table ${table}` : " of this table"} (data rows only).`;
  const scope = special.length ? ` (${special.join(", ").replace("#This Row", "this row only")})` : "";
  const what = names.length === 2 && inner.includes("]:[") ? `columns ${names[0]} to ${names[1]}` : names.length ? `column${names.length > 1 ? "s" : ""} ${names.join(", ")}` : "the table";
  return `The ${what}${table ? ` of table ${table}` : ""}${scope}.`;
}

interface Ctx {
  src: string;
  lets: Set<string>;
  params: Set<string>;
}

function build(n: Node, ctx: Ctx, id: string, argName: string | null): TreeNode {
  const source = ctx.src.slice(n.start, n.end);
  const base = { id, source, argName, start: n.start, end: n.end, returns: null as string | null, known: true, children: [] as TreeNode[] };
  switch (n.type) {
    case "call": {
      const info = functionInfo(n.name);
      // LET and LAMBDA bind names that later children use.
      const lets = new Set(ctx.lets);
      const params = new Set(ctx.params);
      if (n.name === "LET") n.args.forEach((a, i) => i % 2 === 0 && i < n.args.length - 1 && a.type === "name" && lets.add(a.value.toUpperCase()));
      if (n.name === "LAMBDA") n.args.forEach((a, i) => i < n.args.length - 1 && a.type === "name" && params.add(a.value.toUpperCase()));
      const inner = { ...ctx, lets, params };
      const custom = ctx.lets.has(n.name) || ctx.params.has(n.name);
      return {
        ...base,
        kind: "function",
        label: n.name,
        description: info ? info.purpose : custom ? `Calls ${n.name}, a LAMBDA named earlier in this formula.` : "Not in our dictionary: it may be a less common function, a function from another app, or a custom LAMBDA or macro in your file.",
        returns: info?.returns ?? null,
        known: !!info || custom,
        children: n.args.map((a, i) => build(a, inner, `${id}.${i}`, argumentName(n.name, i, n.args.length) ?? `argument ${i + 1}`)),
      };
    }
    case "invoke":
      return { ...base, kind: "call", label: "call with values", description: "Runs the LAMBDA on the left with the values in the last brackets.", children: [build(n.callee, ctx, `${id}.f`, "function"), ...n.args.map((a, i) => build(a, ctx, `${id}.${i}`, `value ${i + 1}`))] };
    case "binary":
      return { ...base, kind: "operator", label: OP_LABEL[n.op] ?? n.op, description: OPERATORS[n.op] ?? "Operator.", children: [build(n.left, ctx, `${id}.l`, "left side"), build(n.right, ctx, `${id}.r`, "right side")] };
    case "unary":
      return {
        ...base,
        kind: "operator",
        label: n.op === "-" ? "− negative" : n.op === "@" ? "@ single value" : "+ plus",
        description: n.op === "-" ? "Changes the sign. A double minus (--) turns TRUE/FALSE into 1/0." : n.op === "@" ? "Implicit intersection: uses one value from a range instead of the whole range." : "Leaves the value unchanged.",
        children: [build(n.operand, ctx, `${id}.0`, null)],
      };
    case "postfix":
      return { ...base, kind: "operator", label: "% percent", description: "Divides the value by 100.", children: [build(n.operand, ctx, `${id}.0`, null)] };
    case "group":
      if (n.inner.length === 1) return { ...base, kind: "group", label: "( brackets )", description: "Brackets: this part is worked out first.", children: [build(n.inner[0], ctx, `${id}.0`, null)] };
      return { ...base, kind: "group", label: "( union )", description: "A union: several ranges treated as one reference.", children: n.inner.map((x, i) => build(x, ctx, `${id}.${i}`, `area ${i + 1}`)) };
    case "array": {
      const rows = n.rows.length;
      const cols = n.rows[0]?.length ?? 0;
      return { ...base, kind: "array", label: `{ array ${rows}×${cols} }`, description: `An array constant: ${plural(rows, "row")} × ${plural(cols, "column")} of fixed values.`, children: n.rows.flatMap((r, ri) => r.map((v, ci) => build(v, ctx, `${id}.${ri}.${ci}`, `row ${ri + 1}, column ${ci + 1}`))) };
    }
    case "ref":
      return { ...base, kind: "reference", label: n.value, description: describeReference(n.value) };
    case "struct":
      return { ...base, kind: "table", label: n.value, description: describeTable(n.value) };
    case "name": {
      const up = n.value.toUpperCase();
      const description = ctx.lets.has(up) ? `${n.value}: a name given a value by LET in this formula.` : ctx.params.has(up) ? `${n.value}: a parameter of the LAMBDA.` : `${n.value}: a named range or a name defined in the workbook (if it does not exist, the formula shows #NAME?).`;
      return { ...base, kind: "name", label: n.value, description };
    }
    case "number":
      return { ...base, kind: "number", label: n.value, description: "A fixed number." };
    case "string":
      return { ...base, kind: "text", label: source, description: n.value === "" ? "Empty text (shows as a blank cell)." : "Fixed text." };
    case "bool":
      return { ...base, kind: "logical", label: n.value, description: `The logical value ${n.value}.` };
    case "error":
      return { ...base, kind: "error", label: n.value, description: `The error value ${n.value}, written into the formula.` };
    case "empty":
      return { ...base, kind: "empty", label: "(left empty)", description: "This argument was left empty, so the function uses its default or treats it as 0 or empty text." };
  }
}

export type Analysis =
  | { ok: true; root: TreeNode; functionCount: number; depth: number; separator: "," | ";"; nodeCount: number }
  | { ok: false; message: string; pos: number };

export function analyse(formula: string): Analysis {
  try {
    const { ast, separator } = parseFormula(formula);
    const root = build(ast, { src: formula, lets: new Set(), params: new Set() }, "n", null);
    let functionCount = 0;
    let nodeCount = 0;
    const stack = [root];
    while (stack.length) {
      const t = stack.pop()!;
      nodeCount++;
      if (t.kind === "function") functionCount++;
      stack.push(...t.children);
    }
    return { ok: true, root, functionCount, depth: maxCallDepth(ast), separator, nodeCount };
  } catch (e) {
    if (e instanceof FormulaSyntaxError) return { ok: false, message: e.message, pos: Math.min(Math.max(0, e.pos), Math.max(0, formula.length - 1)) };
    if (e instanceof RangeError) return { ok: false, message: "The formula is nested too deeply to show.", pos: 0 };
    throw e;
  }
}

/** A window of the formula around `pos` with a caret line under it (for the error view). */
export function caretWindow(formula: string, pos: number, width = 60): { line: string; caret: string } {
  const flat = formula.replace(/[\r\n\t]/g, " ");
  const from = Math.max(0, Math.min(pos - Math.floor(width / 2), flat.length - width));
  const to = Math.min(flat.length, from + width);
  const prefix = from > 0 ? "…" : "";
  const line = prefix + flat.slice(from, to) + (to < flat.length ? "…" : "");
  const caret = " ".repeat(prefix.length + pos - from) + "^";
  return { line, caret };
}

/** Indented plain-text outline of the tree for the download. */
export function outline(root: TreeNode): string {
  const lines: string[] = [];
  const stack: [TreeNode, number][] = [[root, 0]];
  while (stack.length) {
    const [t, d] = stack.pop()!;
    const arg = t.argName ? `${t.argName}: ` : "";
    lines.push(`${"  ".repeat(d)}- ${arg}${t.kind === "function" ? `${t.label}()` : t.label} — ${t.description}${t.returns ? ` Returns ${t.returns}.` : ""}`);
    for (let i = t.children.length - 1; i >= 0; i--) stack.push([t.children[i], d + 1]);
  }
  return lines.join("\n");
}

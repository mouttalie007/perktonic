import type { Node } from "./parser";

export type Indent = 2 | 4 | "tab";

export interface FormatOptions {
  /** null = minify. */
  indent: Indent | null;
  sortKeys: boolean;
}

/** Code-unit order: stable and identical in every browser, unlike localeCompare. */
function byKey(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Writes the tree back as strict JSON. Numbers and strings are written from
 * their source text, so nothing is rounded or re-escaped; comments and
 * trailing commas from lenient input are dropped.
 */
export function formatJson(root: Node, opts: FormatOptions): string {
  const unit = opts.indent === null ? "" : opts.indent === "tab" ? "\t" : " ".repeat(opts.indent);
  const pretty = opts.indent !== null;
  const parts: string[] = [];
  const write = (node: Node, depth: number) => {
    switch (node.t) {
      case "object": {
        if (node.keys.length === 0) {
          parts.push("{}");
          return;
        }
        let order = node.keys.map((_, i) => i);
        // Sorting by key with the original position as tie-break keeps duplicate keys in their order.
        if (opts.sortKeys) order = order.sort((a, b) => byKey(node.keys[a], node.keys[b]) || a - b);
        const pad = pretty ? "\n" + unit.repeat(depth + 1) : "";
        parts.push("{");
        order.forEach((idx, n) => {
          if (n > 0) parts.push(",");
          parts.push(pad, node.rawKeys[idx], pretty ? ": " : ":");
          write(node.values[idx], depth + 1);
        });
        parts.push(pretty ? "\n" + unit.repeat(depth) : "", "}");
        return;
      }
      case "array": {
        if (node.items.length === 0) {
          parts.push("[]");
          return;
        }
        const pad = pretty ? "\n" + unit.repeat(depth + 1) : "";
        parts.push("[");
        node.items.forEach((item, n) => {
          if (n > 0) parts.push(",");
          parts.push(pad);
          write(item, depth + 1);
        });
        parts.push(pretty ? "\n" + unit.repeat(depth) : "", "]");
        return;
      }
      case "string":
        parts.push(node.raw);
        return;
      case "number":
        parts.push(node.raw);
        return;
      case "boolean":
        parts.push(node.value ? "true" : "false");
        return;
      case "null":
        parts.push("null");
    }
  };
  write(root, 0);
  return parts.join("") + (pretty ? "\n" : "");
}

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** JSONPath-style step: .name for simple keys, ['odd key'] otherwise. */
export function pathStep(key: string | number): string {
  if (typeof key === "number") return `[${key}]`;
  if (IDENT.test(key)) return `.${key}`;
  return `['${key.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}']`;
}

export function pathString(steps: (string | number)[]): string {
  return "$" + steps.map(pathStep).join("");
}

/** Follows child positions ([2, 0] = third key's value, then its first child). */
export function nodeAt(root: Node, positions: number[]): Node | null {
  let node: Node | undefined = root;
  for (const p of positions) {
    if (!node) return null;
    if (node.t === "object") node = node.values[p];
    else if (node.t === "array") node = node.items[p];
    else return null;
  }
  return node ?? null;
}

/** Child positions and path steps for a JSON Pointer such as /items/0/qty. */
export function resolvePointer(root: Node, pointer: string): { node: Node; steps: (string | number)[]; keyAt: number | null } | null {
  const tokens = pointer.replace(/^#/, "").split("/").slice(1).map((t) => decodeURIComponent(t).replace(/~1/g, "/").replace(/~0/g, "~"));
  let node: Node = root;
  let keyAt: number | null = null;
  const steps: (string | number)[] = [];
  for (const tok of tokens) {
    if (node.t === "object") {
      const idx = node.keys.lastIndexOf(tok);
      if (idx < 0) return null;
      keyAt = node.keyAt[idx];
      steps.push(tok);
      node = node.values[idx];
    } else if (node.t === "array") {
      const idx = Number(tok);
      if (!Number.isInteger(idx) || !node.items[idx]) return null;
      keyAt = null;
      steps.push(idx);
      node = node.items[idx];
    } else return null;
  }
  return { node, steps, keyAt };
}

export interface TreeChild {
  key: string | number;
  path: string;
  positions: number[];
  type: Node["t"];
  /** Short text: the value for scalars, "{3 keys}" / "[10 items]" for containers. */
  summary: string;
  expandable: boolean;
}

const PAGE = 200;

/** One page of children for the tree view; the worker answers these on demand so huge files stay responsive. */
export function treeChildren(root: Node, positions: number[], steps: (string | number)[], offset = 0): { children: TreeChild[]; total: number } {
  const node = nodeAt(root, positions);
  if (!node || (node.t !== "object" && node.t !== "array")) return { children: [], total: 0 };
  const total = node.t === "object" ? node.keys.length : node.items.length;
  const children: TreeChild[] = [];
  for (let i = offset; i < Math.min(total, offset + PAGE); i++) {
    const key = node.t === "object" ? node.keys[i] : i;
    const child = node.t === "object" ? node.values[i] : node.items[i];
    children.push({ key, path: pathString([...steps, key]), positions: [...positions, i], type: child.t, summary: summarize(child), expandable: (child.t === "object" && child.keys.length > 0) || (child.t === "array" && child.items.length > 0) });
  }
  return { children, total };
}

export function summarize(node: Node): string {
  switch (node.t) {
    case "object":
      return `{${node.keys.length} ${node.keys.length === 1 ? "key" : "keys"}}`;
    case "array":
      return `[${node.items.length} ${node.items.length === 1 ? "item" : "items"}]`;
    case "string":
      return node.raw.length > 120 ? node.raw.slice(0, 117) + "…\"" : node.raw;
    case "number":
      return node.raw;
    case "boolean":
      return String(node.value);
    case "null":
      return "null";
  }
}

export interface Stats {
  objects: number;
  arrays: number;
  values: number;
  maxDepth: number;
  bigIntegers: number;
}

/** Counts nodes and integers that a plain JSON.parse would round (beyond ±2^53). */
export function stats(root: Node): Stats {
  const s: Stats = { objects: 0, arrays: 0, values: 0, maxDepth: 0, bigIntegers: 0 };
  const stack: [Node, number][] = [[root, 1]];
  while (stack.length > 0) {
    const [node, depth] = stack.pop()!;
    s.maxDepth = Math.max(s.maxDepth, depth);
    if (node.t === "object") {
      s.objects++;
      for (const v of node.values) stack.push([v, depth + 1]);
    } else if (node.t === "array") {
      s.arrays++;
      for (const v of node.items) stack.push([v, depth + 1]);
    } else {
      s.values++;
      if (node.t === "number" && /^-?\d+$/.test(node.raw) && !Number.isSafeInteger(Number(node.raw))) s.bigIntegers++;
    }
  }
  return s;
}

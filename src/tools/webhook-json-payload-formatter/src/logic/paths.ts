import { pathStep, summarize } from "./format";
import type { Node } from "./parser";

export interface KeyField {
  path: string;
  type: Node["t"];
  summary: string;
}

/** Reads the simple paths this tool writes: $.a.b[0]['odd key']. */
export function parsePath(path: string): (string | number)[] | null {
  if (!path.startsWith("$")) return null;
  const steps: (string | number)[] = [];
  const re = /\.([A-Za-z_$][A-Za-z0-9_$]*)|\[(\d+)\]|\['((?:[^'\\]|\\.)*)'\]/gy;
  re.lastIndex = 1;
  while (re.lastIndex < path.length) {
    const m = re.exec(path);
    if (!m) return null;
    if (m[1] !== undefined) steps.push(m[1]);
    else if (m[2] !== undefined) steps.push(Number(m[2]));
    else steps.push(m[3].replace(/\\(.)/g, "$1"));
  }
  return steps;
}

export function nodeAtPath(root: Node, steps: (string | number)[]): Node | undefined {
  let node: Node | undefined = root;
  for (const s of steps) {
    if (node?.t === "object" && typeof s === "string") {
      const i = node.keys.lastIndexOf(s);
      node = i < 0 ? undefined : node.values[i];
    } else if (node?.t === "array" && typeof s === "number") node = node.items[s];
    else return undefined;
  }
  return node;
}

/** The provider's key paths that exist in this payload, with a short value. */
export function keyFields(root: Node, paths: string[]): KeyField[] {
  const out: KeyField[] = [];
  for (const path of paths) {
    const steps = parsePath(path);
    const node = steps ? nodeAtPath(root, steps) : undefined;
    if (node) out.push({ path, type: node.t, summary: summarize(node) });
  }
  return out;
}

export const MAX_PATH_ROWS = 200_000;

const cell = (v: string) => {
  // A leading = + - @ makes spreadsheets run the cell as a formula.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Every value's path, type and value as CSV (BOM for Excel), walked without recursion. */
export function leafPathsCsv(root: Node): { csv: string; rows: number; capped: boolean } {
  const lines = ["path,type,value"];
  const stack: [Node, string][] = [[root, "$"]];
  let rows = 0;
  let capped = false;
  while (stack.length) {
    const [node, path] = stack.pop()!;
    if (node.t === "object" || node.t === "array") {
      const n = node.t === "object" ? node.keys.length : node.items.length;
      if (n === 0) {
        lines.push(`${cell(path)},${node.t},${node.t === "object" ? "{}" : "[]"}`);
        rows++;
      }
      // Pushed in reverse so the CSV follows document order.
      for (let i = n - 1; i >= 0; i--) {
        if (node.t === "object") stack.push([node.values[i], path + pathStep(node.keys[i])]);
        else stack.push([node.items[i], `${path}[${i}]`]);
      }
    } else {
      const value = node.t === "string" ? node.value : node.t === "number" ? node.raw : node.t === "boolean" ? String(node.value) : "null";
      lines.push(`${cell(path)},${node.t},${cell(value)}`);
      rows++;
    }
    if (rows >= MAX_PATH_ROWS) {
      capped = stack.length > 0;
      break;
    }
  }
  return { csv: "﻿" + lines.join("\r\n") + "\r\n", rows, capped };
}

// CSV rows ⇄ nested records. No imports, so the rules can be unit-tested and shown on the page.

export type Scalar = string | number | boolean | null;
export type Value = Scalar | Value[] | { [k: string]: Value };
export type Rec = { [k: string]: Value };

export interface ToTreeOptions {
  /** Read numbers, true/false and empty cells as typed values. */
  detectTypes: boolean;
  /** "address.city" becomes { address: { city } }. */
  nest: boolean;
  /** Cells of columns named "tags[]" are split with this separator into lists. */
  listSeparator: string;
}

const NUMBER = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/;

/** A CSV cell as a typed value: 42, 1.5, true, false, null; anything else stays text (007 keeps its zeros). */
export function typed(cell: string, detect: boolean): Scalar {
  if (!detect) return cell;
  if (cell === "") return null;
  if (cell === "true" || cell === "TRUE" || cell === "True") return true;
  if (cell === "false" || cell === "FALSE" || cell === "False") return false;
  if (NUMBER.test(cell)) {
    const n = Number(cell);
    // Integers beyond 2^53 would lose digits as numbers, so they stay text.
    if (Number.isFinite(n) && (!Number.isInteger(n) || Number.isSafeInteger(n))) return n;
  }
  return cell;
}

export interface HeaderPath {
  path: string[];
  list: boolean;
}

/** "address.city" → ["address", "city"]; "tags[]" → a list column. Empty or clashing parts fall back to the full header. */
export function headerPath(header: string, nest: boolean): HeaderPath {
  let h = header.trim();
  const list = h.endsWith("[]");
  if (list) h = h.slice(0, -2);
  const parts = nest ? h.split(".") : [h];
  return { path: parts.some((p) => p === "") ? [h] : parts, list };
}

export function rowsToRecords(headers: string[], rows: string[][], opts: ToTreeOptions): { records: Rec[]; notes: string[] } {
  const notes: string[] = [];
  const paths = headers.map((h, i) => headerPath(h || `column_${i + 1}`, opts.nest));
  // "a" and "a.b" cannot both exist: "a" would be both a value and an object.
  const prefixes = new Set(paths.filter((p) => p.path.length > 1).flatMap((p) => p.path.slice(0, -1).map((_, k) => p.path.slice(0, k + 1).join("."))));
  for (let i = 0; i < paths.length; i++) {
    if (paths[i].path.length === 1 && prefixes.has(paths[i].path[0])) {
      notes.push(`Column “${headers[i]}” clashes with nested columns under “${headers[i]}.”, so it is kept as “${headers[i]}_value”.`);
      paths[i] = { ...paths[i], path: [`${paths[i].path[0]}_value`] };
    }
  }
  const records = rows.map((row) => {
    const rec: Rec = {};
    paths.forEach((p, i) => {
      const cell = row[i] ?? "";
      let value: Value;
      if (p.list) value = cell === "" ? [] : cell.split(opts.listSeparator).map((x) => typed(x.trim(), opts.detectTypes));
      else value = typed(cell, opts.detectTypes);
      let node: Rec = rec;
      for (let k = 0; k < p.path.length - 1; k++) {
        const key = p.path[k];
        if (typeof node[key] !== "object" || node[key] === null || Array.isArray(node[key])) node[key] = {};
        node = node[key] as Rec;
      }
      node[p.path[p.path.length - 1]] = value;
    });
    return rec;
  });
  return { records, notes };
}

export interface FlattenResult {
  headers: string[];
  rows: string[][];
  /** What could not be represented as plain cells. */
  losses: string[];
}

function cellText(v: Scalar | Date): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);

/**
 * Turns records into a table: nested objects become dotted columns
 * (address.city), lists of plain values are joined with `separator`, and
 * anything else (lists of objects, nested lists) is written as JSON text
 * in one cell and reported, because a flat table cannot hold it.
 */
export function recordsToTable(records: unknown[], separator: string): FlattenResult {
  const headers: string[] = [];
  const index = new Map<string, number>();
  const lossCount = new Map<string, number>();
  const loss = (msg: string) => lossCount.set(msg, (lossCount.get(msg) ?? 0) + 1);
  const col = (name: string) => {
    let i = index.get(name);
    if (i === undefined) {
      i = headers.length;
      headers.push(name);
      index.set(name, i);
    }
    return i;
  };
  const rows: string[][] = [];
  for (const rec of records) {
    const row: string[] = [];
    const put = (name: string, text: string) => {
      const i = col(name);
      while (row.length <= i) row.push("");
      row[i] = text;
    };
    const walk = (v: unknown, prefix: string, seen: Set<unknown>) => {
      if (isPlainObject(v)) {
        if (seen.has(v)) {
          put(prefix || "value", "[circular reference]");
          loss(`“${prefix}” refers back to itself (a YAML alias loop); it was written as [circular reference].`);
          return;
        }
        seen.add(v);
        const keys = Object.keys(v);
        if (keys.length === 0 && prefix) put(prefix, "");
        for (const k of keys) walk(v[k], prefix ? `${prefix}.${k}` : k, seen);
        seen.delete(v);
        return;
      }
      if (Array.isArray(v)) {
        const plain = v.every((x) => x === null || ["string", "number", "boolean"].includes(typeof x) || x instanceof Date);
        if (plain) {
          if (v.some((x) => typeof x === "string" && x.includes(separator))) loss(`Some values in “${prefix}” contain the list separator “${separator}”, so splitting the cell again would not give the same list.`);
          put(prefix || "value", v.map((x) => cellText(x as Scalar | Date)).join(separator));
        } else {
          let text: string;
          try {
            text = JSON.stringify(v);
          } catch {
            text = "[circular reference]";
          }
          put(prefix || "value", text);
          loss(`“${prefix}” holds a list of objects or nested lists, which a table cannot hold; it was written as JSON text in one cell.`);
        }
        return;
      }
      put(prefix || "value", cellText(v as Scalar | Date));
    };
    walk(rec, "", new Set());
    rows.push(row);
  }
  for (const r of rows) while (r.length < headers.length) r.push("");
  const losses = [...lossCount].map(([msg, n]) => (n > 1 ? `${msg} (${n.toLocaleString("en-US")} rows)` : msg));
  return { headers, rows, losses };
}

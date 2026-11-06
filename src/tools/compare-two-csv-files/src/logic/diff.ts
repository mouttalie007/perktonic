// Key-based table diff and merge. No imports, so it runs the same in the worker and in tests.

export interface Table {
  headers: string[];
  rows: string[][];
}

export interface KeyOptions {
  /** Ignore upper/lower case in key values (MUG-01 = mug-01). */
  ignoreCase: boolean;
  /** Ignore spaces around key values. */
  trim: boolean;
}

export interface ColumnMap {
  /** Columns in both files: [index in A, index in B, name]. */
  common: [number, number, string][];
  onlyA: string[];
  onlyB: string[];
}

const norm = (h: string) => h.trim().toLowerCase();

/** Matches columns by name (ignoring case and spaces), so column order may differ between the files. */
export function mapColumns(a: string[], b: string[]): ColumnMap {
  const inB = new Map<string, number>();
  b.forEach((h, i) => {
    if (!inB.has(norm(h))) inB.set(norm(h), i);
  });
  const common: [number, number, string][] = [];
  const onlyA: string[] = [];
  const used = new Set<number>();
  a.forEach((h, i) => {
    const j = inB.get(norm(h));
    if (j !== undefined && !used.has(j)) {
      common.push([i, j, h]);
      used.add(j);
    } else onlyA.push(h);
  });
  const onlyB = b.filter((_, i) => !used.has(i));
  return { common, onlyA, onlyB };
}

export function keyOf(row: string[], cols: number[], o: KeyOptions): string {
  let k = "";
  for (let i = 0; i < cols.length; i++) {
    let v = row[cols[i]] ?? "";
    if (o.trim) v = v.trim();
    if (o.ignoreCase) v = v.toLowerCase();
    // The unit separator cannot appear in normal text, so composite keys never collide.
    k += i === 0 ? v : `\u001f${v}`;
  }
  return k;
}

export interface Change {
  a: number;
  b: number;
  /** Indexes into ColumnMap.common of the columns that differ. */
  cols: number[];
}

export interface DiffResult {
  columns: ColumnMap;
  /** Row indexes in B. */
  added: number[];
  /** Row indexes in A. */
  removed: number[];
  changed: Change[];
  unchanged: number;
  /** Keys that appear more than once, with their count, per file (first 20). */
  duplicatesA: { key: string; count: number }[];
  duplicatesB: { key: string; count: number }[];
  duplicateRowsA: number;
  duplicateRowsB: number;
  /** Rows whose key columns are all empty. */
  emptyKeys: number;
}

export interface DiffOptions extends KeyOptions {
  /** Names of the key columns (as in A); empty means row-by-row comparison. */
  keys: string[];
  /** Ignore spaces around cell values when comparing them. */
  trimValues: boolean;
}

function countDuplicates(rows: string[][], cols: number[], o: KeyOptions): { list: { key: string; count: number }[]; rows: number } {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(r, cols, o);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const list: { key: string; count: number }[] = [];
  let dupRows = 0;
  for (const [k, n] of counts) {
    if (n > 1) {
      dupRows += n;
      if (list.length < 20) list.push({ key: k.replace(/\u001f/g, " | "), count: n });
    }
  }
  return { list, rows: dupRows };
}

/**
 * Compares B (new) against A (old). With key columns, rows are matched by
 * key through a hash map, so the order of rows does not matter; rows that
 * share a key are paired in the order they appear. Without keys, row N is
 * compared with row N.
 */
export function diffTables(a: Table, b: Table, o: DiffOptions, onProgress?: (fraction: number) => void): DiffResult {
  const columns = mapColumns(a.headers, b.headers);
  const keyA = o.keys.map((k) => a.headers.findIndex((h) => norm(h) === norm(k)));
  const keyB = o.keys.map((k) => b.headers.findIndex((h) => norm(h) === norm(k)));
  if (keyA.some((i) => i < 0) || keyB.some((i) => i < 0)) throw new Error("A key column is missing from one of the files.");
  const keySet = new Set(keyA);
  const compareCols = columns.common.map((c, idx) => ({ c, idx })).filter(({ c }) => !keySet.has(c[0]));
  const same = (x: string | undefined, y: string | undefined) => {
    const p = x ?? "";
    const q = y ?? "";
    return o.trimValues ? p.trim() === q.trim() : p === q;
  };
  const changed: Change[] = [];
  let unchanged = 0;
  const added: number[] = [];
  const removed: number[] = [];
  const total = a.rows.length + b.rows.length;
  const diffRow = (ia: number, ib: number) => {
    const ra = a.rows[ia];
    const rb = b.rows[ib];
    let cols: number[] | null = null;
    for (const { c, idx } of compareCols) {
      if (!same(ra[c[0]], rb[c[1]])) (cols ??= []).push(idx);
    }
    if (cols) changed.push({ a: ia, b: ib, cols });
    else unchanged++;
  };

  if (o.keys.length === 0) {
    const n = Math.min(a.rows.length, b.rows.length);
    for (let i = 0; i < n; i++) {
      diffRow(i, i);
      if (onProgress && i % 50_000 === 0) onProgress(i / Math.max(1, n));
    }
    for (let i = n; i < a.rows.length; i++) removed.push(i);
    for (let i = n; i < b.rows.length; i++) added.push(i);
    return { columns, added, removed, changed, unchanged, duplicatesA: [], duplicatesB: [], duplicateRowsA: 0, duplicateRowsB: 0, emptyKeys: 0 };
  }

  // Key → queue of row indexes in A (a queue so duplicate keys pair up in order).
  const index = new Map<string, number[] | number>();
  let emptyKeys = 0;
  const emptyKey = keyOf(new Array(Math.max(...keyA) + 1).fill(""), keyA, o);
  for (let i = 0; i < a.rows.length; i++) {
    const k = keyOf(a.rows[i], keyA, o);
    if (k === emptyKey) emptyKeys++;
    const cur = index.get(k);
    if (cur === undefined) index.set(k, i);
    else if (typeof cur === "number") index.set(k, [cur, i]);
    else cur.push(i);
    if (onProgress && i % 50_000 === 0) onProgress(i / total);
  }
  const taken = new Uint8Array(a.rows.length);
  for (let j = 0; j < b.rows.length; j++) {
    const k = keyOf(b.rows[j], keyB, o);
    if (k === emptyKey) emptyKeys++;
    const cur = index.get(k);
    let ia: number | undefined;
    if (typeof cur === "number") {
      ia = cur;
      index.delete(k);
    } else if (cur) {
      ia = cur.shift();
      if (cur.length === 0) index.delete(k);
    }
    if (ia === undefined) added.push(j);
    else {
      taken[ia] = 1;
      diffRow(ia, j);
    }
    if (onProgress && j % 50_000 === 0) onProgress((a.rows.length + j) / total);
  }
  for (let i = 0; i < a.rows.length; i++) if (!taken[i]) removed.push(i);
  const da = countDuplicates(a.rows, keyA, o);
  const db = countDuplicates(b.rows, keyB, o);
  return { columns, added, removed, changed, unchanged, duplicatesA: da.list, duplicatesB: db.list, duplicateRowsA: da.rows, duplicateRowsB: db.rows, emptyKeys };
}

export type JoinType = "inner" | "left" | "right" | "outer";

export interface MergeResult {
  headers: string[];
  rows: string[][];
  /** Extra rows created because a key appears several times on both sides. */
  multiplied: number;
  /** Rows dropped by "stack and remove duplicates". */
  removedDuplicates: number;
}

/**
 * Joins A and B on the key columns like a SQL join. Key columns appear once;
 * other columns present in both files get " (A)" and " (B)" suffixes. A key
 * that appears several times on both sides produces every pair, as SQL does.
 */
export function joinTables(a: Table, b: Table, keys: string[], type: JoinType, o: KeyOptions): MergeResult {
  const keyA = keys.map((k) => a.headers.findIndex((h) => norm(h) === norm(k)));
  const keyB = keys.map((k) => b.headers.findIndex((h) => norm(h) === norm(k)));
  if (keys.length === 0 || keyA.some((i) => i < 0) || keyB.some((i) => i < 0)) throw new Error("Choose key columns that exist in both files.");
  const otherA = a.headers.map((_, i) => i).filter((i) => !keyA.includes(i));
  const otherB = b.headers.map((_, i) => i).filter((i) => !keyB.includes(i));
  const namesB = new Set(otherB.map((i) => norm(b.headers[i])));
  const namesA = new Set(otherA.map((i) => norm(a.headers[i])));
  const headers = [
    ...keyA.map((i) => a.headers[i]),
    ...otherA.map((i) => (namesB.has(norm(a.headers[i])) ? `${a.headers[i]} (A)` : a.headers[i])),
    ...otherB.map((i) => (namesA.has(norm(b.headers[i])) ? `${b.headers[i]} (B)` : b.headers[i])),
  ];
  const byKey = new Map<string, number[]>();
  b.rows.forEach((r, j) => {
    const k = keyOf(r, keyB, o);
    const list = byKey.get(k);
    if (list) list.push(j);
    else byKey.set(k, [j]);
  });
  const rows: string[][] = [];
  const usedB = new Uint8Array(b.rows.length);
  let multiplied = 0;
  const emptyA = otherA.map(() => "");
  const emptyB = otherB.map(() => "");
  for (const ra of a.rows) {
    const matches = byKey.get(keyOf(ra, keyA, o));
    const head = [...keyA.map((i) => ra[i] ?? ""), ...otherA.map((i) => ra[i] ?? "")];
    if (matches) {
      if (matches.length > 1) multiplied += matches.length - 1;
      for (const j of matches) {
        usedB[j] = 1;
        rows.push([...head, ...otherB.map((i) => b.rows[j][i] ?? "")]);
      }
    } else if (type === "left" || type === "outer") rows.push([...head, ...emptyB]);
  }
  if (type === "right" || type === "outer") {
    b.rows.forEach((rb, j) => {
      if (!usedB[j]) rows.push([...keyB.map((i) => rb[i] ?? ""), ...emptyA, ...otherB.map((i) => rb[i] ?? "")]);
    });
  }
  return { headers, rows, multiplied, removedDuplicates: 0 };
}

/**
 * Puts the rows of A and B in one table (columns matched by name; columns
 * only in one file are kept and left empty for the other) and removes rows
 * whose key was already seen, keeping the first. Without keys, whole rows are compared.
 */
export function stackUnique(a: Table, b: Table, keys: string[], o: KeyOptions): MergeResult {
  const cols = mapColumns(a.headers, b.headers);
  const headers = [...a.headers, ...cols.onlyB];
  const bIndex = headers.map((h) => b.headers.findIndex((x) => norm(x) === norm(h)));
  const keyCols = keys.length ? keys.map((k) => headers.findIndex((h) => norm(h) === norm(k))) : headers.map((_, i) => i);
  if (keyCols.some((i) => i < 0)) throw new Error("Choose key columns that exist in both files.");
  const seen = new Set<string>();
  const rows: string[][] = [];
  let removedDuplicates = 0;
  const add = (row: string[]) => {
    const k = keyOf(row, keyCols, o);
    if (seen.has(k)) {
      removedDuplicates++;
      return;
    }
    seen.add(k);
    rows.push(row);
  };
  for (const r of a.rows) add(headers.map((_, i) => (i < a.headers.length ? r[i] ?? "" : "")));
  for (const r of b.rows) add(bIndex.map((i) => (i >= 0 ? r[i] ?? "" : "")));
  return { headers, rows, multiplied: 0, removedDuplicates };
}

/** Columns that look like keys: named like an id, and unique and filled in both files' first rows. */
export function suggestKeys(a: Table, b: Table): string[] {
  const { common } = mapColumns(a.headers, b.headers);
  const unique = (t: Table, i: number) => {
    const seen = new Set<string>();
    for (const r of t.rows.slice(0, 5000)) {
      const v = (r[i] ?? "").trim();
      if (v === "" || seen.has(v)) return false;
      seen.add(v);
    }
    return true;
  };
  const named = common.filter(([, , h]) => /^(id|key|sku|code|uuid|guid|email|e-mail|.*[ _-]id|.*id)$/i.test(h.trim()));
  for (const c of [...named, ...common]) if (unique(a, c[0]) && unique(b, c[1])) return [c[2]];
  return named.length ? [named[0][2]] : [];
}

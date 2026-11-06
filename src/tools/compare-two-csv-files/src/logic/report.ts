import { toCsv } from "./csvWriter";
import type { DiffResult, Table } from "./diff";

export type Group = "added" | "removed" | "changed" | "report";

/**
 * CSV for one group of the diff. "changed" has one line per changed cell
 * (key, column, old value, new value), which is easy to filter in a
 * spreadsheet; "report" has every row with a _status column.
 */
export function groupCsv(group: Group, a: Table, b: Table, d: DiffResult, keys: string[]): string {
  if (group === "added") return toCsv(b.headers, d.added.map((j) => b.rows[j]), ",");
  if (group === "removed") return toCsv(a.headers, d.removed.map((i) => a.rows[i]), ",");
  const keyB = keys.map((k) => b.headers.findIndex((h) => h.trim().toLowerCase() === k.trim().toLowerCase()));
  const keyLabel = keys.length ? keys : ["row"];
  const keyValues = (j: number) => (keys.length ? keyB.map((i) => b.rows[j][i] ?? "") : [String(j + 2)]);
  if (group === "changed") {
    const rows: string[][] = [];
    for (const c of d.changed) {
      for (const idx of c.cols) {
        const [ia, ib, name] = d.columns.common[idx];
        rows.push([...keyValues(c.b), name, a.rows[c.a][ia] ?? "", b.rows[c.b][ib] ?? ""]);
      }
    }
    return toCsv([...keyLabel, "column", "old value", "new value"], rows, ",");
  }
  // Full report: B's columns, then columns that exist only in A.
  const onlyAIdx = d.columns.onlyA.map((h) => a.headers.indexOf(h));
  const bFor = new Map<number, number>();
  for (const [ia, ib] of d.columns.common) bFor.set(ib, ia);
  const headers = ["_status", "_changed_columns", ...b.headers, ...d.columns.onlyA];
  const rows: string[][] = [];
  const changedByB = new Map<number, number[]>();
  for (const c of d.changed) changedByB.set(c.b, c.cols);
  const aForB = new Map<number, number>();
  for (const c of d.changed) aForB.set(c.b, c.a);
  const addedSet = new Set(d.added);
  for (let j = 0; j < b.rows.length; j++) {
    const cols = changedByB.get(j);
    const status = addedSet.has(j) ? "added" : cols ? "changed" : "unchanged";
    const ia = aForB.get(j);
    rows.push([status, cols ? cols.map((i) => d.columns.common[i][2]).join("; ") : "", ...b.headers.map((_, i) => b.rows[j][i] ?? ""), ...onlyAIdx.map((i) => (ia !== undefined ? a.rows[ia][i] ?? "" : ""))]);
  }
  for (const i of d.removed) {
    const row = b.headers.map((_, ib) => {
      const iaCol = bFor.get(ib);
      return iaCol !== undefined ? a.rows[i][iaCol] ?? "" : "";
    });
    rows.push(["removed", "", ...row, ...onlyAIdx.map((k) => a.rows[i][k] ?? "")]);
  }
  return toCsv(headers, rows, ",");
}

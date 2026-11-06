import type { PageData, Table } from "./types";

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const sameRow = (a: string[], b: string[]) => a.length === b.length && a.every((t, i) => norm(t) === norm(b[i]));

/** Does `next` (first table of the following page) continue `prev` (last table of a page)? */
export function continues(prev: Table, next: Table, prevPage: PageData, nextPage: PageData): boolean {
  if (prev.method !== next.method) return false;
  const cols = prev.rows[0]?.length ?? 0;
  if (cols !== (next.rows[0]?.length ?? 0) || cols < 2) return false;
  const inner = (t: Table) => t.edges.slice(1, -1);
  const tol = Math.max(8, prevPage.width * 0.02);
  const edgesMatch = inner(prev).every((e, i) => Math.abs(e - inner(next)[i]) <= tol);
  const nearBottom = prev.bottom > prevPage.height * 0.6;
  const nearTop = next.top < nextPage.height * 0.35;
  return edgesMatch || (nearBottom && nearTop && prev.method === "ruled");
}

/** Appends a continuation; its first rows are dropped when they repeat the header. */
export function append(prev: Table, next: Table): Table {
  let skip = 0;
  if (prev.headerRows > 0 && next.rows.length > prev.headerRows) {
    const h = prev.headerRows;
    if (prev.rows.slice(0, h).every((r, i) => sameRow(r, next.rows[i]))) skip = h;
  }
  const offset = prev.rows.length - skip;
  return {
    ...prev,
    pages: [...prev.pages, ...next.pages.filter((p) => !prev.pages.includes(p))],
    rows: [...prev.rows, ...next.rows.slice(skip)],
    merges: [...prev.merges, ...next.merges.filter((m) => m.row >= skip).map((m) => ({ ...m, row: m.row + offset }))],
    bottom: next.bottom,
    droppedHeaders: prev.droppedHeaders + (skip ? 1 : 0) + next.droppedHeaders,
  };
}

/** Joins tables that continue on the next page (same column layout). */
export function mergeAcrossPages(perPage: { page: PageData; tables: Table[] }[]): Table[] {
  const out: Table[] = [];
  let carry: { table: Table; page: PageData } | null = null;
  for (const { page, tables } of perPage) {
    const list = [...tables];
    if (carry && list.length && carry.page.page === page.page - 1 && continues(carry.table, list[0], carry.page, page)) {
      const joined = append(carry.table, list.shift()!);
      out[out.length - 1] = joined;
      carry = { table: joined, page };
      if (list.length === 0) continue;
    }
    for (const t of list) out.push(t);
    carry = list.length ? { table: out[out.length - 1], page } : carry && carry.page.page === page.page ? carry : null;
  }
  return out;
}

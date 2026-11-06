import { alignedTables } from "./aligned";
import { ruledTables, type RawTable } from "./ruled";
import type { MethodChoice, PageData, Table } from "./types";
import { guessHeaderRows, mirror } from "./util";

/** Tables of one page, top to bottom. "auto" uses ruled tables where there are rules and alignment elsewhere. */
export function detectPage(page: PageData, method: MethodChoice): Table[] {
  const raw: RawTable[] = [];
  if (method !== "aligned") raw.push(...ruledTables(page));
  if (method !== "ruled") {
    const used = new Set(raw.flatMap((t) => t.runs));
    raw.push(...alignedTables(page.runs.filter((r) => !used.has(r))));
  }
  return raw
    .sort((a, b) => a.top - b.top)
    .map((t) => {
      const grid = t.rtl ? mirror(t.rows, t.merges) : { rows: t.rows, merges: t.merges };
      return {
        pages: [page.page],
        method: t.method,
        rows: grid.rows,
        merges: grid.merges,
        headerRows: guessHeaderRows(grid.rows, grid.merges),
        rtl: t.rtl,
        edges: t.edges,
        top: t.top,
        bottom: t.bottom,
        droppedHeaders: 0,
      };
    });
}

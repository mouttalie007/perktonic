import { detectPage } from "./detect";
import { mergeAcrossPages } from "./merge";
import { readPage, type OpsLike, type PageLike } from "./pageData";
import type { MethodChoice, PageData, Table } from "./types";

export interface DocLike {
  numPages: number;
  getPage(n: number): Promise<PageLike>;
}

export interface Analysis {
  tables: Table[];
  pagesRead: number[];
  /** No page had any text: probably a scan. */
  textless: boolean;
}

export async function analyseDoc(doc: DocLike, opts: { pages: number[]; method: MethodChoice; ops: OpsLike; onPage?: (done: number, total: number) => void; shouldStop?: () => boolean }): Promise<Analysis> {
  const data: PageData[] = [];
  for (const [i, n] of opts.pages.entries()) {
    if (opts.shouldStop?.()) break;
    data.push(await readPage(await doc.getPage(n), n, opts.ops));
    opts.onPage?.(i + 1, opts.pages.length);
  }
  return analysePages(data, opts.method);
}

export function analysePages(data: PageData[], method: MethodChoice): Analysis {
  const textless = data.every((p) => p.runs.length === 0);
  const perPage = data.map((page) => ({ page, tables: detectPage(page, method) }));
  return { tables: mergeAcrossPages(perPage), pagesRead: data.map((p) => p.page), textless };
}

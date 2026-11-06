export interface FileHeader {
  name: string;
  header: string[];
}

export interface MergePlan {
  columns: string[];
  /** For each file: where each output column comes from (-1 = missing, left empty). */
  maps: number[][];
  report: { name: string; missing: string[]; extra: string[]; renamed: { from: string; to: string }[] }[];
}

const loose = (h: string) => h.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Aligns columns by header name. The output keeps the first file's order and
 * appends columns that appear later, in the order they are first seen.
 */
export function planMerge(files: FileHeader[], opts: { looseHeaders: boolean; addSource: boolean }): MergePlan {
  const key = opts.looseHeaders ? loose : (h: string) => h;
  const columns: string[] = [];
  const index = new Map<string, number>();
  for (const f of files) {
    for (const h of f.header) {
      const k = key(h);
      if (!index.has(k)) {
        index.set(k, columns.length);
        columns.push(opts.looseHeaders ? h.trim() : h);
      }
    }
  }
  const maps: number[][] = [];
  const report: MergePlan["report"] = [];
  for (const f of files) {
    const map = new Array<number>(columns.length).fill(-1);
    const renamed: { from: string; to: string }[] = [];
    f.header.forEach((h, i) => {
      const col = index.get(key(h))!;
      // With duplicate headers in one file, the first one wins.
      if (map[col] === -1) map[col] = i;
      if (h !== columns[col]) renamed.push({ from: h, to: columns[col] });
    });
    const present = new Set(f.header.map(key));
    report.push({
      name: f.name,
      missing: columns.filter((c) => !present.has(key(c))),
      extra: f === files[0] ? [] : f.header.filter((h) => !files[0].header.some((x) => key(x) === key(h))),
      renamed,
    });
    maps.push(map);
  }
  if (opts.addSource) columns.push(uniqueSourceName(columns));
  return { columns, maps, report };
}

function uniqueSourceName(columns: string[]): string {
  let name = "source_file";
  for (let n = 2; columns.includes(name); n++) name = `source_file_${n}`;
  return name;
}

export function mapRow(row: string[], map: number[], source: string | null): string[] {
  const out = map.map((i) => (i === -1 ? "" : (row[i] ?? "")));
  if (source !== null) out.push(source);
  return out;
}

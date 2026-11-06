import { zipSync } from "fflate";
import { combinedCsv, csvName, encode, tableCsv, type CsvOptions, type Encoding } from "./csv";
import type { Table } from "./pdfTables";

export interface Output {
  name: string;
  bytes: Uint8Array;
  type: string;
  /** Characters replaced by "?" because the encoding cannot hold them. */
  replaced: number;
}

/** One table → one .csv; several → a ZIP of table-1-p2.csv, … ; or one combined .csv. */
export function buildOutput(tables: { table: Table; index: number }[], o: CsvOptions & { encoding: Encoding; combined: boolean; base: string }): Output {
  const base = o.base.replace(/\.pdf$/i, "").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "tables";
  if (o.combined || tables.length === 1) {
    const text = o.combined ? combinedCsv(tables, o) : tableCsv(tables[0].table, o);
    const { bytes, replaced } = encode(text, o.encoding);
    return { name: o.combined ? `${base}-tables.csv` : `${base}-${csvName(tables[0].table, tables[0].index)}`, bytes, type: "text/csv", replaced };
  }
  let replaced = 0;
  const files: Record<string, Uint8Array> = {};
  for (const t of tables) {
    const e = encode(tableCsv(t.table, o), o.encoding);
    replaced += e.replaced;
    files[csvName(t.table, t.index)] = e.bytes;
  }
  return { name: `${base}-tables.zip`, bytes: zipSync(files, { level: 6 }), type: "application/zip", replaced };
}

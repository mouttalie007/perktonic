import { XMLParser, XMLValidator } from "fast-xml-parser";
import { parse as parseTomlText, stringify as stringifyToml } from "smol-toml";
import YAML from "yaml";
import { detectDelimiter, parseCsv, type Delimiter } from "./csvParser";
import { quoteCell } from "./csvWriter";
import { recordsToTable, rowsToRecords, typed, type Rec, type Value } from "./tree";
import { toXml, xmlNameProblem } from "./xml";
import { toYaml } from "./yamlWriter";
import type { ConvertOptions, Format } from "./options";

export class ConvertError extends Error {
  constructor(
    message: string,
    readonly line: number | null = null,
  ) {
    super(message);
  }
}

export interface Converted {
  output: string;
  /** For → CSV: the table, for the preview grid. */
  table: { headers: string[]; rows: string[][] } | null;
  rowCount: number;
  notes: string[];
}

function readCsv(text: string): { headers: string[]; rows: string[][]; delimiter: Delimiter; notes: string[] } {
  const clean = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(clean);
  const parsed = parseCsv(clean, delimiter);
  const grid = parsed.rows.filter((r) => !(r.length === 1 && r[0] === ""));
  if (grid.length === 0) throw new ConvertError("The CSV is empty.");
  const notes: string[] = [];
  if (parsed.unclosedQuote) notes.push("A quoted field is never closed, so the rest of the file was read as one value.");
  const width = grid.reduce((w, r) => Math.max(w, r.length), 0);
  const headers = grid[0].map((h) => h.trim());
  while (headers.length < width) headers.push(`column_${headers.length + 1}`);
  const seen = new Map<string, number>();
  headers.forEach((h, i) => {
    const base = h || `column_${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    headers[i] = n > 1 ? `${base}_${n}` : base;
    if (n > 1) notes.push(`The header “${base}” appears more than once; the copy is called “${headers[i]}”.`);
  });
  return { headers, rows: grid.slice(1), delimiter, notes };
}

function countNulls(v: Value): number {
  if (v === null) return 1;
  if (Array.isArray(v)) return v.reduce<number>((n, x) => n + countNulls(x), 0);
  if (typeof v === "object") return Object.values(v).reduce<number>((n, x) => n + countNulls(x), 0);
  return 0;
}

function stripNulls(v: Value): Value | undefined {
  if (v === null) return undefined;
  if (Array.isArray(v)) return v.map(stripNulls).filter((x): x is Value => x !== undefined);
  if (typeof v === "object") {
    const out: Rec = {};
    for (const [k, x] of Object.entries(v)) {
      const s = stripNulls(x);
      if (s !== undefined) out[k] = s;
    }
    return out;
  }
  return v;
}

function fromCsv(text: string, to: Exclude<Format, "csv">, o: ConvertOptions): Converted {
  const { headers, rows, notes } = readCsv(text);
  if (rows.length === 0) throw new ConvertError("The CSV has a header row but no data rows.");
  const { records, notes: treeNotes } = rowsToRecords(headers, rows, { detectTypes: o.detectTypes, nest: o.nest, listSeparator: o.listSeparator || "|" });
  notes.push(...treeNotes);
  let output: string;
  if (to === "yaml") {
    output = toYaml(records, o.yamlRoot.trim());
  } else if (to === "toml") {
    const key = o.tomlKey.trim() || "rows";
    const nulls = records.reduce((n, r) => n + countNulls(r), 0);
    if (nulls) notes.push(`${nulls.toLocaleString("en-US")} empty cell${nulls === 1 ? " was" : "s were"} left out: TOML has no null, so a missing key is the only way to say “no value”.`);
    output = stringifyToml({ [key]: records.map((r) => stripNulls(r) as Rec) });
  } else {
    for (const [label, name] of [["Root element", o.xmlRoot], ["Row element", o.xmlRow]] as const) {
      const p = xmlNameProblem(name.trim());
      if (p) throw new ConvertError(`${label} name “${name}” ${p}. Example: ${label === "Root element" ? "products" : "product"}.`);
    }
    const r = toXml(records, { root: o.xmlRoot.trim(), row: o.xmlRow.trim(), attributes: o.xmlAttributes });
    if (r.renamed.length) notes.push(`Some headers are not legal XML names and were renamed: ${r.renamed.slice(0, 8).join(", ")}${r.renamed.length > 8 ? "…" : ""}.`);
    output = r.xml;
  }
  return { output, table: null, rowCount: records.length, notes };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);

/**
 * Finds the list of records in a parsed document: the document itself if it
 * is a list; otherwise the longest list of objects within three levels; or,
 * failing that, the innermost single object as one record.
 */
export function findRecords(data: unknown): { records: unknown[]; path: string; skipped: string[] } {
  if (Array.isArray(data)) return { records: data, path: "", skipped: [] };
  if (!isObj(data)) return { records: [{ value: data }], path: "", skipped: [] };
  let best: { list: unknown[]; path: string[] } | null = null;
  const visit = (v: unknown, path: string[], depth: number) => {
    if (depth > 3) return;
    if (Array.isArray(v)) {
      if (v.some(isObj) && (!best || v.length > best.list.length)) best = { list: v, path };
      return;
    }
    if (isObj(v)) for (const [k, x] of Object.entries(v)) visit(x, [...path, k], depth + 1);
  };
  visit(data, [], 0);
  const found = best as { list: unknown[]; path: string[] } | null;
  if (found) {
    const top = found.path[0];
    const skipped = Object.keys(data).filter((k) => k !== top);
    return { records: found.list, path: found.path.join("."), skipped };
  }
  let node: Record<string, unknown> = data;
  const path: string[] = [];
  while (Object.keys(node).length === 1 && isObj(Object.values(node)[0])) {
    const k = Object.keys(node)[0];
    path.push(k);
    node = node[k] as Record<string, unknown>;
  }
  return { records: [node], path: path.join("."), skipped: [] };
}

function typeLeaves(v: unknown, detect: boolean): unknown {
  if (typeof v === "string") return typed(v, detect);
  if (Array.isArray(v)) return v.map((x) => typeLeaves(x, detect));
  if (isObj(v)) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      // Attributes become plain columns; "@" stays only when a child element has the same name.
      const key = k.startsWith("@") && !(k.slice(1) in v) ? k.slice(1) : k === "#text" ? "text" : k;
      out[key] = typeLeaves(x, detect);
    }
    return out;
  }
  return v;
}

export function parseSource(text: string, from: Exclude<Format, "csv">, detectTypes: boolean): unknown {
  const body = text.replace(/^﻿/, "");
  if (body.trim() === "") throw new ConvertError(`The ${from.toUpperCase()} is empty.`);
  if (from === "yaml") {
    const docs = YAML.parseAllDocuments(body, { uniqueKeys: false, merge: true });
    const list = Array.isArray(docs) ? docs : [docs];
    for (const d of list) {
      const err = d.errors[0];
      if (err) throw new ConvertError(`YAML error: ${err.message.split("\n")[0]}`, err.linePos?.[0]?.line ?? null);
    }
    try {
      const values = list.map((d) => d.toJS({ maxAliasCount: 1000 }));
      return values.length === 1 ? values[0] : values;
    } catch (e) {
      throw new ConvertError(/alias/i.test((e as Error).message) ? "This YAML uses aliases to expand into a huge document (an “alias bomb”), so it was not read." : `YAML error: ${(e as Error).message}`);
    }
  }
  if (from === "toml") {
    try {
      return parseTomlText(body);
    } catch (e) {
      const err = e as { message: string; line?: number };
      throw new ConvertError(`TOML error: ${err.message.split("\n")[0]}`, err.line ?? null);
    }
  }
  // Data files never need a DTD; refusing one also rules out entity-expansion attacks.
  if (/<!DOCTYPE|<!ENTITY/i.test(body)) throw new ConvertError("The XML declares a DOCTYPE or entities. Remove the <!DOCTYPE …> part and try again.");
  const v = XMLValidator.validate(body);
  if (v !== true) throw new ConvertError(`XML error: ${v.err.msg}`, v.err.line);
  const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", textNodeName: "#text", parseTagValue: false, parseAttributeValue: false, trimValues: true, ignoreDeclaration: true, ignorePiTags: true, processEntities: true, htmlEntities: false }).parse(body);
  // An empty element is read as "", which typeLeaves turns into null like an empty CSV cell.
  return typeLeaves(parsed, detectTypes);
}

function toCsvText(headers: string[], rows: string[][], delimiter: Delimiter, bom: boolean): string {
  const lines = [headers, ...rows].map((r) => r.map((c) => quoteCell(c, delimiter)).join(delimiter));
  return (bom ? "﻿" : "") + lines.join("\r\n") + "\r\n";
}

function toCsv(text: string, from: Exclude<Format, "csv">, o: ConvertOptions): Converted {
  const data = parseSource(text, from, o.detectTypes);
  const { records, path, skipped } = findRecords(data);
  const notes: string[] = [];
  if (path) notes.push(`Rows were taken from “${path}” (${records.length.toLocaleString("en-US")} item${records.length === 1 ? "" : "s"}).`);
  if (skipped.length) notes.push(`Not included: ${skipped.map((s) => `“${s}”`).join(", ")}. A CSV holds one table, so only the largest list became rows.`);
  const sep = o.listSeparator || "|";
  const t = recordsToTable(records.map((r) => (isObj(r) ? r : { value: r })), sep);
  notes.push(...t.losses);
  if (t.headers.length === 0) throw new ConvertError("No values were found to put in a table.");
  return { output: toCsvText(t.headers, t.rows, o.delimiter, o.bom), table: { headers: t.headers, rows: t.rows.slice(0, 20) }, rowCount: t.rows.length, notes };
}

export function convert(text: string, o: ConvertOptions): Converted {
  if (o.from === "csv" && o.to !== "csv") return fromCsv(text, o.to, o);
  if (o.to === "csv" && o.from !== "csv") return toCsv(text, o.from, o);
  throw new ConvertError("One side of the conversion must be CSV.");
}

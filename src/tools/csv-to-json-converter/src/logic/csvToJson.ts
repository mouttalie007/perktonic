import { CsvStreamParser, detectDelimiter, type Delimiter } from "./csvParser";
import { unflatten } from "./nesting";
import { inferValue, normalizeHeaders, type HeaderFix, type InferOptions, type JsonValue } from "./values";

export interface CsvToJsonOptions {
  delimiter: Delimiter | "auto";
  hasHeader: boolean;
  infer: InferOptions;
  nest: boolean;
  separator: string;
  nestArrays: boolean;
  output: "array" | "ndjson";
  indent: 0 | 2 | 4;
}

export interface CsvToJsonSummary {
  rows: number;
  columns: string[];
  delimiter: Delimiter;
  headerFixes: HeaderFix[];
  conflicts: string[];
  raggedRows: number;
  unclosedQuote: boolean;
  preview: JsonValue[];
}

const DETECT_BYTES = 64 * 1024;
const PREVIEW_COUNT = 10;

/**
 * Streams CSV text in, JSON text out through `emit`, keeping only one row in
 * memory at a time (plus a 64 KB sample for delimiter detection).
 */
export class CsvToJsonStream {
  private parser: CsvStreamParser | null = null;
  private pending = "";
  private headers: string[] | null = null;
  private count = 0;
  private summary: CsvToJsonSummary;
  private conflictSet = new Set<string>();

  constructor(
    private readonly opts: CsvToJsonOptions,
    private readonly emit: (text: string) => void,
  ) {
    this.summary = {
      rows: 0,
      columns: [],
      delimiter: opts.delimiter === "auto" ? "," : opts.delimiter,
      headerFixes: [],
      conflicts: [],
      raggedRows: 0,
      unclosedQuote: false,
      preview: [],
    };
  }

  push(text: string): void {
    if (!this.parser) {
      this.pending += text;
      if (this.pending.length < DETECT_BYTES) return;
      this.start();
      return;
    }
    this.handleRows(this.parser.push(text));
  }

  end(): CsvToJsonSummary {
    if (!this.parser) this.start();
    const parser = this.parser as CsvStreamParser;
    this.handleRows(parser.end());
    this.summary.unclosedQuote = parser.unclosedQuote;
    if (this.opts.output === "array") this.emit(this.count === 0 ? "[]\n" : this.opts.indent ? "\n]\n" : "]\n");
    this.summary.rows = this.count;
    this.summary.conflicts = [...this.conflictSet];
    if (this.headers) this.summary.columns = this.headers;
    return this.summary;
  }

  private start() {
    let text = this.pending;
    this.pending = "";
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const delimiter = this.opts.delimiter === "auto" ? detectDelimiter(text) : this.opts.delimiter;
    this.summary.delimiter = delimiter;
    this.parser = new CsvStreamParser(delimiter);
    this.handleRows(this.parser.push(text));
  }

  private handleRows(rows: string[][]) {
    for (const row of rows) {
      if (row.length === 1 && row[0] === "") continue;
      if (this.opts.hasHeader && !this.headers) {
        const { headers, fixes } = normalizeHeaders(row);
        this.headers = headers;
        this.summary.headerFixes = fixes;
        continue;
      }
      this.writeRecord(this.toRecord(row));
    }
  }

  private toRecord(row: string[]): JsonValue {
    const infer = (v: string) => inferValue(v, this.opts.infer);
    if (!this.headers) return row.map(infer);
    const headers = this.headers;
    if (row.length !== headers.length) this.summary.raggedRows++;
    const flat: Record<string, JsonValue> = {};
    for (let i = 0; i < headers.length; i++) flat[headers[i]] = i < row.length ? infer(row[i]) : this.opts.infer.emptyAsNull ? null : "";
    for (let i = headers.length; i < row.length; i++) {
      if (row[i] === "") continue;
      flat[`column_${i + 1}`] = infer(row[i]);
    }
    if (!this.opts.nest) return flat;
    const { value, conflicts } = unflatten(flat, this.opts.separator, this.opts.nestArrays);
    for (const c of conflicts) this.conflictSet.add(c);
    return value;
  }

  private writeRecord(record: JsonValue) {
    if (this.summary.preview.length < PREVIEW_COUNT) this.summary.preview.push(record);
    const indent = this.opts.indent;
    if (this.opts.output === "ndjson") {
      this.emit(JSON.stringify(record) + "\n");
    } else if (indent === 0) {
      this.emit((this.count === 0 ? "[" : ",") + JSON.stringify(record));
    } else {
      const pad = " ".repeat(indent);
      const body = pad + JSON.stringify(record, null, indent).replace(/\n/g, "\n" + pad);
      this.emit((this.count === 0 ? "[\n" : ",\n") + body);
    }
    this.count++;
  }
}

export function csvToJson(text: string, opts: CsvToJsonOptions): { json: string; summary: CsvToJsonSummary } {
  const parts: string[] = [];
  const stream = new CsvToJsonStream(opts, (s) => parts.push(s));
  stream.push(text);
  const summary = stream.end();
  return { json: parts.join(""), summary };
}

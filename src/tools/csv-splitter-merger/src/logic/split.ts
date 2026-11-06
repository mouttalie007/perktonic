import type { Delimiter } from "./csvParser";
import { quoteCell } from "./csvWriter";
import { NameRegistry, sanitizeFileName } from "./filenames";
import { MAX_OUTPUT_FILES, type PartInfo, type SplitOptions } from "./limits";
import { utf8Length } from "./utf8";

/** Where the parts go: the worker writes them into a ZIP, tests keep them in memory. */
export interface Sink {
  open(name: string): number;
  write(id: number, text: string): void;
  close(id: number): void;
}

export class SplitError extends Error {}

const BOM = "﻿";
const EOL = "\r\n";
const PREVIEW_LINES = 6;

export function rowToLine(row: string[], delimiter: Delimiter): string {
  return row.map((c) => quoteCell(c, delimiter)).join(delimiter) + EOL;
}

interface Part extends PartInfo {
  id: number;
  open: boolean;
}

/**
 * Turns a stream of rows into parts. Rows arrive in order and are written
 * straight to the sink, so memory stays flat however long the file is.
 */
export class Splitter {
  private header: string | null = null;
  private headerRow: string[] | null = null;
  private parts: Part[] = [];
  private current: Part | null = null;
  private byValue = new Map<string, Part>();
  private names = new NameRegistry();
  private seenFirst = false;
  rows = 0;
  oversizedRows = 0;

  constructor(
    private opts: SplitOptions,
    private delimiter: Delimiter,
    private base: string,
    private sink: Sink,
  ) {
    if (opts.mode === "rows" && !(opts.rowsPerPart >= 1)) throw new SplitError("Enter how many rows each part should have (1 or more).");
    if (opts.mode === "size" && !(opts.maxBytes >= 1024)) throw new SplitError("Each part must be allowed at least 1 KB.");
  }

  get headerCells(): string[] | null {
    return this.headerRow;
  }

  push(rows: string[][]): void {
    for (const row of rows) {
      if (!this.seenFirst) {
        this.seenFirst = true;
        if (this.opts.hasHeader) {
          this.headerRow = row;
          this.header = rowToLine(row, this.delimiter);
          if (this.opts.mode === "column" && this.opts.column >= row.length) throw new SplitError(`The file has ${row.length} columns, so column ${this.opts.column + 1} does not exist.`);
          continue;
        }
      }
      // A completely empty line (often the last one) is not a data row.
      if (row.length === 1 && row[0] === "") continue;
      this.rows++;
      const line = rowToLine(row, this.delimiter);
      const part = this.partFor(row, line);
      this.write(part, line);
    }
  }

  private newPart(name: string): Part {
    if (this.parts.length >= MAX_OUTPUT_FILES) {
      throw new SplitError(
        this.opts.mode === "column"
          ? `This column has more than ${MAX_OUTPUT_FILES} different values, and the limit is ${MAX_OUTPUT_FILES} files. It may be an ID column: pick a column with fewer values, or split by rows.`
          : `That would make more than ${MAX_OUTPUT_FILES} files. Use bigger parts.`,
      );
    }
    const id = this.sink.open(name);
    const part: Part = { id, name, rows: 0, bytes: 0, preview: [], open: true };
    this.parts.push(part);
    const head = (this.opts.bom ? BOM : "") + (this.header ?? "");
    if (head) {
      this.sink.write(id, head);
      part.bytes += utf8Length(head);
      if (this.header) part.preview.push(this.header.slice(0, -2));
    }
    return part;
  }

  private partName(n: number): string {
    return this.names.take(`${this.base}-part-${String(n).padStart(3, "0")}`, ".csv");
  }

  private partFor(row: string[], line: string): Part {
    const { mode } = this.opts;
    if (mode === "column") {
      const value = row[this.opts.column] ?? "";
      let part = this.byValue.get(value);
      if (!part) {
        part = this.newPart(this.names.take(sanitizeFileName(value), ".csv"));
        this.byValue.set(value, part);
      }
      return part;
    }
    const cur = this.current;
    if (mode === "rows") {
      if (!cur || cur.rows >= this.opts.rowsPerPart) return this.rotate();
      return cur;
    }
    const len = utf8Length(line);
    if (!cur) return this.rotate();
    if (cur.rows > 0 && cur.bytes + len > this.opts.maxBytes) return this.rotate();
    return cur;
  }

  private rotate(): Part {
    if (this.current) this.closePart(this.current);
    this.current = this.newPart(this.partName(this.parts.length + 1));
    return this.current;
  }

  private write(part: Part, line: string) {
    this.sink.write(part.id, line);
    const len = utf8Length(line);
    part.bytes += len;
    part.rows++;
    if (this.opts.mode === "size" && part.rows === 1 && part.bytes > this.opts.maxBytes) this.oversizedRows++;
    if (part.preview.length < PREVIEW_LINES) part.preview.push(line.length > 300 ? line.slice(0, 300) + "…" : line.slice(0, -2));
  }

  private closePart(p: Part) {
    if (!p.open) return;
    p.open = false;
    this.sink.close(p.id);
  }

  finish(): PartInfo[] {
    if (!this.seenFirst) throw new SplitError("The file has no rows.");
    if (this.rows === 0) throw new SplitError("The file has a header but no data rows to split.");
    for (const p of this.parts) this.closePart(p);
    return this.parts.map(({ name, rows, bytes, preview }) => ({ name, rows, bytes, preview }));
  }
}

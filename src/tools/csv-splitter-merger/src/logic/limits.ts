// No imports: shared by the page, the worker and the logic.

export const MAX_PASTE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_MERGE_FILES = 50;
export const MAX_MERGE_BYTES = 500 * 1024 * 1024;
export const MAX_OUTPUT_FILES = 500;

export type SplitMode = "rows" | "size" | "column";
export type OutDelimiter = "," | ";" | "\t";

export interface SplitOptions {
  mode: SplitMode;
  rowsPerPart: number;
  /** Maximum bytes per part, header and BOM included. */
  maxBytes: number;
  /** Index of the column whose values decide the file. */
  column: number;
  hasHeader: boolean;
  bom: boolean;
}

export interface MergeOptions {
  delimiter: OutDelimiter;
  addSource: boolean;
  /** Match "Email" and " email " as the same column. */
  looseHeaders: boolean;
  bom: boolean;
}

export interface PartInfo {
  name: string;
  rows: number;
  bytes: number;
  /** First lines, for the preview. */
  preview: string[];
}

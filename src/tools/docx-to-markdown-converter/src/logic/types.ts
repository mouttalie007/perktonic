// No imports: shared by the page, the worker and the logic.

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_PASTE_BYTES = 5 * 1024 * 1024;

export type Direction = "toMarkdown" | "toDocx";
export type ImageMode = "inline" | "zip";

export interface Warning {
  /** What was found, in a few words: "Comments", "Equations"… */
  feature: string;
  count: number;
  /** What the converter did with it. */
  action: string;
  level: "lost" | "changed" | "info";
}

export interface DocStats {
  headings: number;
  paragraphs: number;
  lists: number;
  tables: number;
  images: number;
  links: number;
  codeBlocks: number;
  footnotes: number;
}

import type { Analysis, MethodChoice } from "../logic/pdfTables";

export interface AnalyseRequest {
  bytes: ArrayBuffer;
  password?: string;
  range: string;
  method: MethodChoice;
}

export type ErrorCode = "password_required" | "password_wrong" | "invalid" | "too_many_pages" | "range";

/** pdf.js's own worker code, loaded in the same worker, also posts messages; ours carry this tag. */
export const TAG = "pdf-tables" as const;

export type AnalyseMessage = { tag: typeof TAG } & (
  | { type: "opened"; numPages: number; pages: number }
  | { type: "progress"; done: number; total: number }
  | { type: "done"; analysis: Analysis; numPages: number }
  | { type: "error"; code: ErrorCode; message: string }
);

type Untagged<T> = T extends unknown ? Omit<T, "tag"> : never;
export type AnalyseBody = Untagged<AnalyseMessage>;

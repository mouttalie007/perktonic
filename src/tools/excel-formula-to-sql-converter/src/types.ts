// Response types shared by the route and the browser component (type-only imports).
import type { Target } from "./limits";
import type { PandasCheck } from "./logic/pandasCheck";
import type { SqlCheck } from "./logic/sqlCheck";

export interface MappingRow {
  spreadsheet: string;
  target: string;
  note: string;
}

export type ConvertResult =
  | {
      status: "ok";
      target: Target;
      code: string;
      explanation: string;
      mapping: MappingRow[];
      assumptions: string[];
      /** The model's warnings plus ours (sourceWarnings), without duplicates. */
      warnings: string[];
      check: { kind: "sql"; result: SqlCheck } | { kind: "pandas"; result: PandasCheck };
      notes: string[];
      cached: boolean;
    }
  | { status: "needs_clarification" | "refused"; target: Target; message: string; cached: boolean };

export type ApiResponse = { ok: true; data: ConvertResult } | { ok: false; error: { code: string; message: string } };

// Response types shared by the route and the browser component (no runtime imports).
import type { FormulaWarning } from "./logic/checks";

export type AiDiagnosis =
  | {
      status: "ok";
      formula: string;
      diagnosis: string;
      correctedFormula: string | null;
      assumptions: string[];
      preventionTips: string[];
      /** Our own checks on correctedFormula (function names, brackets, quotes, separators). */
      warnings: FormulaWarning[];
      /** Things we noticed about the answer as a whole. */
      notes: string[];
      cached: boolean;
    }
  | { status: "needs_clarification" | "refused"; formula: string; message: string; cached: boolean };

export type ApiResponse = { ok: true; data: AiDiagnosis } | { ok: false; error: { code: string; message: string } };

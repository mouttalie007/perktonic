// Response types shared by the route and the browser component (type-only, no runtime imports).
import type { FormulaWarning, Platform } from "./logic/checks";

export interface CheckSummary {
  warnings: FormulaWarning[];
  unknownFunctions: string[];
  newFunctions: string[];
  separator: "comma" | "semicolon" | "mixed" | "none";
}

export type GeneratorResult =
  | {
      status: "ok";
      platform: Platform;
      formula: string;
      explanation: string;
      alternative: { formula: string; whenToPrefer: string } | null;
      assumptions: string[];
      checks: { formula: CheckSummary; alternative: CheckSummary | null };
      /** Problems with the answer as a whole (for example a missing fallback). */
      notes: string[];
      cached: boolean;
    }
  | { status: "needs_clarification" | "refused"; platform: Platform; message: string; cached: boolean };

export type ApiResponse = { ok: true; data: GeneratorResult } | { ok: false; error: { code: string; message: string } };

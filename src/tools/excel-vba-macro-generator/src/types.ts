// Response types shared by the route and the browser component (type-only imports).
import type { SafetyFlag } from "./logic/detector";

export interface Risk {
  line: number | null;
  text: string;
}

interface Common {
  /** Our own detector, always shown first. */
  safety: SafetyFlag[];
  platformNotes: string[];
  /** The model's own list, shown in addition. */
  modelRisks: Risk[];
  cached: boolean;
}

export type MacroResult =
  | ({ mode: "generate"; status: "ok"; summary: string; code: string; howToRun: string[]; assumptions: string[] } & Common)
  | ({ mode: "explain"; status: "ok"; code: string; summary: string; lines: { from: number; to: number; text: string }[]; dropped: number; unexplained: number[] } & Common)
  | { mode: "generate" | "explain"; status: "needs_clarification" | "refused"; message: string; safety: SafetyFlag[]; platformNotes: string[]; cached: boolean };

export type ApiResponse = { ok: true; data: MacroResult } | { ok: false; error: { code: string; message: string } };

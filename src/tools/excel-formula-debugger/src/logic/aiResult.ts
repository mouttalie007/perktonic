import type { AiDiagnosis } from "../types";
import { checkFormula, type Platform } from "./checks";
import { parseFormula } from "./parse";

export type Answer =
  | { status: "ok"; diagnosis: string; correctedFormula: string | null; assumptions: string[]; preventionTips: string[] }
  | { status: "needs_clarification" | "refused"; message: string };

const WRAPPERS = new Set(["IFERROR", "IFNA"]);

function topFunction(f: string): string | null {
  try {
    const { ast } = parseFormula(f);
    return ast.type === "call" ? ast.name : null;
  } catch {
    return null;
  }
}

/** Our checks on the AI answer. Problems become visible notes; nothing is invented. */
export function buildAiResult(answer: Answer, formula: string, platform: Platform, cached: boolean): AiDiagnosis {
  if (answer.status !== "ok") return { status: answer.status, formula, message: answer.message, cached };
  const notes: string[] = [];
  let corrected = answer.correctedFormula;
  const tips = [...answer.preventionTips];
  const originalWrapped = WRAPPERS.has(topFunction(formula) ?? "");
  if (corrected && !originalWrapped && WRAPPERS.has(topFunction(corrected) ?? "")) {
    // A wrapper only hides the error: keep it as a tip, never as the fix.
    notes.push(`The AI's correction only wrapped the formula in ${topFunction(corrected)}, which hides the error instead of fixing it, so it is listed as a tip, not as the fix.`);
    if (tips.length < 4) tips.push(`Only once the cause is fixed, and only if errors are expected: ${corrected}`);
    corrected = null;
  }
  if (!originalWrapped && /\b(IFERROR|IFNA)\b/i.test(answer.diagnosis)) notes.push("The diagnosis mentions IFERROR/IFNA. Wrapping hides errors; look for the cause first.");
  if (corrected && corrected.replace(/\s/g, "") === formula.trim().replace(/\s/g, "")) {
    notes.push("The suggested formula is the same as yours, so the cause is probably in the data, not in the formula.");
    corrected = null;
  }
  const warnings = corrected ? checkFormula(corrected, platform).warnings : [];
  return { status: "ok", formula, diagnosis: answer.diagnosis, correctedFormula: corrected, assumptions: answer.assumptions, preventionTips: tips, warnings, notes, cached };
}

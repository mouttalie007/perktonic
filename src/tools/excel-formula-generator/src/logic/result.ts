import type { CheckSummary, GeneratorResult } from "../types";
import { checkFormula, type Platform } from "./checks";

/** Shape of a valid model answer (mirrors src/llm/schema.ts without importing zod). */
export type Answer =
  | { status: "ok"; formula: string; explanation: string; alternative: { formula: string; whenToPrefer: string } | null; assumptions: string[] }
  | { status: "needs_clarification" | "refused"; message: string };

export function summarise(formula: string, platform: Platform): CheckSummary {
  const c = checkFormula(formula, platform);
  return { warnings: c.warnings, unknownFunctions: c.unknownFunctions, newFunctions: c.newFunctions, separator: c.separator };
}

/** Run our own checks on the model's answer. Failures become visible warnings; nothing is rewritten. */
export function buildResult(answer: Answer, platform: Platform, cached: boolean): GeneratorResult {
  if (answer.status !== "ok") return { status: answer.status, platform, message: answer.message, cached };
  const main = summarise(answer.formula, platform);
  const alt = answer.alternative ? summarise(answer.alternative.formula, platform) : null;
  const notes: string[] = [];
  const old = platform === "excel2019" || platform === "libreoffice";
  if (old && main.newFunctions.length) {
    if (!answer.alternative) notes.push(`No fallback was given for ${main.newFunctions.join(", ")}. Ask again and mention your version, or use the Cross-Platform Formula Translator.`);
    else if (alt && alt.newFunctions.length) notes.push(`The alternative also uses ${alt.newFunctions.join(", ")}, so it is not a fallback for your version.`);
  }
  if (answer.alternative && answer.alternative.formula.replace(/\s/g, "") === answer.formula.replace(/\s/g, "")) notes.push("The alternative is the same formula as the main answer.");
  return {
    status: "ok",
    platform,
    formula: answer.formula,
    explanation: answer.explanation,
    alternative: answer.alternative,
    assumptions: answer.assumptions,
    checks: { formula: main, alternative: alt },
    notes,
    cached,
  };
}

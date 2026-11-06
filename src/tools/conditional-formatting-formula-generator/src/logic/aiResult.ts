import type { App } from "../limits";
import type { AiRule } from "../types";
import { anchorWarnings } from "./anchors";
import { checkBalance, checkFormula } from "./checks";
import { parseRange, rangeText } from "./range";

export type Answer =
  | { status: "ok"; kind: "conditional_formatting" | "data_validation"; formula: string; appliesTo: string; formatSuggestion: string | null; stepsExcel: string[]; stepsSheets: string[]; notes: string[]; assumptions: string[] }
  | { status: "needs_clarification" | "refused"; message: string };

/** Our checks on the AI rule: shown as warnings, never fixed silently. */
export function ruleWarnings(formula: string, appliesTo: string, platform: App, visitorRange: string): string[] {
  const warnings: string[] = [];
  for (const b of checkBalance(formula)) warnings.push(b.text);
  const c = checkFormula(formula, platform === "sheets" ? "sheets" : "excel365");
  if (c.unknownFunctions.length) warnings.push(`Unverified: ${c.unknownFunctions.join(", ")} ${c.unknownFunctions.length === 1 ? "is" : "are"} not in our list of ${platform === "sheets" ? "Google Sheets" : "Excel"} functions.`);
  if (c.separator === "semicolon" || c.separator === "mixed") warnings.push("The formula uses semicolons between arguments; English-locale spreadsheets need commas.");
  const r = parseRange(appliesTo);
  if (!r) warnings.push(`“${appliesTo}” is not a range we can check, so the $ anchors were not verified.`);
  else {
    warnings.push(...anchorWarnings(formula, r));
    const v = parseRange(visitorRange);
    if (v && rangeText(v) !== rangeText(r)) warnings.push(`The AI applies the rule to ${rangeText(r)}, not to your range ${rangeText(v)}.`);
  }
  return warnings;
}

export function buildAiResult(answer: Answer, input: { range: string; platform: App }, cached: boolean): AiRule {
  if (answer.status !== "ok") return { status: answer.status, message: answer.message, cached };
  return { ...answer, warnings: ruleWarnings(answer.formula, answer.appliesTo, input.platform, input.range), cached };
}

import type { Target } from "../limits";
import type { ConvertResult, MappingRow } from "../types";
import { checkPandas } from "./pandasCheck";
import type { SqlCheck } from "./sqlCheck";
import { sourceWarnings } from "./sourceNotes";

export type Answer =
  | { status: "ok"; code: string; explanation: string; mapping: MappingRow[]; assumptions: string[]; warnings: string[] }
  | { status: "needs_clarification" | "refused"; message: string };

const DESTRUCTIVE = /\b(DROP\s+(TABLE|DATABASE|SCHEMA)|DELETE\s+FROM|TRUNCATE\s+TABLE|UPDATE\s+\w+\s+SET|ALTER\s+TABLE)\b/i;

/** `sql` is injected so this file (and the browser) never imports the SQL parser. */
export function buildResult(answer: Answer, input: { source: string; schema: string; target: Target }, sql: (code: string, target: Exclude<Target, "pandas">) => SqlCheck, cached: boolean): ConvertResult {
  if (answer.status !== "ok") return { status: answer.status, target: input.target, message: answer.message, cached };
  const ours = sourceWarnings(input.source);
  const warnings = [...answer.warnings];
  for (const w of ours) if (!warnings.some((x) => x.slice(0, 40) === w.slice(0, 40))) warnings.push(w);
  const notes: string[] = [];
  if (!input.schema.trim() && answer.assumptions.length === 0) notes.push("No table or column names were given, and the AI did not say which ones it assumed: check the names in the code before running it.");
  if (input.target !== "pandas" && DESTRUCTIVE.test(answer.code)) notes.push("The code contains a statement that changes or deletes data (DROP, DELETE, UPDATE, TRUNCATE or ALTER). This converter should only produce queries; do not run it before reading it.");
  const check: Extract<ConvertResult, { status: "ok" }>["check"] = input.target === "pandas" ? { kind: "pandas", result: checkPandas(answer.code) } : { kind: "sql", result: sql(answer.code, input.target) };
  return { status: "ok", target: input.target, code: answer.code, explanation: answer.explanation, mapping: answer.mapping, assumptions: answer.assumptions, warnings, check, notes, cached };
}

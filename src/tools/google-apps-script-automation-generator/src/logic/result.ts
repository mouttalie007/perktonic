import type { GeneratorResult, SyntaxSummary } from "../types";
import { triggerWarnings } from "./checkTrigger";
import { quotaNotes } from "./quotas";
import { reviewScript } from "./safety";
import { compareScopes, detectScopes } from "./scopes";
import type { TriggerId } from "./triggers";

export type Answer =
  | { status: "ok"; summary: string; script: string; installSteps: string[]; scopes: string[]; assumptions: string[] }
  | { status: "needs_clarification" | "refused"; message: string };

/** Runs every check on the generated script. `syntax` is injected so the browser bundle never needs acorn. */
export function buildResult(answer: Answer, input: { task: string; sheet: string; trigger: TriggerId }, syntax: (s: string) => SyntaxSummary, cached: boolean): GeneratorResult {
  if (answer.status !== "ok") return { status: answer.status, trigger: input.trigger, message: answer.message, cached };
  const scopes = detectScopes(answer.script);
  return {
    status: "ok",
    trigger: input.trigger,
    summary: answer.summary,
    script: answer.script,
    installSteps: answer.installSteps,
    assumptions: answer.assumptions,
    syntax: syntax(answer.script),
    scopes,
    modelScopes: answer.scopes,
    scopeDifference: compareScopes(
      scopes.map((s) => s.scope),
      answer.scopes,
    ),
    triggerWarnings: triggerWarnings(answer.script, input.trigger),
    quotas: quotaNotes(answer.script, input.trigger),
    review: reviewScript(answer.script, `${input.task}\n${input.sheet}`),
    cached,
  };
}

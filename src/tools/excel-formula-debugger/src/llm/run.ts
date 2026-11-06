import type { callLlm, LlmErrorCode } from "@/lib/tools/llm";
import { SLUG } from "../limits";
import { buildAiResult } from "../logic/aiResult";
import { diagnose } from "../logic/rules";
import type { AiDiagnosis } from "../types";
import { buildUser, SYSTEM_PROMPT, type PromptInput } from "./prompt";
import { MAX_OUTPUT_TOKENS, ModelAnswer } from "./schema";

export type RunResult = { ok: true; data: AiDiagnosis } | { ok: false; code: LlmErrorCode; message: string };

export async function run(input: PromptInput, deps: { llm: typeof callLlm }): Promise<RunResult> {
  // The rule engine runs first; its top findings are given to the model as context (our text, not the visitor's).
  const ruled = diagnose({ formula: input.formula, error: input.error, platform: input.platform, cell: input.cell || undefined })
    .slice(0, 4)
    .map((f) => `${f.title} (${f.level.toLowerCase()} confidence)${f.corrected ? `; mechanical fix: ${f.corrected}` : ""}`);
  const user = buildUser(input, ruled);
  const res = await deps.llm({ tool: SLUG, system: SYSTEM_PROMPT, user, schema: ModelAnswer, maxOutputTokens: MAX_OUTPUT_TOKENS });
  if (!res.ok) return res;
  return { ok: true, data: buildAiResult(res.data, input.formula, input.platform, res.cached) };
}

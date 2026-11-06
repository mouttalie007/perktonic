import type { callLlm, LlmErrorCode } from "@/lib/tools/llm";
import { SLUG } from "../limits";
import { explainResult, generateResult } from "../logic/result";
import type { MacroResult } from "../types";
import { buildUser, SYSTEM_EXPLAIN, SYSTEM_GENERATE, type PromptInput } from "./prompt";
import { ExplainAnswer, GenerateAnswer, MAX_OUTPUT_TOKENS } from "./schema";

export type RunResult = { ok: true; data: MacroResult } | { ok: false; code: LlmErrorCode; message: string };

export async function run(input: PromptInput, deps: { llm: typeof callLlm }): Promise<RunResult> {
  const user = buildUser(input);
  if (input.mode === "generate") {
    const res = await deps.llm({ tool: SLUG, system: SYSTEM_GENERATE, user, schema: GenerateAnswer, maxOutputTokens: MAX_OUTPUT_TOKENS.generate });
    return res.ok ? { ok: true, data: generateResult(res.data, res.cached) } : res;
  }
  const res = await deps.llm({ tool: SLUG, system: SYSTEM_EXPLAIN, user, schema: ExplainAnswer, maxOutputTokens: MAX_OUTPUT_TOKENS.explain });
  return res.ok ? { ok: true, data: explainResult(res.data, input.code, res.cached) } : res;
}

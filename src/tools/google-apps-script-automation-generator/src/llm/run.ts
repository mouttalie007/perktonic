import type { callLlm, LlmErrorCode } from "@/lib/tools/llm";
import { SLUG } from "../limits";
import { buildResult } from "../logic/result";
import { checkSyntax } from "../logic/syntax";
import type { GeneratorResult } from "../types";
import { buildUser, SYSTEM_PROMPT, type PromptInput } from "./prompt";
import { MAX_OUTPUT_TOKENS, ModelAnswer } from "./schema";

export type RunResult = { ok: true; data: GeneratorResult } | { ok: false; code: LlmErrorCode; message: string };

export async function run(input: PromptInput, deps: { llm: typeof callLlm }): Promise<RunResult> {
  const res = await deps.llm({ tool: SLUG, system: SYSTEM_PROMPT, user: buildUser(input), schema: ModelAnswer, maxOutputTokens: MAX_OUTPUT_TOKENS });
  if (!res.ok) return res;
  return { ok: true, data: buildResult(res.data, input, checkSyntax, res.cached) };
}

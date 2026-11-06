import type { callLlm, LlmErrorCode } from "@/lib/tools/llm";
import { SLUG } from "../limits";
import { buildNarration, outlineForModel } from "../logic/narration";
import type { Narration } from "../types";
import { buildUser, SYSTEM_PROMPT, type PromptInput } from "./prompt";
import { MAX_OUTPUT_TOKENS, ModelAnswer } from "./schema";

export type RunResult = { ok: true; data: Narration } | { ok: false; code: LlmErrorCode; message: string };

/** The formula must already parse (the route checks it first). */
export async function run(input: PromptInput, deps: { llm: typeof callLlm }): Promise<RunResult> {
  const user = buildUser(input, outlineForModel(input.formula));
  const res = await deps.llm({ tool: SLUG, system: SYSTEM_PROMPT, user, schema: ModelAnswer, maxOutputTokens: MAX_OUTPUT_TOKENS });
  if (!res.ok) return res;
  return { ok: true, data: buildNarration(res.data, input.formula, res.cached) };
}

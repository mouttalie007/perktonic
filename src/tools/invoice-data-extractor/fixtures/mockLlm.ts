import type { callLlm, LlmArgs, LlmErrorCode, LlmResult } from "@/lib/tools/llm";

const MESSAGES: Record<LlmErrorCode, string> = {
  quota: "You have reached today's limit for AI requests. It resets at midnight UTC.",
  invalid_output: "The AI answer could not be read.",
  upstream: "The AI service is not available right now.",
  too_long: "This text is too long for the AI helper.",
};

export type MockReply = unknown | { error: LlmErrorCode };

/**
 * Same signature as callLlm. Replies are given in order (the last one repeats); each reply is
 * validated against the caller's schema like production does, so a malformed reply becomes
 * `invalid_output`. Every call is recorded for assertions.
 */
export function mockLlm(...replies: MockReply[]): typeof callLlm & { calls: LlmArgs<unknown>[] } {
  const calls: LlmArgs<unknown>[] = [];
  let i = 0;
  const fn = async <T,>(args: LlmArgs<T>): Promise<LlmResult<T>> => {
    calls.push(args as LlmArgs<unknown>);
    const reply = replies[Math.min(i++, replies.length - 1)];
    if (reply && typeof reply === "object" && "error" in reply) {
      const code = (reply as { error: LlmErrorCode }).error;
      return { ok: false, code, message: MESSAGES[code] };
    }
    const parsed = args.schema.safeParse(reply);
    if (!parsed.success) return { ok: false, code: "invalid_output", message: MESSAGES.invalid_output };
    return { ok: true, data: parsed.data, cached: false };
  };
  return Object.assign(fn, { calls });
}

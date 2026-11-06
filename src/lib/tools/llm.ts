import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { z, type ZodType } from "zod";
import { getAnthropicApiKey } from "@/lib/ai-article/api-key";

/**
 * The one door to the language model for the AI tools (kind D). Every tool calls
 * `callLlm()` and nothing else: the key, the model, the cache, the daily cost cap
 * and the single retry on a malformed answer live here. The per-visitor limit is
 * `rateLimit(req, { bucket, ...AI_LIMIT })` in each route.
 */

/** Requests allowed per visitor and per 10 minutes for every AI tool. */
export const AI_LIMIT = { limit: 10, windowSec: 600 } as const;
/** The `user` text of one call may not be longer than this; callLlm answers `too_long` above it. */
export const MAX_USER_CHARS = 20_000;

export type LlmErrorCode = "quota" | "invalid_output" | "upstream" | "too_long";

export type LlmResult<T> =
  | { ok: true; data: T; cached: boolean }
  | { ok: false; code: LlmErrorCode; message: string }; // message is safe to show to the visitor

export interface LlmArgs<T> {
  tool: string;
  system: string;
  user: string;
  schema: ZodType<T>;
  maxOutputTokens: number;
}

/** Cheapest model that passes the evals; override with TOOLS_AI_MODEL (e.g. "claude-sonnet-5-5"). */
const DEFAULT_MODEL = "claude-haiku-5-5";
/** USD per million tokens, for the daily cost cap only (cache writes/reads are counted as plain input). */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
};
const FALLBACK_PRICE = { input: 2, output: 10 };
/** Site-wide ceiling in USD per UTC day for all AI tools together; override with TOOLS_AI_DAILY_USD. */
const DEFAULT_DAILY_USD = 5;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 500;
const REQUEST_TIMEOUT_MS = 60_000;

export interface Completion {
  text: string;
  inputTokens: number;
  outputTokens: number;
  refused: boolean;
}
export interface LlmDeps {
  complete: (a: { model: string; system: string; messages: { role: "user" | "assistant"; content: string }[]; maxOutputTokens: number }) => Promise<Completion>;
  now: () => number;
  model: () => string;
  dailyUsd: () => number;
}

const cache = new Map<string, { at: number; data: unknown }>();
const spend = { day: "", usd: 0 };

export function resetLlmState() {
  cache.clear();
  spend.day = "";
  spend.usd = 0;
}

function utcDay(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}
function costUsd(model: string, inTok: number, outTok: number) {
  const p = PRICES[model] ?? FALLBACK_PRICE;
  return (inTok * p.input + outTok * p.output) / 1_000_000;
}

/** First JSON object in the text; tolerates a ```json fence or a short lead-in. */
export function extractJson(text: string): unknown {
  const t = text.replace(/```(?:json)?/gi, "");
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("no JSON object");
  return JSON.parse(t.slice(a, b + 1));
}

/**
 * The tools' prompts say "answer with JSON that matches the schema" but only the code holds the schema,
 * so it is appended to the system prompt here (a model told `"risks":[...]` guesses strings, not objects).
 */
function schemaHint(schema: ZodType<unknown>): string {
  try {
    const js = z.toJSONSchema(schema, { unrepresentable: "any", io: "output" });
    return `\n\nThe JSON Schema of the one object you must return (field names, types and limits are exact; return only the object, no markdown):\n${JSON.stringify(js)}`;
  } catch {
    return "";
  }
}

const MSG = {
  quota: "The AI tools have reached their limit for today. Please come back tomorrow.",
  upstream: "The AI service is not available right now. Please try again in a moment.",
  invalid: "The AI service did not give a usable answer this time. Please try again.",
};

export async function callLlmWith<T>(deps: LlmDeps, args: LlmArgs<T>): Promise<LlmResult<T>> {
  if (args.user.length > MAX_USER_CHARS) {
    return { ok: false, code: "too_long", message: `The text is too long (${args.user.length.toLocaleString("en-US")} characters; the limit is ${MAX_USER_CHARS.toLocaleString("en-US")}).` };
  }
  const now = deps.now();
  const model = deps.model();
  const key = createHash("sha256").update(JSON.stringify([model, args.tool, args.system, args.user, args.maxOutputTokens])).digest("hex");
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) return { ok: true, data: hit.data as T, cached: true };

  const day = utcDay(now);
  if (spend.day !== day) {
    spend.day = day;
    spend.usd = 0;
  }
  if (spend.usd >= deps.dailyUsd()) return { ok: false, code: "quota", message: MSG.quota };

  const messages: { role: "user" | "assistant"; content: string }[] = [{ role: "user", content: args.user }];
  for (let attempt = 0; attempt < 2; attempt++) {
    let c: Completion;
    try {
      c = await deps.complete({ model, system: args.system + schemaHint(args.schema), messages, maxOutputTokens: args.maxOutputTokens });
    } catch (e) {
      // Server log only: the visitor gets the calm message. The error text never contains the key.
      console.error(`[callLlm] ${args.tool}: ${e instanceof Error ? e.message : String(e)}`);
      return { ok: false, code: "upstream", message: MSG.upstream };
    }
    spend.usd += costUsd(model, c.inputTokens, c.outputTokens);
    if (c.refused) return { ok: false, code: "invalid_output", message: MSG.invalid };
    let problem: string;
    try {
      const parsed = args.schema.safeParse(extractJson(c.text));
      if (parsed.success) {
        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
        cache.set(key, { at: now, data: parsed.data });
        return { ok: true, data: parsed.data, cached: false };
      }
      problem = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    } catch (e) {
      problem = e instanceof Error ? e.message : "not valid JSON";
    }
    if (process.env.TOOLS_AI_DEBUG) console.error(`[callLlm] ${args.tool}: attempt ${attempt + 1} rejected (${problem}); out=${c.outputTokens}/${args.maxOutputTokens} tokens; tail: ${c.text.slice(-160).replace(/\s+/g, " ")}`);
    if (spend.usd >= deps.dailyUsd()) break;
    messages.push({ role: "assistant", content: c.text }, { role: "user", content: `That reply was not valid. Problems: ${problem}. Answer again with only one JSON object that matches the schema in the instructions.` });
  }
  return { ok: false, code: "invalid_output", message: MSG.invalid };
}

async function complete(a: Parameters<LlmDeps["complete"]>[0]): Promise<Completion> {
  const { key } = await getAnthropicApiKey();
  if (!key) throw new Error("no API key configured");
  const client = new Anthropic({ apiKey: key, maxRetries: 1, timeout: REQUEST_TIMEOUT_MS });
  const res = await client.messages.create({
    model: a.model,
    max_tokens: a.maxOutputTokens,
    // No reasoning for these short JSON jobs. Haiku accepts "disabled"; Sonnet/Opus 5.x reject it and want "between_tools".
    thinking: (a.model.includes("haiku") ? { type: "disabled" } : { type: "between_tools" }) as Anthropic.ThinkingConfigParam,
    system: a.system,
    messages: a.messages,
  });
  return {
    text: res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join(""),
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
    refused: res.stop_reason === "refusal",
  };
}

const real: LlmDeps = {
  complete,
  now: () => Date.now(),
  model: () => process.env.TOOLS_AI_MODEL?.trim() || DEFAULT_MODEL,
  dailyUsd: () => {
    const n = Number(process.env.TOOLS_AI_DAILY_USD);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_USD;
  },
};

export function callLlm<T>(args: LlmArgs<T>): Promise<LlmResult<T>> {
  return callLlmWith(real, args);
}

import { z } from "zod";
import { USER_AGENT_IDS } from "../logic/userAgents";
import { MAX_URL_LENGTH } from "../logic/url";

export const RequestSchema = z.object({
  url: z.string().trim().min(1, "Enter a URL to check.").max(MAX_URL_LENGTH, `The URL can be at most ${MAX_URL_LENGTH} characters.`),
  userAgent: z.enum(USER_AGENT_IDS).default("default"),
});
export type RequestBody = z.infer<typeof RequestSchema>;

const Hop = z.object({
  index: z.number().int(),
  url: z.string(),
  status: z.number().int(),
  statusText: z.string(),
  kind: z.enum(["permanent", "temporary", "none"]),
  location: z.string().nullable(),
  locationRaw: z.string().nullable(),
  relativeLocation: z.boolean(),
  ms: z.number(),
  ttfbMs: z.number(),
  server: z.string().nullable(),
});

export const DataSchema = z.object({
  startUrl: z.string(),
  finalUrl: z.string(),
  hops: z.array(Hop).min(1),
  redirectCount: z.number().int(),
  totalMs: z.number(),
  stop: z.object({ reason: z.enum(["loop", "too_many_redirects", "error"]), message: z.string(), url: z.string() }).nullable(),
  clientRedirects: z.array(z.object({ kind: z.enum(["meta-refresh", "javascript"]), target: z.string().nullable(), delaySeconds: z.number().nullable(), snippet: z.string() })),
  userAgent: z.enum(USER_AGENT_IDS),
  findings: z.array(z.object({ severity: z.enum(["error", "warning", "info", "good"]), code: z.string(), message: z.string() })),
  recommendation: z.string().nullable(),
});
export type ResponseData = z.infer<typeof DataSchema>;

export const ResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: DataSchema }),
  z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string() }) }),
]);
export type ApiResponse = z.infer<typeof ResponseSchema>;

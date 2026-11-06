import { z } from "zod";
import { MAX_TEST_URLS, MAX_URL_LENGTH, MAX_USER_AGENTS } from "../logic/limits";

export const RequestSchema = z.object({
  domain: z.string().trim().min(1, "Enter a domain, for example example.com.").max(MAX_URL_LENGTH, `The domain or URL can be at most ${MAX_URL_LENGTH} characters.`),
  urls: z.array(z.string().trim().min(1).max(MAX_URL_LENGTH, `A URL to test can be at most ${MAX_URL_LENGTH} characters.`)).max(MAX_TEST_URLS, `Test at most ${MAX_TEST_URLS} URLs at once.`).default([]),
  userAgents: z
    .array(z.string().trim().min(1).max(100, "A user-agent name can be at most 100 characters."))
    .min(1)
    .max(MAX_USER_AGENTS, `Pick at most ${MAX_USER_AGENTS} user-agents.`)
    .default(["Googlebot"]),
});
export type RequestBody = z.infer<typeof RequestSchema>;

const IssueSchema = z.object({ severity: z.enum(["error", "warning", "info"]), message: z.string(), line: z.number().int().nullable() });
const RuleSchema = z.object({ type: z.enum(["allow", "disallow"]), path: z.string(), line: z.number().int() });

export const DataSchema = z.object({
  origin: z.string(),
  robots: z.object({
    url: z.string(),
    finalUrl: z.string().nullable(),
    status: z.number().int().nullable(),
    state: z.enum(["found", "missing", "error"]),
    message: z.string(),
    contentType: z.string().nullable(),
    bytes: z.number().int(),
    truncated: z.boolean(),
    text: z.string(),
    parsed: z.object({
      groups: z.array(z.object({ agents: z.array(z.string()), line: z.number().int(), rules: z.array(RuleSchema), crawlDelay: z.number().nullable() })),
      sitemaps: z.array(z.object({ url: z.string(), line: z.number().int() })),
      issues: z.array(IssueSchema),
      lines: z.number().int(),
    }),
  }),
  sitemaps: z.array(
    z.object({
      url: z.string(),
      source: z.enum(["robots", "default", "index"]),
      parent: z.string().nullable(),
      status: z.number().int().nullable(),
      finalUrl: z.string().nullable(),
      contentType: z.string().nullable(),
      bytes: z.number().int(),
      declaredBytes: z.number().nullable(),
      unpackedBytes: z.number().int().nullable(),
      gzipped: z.boolean(),
      kind: z.enum(["urlset", "sitemapindex", "unknown"]),
      entryCount: z.number().int(),
      sampleEntries: z.array(z.string()),
      children: z.array(z.string()),
      lastmod: z.object({ valid: z.number().int(), invalid: z.number().int(), missing: z.number().int(), future: z.number().int(), invalidExamples: z.array(z.string()), newest: z.string().nullable() }),
      duplicates: z.number().int(),
      offHost: z.number().int(),
      partial: z.boolean(),
      blockedForGooglebot: z.number().int(),
      blockedExamples: z.array(z.string()),
      issues: z.array(IssueSchema),
    }),
  ),
  notChecked: z.array(z.object({ url: z.string(), reason: z.string() })),
  tests: z.array(z.object({ url: z.string(), userAgent: z.string(), allowed: z.boolean(), rule: RuleSchema.nullable(), group: z.array(z.string()).nullable(), explanation: z.string() })),
});
export type ResponseData = z.infer<typeof DataSchema>;

export const ResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: DataSchema }),
  z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string() }) }),
]);
export type ApiResponse = z.infer<typeof ResponseSchema>;

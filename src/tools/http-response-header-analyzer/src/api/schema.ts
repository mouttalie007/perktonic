import { z } from "zod";
import { MAX_CUSTOM_HEADERS } from "../logic/fetchHeaders";
import { MAX_URL_LENGTH } from "../logic/url";

export const RequestSchema = z.object({
  url: z.string().trim().min(1, "Enter a URL to analyse.").max(MAX_URL_LENGTH, `The URL can be at most ${MAX_URL_LENGTH} characters.`),
  method: z.enum(["HEAD", "GET"]).default("HEAD"),
  followRedirects: z.boolean().default(true),
  headers: z
    .array(z.object({ name: z.string().max(64), value: z.string().max(1024) }))
    .max(MAX_CUSTOM_HEADERS, `You can add up to ${MAX_CUSTOM_HEADERS} request headers.`)
    .default([]),
});
export type RequestBody = z.infer<typeof RequestSchema>;

const Check = z.object({
  id: z.enum(["hsts", "csp", "xfo", "xcto", "referrer", "permissions"]),
  header: z.string(),
  status: z.enum(["pass", "partial", "fail"]),
  points: z.number(),
  max: z.number(),
  value: z.string().nullable(),
  notes: z.array(z.string()),
  fix: z.string().nullable(),
});

export const DataSchema = z.object({
  requestedUrl: z.string(),
  finalUrl: z.string(),
  status: z.number().int(),
  method: z.enum(["HEAD", "GET"]),
  fallback: z.string().nullable(),
  headers: z.record(z.string(), z.array(z.string())),
  redirects: z.array(z.object({ url: z.string(), status: z.number().int(), location: z.string() })),
  ttfbMs: z.number(),
  totalMs: z.number(),
  security: z.object({ checks: z.array(Check), score: z.number(), grade: z.string() }),
  notes: z.array(z.object({ level: z.enum(["pass", "warn", "fail", "info"]), topic: z.enum(["caching", "compression", "cookies", "disclosure"]), message: z.string() })),
  cookies: z.array(z.object({ name: z.string(), secure: z.boolean(), httpOnly: z.boolean(), sameSite: z.string().nullable(), expires: z.string().nullable(), domain: z.string().nullable(), issues: z.array(z.string()) })),
  rows: z.array(z.object({ name: z.string(), value: z.string() })),
  snippets: z.object({ nginx: z.string(), apache: z.string(), caddy: z.string() }),
});
export type ResponseData = z.infer<typeof DataSchema>;

export const ResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: DataSchema }),
  z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string() }) }),
]);
export type ApiResponse = z.infer<typeof ResponseSchema>;

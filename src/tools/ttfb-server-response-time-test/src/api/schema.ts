import { z } from "zod";
import { MAX_URL_LENGTH } from "../logic/types";

export const RequestSchema = z.object({
  url: z.string().trim().min(1, "Enter a URL to test.").max(MAX_URL_LENGTH, `The URL can be at most ${MAX_URL_LENGTH} characters.`),
});
export type RequestBody = z.infer<typeof RequestSchema>;

const ms = z.number().int().min(0);
const Phases = z.object({ dnsMs: ms.nullable(), connectMs: ms.nullable(), tlsMs: ms.nullable(), waitMs: ms, downloadMs: ms, ttfbMs: ms, totalMs: ms });

const Run = z.discriminatedUnion("ok", [
  z.object({ n: z.number().int(), ok: z.literal(true), status: z.number().int(), phases: Phases, bytes: z.number().int(), truncated: z.boolean() }),
  z.object({ n: z.number().int(), ok: z.literal(false), code: z.string(), message: z.string() }),
]);

export const DataSchema = z.object({
  url: z.string(),
  location: z.string(),
  runs: z.array(Run).length(3),
  median: Phases.nullable(),
  rating: z.enum(["good", "needs-improvement", "poor"]).nullable(),
  status: z.number().int().nullable(),
  redirect: z.object({ status: z.number().int(), location: z.string() }).nullable(),
  remoteIp: z.string().nullable(),
  ipVersion: z.union([z.literal(4), z.literal(6)]).nullable(),
  server: z.string().nullable(),
  protocolHint: z.string().nullable(),
  cache: z.string().nullable(),
  compression: z.string().nullable(),
  serverTiming: z.array(z.object({ name: z.string(), durMs: z.number().nullable(), desc: z.string().nullable() })),
  suggestions: z.array(z.object({ phase: z.enum(["dns", "connect", "tls", "wait", "download", "general"]), text: z.string() })),
  measuredAt: z.string(),
});
export type ResponseData = z.infer<typeof DataSchema>;

export const ResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: DataSchema }),
  z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string() }) }),
]);
export type ApiResponse = z.infer<typeof ResponseSchema>;

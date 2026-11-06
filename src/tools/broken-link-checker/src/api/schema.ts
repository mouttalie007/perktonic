import { z } from "zod";
import { LIMITS, MAX_URL_LENGTH } from "../logic/types";

export const RequestSchema = z.object({
  url: z.string().trim().min(1, "Enter a URL to start from.").max(MAX_URL_LENGTH, `The URL can be at most ${MAX_URL_LENGTH} characters.`),
  depth: z.number().int().min(0).max(LIMITS.maxDepth).default(LIMITS.maxDepth),
  maxPages: z.number().int().min(1).max(LIMITS.maxPages).default(LIMITS.maxPages),
  checkExternal: z.boolean().default(true),
  checkImages: z.boolean().default(true),
});

const Item = z.object({
  url: z.string(),
  kind: z.enum(["page", "link", "image"]),
  internal: z.boolean(),
  status: z.number().nullable(),
  error: z.string().nullable(),
  redirectTo: z.string().nullable(),
  category: z.enum(["ok", "broken", "redirect", "unknown", "skipped"]),
  sources: z.array(z.object({ page: z.string(), text: z.string() })),
  sourceCount: z.number(),
});

export const DataSchema = z.object({
  start: z.string(),
  origin: z.string(),
  robots: z.object({ url: z.string(), status: z.enum(["found", "none", "unreachable", "error"]), crawlDelayMs: z.number().nullable() }),
  stoppedEarly: z.enum(["time", "links", "cancelled"]).nullable(),
  pagesCrawled: z.number(),
  linksChecked: z.number().max(LIMITS.maxLinks),
  broken: z.array(Item),
  redirects: z.array(Item),
  missingImages: z.array(Item),
  unknown: z.array(Item),
  skipped: z.object({ robots: z.number(), queryVariants: z.number(), external: z.number(), images: z.number(), overLimit: z.number(), pageLimit: z.number(), depth: z.number(), schemes: z.number() }),
  okCount: z.number(),
  durationMs: z.number(),
  options: z.object({ depth: z.number(), maxPages: z.number(), checkExternal: z.boolean(), checkImages: z.boolean() }),
});

/** Before the stream starts, errors use the standard contract. */
export const ErrorSchema = z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string() }) });
export type ApiError = z.infer<typeof ErrorSchema>;

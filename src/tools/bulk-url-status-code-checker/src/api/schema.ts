import { z } from "zod";
import { BATCH_SIZE, MAX_URL_LENGTH } from "../logic/limits";

export const RequestSchema = z.object({
  urls: z
    .array(z.string().trim().min(1, "A URL is empty.").max(MAX_URL_LENGTH, `A URL can be at most ${MAX_URL_LENGTH} characters.`))
    .min(1, "Send at least one URL.")
    .max(BATCH_SIZE, `Send at most ${BATCH_SIZE} URLs per request; the page splits longer lists into batches.`),
  followRedirects: z.boolean().default(true),
  headFirst: z.boolean().default(true),
});
export type RequestBody = z.infer<typeof RequestSchema>;

const Result = z.object({
  url: z.string(),
  status: z.number().int().nullable(),
  statusText: z.string(),
  finalUrl: z.string().nullable(),
  redirects: z.number().int(),
  chain: z.array(z.number().int()),
  timeMs: z.number(),
  contentType: z.string().nullable(),
  method: z.enum(["HEAD", "GET"]),
  error: z.object({ code: z.enum(["invalid_url", "blocked_host", "timeout", "too_large", "network", "too_many_redirects", "redirect_loop", "skipped"]), message: z.string() }).nullable(),
});

export const DataSchema = z.object({ results: z.array(Result) });
export type ResponseData = z.infer<typeof DataSchema>;

export const ResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: DataSchema }),
  z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string() }) }),
]);
export type ApiResponse = z.infer<typeof ResponseSchema>;

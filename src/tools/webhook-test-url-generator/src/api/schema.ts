import { z } from "zod";
import { MAX_DELAY_MS, MAX_REPLY_BODY, MAX_URL_CHARS, REPLY_TYPES } from "../limits";

const id = z.string().regex(/^[A-Za-z0-9_-]{22}$/, "This endpoint id is not valid.");

export const ReplySchema = z.object({
  // 1xx statuses (and upgrades) cannot be sent as a final response.
  status: z.number().int().min(200, "The status must be between 200 and 599.").max(599, "The status must be between 200 and 599."),
  contentType: z.enum(REPLY_TYPES),
  body: z.string().refine((s) => new TextEncoder().encode(s).length <= MAX_REPLY_BODY, `The response body is limited to ${MAX_REPLY_BODY / 1024} KB.`),
  delayMs: z.number().int().min(0).max(MAX_DELAY_MS, `The delay is limited to ${MAX_DELAY_MS / 1000} seconds.`),
});

export const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create") }),
  z.object({ action: z.literal("list"), id }),
  z.object({ action: z.literal("extend"), id }),
  z.object({ action: z.literal("clear"), id }),
  z.object({ action: z.literal("delete"), id }),
  z.object({ action: z.literal("report"), id }),
  z.object({ action: z.literal("reply"), id, reply: ReplySchema }),
  z.object({ action: z.literal("replay"), id, requestId: z.string().min(1).max(40), url: z.string().trim().min(1).max(MAX_URL_CHARS, `URLs are limited to ${MAX_URL_CHARS} characters.`) }),
]);
export type ActionRequest = z.infer<typeof RequestSchema>;
export type { ApiResponse } from "../types";

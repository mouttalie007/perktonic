import { z } from "zod";
import { MAX_EMAILS, MAX_GRACE_SEC, MAX_INTERVAL_SEC, MAX_NAME, MAX_URL_CHARS, MIN_GRACE_SEC, MIN_INTERVAL_SEC } from "../limits";

const token = z.string().regex(/^[A-Za-z0-9_-]{22}$/, "This link is not valid.");

export const CreateSchema = z.object({
  action: z.literal("create"),
  name: z.string().trim().min(1, "Give the monitor a name.").max(MAX_NAME, `The name is limited to ${MAX_NAME} characters.`),
  intervalSec: z.number().int().min(MIN_INTERVAL_SEC, "The interval must be at least 1 minute.").max(MAX_INTERVAL_SEC, "The interval can be at most 7 days."),
  graceSec: z.number().int().min(MIN_GRACE_SEC, "The grace period must be at least 1 minute.").max(MAX_GRACE_SEC, "The grace period can be at most 1 day."),
  emails: z.array(z.string().trim().email("One of the email addresses is not valid.").max(254)).max(MAX_EMAILS, `At most ${MAX_EMAILS} email addresses.`).default([]),
  webhookUrl: z
    .string()
    .trim()
    .max(MAX_URL_CHARS, `URLs are limited to ${MAX_URL_CHARS} characters.`)
    .refine((s) => /^https?:\/\/[^\s/]+/i.test(s), "The webhook URL must start with http:// or https://.")
    .nullable()
    .default(null),
  telegramChatId: z.string().trim().regex(/^-?\d{4,20}$/, "A Telegram chat id is a number, such as 123456789.").nullable().default(null),
});

export const RequestSchema = z.discriminatedUnion("action", [
  CreateSchema,
  z.object({ action: z.literal("config") }),
  z.object({ action: z.literal("view"), manage: token }),
  z.object({ action: z.literal("pause"), manage: token }),
  z.object({ action: z.literal("resume"), manage: token }),
  z.object({ action: z.literal("test"), manage: token }),
  z.object({ action: z.literal("delete"), manage: token }),
  z.object({ action: z.literal("confirm"), token }),
  z.object({ action: z.literal("stop"), token }),
]);
export type { ApiResponse } from "../types";

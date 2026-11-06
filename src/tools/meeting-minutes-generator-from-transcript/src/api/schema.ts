import { z } from "zod";
import { LANGUAGES, MAX_TITLE_CHARS, MAX_TRANSCRIPT_CHARS, type LanguageId } from "../limits";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dates are written YYYY-MM-DD.");

export const RequestSchema = z.object({
  transcript: z
    .string({ error: "Paste the transcript." })
    .refine((s) => s.trim().length >= 80, "Paste a longer transcript (a few exchanges at least).")
    .refine((s) => s.length <= MAX_TRANSCRIPT_CHARS, `The transcript is longer than ${MAX_TRANSCRIPT_CHARS.toLocaleString("en-US")} characters (about 90 minutes of talk). This version does not split long meetings: send it in parts.`),
  title: z.string().max(MAX_TITLE_CHARS, `The title is limited to ${MAX_TITLE_CHARS} characters.`).optional().default(""),
  date: z.union([isoDate, z.literal("")]).optional().default(""),
  language: z.enum(LANGUAGES.map((l) => l.id) as [LanguageId, ...LanguageId[]]).optional().default("auto"),
  referenceDate: isoDate,
});
export type { ApiResponse } from "../types";

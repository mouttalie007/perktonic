import { z } from "zod";
import { MAX_TEXT_CHARS, MAX_WORDS } from "../limits";

export const RequestSchema = z.object({
  text: z
    .string({ error: "Send the text of the invoice." })
    .refine((s) => s.trim().length >= 20, "The invoice text is too short to read.")
    .refine((s) => s.length <= MAX_TEXT_CHARS, `The invoice text is longer than ${MAX_TEXT_CHARS.toLocaleString("en-US")} characters. This version does not split long documents: send the pages with the totals.`),
  source: z.enum(["pdf", "ocr"]).default("pdf"),
  words: z
    .array(z.object({ text: z.string().max(200), confidence: z.number().min(0).max(100) }))
    .max(MAX_WORDS, "Too many OCR words.")
    .optional(),
});
export type { ApiResponse } from "../types";

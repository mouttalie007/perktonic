import { z } from "zod";
import { MAX_TEXT_CHARS } from "../limits";

export const RequestSchema = z.object({
  text: z
    .string({ error: "Paste the text to summarise." })
    .refine((s) => s.trim().length >= 200, "Paste a longer text (at least a few paragraphs, 200 characters).")
    .refine((s) => s.length <= MAX_TEXT_CHARS, `The text is longer than ${MAX_TEXT_CHARS.toLocaleString("en-US")} characters. This version does not split long documents: summarise it in parts.`),
  length: z.enum(["short", "medium", "long"], { error: "Pick a summary length." }),
  tone: z.enum(["executive", "technical", "simple"], { error: "Pick a tone." }),
  sections: z.boolean().optional().default(false),
});
export type { ApiResponse } from "../types";

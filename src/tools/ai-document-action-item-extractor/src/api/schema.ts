import { z } from "zod";
import { MAX_TEXT_CHARS } from "../limits";
import { parseIso } from "../logic/dates";

export const RequestSchema = z.object({
  text: z
    .string({ error: "Paste the text to read." })
    .refine((s) => s.trim().length >= 20, "Paste the text to read (a few sentences at least).")
    .refine((s) => s.length <= MAX_TEXT_CHARS, `The text is longer than ${MAX_TEXT_CHARS.toLocaleString("en-US")} characters. This version does not split long texts: send it in parts.`),
  referenceDate: z.string({ error: "Set the reference date." }).refine((s) => parseIso(s) !== null, "The reference date must be a real date (YYYY-MM-DD)."),
});
export type { ApiResponse } from "../types";

import { z } from "zod";
import { MAX_FOCUS_CHARS, MAX_TEXT_CHARS } from "../limits";

export const RequestSchema = z.object({
  text: z
    .string({ error: "Paste the contract text." })
    .refine((s) => s.trim().length >= 100, "Paste the contract text (at least a few clauses).")
    .refine((s) => s.length <= MAX_TEXT_CHARS, `The contract is longer than ${MAX_TEXT_CHARS.toLocaleString("en-US")} characters. This version does not split long documents: paste it in parts.`),
  focus: z.string().max(MAX_FOCUS_CHARS, `“Anything specific to look for?” is limited to ${MAX_FOCUS_CHARS} characters.`).optional().default(""),
});
export type { ApiResponse } from "../types";

import { z } from "zod";
import { MAX_FORMULA_CHARS, MAX_SAMPLE_CHARS } from "../limits";

export const RequestSchema = z.object({
  formula: z
    .string({ error: "Paste a formula to explain." })
    .trim()
    .min(2, "Paste a formula to explain.")
    .max(MAX_FORMULA_CHARS, `The formula is longer than ${MAX_FORMULA_CHARS.toLocaleString("en-US")} characters.`),
  sampleValues: z
    .string()
    .max(MAX_SAMPLE_CHARS, `The sample values are longer than ${MAX_SAMPLE_CHARS.toLocaleString("en-US")} characters. Shorten them.`)
    .optional()
    .default(""),
});
export type { ApiResponse } from "../types";

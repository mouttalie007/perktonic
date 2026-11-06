import { z } from "zod";
import { MAX_CODE_CHARS, MAX_DESCRIPTION_CHARS } from "../limits";

export const RequestSchema = z.discriminatedUnion(
  "mode",
  [
    z.object({
      mode: z.literal("generate"),
      description: z
        .string({ error: "Describe what the macro should do." })
        .trim()
        .min(10, "Describe what the macro should do (a sentence at least).")
        .max(MAX_DESCRIPTION_CHARS, `The description is longer than ${MAX_DESCRIPTION_CHARS.toLocaleString("en-US")} characters. Shorten it.`),
    }),
    z.object({
      mode: z.literal("explain"),
      code: z
        .string({ error: "Paste the VBA code to explain." })
        .refine((s) => s.trim().length >= 5, "Paste the VBA code to explain.")
        .refine((s) => s.length <= MAX_CODE_CHARS, `The code is longer than ${MAX_CODE_CHARS.toLocaleString("en-US")} characters. Explain one module or procedure at a time.`),
    }),
  ],
  { error: "Choose Generate or Explain." },
);
export type { ApiResponse } from "../types";

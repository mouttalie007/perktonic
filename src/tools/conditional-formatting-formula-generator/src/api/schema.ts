import { z } from "zod";
import { MAX_DESCRIPTION_CHARS } from "../limits";
import { parseRange } from "../logic/range";

export const RequestSchema = z.object({
  description: z
    .string({ error: "Describe the rule you need." })
    .trim()
    .min(5, "Describe the rule you need (a few words at least).")
    .max(MAX_DESCRIPTION_CHARS, `The description is longer than ${MAX_DESCRIPTION_CHARS.toLocaleString("en-US")} characters. Shorten it.`),
  range: z
    .string({ error: "Type the range the rule applies to." })
    .trim()
    .max(80, "The range is too long.")
    .refine((s) => parseRange(s) !== null, "Type the range the rule applies to, such as A2:F100."),
  platform: z.enum(["excel", "sheets"], { error: "Pick Excel or Google Sheets." }),
});
export type { ApiResponse } from "../types";

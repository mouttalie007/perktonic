import { z } from "zod";
import { MAX_DESCRIPTION_CHARS, MAX_FORMULA_CHARS } from "../limits";
import { ERROR_KINDS } from "../logic/rules";

export const RequestSchema = z.object({
  formula: z
    .string({ error: "Paste the formula that shows the error." })
    .trim()
    .min(2, "Paste the formula that shows the error.")
    .max(MAX_FORMULA_CHARS, `The formula is longer than ${MAX_FORMULA_CHARS.toLocaleString("en-US")} characters.`),
  error: z.enum(ERROR_KINDS, { error: "Pick the error your spreadsheet shows." }),
  platform: z.enum(["excel365", "excel2019", "sheets", "libreoffice"], { error: "Pick your spreadsheet app." }),
  cell: z
    .string()
    .trim()
    .max(40, "The cell address is too long (for example C10 or Sheet1!C10).")
    .regex(/^$|^(?:'[^']+'|[\w.]+!)?\$?[A-Za-z]{1,3}\$?\d{1,7}$/, "Write the formula's cell like C10 or Sheet1!C10.")
    .optional()
    .default(""),
  description: z
    .string()
    .max(MAX_DESCRIPTION_CHARS, `The data description is longer than ${MAX_DESCRIPTION_CHARS.toLocaleString("en-US")} characters. Shorten it.`)
    .optional()
    .default(""),
});
export type { ApiResponse } from "../types";

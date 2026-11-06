import { z } from "zod";
import { MAX_COLUMNS_CHARS, MAX_REQUEST_CHARS } from "../limits";

export const RequestSchema = z.object({
  request: z
    .string({ error: "Describe what the formula should do." })
    .trim()
    .min(3, "Describe what the formula should do (a few words at least).")
    .max(MAX_REQUEST_CHARS, `The request is longer than ${MAX_REQUEST_CHARS.toLocaleString("en-US")} characters. Shorten it.`),
  platform: z.enum(["excel365", "excel2019", "sheets", "libreoffice"], { error: "Choose Excel 365/2021, Excel 2019 or older, Google Sheets or LibreOffice Calc." }),
  columns: z
    .string()
    .max(MAX_COLUMNS_CHARS, `The column description is longer than ${MAX_COLUMNS_CHARS.toLocaleString("en-US")} characters. Shorten it.`)
    .optional()
    .default(""),
});
export type GeneratorRequest = z.infer<typeof RequestSchema>;
export type { ApiResponse } from "../types";

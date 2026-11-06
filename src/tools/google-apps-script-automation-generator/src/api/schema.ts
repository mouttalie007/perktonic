import { z } from "zod";
import { MAX_SHEET_CHARS, MAX_TASK_CHARS } from "../limits";
import { TRIGGERS } from "../logic/triggers";

export const RequestSchema = z.object({
  task: z
    .string({ error: "Describe what the script should do." })
    .trim()
    .min(10, "Describe what the script should do (a sentence at least).")
    .max(MAX_TASK_CHARS, `The task description is longer than ${MAX_TASK_CHARS.toLocaleString("en-US")} characters. Shorten it.`),
  sheet: z
    .string()
    .max(MAX_SHEET_CHARS, `The sheet structure is longer than ${MAX_SHEET_CHARS.toLocaleString("en-US")} characters. Shorten it.`)
    .optional()
    .default(""),
  trigger: z.enum(TRIGGERS, { error: "Pick when the script should run." }),
});
export type { ApiResponse } from "../types";

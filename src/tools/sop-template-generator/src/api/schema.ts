import { z } from "zod";
import { MAX_INDUSTRY_CHARS, MAX_NAME_CHARS, MAX_OWNER_CHARS, MAX_STEPS_CHARS, MAX_TEAM_CHARS } from "../limits";

const opt = (max: number, label: string) => z.string().max(max, `${label} is limited to ${max} characters.`).optional().default("");

export const RequestSchema = z.object({
  docType: z.enum(["sop", "policy", "onboarding", "process"], { error: "Choose a document type." }),
  processName: z
    .string({ error: "Give the process a name." })
    .refine((s) => s.trim().length >= 3, "Give the process a name (at least 3 characters).")
    .refine((s) => s.length <= MAX_NAME_CHARS, `The process name is limited to ${MAX_NAME_CHARS} characters.`),
  industry: opt(MAX_INDUSTRY_CHARS, "Industry"),
  teamSize: opt(MAX_TEAM_CHARS, "Team size"),
  steps: z.string().max(MAX_STEPS_CHARS, `Key steps are limited to ${MAX_STEPS_CHARS.toLocaleString("en-US")} characters for the AI. Shorten them, or use the template without AI.`).optional().default(""),
  owner: opt(MAX_OWNER_CHARS, "Owner"),
});
export type { ApiResponse } from "../types";

import { z } from "zod";

export const OkAnswer = z.object({
  status: z.literal("ok"),
  kind: z.enum(["conditional_formatting", "data_validation"]),
  formula: z.string().trim().min(2).max(2000).regex(/^=/, "A rule formula starts with ="),
  appliesTo: z.string().trim().min(2).max(200),
  formatSuggestion: z.string().trim().max(400).nullable(),
  stepsExcel: z.array(z.string().trim().min(1).max(500)).min(2).max(12),
  stepsSheets: z.array(z.string().trim().min(1).max(500)).min(2).max(12),
  notes: z.array(z.string().trim().min(1).max(500)).max(10),
  assumptions: z.array(z.string().trim().min(1).max(400)).max(8),
});
export const ClarifyAnswer = z.object({ status: z.literal("needs_clarification"), message: z.string().trim().min(1).max(600) });
export const RefusedAnswer = z.object({ status: z.literal("refused"), message: z.string().trim().min(1).max(600) });

export const ModelAnswer = z.discriminatedUnion("status", [OkAnswer, ClarifyAnswer, RefusedAnswer]);
export type ModelAnswer = z.infer<typeof ModelAnswer>;

export const MAX_OUTPUT_TOKENS = 1200;

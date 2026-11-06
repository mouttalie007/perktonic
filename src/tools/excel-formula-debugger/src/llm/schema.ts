import { z } from "zod";

export const OkAnswer = z
  .object({
    status: z.literal("ok"),
    diagnosis: z.string().trim().min(1).max(1000),
    /** The full corrected formula, or null when the fix is in the data, not the formula. */
    correctedFormula: z.string().trim().min(2).max(8000).regex(/^=/, "A formula must start with =").nullable(),
    /** Never empty when a corrected formula is given. */
    assumptions: z.array(z.string().trim().min(1).max(400)).max(6),
    preventionTips: z.array(z.string().trim().min(1).max(400)).max(4),
  })
  .refine((a) => a.correctedFormula === null || a.assumptions.length > 0, { message: "A corrected formula needs at least one assumption", path: ["assumptions"] });

export const ClarifyAnswer = z.object({ status: z.literal("needs_clarification"), message: z.string().trim().min(1).max(600) });
export const RefusedAnswer = z.object({ status: z.literal("refused"), message: z.string().trim().min(1).max(600) });

export const ModelAnswer = z.discriminatedUnion("status", [OkAnswer, ClarifyAnswer, RefusedAnswer]);
export type ModelAnswer = z.infer<typeof ModelAnswer>;

export const MAX_OUTPUT_TOKENS = 1000;

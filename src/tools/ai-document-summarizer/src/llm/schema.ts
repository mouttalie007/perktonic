import { z } from "zod";

export const OkAnswer = z.object({
  status: z.literal("ok"),
  summary: z.string().trim().min(1).max(4000),
  keyPoints: z
    .array(z.object({ text: z.string().trim().min(1).max(600), quote: z.string().min(1).max(1200) }))
    .min(1)
    .max(12),
  /** Empty unless the visitor asked for the section-by-section digest. */
  sections: z.array(z.object({ heading: z.string().trim().min(1).max(300), summary: z.string().trim().min(1).max(2000) })).max(30),
});
export const ClarifyAnswer = z.object({ status: z.literal("needs_clarification"), message: z.string().trim().min(1).max(600) });
export const RefusedAnswer = z.object({ status: z.literal("refused"), message: z.string().trim().min(1).max(600) });

export const ModelAnswer = z.discriminatedUnion("status", [OkAnswer, ClarifyAnswer, RefusedAnswer]);
export type ModelAnswer = z.infer<typeof ModelAnswer>;

export const MAX_OUTPUT_TOKENS = 3000;

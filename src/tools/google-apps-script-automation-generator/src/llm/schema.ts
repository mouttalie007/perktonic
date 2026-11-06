import { z } from "zod";

export const OkAnswer = z.object({
  status: z.literal("ok"),
  /** One or two sentences: what the script does. */
  summary: z.string().trim().min(1).max(800),
  /** The full, commented Apps Script (V8). */
  script: z.string().min(20).max(20000),
  installSteps: z.array(z.string().trim().min(1).max(400)).min(2).max(12),
  /** The model's view of the scopes; the page shows our own detection first. */
  scopes: z.array(z.string().trim().min(1).max(200)).max(15),
  assumptions: z.array(z.string().trim().min(1).max(400)).max(8),
});
export const ClarifyAnswer = z.object({ status: z.literal("needs_clarification"), message: z.string().trim().min(1).max(600) });
export const RefusedAnswer = z.object({ status: z.literal("refused"), message: z.string().trim().min(1).max(600) });

export const ModelAnswer = z.discriminatedUnion("status", [OkAnswer, ClarifyAnswer, RefusedAnswer]);
export type ModelAnswer = z.infer<typeof ModelAnswer>;

export const MAX_OUTPUT_TOKENS = 3000;

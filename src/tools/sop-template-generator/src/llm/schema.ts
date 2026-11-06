import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);

export const OkAnswer = z.object({
  status: z.literal("ok"),
  purpose: text(2000),
  scope: text(2000),
  roles: z.array(z.object({ role: text(200), responsibility: text(800) })).min(1).max(15),
  /** "n" is accepted but ignored: the server numbers the steps. */
  steps: z.array(z.object({ n: z.number().int().min(0).max(1000), action: text(800), owner: z.string().trim().max(200) })).min(1).max(40),
  kpis: z.array(z.object({ name: text(300), howMeasured: text(800) })).min(1).max(12),
  notes: z.array(text(600)).max(10),
});
export const ClarifyAnswer = z.object({ status: z.literal("needs_clarification"), message: text(600) });
export const RefusedAnswer = z.object({ status: z.literal("refused"), message: text(600) });

export const ModelAnswer = z.discriminatedUnion("status", [OkAnswer, ClarifyAnswer, RefusedAnswer]);
export type ModelAnswer = z.infer<typeof ModelAnswer>;

export const MAX_OUTPUT_TOKENS = 3000;

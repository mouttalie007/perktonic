import { z } from "zod";

export const OkAnswer = z.object({
  status: z.literal("ok"),
  code: z.string().min(5).max(8000),
  explanation: z.string().trim().min(1).max(800),
  /** Which spreadsheet piece became which SQL / pandas piece. */
  mapping: z.array(z.object({ spreadsheet: z.string().trim().min(1).max(200), target: z.string().trim().min(1).max(200), note: z.string().trim().max(240) })).min(1).max(15),
  /** Table name when none was given, how blanks are treated, data types… */
  assumptions: z.array(z.string().trim().min(1).max(240)).max(8),
  /** Things with no exact equivalent. */
  warnings: z.array(z.string().trim().min(1).max(300)).max(6),
});
export const ClarifyAnswer = z.object({ status: z.literal("needs_clarification"), message: z.string().trim().min(1).max(400) });
export const RefusedAnswer = z.object({ status: z.literal("refused"), message: z.string().trim().min(1).max(400) });

export const ModelAnswer = z.discriminatedUnion("status", [OkAnswer, ClarifyAnswer, RefusedAnswer]);
export type ModelAnswer = z.infer<typeof ModelAnswer>;

export const MAX_OUTPUT_TOKENS = 2000;

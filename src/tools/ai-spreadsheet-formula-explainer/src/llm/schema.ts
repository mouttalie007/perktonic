import { z } from "zod";
import { MAX_SUMMARY_WORDS } from "../limits";

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

export const OkAnswer = z.object({
  status: z.literal("ok"),
  summary: z
    .string()
    .trim()
    .min(1)
    .max(700)
    .refine((s) => words(s) <= MAX_SUMMARY_WORDS, `The summary must be at most ${MAX_SUMMARY_WORDS} words`),
  /** Ordered: each part is an exact piece of the formula; the server drops the others. */
  steps: z
    .array(
      z.object({
        part: z.string().min(1).max(1000),
        text: z.string().trim().min(1).max(400),
      }),
    )
    .min(1)
    .max(20),
});

export const ClarifyAnswer = z.object({ status: z.literal("needs_clarification"), message: z.string().trim().min(1).max(400) });
export const RefusedAnswer = z.object({ status: z.literal("refused"), message: z.string().trim().min(1).max(400) });

export const ModelAnswer = z.discriminatedUnion("status", [OkAnswer, ClarifyAnswer, RefusedAnswer]);
export type ModelAnswer = z.infer<typeof ModelAnswer>;

export const MAX_OUTPUT_TOKENS = 1400;

import { z } from "zod";

// Bounded strings and arrays: the answer is shown as is, so nothing may grow without limit.
const formula = z.string().trim().min(2).max(2000).regex(/^=/, "A formula must start with =");

export const OkAnswer = z.object({
  status: z.literal("ok"),
  formula,
  /** At most three sentences, in plain English. */
  explanation: z.string().trim().min(1).max(600),
  /** A second formula, e.g. the fallback for Excel 2019 / LibreOffice, or null. */
  alternative: z
    .object({
      formula,
      whenToPrefer: z.string().trim().min(1).max(240),
    })
    .nullable(),
  /** Which column the model took for what, which year "March" means, and so on. */
  assumptions: z.array(z.string().trim().min(1).max(240)).max(6),
});

export const ClarifyAnswer = z.object({
  status: z.literal("needs_clarification"),
  message: z.string().trim().min(1).max(400),
});

export const RefusedAnswer = z.object({
  status: z.literal("refused"),
  message: z.string().trim().min(1).max(400),
});

export const ModelAnswer = z.discriminatedUnion("status", [OkAnswer, ClarifyAnswer, RefusedAnswer]);
export type ModelAnswer = z.infer<typeof ModelAnswer>;
export type OkAnswer = z.infer<typeof OkAnswer>;

/** The ceiling we give callLlm: a formula, an alternative and a few short sentences. */
export const MAX_OUTPUT_TOKENS = 900;

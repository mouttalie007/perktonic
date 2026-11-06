import { z } from "zod";

export const TermSchema = z.object({
  /** Same list as CATEGORIES in limits.ts (a test keeps them equal). */
  category: z.enum(["parties", "effective_date", "term_or_expiry", "payment", "renewal", "termination", "obligation", "governing_law", "confidentiality", "liability", "other"]),
  label: z.string().trim().min(1).max(300),
  value: z.string().trim().min(1).max(1000),
  normalised: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.object({ amount: z.number(), currency: z.string().trim().min(1).max(10) }), z.null()]),
  clauseRef: z.string().trim().min(1).max(80).nullable(),
  quote: z.string().min(1).max(2000),
});

export const OkAnswer = z.object({ status: z.literal("ok"), terms: z.array(TermSchema).max(80), notes: z.array(z.string().trim().min(1).max(600)).max(8) });
export const ClarifyAnswer = z.object({ status: z.literal("needs_clarification"), message: z.string().trim().min(1).max(600) });
export const RefusedAnswer = z.object({ status: z.literal("refused"), message: z.string().trim().min(1).max(600) });

export const ModelAnswer = z.discriminatedUnion("status", [OkAnswer, ClarifyAnswer, RefusedAnswer]);
export type ModelAnswer = z.infer<typeof ModelAnswer>;

export const MAX_OUTPUT_TOKENS = 4000;

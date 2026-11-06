import { z } from "zod";
import { MAX_ITEMS } from "../limits";

export const Item = z.object({
  task: z.string().trim().min(1).max(400),
  owner: z.string().trim().min(1).max(200).nullable(),
  /** YYYY-MM-DD or null; validated again on the server. */
  dueDate: z.string().trim().max(20).nullable(),
  dueText: z.string().trim().min(1).max(200).nullable(),
  /** Copied word for word from the document. */
  quote: z.string().min(1).max(1000),
});

export const OkAnswer = z.object({ status: z.literal("ok"), items: z.array(Item).max(MAX_ITEMS) });
export const ClarifyAnswer = z.object({ status: z.literal("needs_clarification"), message: z.string().trim().min(1).max(600) });
export const RefusedAnswer = z.object({ status: z.literal("refused"), message: z.string().trim().min(1).max(600) });

export const ModelAnswer = z.discriminatedUnion("status", [OkAnswer, ClarifyAnswer, RefusedAnswer]);
export type ModelAnswer = z.infer<typeof ModelAnswer>;

export const MAX_OUTPUT_TOKENS = 4000;

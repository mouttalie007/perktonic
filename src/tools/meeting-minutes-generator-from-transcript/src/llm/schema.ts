import { z } from "zod";

const str = (max: number) => z.string().trim().min(1).max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const OkAnswer = z.object({
  status: z.literal("ok"),
  title: str(300).nullable(),
  date: isoDate.nullable(),
  attendees: z.array(z.object({ name: str(120), role: str(200).nullable() })).max(60),
  agenda: z.array(z.object({ topic: str(300), summary: str(1500) })).max(30),
  decisions: z.array(z.object({ text: str(800), quote: str(1500) })).max(40),
  actionItems: z.array(z.object({ task: str(600), owner: str(120).nullable(), dueDate: isoDate.nullable(), dueText: str(200).nullable(), quote: str(1500) })).max(60),
  openQuestions: z.array(z.object({ text: str(800), quote: str(1500) })).max(30),
});
export const ClarifyAnswer = z.object({ status: z.literal("needs_clarification"), message: str(600) });
export const RefusedAnswer = z.object({ status: z.literal("refused"), message: str(600) });

export const ModelAnswer = z.discriminatedUnion("status", [OkAnswer, ClarifyAnswer, RefusedAnswer]);
export type ModelAnswer = z.infer<typeof ModelAnswer>;
export type OkModelAnswer = z.infer<typeof OkAnswer>;

export const MAX_OUTPUT_TOKENS = 4000;

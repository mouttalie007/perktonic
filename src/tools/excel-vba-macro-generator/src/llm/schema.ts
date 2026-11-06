import { z } from "zod";

const risk = z.object({ line: z.number().int().min(1).nullable(), text: z.string().trim().min(1).max(400) });
const clarify = z.object({ status: z.literal("needs_clarification"), message: z.string().trim().min(1).max(600) });
const refused = z.object({ status: z.literal("refused"), message: z.string().trim().min(1).max(600) });

export const GenerateOk = z.object({
  status: z.literal("ok"),
  summary: z.string().trim().min(1).max(800),
  /** One complete, commented standard module. */
  code: z.string().min(10).max(20000),
  howToRun: z.array(z.string().trim().min(1).max(400)).min(2).max(10),
  assumptions: z.array(z.string().trim().min(1).max(400)).max(8),
  risks: z.array(risk).max(15),
});

export const ExplainOk = z.object({
  status: z.literal("ok"),
  summary: z.string().trim().min(1).max(1000),
  /** Ordered ranges of the pasted code; the server drops ranges outside the code. */
  lines: z.array(z.object({ from: z.number().int(), to: z.number().int(), text: z.string().trim().min(1).max(600) })).min(1).max(200),
  risks: z.array(risk).max(15),
});

export const GenerateAnswer = z.discriminatedUnion("status", [GenerateOk, clarify, refused]);
export const ExplainAnswer = z.discriminatedUnion("status", [ExplainOk, clarify, refused]);
export type GenerateAnswer = z.infer<typeof GenerateAnswer>;
export type ExplainAnswer = z.infer<typeof ExplainAnswer>;

export const MAX_OUTPUT_TOKENS = { generate: 3000, explain: 3500 } as const;

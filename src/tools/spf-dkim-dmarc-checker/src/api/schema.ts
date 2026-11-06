import { z } from "zod";
import { MAX_INPUT_LENGTH } from "../logic/types";

export const RequestSchema = z.object({
  domain: z.string().trim().min(1, "Enter a domain name to check.").max(MAX_INPUT_LENGTH, `The input can be at most ${MAX_INPUT_LENGTH} characters.`),
  selector: z.string().trim().max(63, "A DKIM selector can be at most 63 characters.").optional(),
});

const Check = z.object({ level: z.enum(["error", "warning", "info", "good"]), message: z.string() });
type Node = { domain: string; record: string | null; via: "start" | "include" | "redirect"; lookups: number; children: Node[]; problem: string | null };
const SpfNode: z.ZodType<Node> = z.lazy(() => z.object({ domain: z.string(), record: z.string().nullable(), via: z.enum(["start", "include", "redirect"]), lookups: z.number(), children: z.array(SpfNode), problem: z.string().nullable() }));

export const DataSchema = z.object({
  domain: z.string(),
  spf: z.object({ records: z.array(z.string()), record: z.string().nullable(), checks: z.array(Check), lookups: z.number(), voidLookups: z.number(), tree: SpfNode.nullable(), all: z.string().nullable(), suggestion: z.string().nullable() }),
  dmarc: z.object({ record: z.string().nullable(), foundAt: z.string().nullable(), tags: z.record(z.string(), z.string()), checks: z.array(Check), suggestion: z.string() }),
  dkim: z.object({ mode: z.enum(["selector", "probe"]), selectorsTried: z.array(z.string()), found: z.array(z.object({ selector: z.string(), record: z.string(), keyType: z.string(), keyBits: z.number().nullable(), testing: z.boolean(), revoked: z.boolean() })), checks: z.array(Check) }),
  mtaSts: z.object({ record: z.string().nullable(), policyUrl: z.string(), policy: z.object({ mode: z.string().nullable(), mx: z.array(z.string()), maxAge: z.number().nullable(), version: z.string().nullable() }).nullable(), checks: z.array(Check) }),
  bimi: z.object({ record: z.string().nullable(), checks: z.array(Check) }),
  queries: z.number().int().max(40),
  budgetReached: z.boolean(),
  checkedAt: z.string(),
});

export const ResponseSchema = z.discriminatedUnion("ok", [z.object({ ok: z.literal(true), data: DataSchema }), z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string() }) })]);
export type ApiResponse = z.infer<typeof ResponseSchema>;

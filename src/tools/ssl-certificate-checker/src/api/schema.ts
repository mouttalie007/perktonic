import { z } from "zod";
import { MAX_INPUT_LENGTH, PORTS, VERSIONS } from "../logic/types";

export const RequestSchema = z.object({
  host: z.string().trim().min(1, "Enter a domain name to check.").max(MAX_INPUT_LENGTH, `The input can be at most ${MAX_INPUT_LENGTH} characters.`),
  port: z
    .number()
    .int()
    .refine((p) => (PORTS as readonly number[]).includes(p), { message: `Allowed ports: ${PORTS.join(", ")}.` })
    .nullish(),
});

const Level = z.enum(["error", "warning", "info", "good"]);
export const DataSchema = z.object({
  host: z.string(),
  port: z.number(),
  ip: z.string().nullable(),
  verdict: z.object({ level: Level, text: z.string() }),
  daysLeft: z.number().nullable(),
  protocol: z.string().nullable(),
  cipher: z.string().nullable(),
  alpn: z.string().nullable(),
  versions: z.array(z.object({ version: z.enum(VERSIONS), accepted: z.boolean().nullable(), note: z.string().nullable() })),
  chain: z.array(z.object({ subject: z.string(), commonName: z.string().nullable(), issuer: z.string(), issuerName: z.string().nullable(), validFrom: z.string(), validTo: z.string(), daysLeft: z.number(), san: z.array(z.string()), serial: z.string(), fingerprint256: z.string(), keyType: z.string().nullable(), keyBits: z.number().nullable(), isCa: z.boolean(), selfSigned: z.boolean(), role: z.enum(["leaf", "intermediate", "root"]) })),
  checks: z.array(z.object({ id: z.string(), level: Level, title: z.string(), detail: z.string() })),
  handshakeMs: z.number().nullable(),
  checkedAt: z.string(),
});
export const ResponseSchema = z.discriminatedUnion("ok", [z.object({ ok: z.literal(true), data: DataSchema }), z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string() }) })]);
export type ApiResponse = z.infer<typeof ResponseSchema>;

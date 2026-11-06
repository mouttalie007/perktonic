import { z } from "zod";
import { MAX_INPUT_LENGTH, RECORD_TYPES } from "../logic/types";

export const RequestSchema = z.object({
  domain: z.string().trim().min(1, "Enter a domain name to look up.").max(MAX_INPUT_LENGTH, `The input can be at most ${MAX_INPUT_LENGTH} characters.`),
  types: z.array(z.enum(RECORD_TYPES)).max(8).optional(),
  whois: z.boolean().optional(),
});

const Row = z.object({ name: z.string(), type: z.string(), ttl: z.number(), data: z.string() });
export const DataSchema = z.object({
  domain: z.string(),
  input: z.string(),
  unicode: z.string().nullable(),
  results: z.array(z.object({ type: z.enum(RECORD_TYPES), status: z.enum(["ok", "nodata", "nxdomain", "servfail", "error", "skipped"]), records: z.array(Row), dnssec: z.boolean() })),
  chain: z.array(Row),
  findings: z.array(z.object({ level: z.enum(["error", "warning", "info", "good"]), code: z.string(), message: z.string() })),
  registration: z
    .object({
      status: z.enum(["ok", "no_rdap", "not_found", "error"]),
      message: z.string().nullable(),
      server: z.string().nullable(),
      domain: z.string().nullable(),
      registrar: z.string().nullable(),
      registrarIanaId: z.string().nullable(),
      created: z.string().nullable(),
      updated: z.string().nullable(),
      expires: z.string().nullable(),
      statuses: z.array(z.string()),
      nameservers: z.array(z.string()),
      dnssecSigned: z.boolean().nullable(),
    })
    .nullable(),
  queries: z.number().int().max(8),
  resolver: z.string(),
  checkedAt: z.string(),
});

export const ResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: DataSchema }),
  z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string() }) }),
]);
export type ApiResponse = z.infer<typeof ResponseSchema>;

import { z } from "zod";

const str = (max: number) => z.string().trim().min(1).max(max);
/** A value as printed, with the text it was copied from. */
const Field = z.object({ value: str(400).nullable(), quote: str(1000).nullable() });

export const OkAnswer = z.object({
  status: z.literal("ok"),
  vendor: Field,
  vendorTaxId: Field,
  invoiceNumber: Field,
  invoiceDate: Field,
  dueDate: Field,
  currency: Field,
  lineItems: z
    .array(
      z.object({
        description: str(600).nullable(),
        quantity: str(60).nullable(),
        unitPrice: str(60).nullable(),
        amount: str(60).nullable(),
        quote: str(1000).nullable(),
      }),
    )
    .max(150),
  subtotal: Field,
  taxes: z.array(z.object({ name: str(200).nullable(), rate: str(60).nullable(), amount: str(60).nullable(), quote: str(1000).nullable() })).max(12),
  total: Field,
  notes: z.array(str(600)).max(8),
});
export const ClarifyAnswer = z.object({ status: z.literal("needs_clarification"), message: str(600) });
export const RefusedAnswer = z.object({ status: z.literal("refused"), message: str(600) });

export const ModelAnswer = z.discriminatedUnion("status", [OkAnswer, ClarifyAnswer, RefusedAnswer]);
export type ModelAnswer = z.infer<typeof ModelAnswer>;
export type OkModelAnswer = z.infer<typeof OkAnswer>;

export const MAX_OUTPUT_TOKENS = 4000;

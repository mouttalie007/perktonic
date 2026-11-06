// Types shared by the route and the browser component (type-only imports).

export type FieldStatus = "verified" | "check" | "missing";

export interface Checked {
  /** As printed on the invoice (or null when the model found nothing). */
  value: string | null;
  quote: string | null;
  status: FieldStatus;
  /** Why the field needs checking, in plain words. */
  reason?: string;
  /** Lowest OCR confidence (0-100) of the words of the quote, for scanned invoices. */
  ocr?: number | null;
}

export interface CheckedAmount extends Checked {
  /** Parsed by our code (never by the model). */
  number: number | null;
  ambiguous?: boolean;
}

export interface LineItem {
  description: Checked;
  quantity: CheckedAmount;
  unitPrice: CheckedAmount;
  amount: CheckedAmount;
  quote: string | null;
}

export interface Tax {
  name: string | null;
  rate: string | null;
  amount: CheckedAmount;
  quote: string | null;
}

export interface ArithmeticCheck {
  id: "line" | "lines_vs_subtotal" | "subtotal_plus_taxes_vs_total";
  label: string;
  status: "pass" | "fail" | "skipped";
  expected: number | null;
  actual: number | null;
  difference: number | null;
  /** Line number (1-based) for "line" checks. */
  line?: number;
}

export interface Invoice {
  vendor: Checked;
  vendorTaxId: Checked;
  invoiceNumber: Checked;
  invoiceDate: Checked;
  dueDate: Checked;
  currency: Checked;
  lineItems: LineItem[];
  subtotal: CheckedAmount;
  taxes: Tax[];
  total: CheckedAmount;
  notes: string[];
  numberStyle: "1,234.56" | "1.234,56" | "unknown";
  checks: ArithmeticCheck[];
}

export type InvoiceResult = ({ status: "ok" } & Invoice & { cached: boolean }) | { status: "needs_clarification" | "refused"; message: string; cached: boolean };

export type ApiResponse = { ok: true; data: InvoiceResult } | { ok: false; error: { code: string; message: string } };

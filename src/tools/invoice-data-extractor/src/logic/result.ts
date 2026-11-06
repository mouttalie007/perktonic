// Server-side rules, never delegated to the model: quotes found in the text, amounts parsed by us
// and present in their quote, dates written in their quote, confidence per field, and arithmetic.
import { LOW_OCR } from "../limits";
import type { OkModelAnswer } from "../llm/schema";
import type { ArithmeticCheck, Checked, CheckedAmount, Invoice, InvoiceResult, LineItem, Tax } from "../types";
import { detectStyle, parseAmount, round2, writtenIn, type Style } from "./amounts";
import { datesInAny } from "./dates";
import { collapse, containsCollapsed } from "./text";

export interface Source {
  text: string;
  source: "pdf" | "ocr";
  words?: { text: string; confidence: number }[];
}

type Answer = OkModelAnswer | { status: "needs_clarification" | "refused"; message: string };

const SYMBOLS: Record<string, string> = { "ر.س": "SAR", "د.إ": "AED", "€": "EUR", "£": "GBP", "₹": "INR", "₺": "TRY", "₩": "KRW", "₪": "ILS", "₦": "NGN", "₱": "PHP", "₫": "VND", "฿": "THB", "₴": "UAH", "₽": "RUB" };

/** Lowest OCR confidence of the words that make up a quote (null for PDF text). */
function ocrConfidence(value: string, quote: string | null, src: Source): number | null {
  if (src.source !== "ocr" || !src.words?.length) return null;
  const of = (s: string) => {
    const tokens = new Set(collapse(s).split(" "));
    return src.words!.filter((w) => tokens.has(w.text)).map((w) => w.confidence);
  };
  // The words of the value itself; the whole quote only when the value's words are not found.
  const own = of(value);
  const conf = own.length ? own : quote ? of(quote) : [];
  return conf.length ? Math.min(...conf) : null;
}

function base(value: string | null, quote: string | null, src: Source, inQuote: (v: string, q: string) => boolean, what: string): Checked {
  if (value === null) return { value: null, quote: null, status: "missing" };
  const ocr = ocrConfidence(value, quote, src);
  const extra = ocr !== null ? { ocr } : {};
  if (!quote || !containsCollapsed(src.text, quote)) return { value, quote, status: "check", reason: "The quoted text was not found in the invoice.", ...extra };
  if (!inQuote(value, quote)) return { value, quote, status: "check", reason: `The ${what} is not written in the quoted text.`, ...extra };
  if (ocr !== null && ocr < LOW_OCR) return { value, quote, status: "check", reason: `The scan was hard to read here (OCR confidence ${Math.round(ocr)}).`, ...extra };
  return { value, quote, status: "verified", ...extra };
}

const textIn = (v: string, q: string) => containsCollapsed(q, v, true);

function amountField(value: string | null, quote: string | null, src: Source, style: Style | null): CheckedAmount {
  const c = base(value, quote, src, writtenIn, "amount as returned (amounts must be copied as printed)");
  const p = parseAmount(value, style);
  if (value !== null && p.number === null) return { ...c, number: null, status: "check", reason: "This is not a readable amount." };
  if (p.ambiguous) return { ...c, number: p.number, ambiguous: true, status: c.status === "verified" ? "check" : c.status, reason: `Ambiguous: "${value}" could be ${p.number} or a decimal number. Check it.` };
  return { ...c, number: p.number };
}

function dateField(value: string | null, quote: string | null, src: Source): Checked {
  if (value !== null && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { value, quote, status: "check", reason: "Not a full date (YYYY-MM-DD)." };
  return base(value, quote, src, (v, q) => datesInAny(q).has(v), "date");
}

function currencyField(value: string | null, quote: string | null, src: Source): Checked {
  if (value === null) return { value: null, quote: null, status: "missing" };
  const code = value.toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return { value, quote, status: "check", reason: "Not a 3-letter currency code." };
  const printed = (q: string) => new RegExp(`\\b${code}\\b`).test(q) || Object.entries(SYMBOLS).some(([s, c]) => c === code && q.includes(s));
  return base(code, quote, src, (_v, q) => printed(q), "currency");
}

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol + 1e-9;

export function arithmetic(lines: LineItem[], subtotal: CheckedAmount, taxes: Tax[], total: CheckedAmount): ArithmeticCheck[] {
  const checks: ArithmeticCheck[] = [];
  lines.forEach((l, i) => {
    const q = l.quantity.number;
    const u = l.unitPrice.number;
    const a = l.amount.number;
    if (q === null || u === null || a === null) return;
    const expected = round2(q * u);
    checks.push({ id: "line", line: i + 1, label: `Line ${i + 1}: quantity × unit price = amount`, status: near(expected, a, 0.01) ? "pass" : "fail", expected, actual: a, difference: round2(a - expected) });
  });
  const amounts = lines.map((l) => l.amount.number);
  const linesSum = amounts.length && amounts.every((n) => n !== null) ? round2(amounts.reduce((s: number, n) => s + (n as number), 0)) : null;
  const tol = 0.01 * Math.max(1, lines.length);
  if (linesSum === null || subtotal.number === null) checks.push({ id: "lines_vs_subtotal", label: "Sum of line amounts = subtotal", status: "skipped", expected: linesSum, actual: subtotal.number, difference: null });
  else checks.push({ id: "lines_vs_subtotal", label: "Sum of line amounts = subtotal", status: near(linesSum, subtotal.number, tol) ? "pass" : "fail", expected: linesSum, actual: subtotal.number, difference: round2(subtotal.number - linesSum) });
  const taxNums = taxes.map((t) => t.amount.number);
  const start = subtotal.number ?? linesSum;
  if (start === null || total.number === null || taxNums.some((n) => n === null)) checks.push({ id: "subtotal_plus_taxes_vs_total", label: "Subtotal + taxes = total", status: "skipped", expected: null, actual: total.number, difference: null });
  else {
    const expected = round2(start + taxNums.reduce((s: number, n) => s + (n as number), 0));
    checks.push({ id: "subtotal_plus_taxes_vs_total", label: subtotal.number === null ? "Sum of lines + taxes = total (no subtotal printed)" : "Subtotal + taxes = total", status: near(expected, total.number, 0.01 * (1 + taxes.length)) ? "pass" : "fail", expected, actual: total.number, difference: round2(total.number - expected) });
  }
  return checks;
}

export function buildInvoice(a: OkModelAnswer, src: Source): Invoice {
  const style = detectStyle(src.text);
  const lineItems: LineItem[] = a.lineItems.map((l) => {
    const q = l.quote;
    return {
      description: base(l.description, q, src, textIn, "description"),
      quantity: amountField(l.quantity, q, src, style),
      unitPrice: amountField(l.unitPrice, q, src, style),
      amount: amountField(l.amount, q, src, style),
      quote: q,
    };
  });
  const taxes: Tax[] = a.taxes.map((t) => ({ name: t.name, rate: t.rate, amount: amountField(t.amount, t.quote, src, style), quote: t.quote }));
  const subtotal = amountField(a.subtotal.value, a.subtotal.quote, src, style);
  const total = amountField(a.total.value, a.total.quote, src, style);
  return {
    vendor: base(a.vendor.value, a.vendor.quote, src, textIn, "name"),
    vendorTaxId: base(a.vendorTaxId.value, a.vendorTaxId.quote, src, textIn, "number"),
    invoiceNumber: base(a.invoiceNumber.value, a.invoiceNumber.quote, src, textIn, "number"),
    invoiceDate: dateField(a.invoiceDate.value, a.invoiceDate.quote, src),
    dueDate: dateField(a.dueDate.value, a.dueDate.quote, src),
    currency: currencyField(a.currency.value, a.currency.quote, src),
    lineItems,
    subtotal,
    taxes,
    total,
    notes: a.notes,
    numberStyle: style === "dot" ? "1,234.56" : style === "comma" ? "1.234,56" : "unknown",
    checks: arithmetic(lineItems, subtotal, taxes, total),
  };
}

export function buildResult(a: Answer, src: Source, cached: boolean): InvoiceResult {
  if (a.status !== "ok") return { status: a.status, message: a.message, cached };
  return { status: "ok", ...buildInvoice(a, src), cached };
}

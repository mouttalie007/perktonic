// JSON, CSV (one row per line item, invoice fields repeated) and XLSX (one sheet per invoice and a summary).
import type { Checked, InvoiceResult } from "../types";
import { writeXlsx, type XCell, type XSheet } from "./xlsx";

export interface Done {
  fileName: string;
  result: InvoiceResult;
}

const v = (c: Checked) => c.value ?? "";
const looksLikeFormula = (t: string) => /^[=+\-@\t\r]/.test(t) && !/^[-+]?\d[\d.,\s]*$/.test(t.trim());

export function toJson(done: Done[]): string {
  return JSON.stringify(
    done.map((d) => ({ file: d.fileName, ...d.result, cached: undefined })),
    null,
    2,
  );
}

const HEAD = ["file", "vendor", "vendor_tax_id", "invoice_number", "invoice_date", "due_date", "currency", "subtotal", "tax_total", "total", "line", "description", "quantity", "unit_price", "amount", "amount_number", "checks"];

export function toCsv(done: Done[]): string {
  const field = (s: string) => {
    const t = looksLikeFormula(s) ? `'${s}` : s;
    return /[",\r\n]/.test(t) || /^\s|\s$/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const rows: string[][] = [HEAD];
  for (const { fileName, result: r } of done) {
    if (r.status !== "ok") continue;
    const taxTotal = r.taxes.every((t) => t.amount.number !== null) && r.taxes.length ? String(Math.round(r.taxes.reduce((s, t) => s + (t.amount.number ?? 0), 0) * 100) / 100) : "";
    const checks = r.checks.filter((c) => c.status === "fail").length ? "fail" : r.checks.some((c) => c.status === "pass") ? "pass" : "skipped";
    const common = [fileName, v(r.vendor), v(r.vendorTaxId), v(r.invoiceNumber), v(r.invoiceDate), v(r.dueDate), v(r.currency), r.subtotal.number?.toString() ?? "", taxTotal, r.total.number?.toString() ?? ""];
    if (!r.lineItems.length) rows.push([...common, "", "", "", "", "", "", checks]);
    r.lineItems.forEach((l, i) => rows.push([...common, String(i + 1), v(l.description), v(l.quantity), v(l.unitPrice), v(l.amount), l.amount.number?.toString() ?? "", checks]));
  }
  return "﻿" + rows.map((r) => r.map(field).join(",")).join("\r\n") + "\r\n";
}

const text = (s: string | null, bold = false): XCell => (s ? { t: "s", v: s, bold, protect: looksLikeFormula(s) } : null);
const num = (n: number | null): XCell => (n === null ? null : { t: "n", v: n });

export function toXlsx(done: Done[]): Uint8Array {
  const ok = done.filter((d) => d.result.status === "ok");
  const summary: XSheet = {
    name: "Summary",
    freezeRows: 1,
    merges: [],
    rows: [
      ["File", "Vendor", "Invoice number", "Invoice date", "Due date", "Currency", "Subtotal", "Taxes", "Total", "Arithmetic", "Fields to check"].map((h) => text(h, true)),
      ...ok.map(({ fileName, result: r }) => {
        if (r.status !== "ok") return [];
        const toCheck = [r.vendor, r.vendorTaxId, r.invoiceNumber, r.invoiceDate, r.dueDate, r.currency, r.subtotal, r.total, ...r.lineItems.flatMap((l) => [l.description, l.quantity, l.unitPrice, l.amount]), ...r.taxes.map((t) => t.amount)].filter((c) => c.status === "check").length;
        const taxes = r.taxes.length && r.taxes.every((t) => t.amount.number !== null) ? Math.round(r.taxes.reduce((s, t) => s + (t.amount.number ?? 0), 0) * 100) / 100 : null;
        return [text(fileName), text(r.vendor.value), text(r.invoiceNumber.value), text(r.invoiceDate.value), text(r.dueDate.value), text(r.currency.value), num(r.subtotal.number), num(taxes), num(r.total.number), text(r.checks.some((c) => c.status === "fail") ? "Mismatch" : r.checks.some((c) => c.status === "pass") ? "Adds up" : "Not checked"), num(toCheck)];
      }),
    ],
  };
  const sheets = ok.map(({ fileName, result: r }, i): XSheet => {
    if (r.status !== "ok") throw new Error("unreachable");
    const rows: XCell[][] = [[text("Field", true), text("Value as printed", true), text("Status", true), text("Quote", true)]];
    const add = (name: string, c: Checked & { number?: number | null }) => rows.push([text(name), text(c.value), text(c.status), text(c.quote)]);
    add("Vendor", r.vendor);
    add("Vendor tax ID", r.vendorTaxId);
    add("Invoice number", r.invoiceNumber);
    add("Invoice date", r.invoiceDate);
    add("Due date", r.dueDate);
    add("Currency", r.currency);
    add("Subtotal", r.subtotal);
    r.taxes.forEach((t) => add(`Tax ${[t.name, t.rate].filter(Boolean).join(" ")}`.trim(), t.amount));
    add("Total", r.total);
    rows.push([], [text("Line", true), text("Description", true), text("Quantity", true), text("Unit price", true), text("Amount", true), text("Amount (number)", true)]);
    r.lineItems.forEach((l, k) => rows.push([num(k + 1), text(l.description.value), text(l.quantity.value), text(l.unitPrice.value), text(l.amount.value), num(l.amount.number)]));
    rows.push([], [text("Check", true), text("Result", true), text("Expected", true), text("Printed", true), text("Difference", true)]);
    r.checks.forEach((c) => rows.push([text(c.label), text(c.status), num(c.expected), num(c.actual), num(c.difference)]));
    return { name: `${i + 1} ${r.invoiceNumber.value ?? fileName}`, rows, merges: [], freezeRows: 1 };
  });
  return writeXlsx([summary, ...sheets]);
}

import { CATEGORIES, DISCLAIMER, type CategoryId } from "../limits";
import type { NormalisedValue, Term } from "../types";

export const categoryLabel = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

export function formatNormalised(n: NormalisedValue): string {
  if (n === null) return "";
  if (typeof n === "string") return n;
  return `${n.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${n.currency}`;
}

/** Terms grouped in the fixed category order (empty groups are left out). */
export function groupTerms(terms: Term[]): { id: CategoryId; label: string; terms: Term[] }[] {
  return CATEGORIES.map((c) => ({ id: c.id as CategoryId, label: c.label as string, terms: terms.filter((t) => t.category === c.id) })).filter((g) => g.terms.length > 0);
}

/** "4.2" → "Clause 4.2"; "Section 3" stays as written. */
export const clauseText = (ref: string) => (/^[\d(]/.test(ref.trim()) ? `Clause ${ref.trim()}` : ref.trim());

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

/** CSV cells: quoted, quotes doubled, and cells starting with = + - @ are prefixed so spreadsheets do not run them. */
export function csvCell(value: string): string {
  const v = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${v.replace(/"/g, '""')}"`;
}

/** CSV with a byte-order mark so Excel opens accents correctly; the disclaimer is the first line. */
export function toCsv(terms: Term[]): string {
  const rows = [[DISCLAIMER], ["Category", "Label", "Value", "Normalised", "Clause", "Quote"]];
  for (const t of terms) rows.push([categoryLabel(t.category), t.label, t.value, formatNormalised(t.normalised), t.clauseRef ?? "", oneLine(t.quote)]);
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

const mdEscape = (s: string) => oneLine(s).replace(/([\\`*_[\]<>#|])/g, "\\$1");

/** Markdown checklist: one box per term, grouped by category, gaps listed; disclaimer first. */
export function toMarkdownChecklist(terms: Term[], notFound: CategoryId[], notes: string[]): string {
  const out = [`> ${DISCLAIMER}`, "", "# Contract key terms", ""];
  for (const g of groupTerms(terms)) {
    out.push(`## ${g.label}`, "");
    for (const t of g.terms) {
      const extra = [t.clauseRef ? mdEscape(clauseText(t.clauseRef)) : "", formatNormalised(t.normalised)].filter(Boolean).join(", ");
      out.push(`- [ ] **${mdEscape(t.label)}**: ${mdEscape(t.value)}${extra ? ` (${extra})` : ""}`, `  > ${mdEscape(t.quote)}`);
    }
    out.push("");
  }
  if (notFound.length) out.push("## Not found in this text", "", ...notFound.map((c) => `- ${categoryLabel(c)}`), "");
  if (notes.length) out.push("## Notes", "", ...notes.map((n) => `- ${mdEscape(n)}`), "");
  return out.join("\n");
}

export function toPlainText(terms: Term[], notFound: CategoryId[]): string {
  const out = [DISCLAIMER, ""];
  for (const g of groupTerms(terms)) {
    out.push(g.label.toUpperCase());
    for (const t of g.terms) out.push(`- ${t.label}: ${oneLine(t.value)}${t.clauseRef ? ` (${clauseText(t.clauseRef)})` : ""}`);
    out.push("");
  }
  if (notFound.length) out.push(`Not found in this text: ${notFound.map(categoryLabel).join(", ")}`);
  return out.join("\n").trim() + "\n";
}

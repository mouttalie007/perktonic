import { DOC_TYPES, SECTIONS } from "../limits";
import type { SopDoc } from "../types";

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
const mdCell = (s: string) => oneLine(s).replace(/\|/g, "\\|");
const mdText = (s: string) => s.replace(/^(\s*)([#>]|[-*+]\s|\d+[.)]\s)/gm, "$1\\$2");

/** Markdown with the fixed six sections; an onboarding checklist gets tick boxes. */
export function toMarkdown(doc: SopDoc): string {
  const [purpose, scope, roles, steps, kpis, revisions] = SECTIONS;
  const type = DOC_TYPES.find((d) => d.id === doc.docType)!;
  const out = [`# ${oneLine(doc.title)}`, "", `*${type.label}*`, "", `## 1. ${purpose}`, "", mdText(doc.purpose.trim()), "", `## 2. ${scope}`, "", mdText(doc.scope.trim()), "", `## 3. ${roles}`, "", "| Role | Responsibility |", "| --- | --- |"];
  for (const r of doc.roles) out.push(`| ${mdCell(r.role)} | ${mdCell(r.responsibility)} |`);
  out.push("", `## 4. ${steps}`, "");
  for (const s of doc.steps) out.push(doc.docType === "onboarding" ? `- [ ] ${s.n}. ${oneLine(s.action)} (${oneLine(s.owner)})` : `${s.n}. ${oneLine(s.action)} *(${oneLine(s.owner)})*`);
  out.push("", `## 5. ${kpis}`, "", "| KPI | How it is measured |", "| --- | --- |");
  for (const k of doc.kpis) out.push(`| ${mdCell(k.name)} | ${mdCell(k.howMeasured)} |`);
  out.push("", `## 6. ${revisions}`, "", "| Version | Date | Author | Change |", "| --- | --- | --- | --- |");
  for (const v of doc.revisions) out.push(`| ${mdCell(v.version)} | ${mdCell(v.date)} | ${mdCell(v.author)} | ${mdCell(v.change)} |`);
  return out.join("\n") + "\n";
}

/** Plain text for the clipboard (pastes cleanly into email or a wiki). */
export function toPlainText(doc: SopDoc): string {
  const [purpose, scope, roles, steps, kpis, revisions] = SECTIONS;
  const out = [doc.title.trim(), "", `1. ${purpose.toUpperCase()}`, doc.purpose.trim(), "", `2. ${scope.toUpperCase()}`, doc.scope.trim(), "", `3. ${roles.toUpperCase()}`];
  for (const r of doc.roles) out.push(`- ${oneLine(r.role)}: ${oneLine(r.responsibility)}`);
  out.push("", `4. ${steps.toUpperCase()}`);
  for (const s of doc.steps) out.push(`${doc.docType === "onboarding" ? "[ ] " : ""}${s.n}. ${oneLine(s.action)} (${oneLine(s.owner)})`);
  out.push("", `5. ${kpis.toUpperCase()}`);
  for (const k of doc.kpis) out.push(`- ${oneLine(k.name)}: ${oneLine(k.howMeasured)}`);
  out.push("", `6. ${revisions.toUpperCase()}`);
  for (const v of doc.revisions) out.push(`- ${v.version} | ${v.date} | ${oneLine(v.author)} | ${oneLine(v.change)}`);
  return out.join("\n") + "\n";
}

export function fileName(doc: SopDoc, ext: string): string {
  const base = doc.title.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").slice(0, 60).replace(/-+$/, "");
  return `${base || "document"}.${ext}`;
}

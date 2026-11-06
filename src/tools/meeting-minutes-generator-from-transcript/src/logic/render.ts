// Markdown minutes, the action items as CSV and as a Markdown checklist, and plain text for copy.
import type { Minutes } from "../types";

const one = (s: string) => s.replace(/\s+/g, " ").trim();
const md = (s: string) => one(s).replace(/([\\`*_[\]<>#|])/g, "\\$1");

export function toMarkdown(m: Minutes): string {
  const out = [`# ${md(m.title ?? "Meeting minutes")}`, ""];
  if (m.date) out.push(`**Date:** ${m.date}`, "");
  out.push("## Attendees", "", ...(m.attendees.length ? m.attendees.map((a) => `- ${md(a.name)}${a.role ? ` (${md(a.role)})` : ""}`) : ["- Not stated in the transcript"]), "");
  out.push("## Agenda", "");
  m.agenda.forEach((t, i) => out.push(`### ${i + 1}. ${md(t.topic)}`, "", md(t.summary), ""));
  out.push("## Decisions", "", ...(m.decisions.length ? m.decisions.map((d) => `- ${md(d.text)}`) : ["- None recorded"]), "");
  out.push("## Action items", "", ...(m.actionItems.length ? m.actionItems.map(checkItem) : ["- None recorded"]), "");
  out.push("## Open questions", "", ...(m.openQuestions.length ? m.openQuestions.map((q) => `- ${md(q.text)}`) : ["- None"]), "");
  return out.join("\n");
}

const checkItem = (i: Minutes["actionItems"][number]) => `- [ ] ${md(i.task)} (${md(i.owner ?? "Unassigned")}${i.dueDate ? `, due ${i.dueDate}` : i.dueText ? `, ${md(i.dueText)}` : ""})`;

export const toChecklist = (m: Minutes) => m.actionItems.map(checkItem).join("\n") + "\n";

export function toActionsCsv(m: Minutes): string {
  const field = (s: string) => {
    const t = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\r\n]/.test(t) || /^\s|\s$/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const rows = [["task", "owner", "due_date", "due_text", "quote"], ...m.actionItems.map((i) => [i.task, i.owner ?? "Unassigned", i.dueDate ?? "", i.dueText ?? "", one(i.quote)])];
  return "﻿" + rows.map((r) => r.map(field).join(",")).join("\r\n") + "\r\n";
}

export function toPlainText(m: Minutes): string {
  const out = [m.title ?? "Meeting minutes", m.date ? `Date: ${m.date}` : "", "", "ATTENDEES", ...m.attendees.map((a) => `- ${a.name}${a.role ? ` (${a.role})` : ""}`), "", "AGENDA"];
  m.agenda.forEach((t, i) => out.push(`${i + 1}. ${t.topic}: ${one(t.summary)}`));
  out.push("", "DECISIONS", ...m.decisions.map((d) => `- ${one(d.text)}`), "", "ACTION ITEMS", ...m.actionItems.map((i) => `- ${one(i.task)} (${i.owner ?? "Unassigned"}${i.dueDate ? `, due ${i.dueDate}` : i.dueText ? `, ${i.dueText}` : ""})`), "", "OPEN QUESTIONS", ...m.openQuestions.map((q) => `- ${one(q.text)}`));
  return out.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n").trim() + "\n";
}

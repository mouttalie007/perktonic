// CSV (UTF-8 with BOM so Excel opens it correctly) and a Markdown checklist.

export interface ExportItem {
  task: string;
  owner: string | null;
  dueDate: string | null;
  dueText: string | null;
  quote: string;
}

function csvCell(v: string): string {
  // Cells that start with = + - @ would run as formulas in a spreadsheet; a leading ' keeps them as text.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(items: ExportItem[]): string {
  const rows = [["Task", "Owner", "Due date", "Due (as written)", "Quote"], ...items.map((i) => [i.task, i.owner ?? "Unassigned", i.dueDate ?? "", i.dueText ?? "", i.quote])];
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function toMarkdown(items: ExportItem[]): string {
  return items
    .map((i) => {
      const meta = [i.owner ?? "Unassigned", i.dueDate ?? i.dueText].filter(Boolean).join(", ");
      return `- [ ] ${i.task.replace(/\s+/g, " ")} (${meta})`;
    })
    .join("\n")
    .concat("\n");
}

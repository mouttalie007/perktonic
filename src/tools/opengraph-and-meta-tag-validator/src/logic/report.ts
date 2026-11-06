import type { ValidationResult } from "./run";

export function reportText(r: ValidationResult): string {
  const lines = [`Meta tag report for ${r.finalUrl}`, ""];
  for (const sev of ["error", "warning", "info", "good"] as const) {
    const list = r.issues.filter((i) => i.severity === sev);
    if (list.length === 0) continue;
    lines.push(`${sev.toUpperCase()} (${list.length})`);
    for (const i of list) lines.push(`- ${i.message}${i.fix ? `\n  Fix: ${i.fix.replace(/\n/g, "\n       ")}` : ""}`);
    lines.push("");
  }
  lines.push("Tags found:");
  for (const t of r.tags.raw) lines.push(`${t.key}: ${t.value}`);
  return lines.join("\n") + "\n";
}

/** The fixes as one block of HTML to paste into <head>. */
export function fixSnippet(r: ValidationResult): string {
  const fixes = [...new Set(r.issues.filter((i) => i.fix && (i.severity === "error" || i.severity === "warning")).map((i) => i.fix as string))];
  return fixes.length ? fixes.join("\n") + "\n" : "";
}

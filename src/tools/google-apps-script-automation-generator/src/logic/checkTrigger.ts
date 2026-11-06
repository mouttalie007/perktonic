import { codeOnly, definedFunctions } from "./code";
import { NEEDS_AUTH, TRIGGER_INFO, type TriggerId } from "./triggers";

/** Does the script fit the trigger the visitor picked? */
export function triggerWarnings(script: string, trigger: TriggerId): string[] {
  const out: string[] = [];
  const fns = definedFunctions(script);
  const info = TRIGGER_INFO[trigger];
  const code = codeOnly(script);
  if (info.requiredFunction && !fns.includes(info.requiredFunction)) out.push(`A ${info.label} trigger needs a function named ${info.requiredFunction}; the script does not define one.`);
  if (trigger === "simple-onedit") {
    const used = NEEDS_AUTH.filter((s) => new RegExp(`\\b${s}\\b`).test(code));
    if (/\bSpreadsheetApp\s*\.\s*openBy(Id|Url)\b/.test(code)) used.push("SpreadsheetApp.openById/openByUrl");
    if (used.length) out.push(`A simple onEdit trigger cannot use ${used.join(", ")}: it runs without permission. Pick "Installable on-edit" and rename the function (not onEdit).`);
  }
  if (trigger === "installable-onedit" && fns.includes("onEdit"))
    out.push("The function is named onEdit, so it also runs as a simple trigger: with an installable on-edit trigger on it, every edit runs it twice. Rename it (for example onSheetEdit).");
  if (info.kind === "installable" && fns.length === 0) out.push("The script defines no function for the trigger to run.");
  return out;
}

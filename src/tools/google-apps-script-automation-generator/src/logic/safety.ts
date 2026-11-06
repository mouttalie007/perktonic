// "Review before you run": a deterministic safety review that always runs on the generated script.

import { codeOnly, lineOf, stringLiterals } from "./code";

export interface ReviewItem {
  level: "danger" | "check";
  text: string;
  line: number | null;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const URL_RE = /https?:\/\/([A-Za-z0-9.-]+)(?::\d+)?[^\s"'`]*/g;

/** `request` is everything the visitor typed (task + sheet structure). */
export function reviewScript(script: string, request: string): ReviewItem[] {
  const items: ReviewItem[] = [];
  const asked = request.toLowerCase();
  const code = codeOnly(script);
  const literals = stringLiterals(script).join("\n");

  const emails = [...new Set([...literals.matchAll(EMAIL)].map((m) => m[0].toLowerCase()))];
  for (const e of emails) {
    if (!asked.includes(e)) items.push({ level: "danger", text: `The script contains the e-mail address ${e}, which is not in your request. Remove it unless you know why it is there.`, line: lineOf(script, script.toLowerCase().indexOf(e)) });
  }

  const fetches = [...code.matchAll(/\bUrlFetchApp\s*\.\s*fetch(?:All)?\s*\(/g)];
  if (fetches.length) {
    const hosts = [...new Set([...literals.matchAll(URL_RE)].map((m) => m[1].toLowerCase()))];
    for (const h of hosts) if (!asked.includes(h)) items.push({ level: "danger", text: `The script contacts ${h}, which is not in your request.`, line: lineOf(script, script.toLowerCase().indexOf(h)) });
    for (const f of fetches) {
      const after = script.slice((f.index ?? 0) + f[0].length).trimStart();
      // A constant holding a literal URL counts as a literal (its host was checked above).
      const ident = /^([A-Za-z_$][\w$]*)\s*[,)]/.exec(after)?.[1];
      const constUrl = ident ? new RegExp(`\\bconst\\s+${ident.replace(/\$/g, "\\$")}\\s*=\\s*["'\`]https?:\\/\\/`).test(script) : false;
      if (!/^["'`]https?:\/\//.test(after) && !constUrl) items.push({ level: "check", text: "UrlFetchApp.fetch gets its address from a variable. Check where that address comes from before you run it.", line: lineOf(script, f.index ?? 0) });
    }
    if (/\.(getValues|getDisplayValues|getDataRange)\s*\(/.test(code) && /\bpayload\b|method\s*:\s*["']?post/i.test(script))
      items.push({ level: "danger", text: "The script reads sheet data and sends it to an external address (UrlFetchApp with a payload). Make sure you trust the receiving service.", line: lineOf(script, fetches[0].index ?? 0) });
  }

  for (const m of code.matchAll(/\beval\s*\(|\bnew\s+Function\s*\(|(?:^|[^\w.$])Function\s*\(/g)) items.push({ level: "danger", text: `The script runs text as code (${m[0].replace(/^[^\w]*/, "").replace(/\s*\($/, "")}). Generated automations should never need this.`, line: lineOf(script, m.index ?? 0) });

  if (/\.setSharing\s*\(\s*DriveApp\s*\.\s*Access\s*\.\s*ANYONE/.test(code)) items.push({ level: "danger", text: "The script makes files viewable by anyone with the link.", line: lineOf(script, code.search(/\.setSharing\s*\(/)) });
  const addPeople = code.search(/\.add(Editor|Viewer|Editors|Viewers)\s*\(/);
  if (addPeople >= 0) items.push({ level: "check", text: "The script shares a file with other people (addEditor / addViewer). Check who they are.", line: lineOf(script, addPeople) });
  const destructive = code.search(/\.(deleteRow|deleteRows|deleteSheet|deleteColumn|deleteColumns|clear|clearContents|setTrashed|moveToTrash)\s*\(/);
  if (destructive >= 0) items.push({ level: "check", text: "The script deletes or clears data. Try it on a copy of the spreadsheet first.", line: lineOf(script, destructive) });
  const sends = code.search(/\b(MailApp|GmailApp)\s*\.\s*send/);
  if (sends >= 0) items.push({ level: "check", text: "The script sends e-mail as you. Test it with your own address first.", line: lineOf(script, sends) });
  return items;
}

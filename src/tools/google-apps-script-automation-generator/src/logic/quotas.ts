// Our own small quota table. Source: "Quotas for Google Services"
// (https://developers.google.com/apps-script/guides/services/quotas), checked 2026-10-30.
// Google changes these limits; the page tells visitors to check the current numbers.

import type { TriggerId } from "./triggers";

export const QUOTA_DOC = "https://developers.google.com/apps-script/guides/services/quotas";
export const QUOTAS_CHECKED = "2026-10-30";

export interface QuotaNote {
  id: string;
  topic: string;
  consumer: string;
  workspace: string;
}

const Q: Record<string, QuotaNote> = {
  mail: { id: "mail", topic: "Email recipients per day (MailApp / GmailApp)", consumer: "100", workspace: "1,500" },
  runtime: { id: "runtime", topic: "Run time of one execution", consumer: "6 min", workspace: "6 min" },
  simple: { id: "simple", topic: "Run time of a simple trigger (onEdit / onOpen)", consumer: "30 s", workspace: "30 s" },
  triggerTime: { id: "triggerTime", topic: "Total run time of triggers per day", consumer: "90 min", workspace: "6 h" },
  triggers: { id: "triggers", topic: "Triggers per user per script", consumer: "20", workspace: "20" },
  urlfetch: { id: "urlfetch", topic: "URL Fetch calls per day", consumer: "20,000", workspace: "100,000" },
  calendar: { id: "calendar", topic: "Calendar events created per day", consumer: "5,000", workspace: "10,000" },
  docs: { id: "docs", topic: "Documents created per day", consumer: "250", workspace: "1,500" },
};

export function quotaNotes(script: string, trigger: TriggerId): QuotaNote[] {
  const out: QuotaNote[] = [Q.runtime];
  if (trigger === "simple-onedit" || trigger === "onopen-menu") out.push(Q.simple);
  else out.push(Q.triggerTime, Q.triggers);
  if (/\b(MailApp|GmailApp)\s*\.\s*send/.test(script)) out.push(Q.mail);
  if (/\bUrlFetchApp\b/.test(script)) out.push(Q.urlfetch);
  if (/\bcreate(All)?DayEvent|createEvent\b/.test(script)) out.push(Q.calendar);
  if (/\bDocumentApp\s*\.\s*create\b/.test(script)) out.push(Q.docs);
  return out;
}

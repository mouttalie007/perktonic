// Our own service → OAuth scope table. The scopes shown on the page come from here, not from the model.
// Source: Google Apps Script reference pages of each service and "Authorization scopes"
// (https://developers.google.com/apps-script/concepts/scopes), checked 2026-10-30.

import { codeOnly } from "./code";

export const SCOPES_CHECKED = "2026-10-30";

export interface ServiceScope {
  service: string;
  /** Regular expression source that detects the use, on code without comments and strings. */
  detect: string;
  scope: string | null;
  why: string;
  doc: string;
}

// SpreadsheetApp is also detected through the Range/Sheet methods used on an event object (e.range.getSheet()),
// because the script editor asks for the spreadsheet scope for those too.
export const SERVICE_SCOPES: ServiceScope[] = [
  { service: "SpreadsheetApp", detect: "\\bSpreadsheetApp\\b|\\.(?:getRange|getSheet|getSheetByName|getActiveSheet|getDataRange|getValues|setValue|setValues|appendRow|getLastRow|setBackgrounds)\\s*\\(", scope: "https://www.googleapis.com/auth/spreadsheets", why: "Read and change your spreadsheets", doc: "https://developers.google.com/apps-script/reference/spreadsheet" },
  { service: "GmailApp", detect: "\\bGmailApp\\b", scope: "https://mail.google.com/", why: "Read, send and delete your Gmail (full mailbox access)", doc: "https://developers.google.com/apps-script/reference/gmail" },
  { service: "MailApp", detect: "\\bMailApp\\b", scope: "https://www.googleapis.com/auth/script.send_mail", why: "Send email as you (no access to your inbox)", doc: "https://developers.google.com/apps-script/reference/mail" },
  { service: "DriveApp", detect: "\\bDriveApp\\b", scope: "https://www.googleapis.com/auth/drive", why: "See, edit, create and delete all your Drive files", doc: "https://developers.google.com/apps-script/reference/drive" },
  { service: "UrlFetchApp", detect: "\\bUrlFetchApp\\b", scope: "https://www.googleapis.com/auth/script.external_request", why: "Connect to services outside Google", doc: "https://developers.google.com/apps-script/reference/url-fetch" },
  { service: "CalendarApp", detect: "\\bCalendarApp\\b", scope: "https://www.googleapis.com/auth/calendar", why: "See, edit, share and delete your calendars", doc: "https://developers.google.com/apps-script/reference/calendar" },
  { service: "DocumentApp", detect: "\\bDocumentApp\\b", scope: "https://www.googleapis.com/auth/documents", why: "See, edit, create and delete your Google Docs", doc: "https://developers.google.com/apps-script/reference/document" },
  { service: "FormApp", detect: "\\bFormApp\\b", scope: "https://www.googleapis.com/auth/forms", why: "See, edit, create and delete your Google Forms", doc: "https://developers.google.com/apps-script/reference/forms" },
  { service: "SlidesApp", detect: "\\bSlidesApp\\b", scope: "https://www.googleapis.com/auth/presentations", why: "See, edit, create and delete your Google Slides", doc: "https://developers.google.com/apps-script/reference/slides" },
  { service: "ScriptApp (triggers)", detect: "\\bScriptApp\\s*\\.\\s*(?:newTrigger|getProjectTriggers|deleteTrigger|getUserTriggers)\\b", scope: "https://www.googleapis.com/auth/script.scriptapp", why: "Create and manage triggers that run when you are not there", doc: "https://developers.google.com/apps-script/reference/script" },
  { service: "HtmlService / dialogs", detect: "\\bHtmlService\\b|\\.show(?:Sidebar|ModalDialog|ModelessDialog)\\s*\\(", scope: "https://www.googleapis.com/auth/script.container.ui", why: "Show dialogs and sidebars inside Google apps", doc: "https://developers.google.com/apps-script/reference/html" },
  { service: "Session (user email)", detect: "\\bSession\\s*\\.\\s*get(?:Active|Effective)User\\b", scope: "https://www.googleapis.com/auth/userinfo.email", why: "See your email address", doc: "https://developers.google.com/apps-script/reference/base/session" },
  { service: "GroupsApp", detect: "\\bGroupsApp\\b", scope: "https://www.googleapis.com/auth/groups", why: "See your Google Groups", doc: "https://developers.google.com/apps-script/reference/groups" },
];

/** Services that need no scope, listed so the page can say so. */
export const NO_SCOPE_SERVICES = ["Utilities", "Logger", "console", "PropertiesService", "CacheService", "LockService", "ContentService", "LanguageApp"];

export interface DetectedScope {
  service: string;
  scope: string;
  why: string;
  doc: string;
}

export function detectScopes(script: string): DetectedScope[] {
  const code = codeOnly(script);
  const currentOnly = /@OnlyCurrentDoc\b/.test(script);
  const out: DetectedScope[] = [];
  for (const s of SERVICE_SCOPES) {
    if (!s.scope || !new RegExp(s.detect).test(code)) continue;
    const scope = s.service === "SpreadsheetApp" && currentOnly ? "https://www.googleapis.com/auth/spreadsheets.currentonly" : s.scope;
    if (!out.some((o) => o.scope === scope)) out.push({ service: s.service, scope, why: currentOnly && s.service === "SpreadsheetApp" ? "Read and change only the spreadsheet this script is bound to" : s.why, doc: s.doc });
  }
  return out;
}

/** Compare the model's list with ours (both normalised). */
export function compareScopes(ours: string[], model: string[]): { extra: string[]; missing: string[] } | null {
  const norm = (s: string) => s.trim().replace(/\/+$/, "").toLowerCase();
  const a = new Set(ours.map(norm));
  const b = new Set(model.map(norm));
  const extra = model.filter((s) => !a.has(norm(s)));
  const missing = ours.filter((s) => !b.has(norm(s)));
  return extra.length || missing.length ? { extra, missing } : null;
}

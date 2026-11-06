// The triggers a visitor can pick, and the short explanation shown on the page. No imports.

export const TRIGGERS = ["simple-onedit", "installable-onedit", "time-hourly", "time-daily", "time-weekly", "form-submit", "onopen-menu"] as const;
export type TriggerId = (typeof TRIGGERS)[number];

export interface TriggerInfo {
  label: string;
  kind: "simple" | "installable";
  /** The function name a simple trigger must have, or null. */
  requiredFunction: string | null;
  howToInstall: string;
}

export const TRIGGER_INFO: Record<TriggerId, TriggerInfo> = {
  "simple-onedit": { label: "Simple onEdit (no permissions)", kind: "simple", requiredFunction: "onEdit", howToInstall: "Nothing to install: a function named onEdit(e) runs by itself after each edit by a person." },
  "installable-onedit": { label: "Installable on-edit", kind: "installable", requiredFunction: null, howToInstall: "Triggers (clock icon) > Add Trigger > choose the function > From spreadsheet > On edit." },
  "time-hourly": { label: "Time-driven: every hour", kind: "installable", requiredFunction: null, howToInstall: "Triggers > Add Trigger > choose the function > Time-driven > Hour timer > Every hour." },
  "time-daily": { label: "Time-driven: every day", kind: "installable", requiredFunction: null, howToInstall: "Triggers > Add Trigger > choose the function > Time-driven > Day timer > pick an hour." },
  "time-weekly": { label: "Time-driven: every week", kind: "installable", requiredFunction: null, howToInstall: "Triggers > Add Trigger > choose the function > Time-driven > Week timer > pick a day and hour." },
  "form-submit": { label: "Form submit", kind: "installable", requiredFunction: null, howToInstall: "In the spreadsheet linked to the form: Triggers > Add Trigger > choose the function > From spreadsheet > On form submit." },
  "onopen-menu": { label: "onOpen custom menu", kind: "simple", requiredFunction: "onOpen", howToInstall: "Nothing to install: a function named onOpen(e) adds the menu each time the file opens; the menu items ask for permission the first time they run." },
};

/** One short block for the page: simple versus installable triggers. */
export const TRIGGER_EXPLAINER = {
  simple:
    "Simple triggers (functions named onEdit or onOpen) run by themselves without asking for permission, so they cannot send mail, call other websites or open other files, and they stop after 30 seconds. They only fire for edits made by a person, not by scripts or formulas.",
  installable:
    "Installable triggers are created on the Triggers page (or with ScriptApp). They run as the person who created them, can use every service that person authorised (Gmail, Drive, other websites), and can run on a timer or on form submissions.",
};

/** Services a simple trigger cannot use because they need authorisation. */
export const NEEDS_AUTH = ["MailApp", "GmailApp", "UrlFetchApp", "DriveApp", "CalendarApp", "DocumentApp", "FormApp", "SlidesApp", "GroupsApp"];

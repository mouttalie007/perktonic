// The saved result the page opens with (nothing is sent). A test checks it equals buildResult(sampleAnswer).
import type { GeneratorResult } from "../src/types";
import { sampleAnswer } from "./sampleAnswer";

export const sampleResult: GeneratorResult = {
  status: "ok",
  trigger: "installable-onedit",
  summary: sampleAnswer.summary,
  script: sampleAnswer.script,
  installSteps: sampleAnswer.installSteps,
  assumptions: sampleAnswer.assumptions,
  syntax: { ok: true },
  scopes: [
    {
      "service": "SpreadsheetApp",
      "scope": "https://www.googleapis.com/auth/spreadsheets",
      "why": "Read and change your spreadsheets",
      "doc": "https://developers.google.com/apps-script/reference/spreadsheet"
    },
    {
      "service": "MailApp",
      "scope": "https://www.googleapis.com/auth/script.send_mail",
      "why": "Send email as you (no access to your inbox)",
      "doc": "https://developers.google.com/apps-script/reference/mail"
    }
  ],
  modelScopes: sampleAnswer.scopes,
  scopeDifference: null,
  triggerWarnings: [],
  quotas: [
    {
      "id": "runtime",
      "topic": "Run time of one execution",
      "consumer": "6 min",
      "workspace": "6 min"
    },
    {
      "id": "triggerTime",
      "topic": "Total run time of triggers per day",
      "consumer": "90 min",
      "workspace": "6 h"
    },
    {
      "id": "triggers",
      "topic": "Triggers per user per script",
      "consumer": "20",
      "workspace": "20"
    },
    {
      "id": "mail",
      "topic": "Email recipients per day (MailApp / GmailApp)",
      "consumer": "100",
      "workspace": "1,500"
    }
  ],
  review: [
    {
      "level": "check",
      "text": "The script sends e-mail as you. Test it with your own address first.",
      "line": 28
    }
  ],
  cached: false,
};

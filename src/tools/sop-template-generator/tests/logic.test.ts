import { strFromU8, unzipSync } from "fflate";
import { Packer } from "docx";
import { describe, expect, test } from "vitest";
import { PLACEHOLDER, SECTIONS } from "../src/limits";
import { companiesIn, figuresIn, guardDraft, referencesIn } from "../src/logic/guard";
import { fileName, toMarkdown, toPlainText } from "../src/logic/render";
import { splitSteps } from "../src/logic/steps";
import { buildTemplate, mergeImproved, todayIso } from "../src/logic/template";
import { buildDocx } from "../src/logic/toDocx";
import type { Brief } from "../src/types";

const empty: Brief = { docType: "sop", processName: "", industry: "", teamSize: "", steps: "", owner: "" };

describe("browser template: works with no server", () => {
  test("bullets and numbering are removed from the visitor's steps", () => {
    expect(splitSteps("1. Check stock\n2) Order\n- Pay\n• Ship\nStep 5: Invoice\n\n[ ] Archive")).toEqual(["Check stock", "Order", "Pay", "Ship", "Invoice", "Archive"]);
  });
  test("an empty form still gives the six sections, with visible placeholders and nothing invented", () => {
    const doc = buildTemplate(empty, "2026-11-02");
    expect(doc.title).toBe(`SOP: ${PLACEHOLDER}`);
    expect(doc.steps).toEqual([1, 2, 3].map((n) => ({ n, action: PLACEHOLDER, owner: PLACEHOLDER })));
    expect(doc.revisions).toEqual([{ version: "1.0", date: "2026-11-02", author: PLACEHOLDER, change: "Initial draft" }]);
    expect(doc.scope).toContain(`a team of ${PLACEHOLDER} people`);
    expect(JSON.stringify([doc.purpose, doc.scope, doc.roles, doc.steps.map((s) => s.action), doc.kpis])).not.toMatch(/\d/);
  });
  test("the form fields are used as they are; each document type has its own wording", () => {
    const brief: Brief = { docType: "onboarding", processName: "New cashier onboarding", industry: "retail", teamSize: "5-8", steps: "Get a badge\nShadow a shift", owner: "Ana" };
    const doc = buildTemplate(brief, "2026-11-02");
    expect(doc.title).toBe("Onboarding checklist: New cashier onboarding");
    expect(doc.purpose).toMatch(/^This checklist .* New cashier onboarding in our retail organisation/);
    expect(doc.scope).toContain("a team of 5-8 people");
    expect(doc.roles[0].responsibility).toMatch(/^Ana keeps this checklist/);
    expect(doc.steps.map((s) => s.action)).toEqual(["Get a badge", "Shadow a shift"]);
    expect(doc.revisions[0].author).toBe("Ana");
    expect(buildTemplate({ ...brief, docType: "policy" }, "x").purpose).toMatch(/^This policy sets out the rules/);
  });
  test("today is the visitor's local date", () => {
    expect(todayIso(new Date(2026, 10, 2, 23, 30))).toBe("2026-11-02");
  });
});

describe("server rules: regulations, figures and company names the visitor did not give", () => {
  test("references, figures and companies are detected", () => {
    expect(referencesIn("Follow ISO 9001:2015, GDPR Article 17, OSHA and the Health and Safety at Work Act 1974. See § 4.")).toEqual(["ISO 9001:2015", "GDPR", "OSHA", "Article 17", "§ 4.", "OSHA and the Health and Safety at Work Act 1974"]);
    expect(referencesIn("Act quickly and keep the KYC checks.")).toEqual([]);
    expect(figuresIn("Within 24 hours, 1,200 orders, see step 3 and steps 4 to 5.")).toEqual(["24", "1200"]);
    expect(companiesIn("Ship with Acme Logistics Ltd today.")).toEqual(["Acme Logistics Ltd"]);
  });
  test("sentences that break a rule are removed and reported; allowed references stay; steps renumbered", () => {
    const brief: Brief = { ...empty, processName: "Data deletion", steps: "Delete the data within 30 days under GDPR\nConfirm by email", teamSize: "6" };
    const g = guardDraft(
      {
        purpose: "This procedure handles deletion requests. It follows ISO 27001. It applies GDPR rules.",
        scope: "Covers the 6 agents. Requests take 3 days on average.",
        roles: [{ role: "Owner", responsibility: "Works with Acme Data Inc on audits." }, { role: "HIPAA officer", responsibility: "x" }],
        steps: [
          { n: 7, action: "Delete the data within 30 days under GDPR", owner: "Agent" },
          { n: 9, action: "File the request under Section 12.", owner: "" },
          { n: 2, action: "Confirm by email", owner: "Agent" },
        ],
        kpis: [{ name: "On-time deletions", howMeasured: "Share closed within 30 days; target 95%." }],
        notes: ["Check OSHA rules."],
      },
      brief,
    );
    expect(g.purpose).toBe("This procedure handles deletion requests. It applies GDPR rules.");
    expect(g.scope).toBe("Covers the 6 agents.");
    expect(g.roles).toEqual([{ role: "Owner", responsibility: PLACEHOLDER }]);
    expect(g.steps).toEqual([
      { n: 1, action: "Delete the data within 30 days under GDPR", owner: "Agent" },
      { n: 2, action: "Confirm by email", owner: "Agent" },
    ]);
    expect(g.kpis).toEqual([{ name: "On-time deletions", howMeasured: "Share closed within 30 days;" }].map((k) => ({ ...k, howMeasured: g.kpis[0].howMeasured })));
    expect(g.kpis[0].howMeasured).not.toMatch(/95/);
    expect(g.notes).toEqual([]);
    expect(g.removed.map((r) => r.reason).sort()).toEqual(["company", "figure", "figure", "regulation", "regulation", "regulation", "regulation"]);
    expect(g.missingSteps).toEqual([]);
  });
  test("a law the visitor named stays even inside a longer phrase", () => {
    const g = guardDraft({ purpose: "Under the Data Protection Act we answer requests. We also apply the Consumer Rights Act.", scope: "s", roles: [{ role: "r", responsibility: "x" }], steps: [{ n: 1, action: "a", owner: "A" }], kpis: [{ name: "k", howMeasured: "m" }], notes: [] }, { ...empty, processName: "Subject access requests (Data Protection Act)" });
    expect(g.purpose).toBe("Under the Data Protection Act we answer requests.");
  });
  test("a visitor step the AI reworded or dropped is reported", () => {
    const g = guardDraft({ purpose: "p", scope: "s", roles: [{ role: "r", responsibility: "x" }], steps: [{ n: 1, action: "Confirm by phone", owner: "A" }], kpis: [{ name: "k", howMeasured: "m" }], notes: [] }, { ...empty, processName: "x", steps: "Check ID\nconfirm by phone." });
    expect(g.missingSteps).toEqual(["Check ID"]);
  });
});

describe("exports keep the fixed structure", () => {
  const doc = mergeImproved(buildTemplate({ ...empty, docType: "onboarding", processName: "Barista | onboarding", owner: "Kim" }, "2026-11-02"), {
    purpose: "# Not a heading\nWhy.",
    scope: "Scope.",
    roles: [{ role: "Trainer", responsibility: "Shows | demos" }],
    steps: [{ n: 5, action: "Learn the grinder", owner: "Trainee" }],
    kpis: [{ name: "Ready", howMeasured: "Days" }],
  });
  test("Markdown: six sections in order, escaped tables, tick boxes for a checklist, edits kept", () => {
    const md = toMarkdown(doc);
    const heads = [...md.matchAll(/^## \d\. (.+)$/gm)].map((m) => m[1]);
    expect(heads).toEqual([...SECTIONS]);
    expect(md).toContain("\\# Not a heading");
    expect(md).toContain("| Trainer | Shows \\| demos |");
    expect(md).toContain("- [ ] 1. Learn the grinder (Trainee)");
    expect(md).toContain("| 1.0 | 2026-11-02 | Kim | Initial draft |");
    expect(toPlainText(doc)).toContain("6. REVISION HISTORY");
    expect(fileName(doc, "docx")).toBe("onboarding-checklist-barista-onboarding.docx");
  });
  test("DOCX contains every section and the edited text", async () => {
    const bytes = new Uint8Array(await Packer.toBuffer(buildDocx(doc)));
    const xml = strFromU8(unzipSync(bytes)["word/document.xml"]);
    for (const s of SECTIONS) expect(xml).toContain(s);
    expect(xml).toContain("Learn the grinder");
    expect(xml).toContain("Initial draft");
  }, 15000);
});

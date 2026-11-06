import { DOC_TYPES, PLACEHOLDER } from "../limits";
import type { Brief, Revision, SopDoc } from "../types";
import { splitSteps } from "./steps";

const P = PLACEHOLDER;

export const docTypeOf = (id: Brief["docType"]) => DOC_TYPES.find((d) => d.id === id) ?? DOC_TYPES[0];

/** Today as YYYY-MM-DD in the visitor's own time zone. */
export function todayIso(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function initialRevision(author: string, today: string): Revision[] {
  return [{ version: "1.0", date: today, author: author.trim() || P, change: "Initial draft" }];
}

export function titleOf(brief: Brief): string {
  return `${docTypeOf(brief.docType).short}: ${brief.processName.trim() || P}`;
}

function teamPhrase(teamSize: string): string {
  const t = teamSize.trim();
  if (!t) return `a team of ${P} people`;
  return /^\d[\d\s,.–-]*$/.test(t) ? `a team of ${t} people` : `a team of ${t}`;
}

/**
 * The browser template: a complete document from the form alone, with no server and no AI.
 * Nothing is invented: every gap is the visible placeholder.
 */
export function buildTemplate(brief: Brief, today: string): SopDoc {
  const type = docTypeOf(brief.docType);
  const name = brief.processName.trim() || P;
  const industry = brief.industry.trim();
  const where = industry ? ` in our ${industry} organisation` : "";
  const owner = brief.owner.trim();
  const steps = splitSteps(brief.steps);
  const purpose =
    brief.docType === "policy"
      ? `This policy sets out the rules for ${name}${where}, so that everyone applies them the same way. Why it matters: ${P}`
      : brief.docType === "onboarding"
        ? `This checklist lists what a new team member completes for ${name}${where}, so that nothing is missed in their first weeks. Expected outcome: ${P}`
        : `This ${type.noun} describes how ${name} is carried out${where}, so that the work is done the same way every time. Expected outcome: ${P}`;
  return {
    title: titleOf(brief),
    docType: brief.docType,
    purpose,
    scope: `Applies to ${teamPhrase(brief.teamSize)} involved in ${name}. Starts when: ${P}. Ends when: ${P}. Out of scope: ${P}.`,
    roles: [
      { role: "Process owner", responsibility: `${owner ? `${owner} keeps` : "Keeps"} this ${type.noun} up to date and answers questions about it.` },
      { role: brief.docType === "onboarding" ? "New team member" : "Team members", responsibility: `Follow the ${brief.docType === "onboarding" ? "checklist" : "steps"} below and report problems to the process owner.` },
      { role: P, responsibility: P },
    ],
    steps: (steps.length ? steps : [P, P, P]).map((action, i) => ({ n: i + 1, action, owner: P })),
    kpis: [
      { name: P, howMeasured: P },
      { name: P, howMeasured: P },
    ],
    revisions: initialRevision(owner, today),
  };
}

/** Puts the AI's sections into the document; title and revision history stay the visitor's. */
export function mergeImproved(doc: SopDoc, improved: Pick<SopDoc, "purpose" | "scope" | "roles" | "steps" | "kpis">): SopDoc {
  return { ...doc, purpose: improved.purpose, scope: improved.scope, roles: improved.roles, steps: renumber(improved.steps), kpis: improved.kpis };
}

export const renumber = <T extends { n: number }>(steps: T[]): T[] => steps.map((s, i) => ({ ...s, n: i + 1 }));

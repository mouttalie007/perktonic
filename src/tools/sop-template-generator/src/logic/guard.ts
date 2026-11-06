// Server-side rules of the brief, never delegated to the model:
// 1. no law, standard or regulation the visitor did not write in the form (the sentence is removed);
// 2. no invented figures, dates or company names (the sentence is removed);
// 3. steps are numbered by us.
import { PLACEHOLDER } from "../limits";
import type { Brief, Kpi, Removal, Role, Step } from "../types";
import { splitSteps } from "./steps";

const REFERENCE_PATTERNS: RegExp[] = [
  /\b(?:ISO|IEC|EN|BS|ANSI|ASTM|DIN|NFPA|IEEE)(?:\s*\/\s*IEC)?\s*\d{2,5}(?:[-:.]\d+)*/g,
  /\b(?:GDPR|RGPD|HIPAA|OSHA|CCPA|CPRA|SOX|HACCP|FSMA|COSHH|RIDDOR|NIST|FERPA|COPPA|GLBA|FISMA|PIPEDA|LGPD|NIS ?2|PCI[- ]?DSS|SOC ?[12]|CFR|USC|FDA|EMA|MHRA|FCA|SEC|FINRA|FLSA|FMLA|ADA|WCAG|IFRS|GAAP|GMP|GxP|REACH|RoHS|CLIA|DSGVO|eIDAS)\b/g,
  /\b(?:Section|Sections|Article|Articles|Art\.|Regulation|Directive|Title|Chapter|Clause)\s*\(?\d+[\w().:-]*/g,
  /§+\s*\d+[\w().:-]*/g,
  /\b[A-Z][\w-]*(?:\s+(?:[A-Z][\w-]*|and|of|at|the|for|on|in|&))*\s+Act\b(?:\s+(?:of\s+)?\d{4})?/g,
  /\b(?:Directive|Regulation)\s+\(?(?:EU|EC|EEC)\)?\s*(?:No\.?\s*)?\d+\/\d+/g,
];

const COMPANY = /\b[A-Z][\w&'.-]*(?:\s+[A-Z][\w&'.-]*){0,4}\s+(?:Inc|Ltd|LLC|LLP|GmbH|Corp|Corporation|plc|PLC|S\.A\.|SA|SAS|SARL|AG|BV|NV|Pty|Co)\b\.?/g;
const FIGURE = /\d+(?:[.,:/]\d+)*/g;

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9§]/g, "");

/** Every law, standard or regulation named in a text. */
export function referencesIn(text: string): string[] {
  const out: string[] = [];
  for (const re of REFERENCE_PATTERNS) for (const m of text.matchAll(re)) out.push(m[0].trim());
  return out;
}

export function companiesIn(text: string): string[] {
  return [...text.matchAll(COMPANY)].map((m) => m[0].trim());
}

/** Numbers written in a text, without separators ("1,200" → "1200"); "step 3" is a cross-reference, not a figure. */
export function figuresIn(text: string): string[] {
  return [...text.replace(/\bsteps?\s+\d+(?:\s*(?:and|to|-|–)\s*\d+)?/gi, "").matchAll(FIGURE)].map((m) => m[0].replace(/[.,]/g, ""));
}

export interface FormContext {
  formText: string;
  formNorm: string;
  formFigures: Set<string>;
}

export function formContext(brief: Brief): FormContext {
  const formText = [brief.processName, brief.industry, brief.teamSize, brief.steps, brief.owner].join("\n");
  const formFigures = new Set<string>();
  for (const f of figuresIn(formText)) {
    formFigures.add(f);
    for (const part of f.split(/[:/]/)) formFigures.add(part);
  }
  return { formText, formNorm: norm(formText), formFigures };
}

/** A reference is allowed when the visitor wrote it; "Under the Data Protection Act" matches a form that says "Data Protection Act". */
function refAllowed(ref: string, ctx: FormContext): boolean {
  if (ctx.formNorm.includes(norm(ref))) return true;
  const words = ref.split(/\s+/);
  for (let i = 1; i < words.length - 1; i++) if (/^[A-Z]/.test(words[i]) && ctx.formNorm.includes(norm(words.slice(i).join(" ")))) return true;
  return false;
}

/** Why a sentence must go, or null when it can stay. */
export function offence(sentence: string, ctx: FormContext): Removal["reason"] | null {
  if (referencesIn(sentence).some((r) => !refAllowed(r, ctx))) return "regulation";
  if (companiesIn(sentence).some((c) => !ctx.formNorm.includes(norm(c)))) return "company";
  if (figuresIn(sentence).some((f) => !ctx.formFigures.has(f) && !f.split(/[:/]/).every((p) => ctx.formFigures.has(p)))) return "figure";
  return null;
}

/** Sentences, keeping line breaks; a full stop inside "e.g." or "2.5" does not end one. */
export function sentences(line: string): string[] {
  return line
    .replace(/([.!?])\s+(?=[A-Z0-9"“(\[])/g, "$1\u0000")
    .split("\u0000")
    .filter((s) => s.trim());
}

export function clean(text: string, field: string, ctx: FormContext, removed: Removal[]): string {
  return text
    .split("\n")
    .map((line) =>
      sentences(line)
        .filter((s) => {
          const why = offence(s, ctx);
          if (why) removed.push({ field, text: s.trim(), reason: why });
          return !why;
        })
        .join(" ")
        .trim(),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const key = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export interface Draft {
  purpose: string;
  scope: string;
  roles: Role[];
  steps: Step[];
  kpis: Kpi[];
  notes: string[];
}

export function guardDraft(draft: Draft, brief: Brief) {
  const ctx = formContext(brief);
  const removed: Removal[] = [];
  const purpose = clean(draft.purpose, "Purpose", ctx, removed) || PLACEHOLDER;
  const scope = clean(draft.scope, "Scope", ctx, removed) || PLACEHOLDER;
  const roles: Role[] = [];
  for (const r of draft.roles) {
    const role = clean(r.role, "Roles", ctx, removed);
    if (!role) continue;
    roles.push({ role, responsibility: clean(r.responsibility, "Roles", ctx, removed) || PLACEHOLDER });
  }
  const steps: Step[] = [];
  for (const s of draft.steps) {
    const action = clean(s.action, "Steps", ctx, removed);
    if (!action) continue;
    steps.push({ n: steps.length + 1, action, owner: clean(s.owner, "Steps", ctx, removed) || PLACEHOLDER });
  }
  const kpis: Kpi[] = [];
  for (const k of draft.kpis) {
    const name = clean(k.name, "KPIs", ctx, removed);
    if (!name) continue;
    kpis.push({ name, howMeasured: clean(k.howMeasured, "KPIs", ctx, removed) || PLACEHOLDER });
  }
  const notes = draft.notes.map((n) => clean(n, "Notes", ctx, removed)).filter(Boolean);
  const actions = steps.map((s) => key(s.action)).join(" | ");
  const missingSteps = splitSteps(brief.steps).filter((v) => !actions.includes(key(v)));
  return { purpose, scope, roles, steps, kpis, notes, removed, missingSteps };
}

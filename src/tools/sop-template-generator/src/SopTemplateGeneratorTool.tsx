"use client";

import { useEffect, useId, useRef, useState } from "react";
import { sampleDate, sampleInput } from "../fixtures/sampleInput";
import { sampleResult } from "../fixtures/sampleResult";
import { DOC_TYPES, LIMIT_TEXT, MAX_INDUSTRY_CHARS, MAX_NAME_CHARS, MAX_OWNER_CHARS, MAX_STEPS_CHARS, MAX_TEAM_CHARS, PLACEHOLDER, SECTIONS, type DocTypeId } from "./limits";
import { fileName, toMarkdown, toPlainText } from "./logic/render";
import { buildTemplate, initialRevision, mergeImproved, renumber, titleOf, todayIso } from "./logic/template";
import type { ApiResponse, Brief, ImproveResult, Removal, SopDoc } from "./types";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const ENDPOINT = "/api/tools/sop-template-generator";
const btnSmall = `inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-navy hover:bg-slate-50 disabled:opacity-40 ${focusRing}`;
const label = "block text-sm font-medium text-slate-700";

/** Print stylesheet: "Print / Save as PDF" prints only the document (no server PDF engine). */
const PRINT_CSS = `.sop-print{display:none}
@media print{
body *{visibility:hidden!important}
.sop-print,.sop-print *{visibility:visible!important}
.sop-print{display:block!important;position:absolute;left:0;top:0;width:100%;color:#000;background:#fff;font:11pt/1.45 system-ui,sans-serif}
.sop-print .sop-title{font-size:18pt;font-weight:700;margin:0 0 2pt}
.sop-print h2{font-size:13pt;margin:14pt 0 4pt;break-after:avoid}
.sop-print p{margin:0 0 6pt;white-space:pre-wrap}
.sop-print table{border-collapse:collapse;width:100%;margin:4pt 0 8pt}
.sop-print th,.sop-print td{border:1px solid #888;padding:3pt 5pt;text-align:left;vertical-align:top}
.sop-print tr{break-inside:avoid}
@page{margin:18mm}
}`;

type Source = "sample" | "template" | "ai";
type Failure = { message: string; retry: boolean };
type AiInfo = { notes: string[]; removed: Removal[]; missingSteps: string[]; cached: boolean };
const REASON: Record<Removal["reason"], string> = { regulation: "cites a law or standard you did not give", figure: "contains a number that is not in your brief", company: "names a company that is not in your brief" };

function save(data: Blob, name: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sampleDoc(today: string): SopDoc {
  const base = buildTemplate(sampleInput, today);
  return sampleResult.status === "ok" ? mergeImproved(base, sampleResult) : base;
}
const sampleInfo = (r: ImproveResult): AiInfo | null => (r.status === "ok" ? { notes: r.notes, removed: r.removed, missingSteps: r.missingSteps, cached: r.cached } : null);

function PrintView({ doc }: { doc: SopDoc }) {
  const [purpose, scope, roles, steps, kpis, revisions] = SECTIONS;
  return (
    <article className="sop-print" aria-hidden="true">
      <p className="sop-title">{doc.title}</p>
      <p>
        <em>{DOC_TYPES.find((d) => d.id === doc.docType)?.label}</em>
      </p>
      <h2><span className="tool-step" aria-hidden>1</span>{purpose}</h2>
      <p>{doc.purpose}</p>
      <h2><span className="tool-step" aria-hidden>2</span>{scope}</h2>
      <p>{doc.scope}</p>
      <h2><span className="tool-step" aria-hidden>3</span>{roles}</h2>
      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>Responsibility</th>
          </tr>
        </thead>
        <tbody>
          {doc.roles.map((r, i) => (
            <tr key={i}>
              <td>{r.role}</td>
              <td>{r.responsibility}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2><span className="tool-step" aria-hidden>4</span>{steps}</h2>
      <table>
        <thead>
          <tr>
            <th>{doc.docType === "onboarding" ? "Done" : "#"}</th>
            <th>Action</th>
            <th>Owner</th>
          </tr>
        </thead>
        <tbody>
          {doc.steps.map((s) => (
            <tr key={s.n}>
              <td>{doc.docType === "onboarding" ? `☐ ${s.n}` : s.n}</td>
              <td>{s.action}</td>
              <td>{s.owner}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2><span className="tool-step" aria-hidden>5</span>{kpis}</h2>
      <table>
        <thead>
          <tr>
            <th>KPI</th>
            <th>How it is measured</th>
          </tr>
        </thead>
        <tbody>
          {doc.kpis.map((k, i) => (
            <tr key={i}>
              <td>{k.name}</td>
              <td>{k.howMeasured}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2><span className="tool-step" aria-hidden>6</span>{revisions}</h2>
      <table>
        <thead>
          <tr>
            <th>Version</th>
            <th>Date</th>
            <th>Author</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          {doc.revisions.map((v, i) => (
            <tr key={i}>
              <td>{v.version}</td>
              <td>{v.date}</td>
              <td>{v.author}</td>
              <td>{v.change}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

export default function SopTemplateGeneratorTool() {
  const uid = useId();
  const [brief, setBrief] = useState<Brief>(sampleInput);
  const [doc, setDoc] = useState<SopDoc>(() => sampleDoc(sampleDate));
  const [source, setSource] = useState<Source>("sample");
  const [ai, setAi] = useState<AiInfo | null>(() => sampleInfo(sampleResult));
  const [answer, setAnswer] = useState<{ kind: "refused" | "needs_clarification"; message: string } | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const set = <K extends keyof Brief>(k: K, v: Brief[K]) => setBrief((b) => ({ ...b, [k]: v }));
  const edit = (patch: Partial<SopDoc>) => setDoc((d) => ({ ...d, ...patch }));
  const stepsOver = brief.steps.length > MAX_STEPS_CHARS;

  const generate = () => {
    setDoc(buildTemplate(brief, todayIso()));
    setSource("template");
    setAi(null);
    setAnswer(null);
    setFailure(null);
    setNotice("Template made in your browser from the form. Nothing was sent. Fill in the [to be completed] parts or press Improve with AI.");
    setTimeout(() => heading.current?.focus(), 0);
  };

  const improve = async () => {
    if (brief.processName.trim().length < 3) return setFailure({ message: "Give the process a name (at least 3 characters) before asking the AI.", retry: false });
    if (stepsOver) return setFailure({ message: `Key steps are limited to ${MAX_STEPS_CHARS.toLocaleString("en-US")} characters for the AI. Shorten them, or use Generate template, which has no limit.`, retry: false });
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setFailure(null);
    setNotice(null);
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(brief), signal: ctrl.signal });
      const body = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!body) throw new Error("The generator did not answer properly. Please try again.");
      if (!body.ok) return setFailure({ message: body.error.message, retry: res.status === 502 || res.status === 500 });
      const r = body.data;
      if (r.status !== "ok") {
        setAnswer({ kind: r.status, message: r.message });
        return;
      }
      // The automatic first revision follows the form's author; revisions the visitor added are kept.
      const firstOnly = (d: SopDoc) => d.revisions.length === 1 && d.revisions[0].change === "Initial draft";
      setDoc((d) => mergeImproved({ ...d, title: titleOf(brief), docType: brief.docType, revisions: firstOnly(d) || !d.revisions.length ? initialRevision(brief.owner, todayIso()) : d.revisions }, r));
      setAi(sampleInfo(r));
      setAnswer(null);
      setSource("ai");
      setTimeout(() => heading.current?.focus(), 0);
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setFailure({ message: e instanceof Error && !(e instanceof TypeError) ? e.message : "Could not reach the generator. Check your connection and try again. Generate template still works without a connection.", retry: true });
    } finally {
      if (abort.current === ctrl) {
        abort.current = null;
        setBusy(false);
      }
    }
  };

  const cancel = () => {
    abort.current?.abort();
    abort.current = null;
    setBusy(false);
    setNotice("Request cancelled. Your document is unchanged.");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toPlainText(doc));
      setNotice("Document copied.");
    } catch {
      setNotice("Your browser blocked clipboard access. Use the downloads instead.");
    }
  };

  const downloadDocx = async () => {
    setExporting(true);
    try {
      const { docxBlob } = await import("./logic/toDocx");
      save(await docxBlob(doc), fileName(doc, "docx"));
      setNotice("Word document downloaded.");
    } catch {
      setNotice("The Word file could not be created. Try the Markdown download or Print / Save as PDF.");
    } finally {
      setExporting(false);
    }
  };

  const updateRow = <K extends "roles" | "steps" | "kpis" | "revisions">(key: K, i: number, patch: Partial<SopDoc[K][number]>) => setDoc((d) => ({ ...d, [key]: d[key].map((row, j) => (j === i ? { ...row, ...patch } : row)) }));
  const removeRow = (key: "roles" | "steps" | "kpis" | "revisions", i: number) => setDoc((d) => ({ ...d, [key]: key === "steps" ? renumber(d.steps.filter((_, j) => j !== i)) : d[key].filter((_, j) => j !== i) }));
  const moveStep = (i: number, by: -1 | 1) =>
    setDoc((d) => {
      const s = [...d.steps];
      const j = i + by;
      if (j < 0 || j >= s.length) return d;
      [s[i], s[j]] = [s[j], s[i]];
      return { ...d, steps: renumber(s) };
    });

  const badge = source === "sample" ? "Example result (nothing was sent)" : source === "template" ? "Template made in your browser" : ai?.cached ? "Improved with AI (from a short-lived cache)" : "Improved with AI";

  return (
    <div className="space-y-6 text-navy">
      <style>{PRINT_CSS}</style>
      <section className={card} aria-labelledby={`${uid}-in`}>
        <h2 id={`${uid}-in`} className="text-lg font-semibold">
          Your brief
        </h2>
        <form
          className="mt-3 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            generate();
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-type`} className={label}>
                Document type
              </label>
              <select id={`${uid}-type`} className={`${inputCls} mt-1`} value={brief.docType} onChange={(e) => set("docType", e.target.value as DocTypeId)}>
                {DOC_TYPES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-name`} className={label}>
                Process name
              </label>
              <input id={`${uid}-name`} className={`${inputCls} mt-1`} maxLength={MAX_NAME_CHARS} value={brief.processName} onChange={(e) => set("processName", e.target.value)} placeholder="e.g. Customer refund requests" />
            </div>
            <div>
              <label htmlFor={`${uid}-ind`} className={label}>
                Industry
              </label>
              <input id={`${uid}-ind`} className={`${inputCls} mt-1`} maxLength={MAX_INDUSTRY_CHARS} value={brief.industry} onChange={(e) => set("industry", e.target.value)} placeholder="e.g. Dental clinic" />
            </div>
            <div>
              <label htmlFor={`${uid}-team`} className={label}>
                Team size <span className="font-normal text-slate-600">(number or range)</span>
              </label>
              <input id={`${uid}-team`} className={`${inputCls} mt-1`} maxLength={MAX_TEAM_CHARS} value={brief.teamSize} onChange={(e) => set("teamSize", e.target.value)} placeholder="e.g. 12 or 5-10" />
            </div>
          </div>
          <div>
            <label htmlFor={`${uid}-steps`} className={label}>
              Key steps <span className="font-normal text-slate-600">(optional, one per line)</span>
            </label>
            <textarea id={`${uid}-steps`} className={`${inputCls} mt-1 min-h-32 leading-5`} value={brief.steps} onChange={(e) => set("steps", e.target.value)} placeholder={"Check the order\nApprove the refund\nEmail the customer"} aria-describedby={`${uid}-sc`} aria-invalid={stepsOver || undefined} />
            <p id={`${uid}-sc`} className={`mt-1 text-xs ${stepsOver ? "font-semibold text-red-800" : "text-slate-600"}`}>
              {brief.steps.length.toLocaleString("en-US")} / {MAX_STEPS_CHARS.toLocaleString("en-US")} characters for the AI. {stepsOver ? "Too long for Improve with AI; the template still works." : "The template has no limit."}
            </p>
          </div>
          <div className="md:w-1/2">
            <label htmlFor={`${uid}-owner`} className={label}>
              Owner or author <span className="font-normal text-slate-600">(optional)</span>
            </label>
            <input id={`${uid}-owner`} className={`${inputCls} mt-1`} maxLength={MAX_OWNER_CHARS} value={brief.owner} onChange={(e) => set("owner", e.target.value)} placeholder="e.g. Head of Operations" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className={btnPrimary} disabled={busy}>
              Generate template
            </button>
            <button type="button" className={btnSecondary} onClick={() => void improve()} disabled={busy}>
              {busy ? "Improving…" : "Improve with AI"}
            </button>
            {busy ? (
              <button type="button" className={btnSecondary} onClick={cancel}>
                Cancel
              </button>
            ) : (
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  setBrief(sampleInput);
                  setDoc(sampleDoc(sampleDate));
                  setSource("sample");
                  setAi(sampleInfo(sampleResult));
                  setAnswer(null);
                  setFailure(null);
                  setNotice(null);
                }}
              >
                Try an example
              </button>
            )}
          </div>
          <p className="text-xs text-slate-600">Generate template runs in your browser and sends nothing. Improve with AI sends the form to our server and to the AI provider (limit: {LIMIT_TEXT}).</p>
        </form>
      </section>

      {failure && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between">
          <p>{failure.message}</p>
          {failure.retry && (
            <button type="button" className={btnSecondary} onClick={() => void improve()} disabled={busy}>
              Try again
            </button>
          )}
        </div>
      )}

      <section className={`${card} min-h-64`} aria-labelledby={`${uid}-out`} aria-busy={busy}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={`${uid}-out`} ref={heading} tabIndex={-1} className="text-lg font-semibold focus:outline-none">
            Document
          </h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">{badge}</span>
        </div>
        <div aria-live="polite" className="mt-3 space-y-3">
          {busy && <p className="text-sm text-slate-700">The AI is drafting the document… this can take up to half a minute. Your current document stays here.</p>}
          {notice && <p className="text-sm text-slate-700">{notice}</p>}
          {answer && (
            <div className={`rounded-xl border p-4 text-sm ${answer.kind === "refused" ? "border-slate-200 bg-slate-50" : "border-blue-200 bg-primary-soft"}`}>
              <p className="font-semibold">{answer.kind === "refused" ? "The AI did not draft this one" : "The AI needs one more detail"}</p>
              <p className="mt-1">{answer.message}</p>
              <p className="mt-1 text-slate-700">Your document below is unchanged.</p>
            </div>
          )}
          {source !== "template" && ai && ai.removed.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <p className="font-semibold">
                {ai.removed.length} sentence{ai.removed.length === 1 ? " was" : "s were"} removed from the AI draft:
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {ai.removed.map((r, i) => (
                  <li key={i} className="break-words">
                    {r.field}: “{r.text}” ({REASON[r.reason]})
                  </li>
                ))}
              </ul>
            </div>
          )}
          {source !== "template" && ai && ai.missingSteps.length > 0 && (
            <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              The AI reworded or left out {ai.missingSteps.length === 1 ? "this step" : "these steps"} from your brief: {ai.missingSteps.map((s) => `“${s}”`).join(", ")}. Check the Steps section.
            </p>
          )}
          {source !== "template" && ai && ai.notes.length > 0 && (
            <div className="rounded-xl border border-blue-200 bg-primary-soft p-3 text-sm">
              <h3 className="font-semibold">Notes from the AI</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {ai.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-5">
          <div>
            <label htmlFor={`${uid}-title`} className={label}>
              Title
            </label>
            <input id={`${uid}-title`} className={`${inputCls} mt-1 font-semibold`} value={doc.title} onChange={(e) => edit({ title: e.target.value })} />
          </div>
          <div>
            <label htmlFor={`${uid}-p`} className="block text-base font-semibold">
              1. {SECTIONS[0]}
            </label>
            <textarea id={`${uid}-p`} className={`${inputCls} mt-1 min-h-24`} value={doc.purpose} onChange={(e) => edit({ purpose: e.target.value })} />
          </div>
          <div>
            <label htmlFor={`${uid}-s`} className="block text-base font-semibold">
              2. {SECTIONS[1]}
            </label>
            <textarea id={`${uid}-s`} className={`${inputCls} mt-1 min-h-24`} value={doc.scope} onChange={(e) => edit({ scope: e.target.value })} />
          </div>

          <fieldset>
            <legend className="text-base font-semibold">3. {SECTIONS[2]}</legend>
            <ul className="mt-2 space-y-2">
              {doc.roles.map((r, i) => (
                <li key={i} className="grid gap-2 rounded-xl border border-slate-200 p-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-start">
                  <input aria-label={`Role ${i + 1}`} className={inputCls} value={r.role} onChange={(e) => updateRow("roles", i, { role: e.target.value })} />
                  <textarea aria-label={`Responsibility of role ${i + 1}`} rows={2} className={inputCls} value={r.responsibility} onChange={(e) => updateRow("roles", i, { responsibility: e.target.value })} />
                  <button type="button" className={btnSmall} onClick={() => removeRow("roles", i)} aria-label={`Remove role ${i + 1}`}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className={`${btnSmall} mt-2`} onClick={() => edit({ roles: [...doc.roles, { role: PLACEHOLDER, responsibility: PLACEHOLDER }] })}>
              Add role
            </button>
          </fieldset>

          <fieldset>
            <legend className="text-base font-semibold">4. {SECTIONS[3]}</legend>
            <ol className="mt-2 space-y-2">
              {doc.steps.map((s, i) => (
                <li key={i} className="grid gap-2 rounded-xl border border-slate-200 p-2 sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,11rem)_auto] sm:items-start">
                  <span className="pt-2 text-sm font-semibold text-slate-700" aria-hidden="true">
                    {s.n}.
                  </span>
                  <textarea aria-label={`Step ${s.n} action`} rows={2} className={inputCls} value={s.action} onChange={(e) => updateRow("steps", i, { action: e.target.value })} />
                  <input aria-label={`Step ${s.n} owner`} className={inputCls} value={s.owner} onChange={(e) => updateRow("steps", i, { owner: e.target.value })} />
                  <span className="flex flex-wrap gap-1">
                    <button type="button" className={btnSmall} onClick={() => moveStep(i, -1)} disabled={i === 0} aria-label={`Move step ${s.n} up`}>
                      ↑
                    </button>
                    <button type="button" className={btnSmall} onClick={() => moveStep(i, 1)} disabled={i === doc.steps.length - 1} aria-label={`Move step ${s.n} down`}>
                      ↓
                    </button>
                    <button type="button" className={btnSmall} onClick={() => removeRow("steps", i)} aria-label={`Remove step ${s.n}`}>
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ol>
            <button type="button" className={`${btnSmall} mt-2`} onClick={() => edit({ steps: renumber([...doc.steps, { n: 0, action: PLACEHOLDER, owner: PLACEHOLDER }]) })}>
              Add step
            </button>
          </fieldset>

          <fieldset>
            <legend className="text-base font-semibold">5. {SECTIONS[4]}</legend>
            <ul className="mt-2 space-y-2">
              {doc.kpis.map((k, i) => (
                <li key={i} className="grid gap-2 rounded-xl border border-slate-200 p-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-start">
                  <input aria-label={`KPI ${i + 1} name`} className={inputCls} value={k.name} onChange={(e) => updateRow("kpis", i, { name: e.target.value })} />
                  <textarea aria-label={`How KPI ${i + 1} is measured`} rows={2} className={inputCls} value={k.howMeasured} onChange={(e) => updateRow("kpis", i, { howMeasured: e.target.value })} />
                  <button type="button" className={btnSmall} onClick={() => removeRow("kpis", i)} aria-label={`Remove KPI ${i + 1}`}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className={`${btnSmall} mt-2`} onClick={() => edit({ kpis: [...doc.kpis, { name: PLACEHOLDER, howMeasured: PLACEHOLDER }] })}>
              Add KPI
            </button>
          </fieldset>

          <fieldset>
            <legend className="text-base font-semibold">6. {SECTIONS[5]}</legend>
            <ul className="mt-2 space-y-2">
              {doc.revisions.map((v, i) => (
                <li key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-2 sm:grid-cols-[5rem_9rem_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start">
                  <input aria-label={`Revision ${i + 1} version`} className={inputCls} value={v.version} onChange={(e) => updateRow("revisions", i, { version: e.target.value })} />
                  <input aria-label={`Revision ${i + 1} date`} className={inputCls} value={v.date} onChange={(e) => updateRow("revisions", i, { date: e.target.value })} />
                  <input aria-label={`Revision ${i + 1} author`} className={inputCls} value={v.author} onChange={(e) => updateRow("revisions", i, { author: e.target.value })} />
                  <input aria-label={`Revision ${i + 1} change`} className={inputCls} value={v.change} onChange={(e) => updateRow("revisions", i, { change: e.target.value })} />
                  <button type="button" className={btnSmall} onClick={() => removeRow("revisions", i)} disabled={doc.revisions.length === 1} aria-label={`Remove revision ${i + 1}`}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={`${btnSmall} mt-2`}
              onClick={() => {
                const last = doc.revisions.at(-1);
                const next = last && /^\d+\.\d+$/.test(last.version) ? `${last.version.split(".")[0]}.${Number(last.version.split(".")[1]) + 1}` : PLACEHOLDER;
                edit({ revisions: [...doc.revisions, { version: next, date: todayIso(), author: brief.owner.trim() || PLACEHOLDER, change: PLACEHOLDER }] });
              }}
            >
              Add revision
            </button>
          </fieldset>

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <button type="button" className={btnSecondary} onClick={() => void copy()}>
              Copy
            </button>
            <button type="button" className={btnSecondary} onClick={() => save(new Blob([toMarkdown(doc)], { type: "text/markdown;charset=utf-8" }), fileName(doc, "md"))}>
              Download Markdown
            </button>
            <button type="button" className={btnSecondary} onClick={() => void downloadDocx()} disabled={exporting}>
              {exporting ? "Preparing .docx…" : "Download Word (.docx)"}
            </button>
            <button type="button" className={btnSecondary} onClick={() => window.print()}>
              Print / Save as PDF
            </button>
          </div>
        </div>
      </section>
      <PrintView doc={doc} />
    </div>
  );
}

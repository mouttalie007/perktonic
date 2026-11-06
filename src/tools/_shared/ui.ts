/**
 * Look of every tool's interactive part, in one place. Each tool component
 * imports these five class strings instead of defining its own copy, so the
 * whole tool platform can be restyled here (see tools-handbook/_build/skin-tool.mjs,
 * which swaps a delivered tool's local constants for this import).
 *
 * Sections are white cards that float on the tinted "stage" built by the tool
 * page (src/components/tools/ToolStage.tsx); headings, selects and the numbered
 * step badge are styled by the `.tool-stage` rules in globals.css.
 */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2";

export const btnPrimary = `inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#2b78ff] to-primary px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_18px_-8px_rgba(11,92,255,0.75)] transition hover:from-primary hover:to-primary-dark hover:shadow-[0_10px_22px_-8px_rgba(11,92,255,0.8)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${focusRing}`;

export const btnSecondary = `inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy shadow-[0_1px_2px_rgba(15,35,95,0.06)] transition hover:border-primary/40 hover:bg-primary-soft/70 hover:text-primary-dark active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-navy ${focusRing}`;

export const inputCls = `w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-navy shadow-[inset_0_1px_2px_rgba(15,35,95,0.05)] transition placeholder:text-slate-400 hover:border-slate-400 focus-visible:border-primary ${focusRing}`;

export const card =
  "rounded-3xl bg-white p-4 shadow-[0_1px_2px_rgba(15,35,95,0.05),0_18px_40px_-18px_rgba(15,35,95,0.22)] ring-1 ring-slate-900/[0.06] sm:p-7";

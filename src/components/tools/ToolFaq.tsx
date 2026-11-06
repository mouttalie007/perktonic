export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * Questions as a native <details> accordion: works without JavaScript, is
 * keyboard-accessible, and every answer stays in the HTML for search engines.
 */
export function ToolFaq({ items }: { items: FaqItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((f, i) => (
        <details
          key={f.question}
          open={i === 0}
          className="group rounded-2xl bg-white shadow-[var(--shadow-card)] ring-1 ring-slate-900/[0.07] transition open:shadow-[var(--shadow-soft)] open:ring-primary/25"
        >
          <summary className="text-navy flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left font-bold [&::-webkit-details-marker]:hidden">
            <h3 className="text-[1.02rem] leading-snug font-bold">{f.question}</h3>
            <span
              aria-hidden
              className="bg-primary-soft text-primary group-open:bg-primary grid size-7 shrink-0 place-items-center rounded-full transition group-open:rotate-180 group-open:text-white"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 7.5 5 5 5-5" />
              </svg>
            </span>
          </summary>
          <p className="text-slate-ink px-5 pb-5 leading-relaxed">{f.answer}</p>
        </details>
      ))}
    </div>
  );
}

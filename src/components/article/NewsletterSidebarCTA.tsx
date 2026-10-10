"use client";

import { useActionState, useId } from "react";
import { subscribeAction, type NewsletterState } from "@/app/actions/newsletter";

const initial: NewsletterState = { status: "idle" };

/**
 * Compact newsletter signup for the article-page sidebar (perktonic
 * workflow, 2026-10-10) — same `subscribeAction` as the full-width
 * NewsletterCTA, just boxed to fit a 300px column alongside the other
 * sidebar widgets (AdSlot, TrendingList) instead of a page-wide banner.
 */
export function NewsletterSidebarCTA() {
  const [state, formAction, pending] = useActionState(subscribeAction, initial);
  const emailId = useId();
  const msgId = useId();

  return (
    <section className="border-line bg-canvas rounded-sm border p-4">
      <h2 className="text-sm font-extrabold tracking-[0.12em] uppercase">
        Get the Best Deals
      </h2>
      <p className="text-muted mt-1.5 text-xs">
        Join thousands of smart shoppers. No spam, just the good stuff.
      </p>

      <form action={formAction} noValidate className="mt-3 space-y-2">
        <label htmlFor={emailId} className="sr-only">
          Your email address
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Your email address"
          aria-describedby={state.message ? msgId : undefined}
          aria-invalid={state.status === "error" || undefined}
          className="border-line placeholder:text-muted w-full rounded-sm border bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
        />
        {/* honeypot */}
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-brand text-ink hover:bg-brand-strong w-full rounded-sm px-4 py-2 text-sm font-extrabold transition-colors disabled:opacity-60"
        >
          {pending ? "Subscribing…" : "Subscribe"}
        </button>
      </form>

      {state.message && (
        <p
          id={msgId}
          role="status"
          className={`mt-2 text-xs ${state.status === "error" ? "text-accent-red" : "text-brand-ink"}`}
        >
          {state.message}
        </p>
      )}
    </section>
  );
}

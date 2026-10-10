"use client";

import { useActionState, useId } from "react";
import {
  subscribeAction,
  type NewsletterState,
} from "@/app/actions/newsletter";

const initial: NewsletterState = { status: "idle" };

/**
 * Premium newsletter CTA (spec §18). Dark, yellow accent, accessible form
 * with client + server validation. No fake subscriber counts.
 */
export function NewsletterCTA() {
  const [state, formAction, pending] = useActionState(
    subscribeAction,
    initial,
  );
  const emailId = useId();
  const msgId = useId();

  return (
    <section className="bg-ink text-white">
      <div className="site-container flex flex-col items-center gap-6 py-14 text-center lg:flex-row lg:justify-between lg:gap-10 lg:text-left">
        <div className="max-w-xl">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">
            Get the Best Deals{" "}
            <span className="text-brand">Straight to Your Inbox</span>
          </h2>
          <p className="mt-2 text-sm text-white/70">
            Join thousands of smart shoppers. No spam, just the good stuff.
          </p>
        </div>

        <form
          action={formAction}
          noValidate
          className="w-full max-w-md lg:w-auto lg:min-w-[26rem]"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
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
              className="text-ink placeholder:text-muted min-w-0 flex-1 rounded-sm bg-white px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
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
              className="bg-brand text-ink hover:bg-brand-strong rounded-sm px-6 py-3 text-sm font-extrabold transition-colors disabled:opacity-60"
            >
              {pending ? "Subscribing…" : "Subscribe"}
            </button>
          </div>

          {state.message && (
            <p
              id={msgId}
              role="status"
              className={`mt-2 text-sm ${
                state.status === "error" ? "text-accent-red" : "text-brand"
              }`}
            >
              {state.message}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}

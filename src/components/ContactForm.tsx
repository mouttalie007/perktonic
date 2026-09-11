"use client";

import { useActionState } from "react";
import { submitContactForm, type ContactFormState } from "@/app/actions/contact";

const initial: ContactFormState = { status: "idle" };

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContactForm, initial);

  if (state.status === "success") {
    return (
      <div className="border-line bg-surface rounded-sm border p-6 text-center">
        <p className="font-semibold">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="max-w-xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="mb-1 block text-sm font-semibold">
            Name
          </label>
          <input
            id="contact-name"
            name="name"
            required
            className="border-line w-full rounded-sm border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-blue)]"
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="mb-1 block text-sm font-semibold">
            Email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            className="border-line w-full rounded-sm border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-blue)]"
          />
        </div>
      </div>
      <div>
        <label htmlFor="contact-subject" className="mb-1 block text-sm font-semibold">
          Subject
        </label>
        <input
          id="contact-subject"
          name="subject"
          required
          className="border-line w-full rounded-sm border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-blue)]"
        />
      </div>
      <div>
        <label htmlFor="contact-message" className="mb-1 block text-sm font-semibold">
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={6}
          required
          minLength={10}
          className="border-line w-full rounded-sm border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-blue)]"
        />
      </div>

      {/* honeypot */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

      {state.status === "error" && (
        <p role="alert" className="text-accent-red text-sm font-semibold">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-ink hover:bg-ink-deep rounded-sm px-6 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}

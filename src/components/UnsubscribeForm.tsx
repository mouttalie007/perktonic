"use client";

import { useActionState } from "react";
import { unsubscribeAction, type UnsubscribeState } from "@/app/actions/newsletter";

const initial: UnsubscribeState = { status: "idle" };

export function UnsubscribeForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [state, formAction, pending] = useActionState(unsubscribeAction, initial);

  if (state.status === "success") {
    return <p className="font-semibold">{state.message}</p>;
  }

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-3">
      <label htmlFor="unsubscribe-email" className="sr-only">
        Email address
      </label>
      <input
        id="unsubscribe-email"
        name="email"
        type="email"
        required
        defaultValue={defaultEmail}
        placeholder="Your email address"
        className="border-line rounded-sm border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-blue)]"
      />
      {state.status === "error" && (
        <p role="alert" className="text-accent-red text-sm font-semibold">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-ink hover:bg-ink-deep rounded-sm px-5 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-60"
      >
        {pending ? "Unsubscribing…" : "Unsubscribe"}
      </button>
    </form>
  );
}

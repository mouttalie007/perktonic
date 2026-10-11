"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/actions/admin-auth";

const initial: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-semibold">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          className="border-line focus-visible:ring-accent-blue w-full rounded-sm border px-3 py-2 text-sm outline-none focus-visible:ring-2"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-semibold">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="border-line focus-visible:ring-accent-blue w-full rounded-sm border px-3 py-2 text-sm outline-none focus-visible:ring-2"
        />
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-accent-red text-sm font-medium">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-ink hover:bg-ink-deep w-full rounded-sm py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

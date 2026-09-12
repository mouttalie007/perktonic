"use client";

import { useActionState } from "react";
import { submitComment, type CommentFormState } from "@/app/actions/comments";

const initial: CommentFormState = { status: "idle" };

export function CommentForm({ articleId, path }: { articleId: string; path: string }) {
  const [state, formAction, pending] = useActionState(submitComment, initial);

  if (state.status === "success") {
    return <p className="border-line rounded-sm border p-4 text-sm font-semibold">{state.message}</p>;
  }

  return (
    <form action={formAction} className="border-line rounded-sm border p-4">
      <input type="hidden" name="articleId" value={articleId} />
      <input type="hidden" name="path" value={path} />

      <label htmlFor="comment-name" className="sr-only">
        Your name
      </label>
      <input
        id="comment-name"
        name="name"
        required
        maxLength={80}
        placeholder="Your name"
        className="border-line w-full max-w-xs rounded-sm border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-blue)]"
      />

      <label htmlFor="comment-body" className="sr-only">
        Comment
      </label>
      <textarea
        id="comment-body"
        name="body"
        required
        minLength={3}
        maxLength={2000}
        rows={3}
        placeholder="Join the conversation…"
        className="border-line mt-3 w-full rounded-sm border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-blue)]"
      />

      {/* honeypot */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

      {state.status === "error" && (
        <p role="alert" className="text-accent-red mt-2 text-sm font-semibold">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-ink hover:bg-ink-deep mt-3 rounded-sm px-5 py-2 text-sm font-bold text-white transition-colors disabled:opacity-60"
      >
        {pending ? "Posting…" : "Post Comment"}
      </button>
    </form>
  );
}

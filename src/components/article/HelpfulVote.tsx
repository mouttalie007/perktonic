"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { reactToArticle } from "@/app/actions/reactions";

type Vote = "HELPFUL" | "NOT_HELPFUL";
const key = (articleId: string) => `pt-helpful:${articleId}`;

function Thumb({ down = false }: { down?: boolean }) {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={down ? "rotate-180" : ""}>
      <path d="M7 10v11H3V10zM7 10l4-8c1.7 0 3 1.3 3 3v3h5.5a2 2 0 0 1 2 2.3l-1.3 8a2 2 0 0 1-2 1.7H7" />
    </svg>
  );
}

/**
 * "Was this guide helpful?" Yes / No. One vote per browser (kept in localStorage, with the server's per-IP
 * limit behind it). The answer is a counter only; nothing identifies the reader. A "No" points to the contact page.
 */
export function HelpfulVote({ articleId }: { articleId: string }) {
  const [vote, setVote] = useState<Vote | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(key(articleId));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v === "HELPFUL" || v === "NOT_HELPFUL") setVote(v);
    } catch {
      /* private mode: the vote still counts, it just is not remembered */
    }
  }, [articleId]);

  function cast(v: Vote) {
    if (vote || pending) return;
    setVote(v);
    try {
      window.localStorage.setItem(key(articleId), v);
    } catch {
      /* ignore */
    }
    startTransition(async () => {
      await reactToArticle(articleId, v);
    });
  }

  const btn = "border-line hover:bg-surface inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-semibold transition-colors";

  return (
    <div role="group" aria-label="Was this guide helpful?" className="flex flex-wrap items-center gap-3">
      {vote ? (
        <p className="text-sm text-slate-700" role="status">
          {vote === "HELPFUL" ? (
            "Thanks, glad it helped."
          ) : (
            <>
              Thanks for telling us.{" "}
              <Link href="/contact" className="text-primary font-semibold underline">
                Tell us what was missing
              </Link>
              .
            </>
          )}
        </p>
      ) : (
        <>
          <span className="text-ink text-sm font-semibold">Was this guide helpful?</span>
          <button type="button" onClick={() => cast("HELPFUL")} className={btn}>
            <Thumb /> Yes
          </button>
          <button type="button" onClick={() => cast("NOT_HELPFUL")} className={btn}>
            <Thumb down /> No
          </button>
        </>
      )}
    </div>
  );
}

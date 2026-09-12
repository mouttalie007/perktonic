"use client";

import { useEffect, useState, useTransition } from "react";
import { reactToArticle } from "@/app/actions/reactions";
import { REACTION_EMOJI, type ReactionCounts } from "@/services/reaction.service";
import type { ReactionEmoji } from "@prisma/client";

const EMOJIS = Object.keys(REACTION_EMOJI) as ReactionEmoji[];

function storageKey(articleId: string) {
  return `vt-reacted:${articleId}`;
}

/**
 * Emoji reaction bar (homepage redesign, 2026-09-12). One reaction per
 * emoji per browser, tracked in localStorage — soft client-side dedupe on
 * top of the server's per-IP rate limit (see actions/reactions.ts).
 */
export function ReactionBar({
  articleId,
  initialCounts,
}: {
  articleId: string;
  initialCounts: ReactionCounts;
}) {
  const [counts, setCounts] = useState(initialCounts);
  const [reacted, setReacted] = useState<Set<ReactionEmoji>>(new Set());
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(articleId));
      // localStorage (browser-only) can't be read during SSR, so this can
      // only run after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setReacted(new Set(JSON.parse(raw) as ReactionEmoji[]));
    } catch {
      /* localStorage unavailable (private mode etc.) — reactions still work,
         just without the "already reacted" memory. */
    }
  }, [articleId]);

  function handleReact(emoji: ReactionEmoji) {
    if (reacted.has(emoji) || pending) return;
    const next = new Set(reacted).add(emoji);
    setReacted(next);
    setCounts((c) => ({ ...c, [emoji]: (c[emoji] ?? 0) + 1 }));
    try {
      window.localStorage.setItem(storageKey(articleId), JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
    startTransition(async () => {
      const res = await reactToArticle(articleId, emoji);
      if (!res.ok) {
        // Roll back the optimistic update if the server rejected it
        // (rate-limited or invalid) — rare, but don't leave a stale count.
        setCounts((c) => ({ ...c, [emoji]: Math.max(0, (c[emoji] ?? 1) - 1) }));
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="React to this story">
      {EMOJIS.map((emoji) => {
        const active = reacted.has(emoji);
        const count = counts[emoji] ?? 0;
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => handleReact(emoji)}
            disabled={active}
            aria-pressed={active}
            aria-label={emoji.charAt(0) + emoji.slice(1).toLowerCase()}
            className={`border-line flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
              active ? "bg-brand/20 border-brand" : "hover:bg-surface"
            } disabled:cursor-default`}
          >
            <span aria-hidden className="text-base">
              {REACTION_EMOJI[emoji]}
            </span>
            {count > 0 && <span className="text-muted tabular-nums">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

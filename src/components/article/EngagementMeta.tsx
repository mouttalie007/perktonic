import { REACTION_EMOJI, topReactions, totalReactions, type ReactionCounts } from "@/services/reaction.service";
import { CommentIcon } from "@/components/icons";

/**
 * Compact, read-only reaction+comment summary for feed rows / the trending
 * rail (homepage redesign, 2026-09-12). Interactive reacting/commenting only
 * happens on the article page itself (ReactionBar / CommentSection) — this
 * is a preview, not a control.
 */
export function EngagementMeta({
  reactions,
  commentCount,
  className = "",
}: {
  reactions: ReactionCounts;
  commentCount: number;
  className?: string;
}) {
  const top = topReactions(reactions, 2);
  const total = totalReactions(reactions);
  if (top.length === 0 && commentCount === 0) return null;

  return (
    <div className={`text-muted flex items-center gap-3 text-[0.78rem] ${className}`}>
      {top.length > 0 && (
        <span className="flex items-center gap-1">
          <span aria-hidden className="flex -space-x-0.5">
            {top.map((t) => (
              <span key={t.emoji}>{REACTION_EMOJI[t.emoji]}</span>
            ))}
          </span>
          <span className="tabular-nums">{total}</span>
        </span>
      )}
      {commentCount > 0 && (
        <span className="flex items-center gap-1">
          <CommentIcon width={14} height={14} />
          <span className="tabular-nums">{commentCount}</span>
        </span>
      )}
    </div>
  );
}

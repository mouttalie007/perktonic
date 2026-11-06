import { CommentIcon } from "@/components/icons";

/** Compact, read-only comment count for feed rows (a preview, not a control). */
export function EngagementMeta({ commentCount, className = "" }: { commentCount: number; className?: string }) {
  if (commentCount === 0) return null;
  return (
    <div className={`text-muted flex items-center gap-3 text-[0.78rem] ${className}`}>
      <span className="flex items-center gap-1">
        <CommentIcon width={14} height={14} />
        <span className="tabular-nums">{commentCount}</span>
      </span>
    </div>
  );
}

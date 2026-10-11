import Image from "next/image";
import { commentService } from "@/services/comment.service";
import { CommentForm } from "./CommentForm";
import { formatRelativeTime } from "@/lib/format";

/**
 * Public comment thread (homepage redesign, 2026-09-12). Only APPROVED
 * comments render — new submissions land PENDING and need an editor's nod
 * in /adminiyad/comments before they're visible here.
 */
export async function CommentSection({
  articleId,
  path,
  className = "",
}: {
  articleId: string;
  path: string;
  className?: string;
}) {
  const comments = await commentService.listApproved(articleId);

  return (
    <section aria-label="Comments" className={className}>
      <h2 className="font-heading text-xl font-extrabold tracking-tight">
        Comments{" "}
        {comments.length > 0 && (
          <span className="text-muted font-normal">({comments.length})</span>
        )}
      </h2>

      <div className="mt-5">
        <CommentForm articleId={articleId} path={path} />
      </div>

      {comments.length > 0 && (
        <ol className="divide-line mt-8 divide-y">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3 py-4 first:pt-0">
              <span className="bg-surface border-line relative h-9 w-9 shrink-0 overflow-hidden rounded-full border">
                {c.avatarUrl ? (
                  <Image src={c.avatarUrl} alt="" fill sizes="36px" className="object-cover" />
                ) : (
                  <span className="text-muted flex h-full w-full items-center justify-center text-xs font-bold">
                    {c.name.charAt(0)}
                  </span>
                )}
              </span>
              <div className="min-w-0">
                <p className="text-ink text-sm font-bold">{c.name}</p>
                <p className="text-muted text-xs">{formatRelativeTime(c.createdAt)}</p>
                <p className="mt-1.5 text-sm leading-relaxed">{c.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

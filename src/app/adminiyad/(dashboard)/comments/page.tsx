import Link from "next/link";
import type { Route } from "next";
import { commentService } from "@/services/comment.service";
import { PageHeader, Badge, Card } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { formatDate } from "@/lib/format";
import { setCommentStatus, deleteComment } from "@/app/actions/admin-comments";

const TONE = { PENDING: "warning", APPROVED: "success", SPAM: "default" } as const;

export default async function CommentsPage() {
  const comments = await commentService.listForModeration();

  return (
    <div>
      <PageHeader
        title="Comments"
        description="Moderation queue for public comments — new submissions land PENDING and only APPROVED ones show on the site."
      />

      {comments.length === 0 ? (
        <p className="text-muted text-sm">No comments yet.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <Card key={c.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{c.name}</p>
                  <p className="text-muted text-xs">
                    on{" "}
                    <Link href={`/adminiyad/articles` as Route} className="text-accent-blue hover:underline">
                      {c.article.title}
                    </Link>{" "}
                    · {formatDate(c.createdAt)}
                  </p>
                </div>
                <Badge tone={TONE[c.status]}>{c.status}</Badge>
              </div>
              <p className="mt-3 text-sm whitespace-pre-wrap">{c.body}</p>
              <div className="mt-3 flex items-center gap-3">
                {c.status !== "APPROVED" && (
                  <form action={setCommentStatus}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="status" value="APPROVED" />
                    <button type="submit" className="text-accent-blue text-xs font-bold hover:underline">
                      Approve
                    </button>
                  </form>
                )}
                {c.status !== "SPAM" && (
                  <form action={setCommentStatus}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="status" value="SPAM" />
                    <button type="submit" className="text-muted text-xs font-bold hover:underline">
                      Mark spam
                    </button>
                  </form>
                )}
                <form action={deleteComment}>
                  <input type="hidden" name="id" value={c.id} />
                  <DeleteButton />
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

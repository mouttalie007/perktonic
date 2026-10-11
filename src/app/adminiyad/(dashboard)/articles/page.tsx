import Link from "next/link";
import type { Route } from "next";
import { prisma } from "@/lib/prisma";
import type { Prisma, ContentStatus } from "@prisma/client";
import { PageHeader, LinkButton, Badge, EmptyRow } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { deleteArticle } from "@/app/actions/admin-articles";
import { formatDate } from "@/lib/format";

const STATUS_TONE: Record<ContentStatus, "default" | "success" | "warning" | "danger"> = {
  DRAFT: "default",
  SCHEDULED: "warning",
  PUBLISHED: "success",
  ARCHIVED: "default",
  DELETED: "danger",
};

export default async function ArticlesListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;

  const where: Prisma.ArticleWhereInput = {
    ...(status ? { status: status as ContentStatus } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
  };

  const articles = await prisma.article.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { category: true, author: true },
  });

  return (
    <div>
      <PageHeader
        title="Articles"
        description="Standard articles and Top N lists."
        action={
          <div className="flex gap-2">
            <LinkButton href="/adminiyad/articles/new/standard" variant="primary">New Article</LinkButton>
            <LinkButton href="/adminiyad/articles/new/listicle">New Top N List</LinkButton>
          </div>
        }
      />

      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search title…"
          className="border-line rounded-sm border px-3 py-1.5 text-sm"
        />
        <select name="status" defaultValue={status ?? ""} className="border-line rounded-sm border bg-white px-3 py-1.5 text-sm">
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <button type="submit" className="border-line rounded-sm border px-3 py-1.5 text-sm font-bold">
          Filter
        </button>
      </form>

      <div className="border-line overflow-x-auto rounded-md border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-muted text-xs font-bold tracking-wide uppercase">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Author</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Views</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {articles.length === 0 && <EmptyRow colSpan={8}>No articles match.</EmptyRow>}
            {articles.map((a) => (
              <tr key={a.id}>
                <td className="max-w-xs truncate px-4 py-3 font-semibold">{a.title}</td>
                <td className="px-4 py-3">
                  <Badge>{a.type === "LISTICLE" ? "Top N" : "Article"}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
                </td>
                <td className="text-muted px-4 py-3">{a.category?.name ?? "—"}</td>
                <td className="text-muted px-4 py-3">{a.author?.name ?? "Editorial Team"}</td>
                <td className="text-muted px-4 py-3">{formatDate(a.updatedAt)}</td>
                <td className="px-4 py-3">{a.viewCount}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/adminiyad/articles/${a.id}/edit` as Route} className="text-accent-blue text-xs font-bold hover:underline">
                      Edit
                    </Link>
                    <a
                      href={`/story/${a.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted text-xs font-bold hover:underline"
                    >
                      View
                    </a>
                    <form action={deleteArticle}>
                      <input type="hidden" name="id" value={a.id} />
                      <DeleteButton />
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

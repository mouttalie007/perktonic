import Link from "next/link";
import type { Route } from "next";
import { prisma } from "@/lib/prisma";
import type { Prisma, ContentStatus } from "@prisma/client";
import { PageHeader, LinkButton, Badge, EmptyRow } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { deleteArticle, makeArticleDraft } from "@/app/actions/admin-articles";
import { formatDate } from "@/lib/format";

const STATUS_TONE: Record<
  ContentStatus,
  "default" | "success" | "warning" | "danger"
> = {
  DRAFT: "default",
  SCHEDULED: "warning",
  PUBLISHED: "success",
  ARCHIVED: "default",
  DELETED: "danger",
};

export default async function ArticlesListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; category?: string }>;
}) {
  const { status, q, category } = await searchParams;

  // Counts follow the search + category filters but not the status filter,
  // so the cards always show how the current selection splits by status.
  const baseWhere: Prisma.ArticleWhereInput = {
    ...(category ? { categoryId: category === "none" ? null : category } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
  };
  const where: Prisma.ArticleWhereInput = {
    ...baseWhere,
    ...(status ? { status: status as ContentStatus } : {}),
  };

  const [articles, statusGroups, categories, categoryGroups] =
    await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: 300,
        include: { category: true, author: true },
      }),
      prisma.article.groupBy({
        by: ["status"],
        where: baseWhere,
        _count: { _all: true },
      }),
      prisma.category.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.article.groupBy({
        by: ["categoryId"],
        where: {
          ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
          ...(status ? { status: status as ContentStatus } : {}),
        },
        _count: { _all: true },
      }),
    ]);
  const count = (st: ContentStatus) =>
    statusGroups.find((g) => g.status === st)?._count._all ?? 0;
  const total = statusGroups.reduce((n, g) => n + g._count._all, 0);
  const perCategory = new Map(
    categoryGroups.map((g) => [g.categoryId ?? "none", g._count._all]),
  );

  const href = (st: string) => {
    const p = new URLSearchParams();
    if (st) p.set("status", st);
    if (category) p.set("category", category);
    if (q) p.set("q", q);
    const qs = p.toString();
    return (qs ? `/adminiyad/articles?${qs}` : "/adminiyad/articles") as Route;
  };
  const cards: { label: string; value: number; st: string; tone: string }[] = [
    { label: "All articles", value: total, st: "", tone: "" },
    {
      label: "Published",
      value: count("PUBLISHED"),
      st: "PUBLISHED",
      tone: "text-green-700",
    },
    {
      label: "Drafts",
      value: count("DRAFT"),
      st: "DRAFT",
      tone: "text-amber-700",
    },
    {
      label: "Scheduled",
      value: count("SCHEDULED"),
      st: "SCHEDULED",
      tone: "",
    },
    { label: "Archived", value: count("ARCHIVED"), st: "ARCHIVED", tone: "" },
  ];

  return (
    <div>
      <PageHeader
        title="Articles"
        description="Standard articles and Top N lists."
        action={
          <div className="flex gap-2">
            <LinkButton
              href="/adminiyad/articles/new/standard"
              variant="primary"
            >
              New Article
            </LinkButton>
            <LinkButton href="/adminiyad/articles/new/listicle">
              New Top N List
            </LinkButton>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={href(c.st)}
            className={`border-line hover:border-ink rounded-md border p-3 transition-colors ${(status ?? "") === c.st ? "border-ink bg-surface" : "bg-white"}`}
          >
            <span className="text-muted block text-xs font-bold tracking-wide uppercase">
              {c.label}
            </span>
            <span className={`block text-2xl font-extrabold ${c.tone}`}>
              {c.value}
            </span>
          </Link>
        ))}
      </div>

      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search title…"
          className="border-line rounded-sm border px-3 py-1.5 text-sm"
        />
        <select
          name="category"
          defaultValue={category ?? ""}
          className="border-line rounded-sm border bg-white px-3 py-1.5 text-sm"
          aria-label="Category"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({perCategory.get(c.id) ?? 0})
            </option>
          ))}
          {(perCategory.get("none") ?? 0) > 0 && (
            <option value="none">
              No category ({perCategory.get("none")})
            </option>
          )}
        </select>
        <select
          name="status"
          defaultValue={status ?? ""}
          className="border-line rounded-sm border bg-white px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <button
          type="submit"
          className="border-line rounded-sm border px-3 py-1.5 text-sm font-bold"
        >
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
            {articles.length === 0 && (
              <EmptyRow colSpan={8}>No articles match.</EmptyRow>
            )}
            {articles.map((a) => (
              <tr key={a.id}>
                <td className="max-w-xs truncate px-4 py-3 font-semibold">
                  {a.title}
                </td>
                <td className="px-4 py-3">
                  <Badge>{a.type === "LISTICLE" ? "Top N" : "Article"}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
                </td>
                <td className="text-muted px-4 py-3">
                  {a.category?.name ?? "—"}
                </td>
                <td className="text-muted px-4 py-3">
                  {a.author?.name ?? "Editorial Team"}
                </td>
                <td className="text-muted px-4 py-3">
                  {formatDate(a.updatedAt)}
                </td>
                <td className="px-4 py-3">{a.viewCount}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/adminiyad/articles/${a.id}/edit` as Route}
                      className="text-accent-blue text-xs font-bold hover:underline"
                    >
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
                    {(a.status === "PUBLISHED" || a.status === "SCHEDULED") && (
                      <form action={makeArticleDraft}>
                        <input type="hidden" name="id" value={a.id} />
                        <DeleteButton
                          label="Make draft"
                          confirmText="Take this article offline and turn it back into a draft?"
                          className="text-xs font-bold text-amber-700 hover:underline"
                        />
                      </form>
                    )}
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

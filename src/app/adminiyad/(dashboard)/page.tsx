import Link from "next/link";
import type { Route } from "next";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/admin/ui";

export default async function AdminHome() {
  const [published, drafts, scheduled, categories, subscribers, mediaCount] =
    await Promise.all([
      prisma.article.count({ where: { status: "PUBLISHED" } }),
      prisma.article.count({ where: { status: "DRAFT" } }),
      prisma.article.count({ where: { status: "SCHEDULED" } }),
      prisma.category.count(),
      prisma.newsletterSubscriber.count({ where: { status: "pending" } }),
      prisma.media.count(),
    ]);

  const stats = [
    { label: "Published articles", value: published, href: "/adminiyad/articles?status=PUBLISHED" },
    { label: "Drafts", value: drafts, href: "/adminiyad/articles?status=DRAFT" },
    { label: "Scheduled", value: scheduled, href: "/adminiyad/articles?status=SCHEDULED" },
    { label: "Categories", value: categories, href: "/adminiyad/categories" },
    { label: "Newsletter subscribers", value: subscribers, href: "/adminiyad/subscribers" },
    { label: "Media assets", value: mediaCount, href: "/adminiyad/media" },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="A quick snapshot of the publication."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Link key={s.label} href={s.href as Route}>
            <Card className="transition-shadow hover:shadow-[var(--shadow-raised)]">
              <p className="text-3xl font-extrabold tabular-nums">{s.value}</p>
              <p className="text-muted mt-1 text-xs font-semibold">{s.label}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-bold">Write something new</h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href={"/adminiyad/articles/new/standard" as Route}
              className="bg-ink hover:bg-ink-deep rounded-sm px-4 py-2 text-sm font-bold text-white transition-colors"
            >
              New Article
            </Link>
            <Link
              href={"/adminiyad/articles/new/listicle" as Route}
              className="border-line hover:bg-surface rounded-sm border px-4 py-2 text-sm font-bold transition-colors"
            >
              New Top N List
            </Link>
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 font-bold">Manage</h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/adminiyad/categories" className="border-line hover:bg-surface rounded-sm border px-4 py-2 text-sm font-bold transition-colors">
              Categories
            </Link>
            <Link href={"/adminiyad/ads/units" as Route} className="border-line hover:bg-surface rounded-sm border px-4 py-2 text-sm font-bold transition-colors">
              Ad Units
            </Link>
            <Link href={"/adminiyad/settings/site" as Route} className="border-line hover:bg-surface rounded-sm border px-4 py-2 text-sm font-bold transition-colors">
              Site Settings
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

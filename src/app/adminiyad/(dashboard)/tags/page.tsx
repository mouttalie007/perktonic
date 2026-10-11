import { prisma } from "@/lib/prisma";
import { PageHeader, Badge, EmptyRow, Card } from "@/components/admin/ui";
import { TitleSlugFields } from "@/components/admin/TitleSlugFields";
import { Checkbox, Button } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { createTag, deleteTag } from "@/app/actions/admin-tags";

export default async function TagsPage() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { articles: true } } },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div>
        <PageHeader
          title="Tags"
          description="Kept sparing — a handful of reusable tags, not one per article."
        />
        <div className="border-line overflow-x-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-muted text-xs font-bold tracking-wide uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Articles</th>
                <th className="px-4 py-3">Indexable</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {tags.length === 0 && <EmptyRow colSpan={5}>No tags yet.</EmptyRow>}
              {tags.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-semibold">{t.name}</td>
                  <td className="text-muted px-4 py-3">/tag/{t.slug}</td>
                  <td className="px-4 py-3">{t._count.articles}</td>
                  <td className="px-4 py-3">
                    <Badge tone={t.robotsIndex ? "success" : "default"}>
                      {t.robotsIndex ? "Indexed" : "Noindex"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={deleteTag}>
                      <input type="hidden" name="id" value={t.id} />
                      <DeleteButton />
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Card className="h-fit space-y-4">
        <h2 className="font-bold">New tag</h2>
        <form action={createTag} className="space-y-4">
          <TitleSlugFields titleLabel="Name" />
          <Checkbox label="Indexable (SeoSettings.tagPagesIndexable must also be on)" name="robotsIndex" />
          <Button type="submit" className="w-full justify-center">
            Add tag
          </Button>
        </form>
      </Card>
    </div>
  );
}

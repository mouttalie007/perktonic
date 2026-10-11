import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, LinkButton, Badge, EmptyRow } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { deleteCategory } from "@/app/actions/admin-categories";

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { articles: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Sections shown in navigation and used to file articles."
        action={<LinkButton href="/adminiyad/categories/new" variant="primary">New Category</LinkButton>}
      />

      <div className="border-line overflow-x-auto rounded-md border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-muted text-xs font-bold tracking-wide uppercase">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Articles</th>
              <th className="px-4 py-3">Indexable</th>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {categories.length === 0 && <EmptyRow colSpan={6}>No categories yet.</EmptyRow>}
            {categories.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-semibold">{c.name}</td>
                <td className="text-muted px-4 py-3">/{c.slug}</td>
                <td className="px-4 py-3">{c._count.articles}</td>
                <td className="px-4 py-3">
                  <Badge tone={c.robotsIndex ? "success" : "default"}>
                    {c.robotsIndex ? "Indexed" : "Noindex"}
                  </Badge>
                </td>
                <td className="px-4 py-3">{c.order}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/adminiyad/categories/${c.id}/edit`} className="text-accent-blue text-xs font-bold hover:underline">
                      Edit
                    </Link>
                    <form action={deleteCategory}>
                      <input type="hidden" name="id" value={c.id} />
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

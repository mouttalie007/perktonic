import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, LinkButton, Badge, EmptyRow } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { deletePage } from "@/app/actions/admin-pages";

export default async function PagesListPage() {
  const pages = await prisma.page.findMany({ orderBy: { order: "asc" } });

  return (
    <div>
      <PageHeader
        title="Pages"
        description="Legal, trust and informational pages linked from the footer."
        action={<LinkButton href="/admin/pages/new" variant="primary">New Page</LinkButton>}
      />
      <div className="border-line overflow-x-auto rounded-md border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-muted text-xs font-bold tracking-wide uppercase">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">URL</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Footer</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {pages.length === 0 && <EmptyRow colSpan={5}>No pages yet.</EmptyRow>}
            {pages.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-semibold">{p.title}</td>
                <td className="text-muted px-4 py-3">/{p.slug}</td>
                <td className="px-4 py-3">
                  <Badge tone={p.status === "PUBLISHED" ? "success" : "default"}>{p.status}</Badge>
                </td>
                <td className="px-4 py-3">{p.showInFooter ? p.footerColumn || "yes" : "—"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/admin/pages/${p.id}/edit`} className="text-accent-blue text-xs font-bold hover:underline">
                      Edit
                    </Link>
                    <form action={deletePage}>
                      <input type="hidden" name="id" value={p.id} />
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

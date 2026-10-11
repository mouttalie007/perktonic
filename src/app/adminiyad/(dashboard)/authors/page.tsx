import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { PageHeader, LinkButton, EmptyRow } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { deleteAuthor } from "@/app/actions/admin-authors";

export default async function AuthorsPage() {
  const authors = await prisma.author.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { articles: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Authors"
        description="The publication's byline roster."
        action={<LinkButton href="/adminiyad/authors/new" variant="primary">New Author</LinkButton>}
      />
      <div className="border-line overflow-x-auto rounded-md border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-muted text-xs font-bold tracking-wide uppercase">
            <tr>
              <th className="px-4 py-3">Author</th>
              <th className="px-4 py-3">Beat</th>
              <th className="px-4 py-3">Articles</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {authors.length === 0 && <EmptyRow colSpan={4}>No authors yet.</EmptyRow>}
            {authors.map((a) => (
              <tr key={a.id}>
                <td className="flex items-center gap-3 px-4 py-3 font-semibold">
                  <span className="bg-ink relative block h-8 w-8 shrink-0 overflow-hidden rounded-full">
                    {a.avatarUrl && (
                      <Image src={a.avatarUrl} alt="" fill sizes="32px" className="object-cover" />
                    )}
                  </span>
                  {a.name}
                </td>
                <td className="text-muted px-4 py-3">{a.role}</td>
                <td className="px-4 py-3">{a._count.articles}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/adminiyad/authors/${a.id}/edit`} className="text-accent-blue text-xs font-bold hover:underline">
                      Edit
                    </Link>
                    <form action={deleteAuthor}>
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

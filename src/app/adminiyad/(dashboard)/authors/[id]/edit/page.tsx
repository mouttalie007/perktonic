import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/ui";
import { AuthorForm } from "@/components/admin/AuthorForm";
import { updateAuthor } from "@/app/actions/admin-authors";

export default async function EditAuthorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const author = await prisma.author.findUnique({ where: { id } });
  if (!author) notFound();

  return (
    <div>
      <PageHeader title={`Edit: ${author.name}`} />
      <AuthorForm author={author} action={updateAuthor} />
    </div>
  );
}

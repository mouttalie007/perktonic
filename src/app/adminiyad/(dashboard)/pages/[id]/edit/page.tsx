import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/ui";
import { PageForm } from "@/components/admin/PageForm";
import { updatePage } from "@/app/actions/admin-pages";

export default async function EditPagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const page = await prisma.page.findUnique({ where: { id } });
  if (!page) notFound();

  return (
    <div>
      <PageHeader title={`Edit: ${page.title}`} />
      <PageForm page={page} action={updatePage} />
    </div>
  );
}

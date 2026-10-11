import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/ui";
import { AdUnitForm } from "@/components/admin/AdUnitForm";
import { updateAdUnit } from "@/app/actions/admin-ads";

export default async function EditAdUnitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const unit = await prisma.adUnit.findUnique({ where: { id } });
  if (!unit) notFound();

  return (
    <div>
      <PageHeader title={`Edit: ${unit.name}`} />
      <AdUnitForm unit={unit} action={updateAdUnit} />
    </div>
  );
}

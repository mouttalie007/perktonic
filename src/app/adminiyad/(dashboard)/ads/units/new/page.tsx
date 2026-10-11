import { PageHeader } from "@/components/admin/ui";
import { AdUnitForm } from "@/components/admin/AdUnitForm";
import { createAdUnit } from "@/app/actions/admin-ads";

export default function NewAdUnitPage() {
  return (
    <div>
      <PageHeader title="New Ad Unit" />
      <AdUnitForm action={createAdUnit} />
    </div>
  );
}

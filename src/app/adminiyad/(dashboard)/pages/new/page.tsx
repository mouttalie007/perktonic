import { PageHeader } from "@/components/admin/ui";
import { PageForm } from "@/components/admin/PageForm";
import { createPage } from "@/app/actions/admin-pages";

export default function NewPagePage() {
  return (
    <div>
      <PageHeader title="New Page" />
      <PageForm action={createPage} />
    </div>
  );
}

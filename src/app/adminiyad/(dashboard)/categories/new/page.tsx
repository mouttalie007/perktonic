import { PageHeader } from "@/components/admin/ui";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { createCategory } from "@/app/actions/admin-categories";

export default function NewCategoryPage() {
  return (
    <div>
      <PageHeader title="New Category" />
      <CategoryForm action={createCategory} />
    </div>
  );
}

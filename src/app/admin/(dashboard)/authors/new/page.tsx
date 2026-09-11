import { PageHeader } from "@/components/admin/ui";
import { AuthorForm } from "@/components/admin/AuthorForm";
import { createAuthor } from "@/app/actions/admin-authors";

export default function NewAuthorPage() {
  return (
    <div>
      <PageHeader title="New Author" />
      <AuthorForm action={createAuthor} />
    </div>
  );
}

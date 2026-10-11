import { PageHeader } from "@/components/admin/ui";
import { ListicleArticleForm } from "@/components/admin/article/ListicleArticleForm";
import { articleFormData } from "@/lib/admin-article-data";

export default async function NewListicleArticlePage() {
  const { categories, authors, tags } = await articleFormData();
  return (
    <div>
      <PageHeader title="New Top N List" />
      <ListicleArticleForm categories={categories} authors={authors} tags={tags} />
    </div>
  );
}

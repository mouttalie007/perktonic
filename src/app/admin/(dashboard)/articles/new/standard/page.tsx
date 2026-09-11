import { PageHeader } from "@/components/admin/ui";
import { StandardArticleForm } from "@/components/admin/article/StandardArticleForm";
import { articleFormData } from "@/lib/admin-article-data";

export default async function NewStandardArticlePage() {
  const { categories, authors, tags } = await articleFormData();
  return (
    <div>
      <PageHeader title="New Article" />
      <StandardArticleForm categories={categories} authors={authors} tags={tags} />
    </div>
  );
}

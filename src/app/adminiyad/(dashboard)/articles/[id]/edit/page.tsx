import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, LinkButton } from "@/components/admin/ui";
import { StandardArticleForm } from "@/components/admin/article/StandardArticleForm";
import { ListicleArticleForm } from "@/components/admin/article/ListicleArticleForm";
import { articleFormData } from "@/lib/admin-article-data";

export default async function EditArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;

  const [article, formData] = await Promise.all([
    prisma.article.findUnique({
      where: { id },
      include: {
        featuredImage: true,
        tags: { select: { tagId: true } },
        listicleItems: { orderBy: { position: "asc" }, include: { media: true } },
      },
    }),
    articleFormData(),
  ]);
  if (!article) notFound();

  const withTagIds = { ...article, tagIds: article.tags.map((t) => t.tagId) };

  return (
    <div>
      <PageHeader
        title={`Edit: ${article.title}`}
        description={saved ? "Saved." : undefined}
        action={
          saved ? (
            <LinkButton href="/adminiyad/articles/new/standard">
              + Add another article
            </LinkButton>
          ) : undefined
        }
      />
      {article.type === "LISTICLE" ? (
        <ListicleArticleForm
          article={withTagIds}
          items={article.listicleItems}
          featuredImageMedia={article.featuredImage}
          {...formData}
        />
      ) : (
        <StandardArticleForm article={withTagIds} featuredImageMedia={article.featuredImage} {...formData} />
      )}
    </div>
  );
}

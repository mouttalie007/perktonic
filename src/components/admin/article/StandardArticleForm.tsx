"use client";

import { useActionState, useState } from "react";
import type { Article, Author, Category, Media, Tag } from "@prisma/client";
import { saveStandardArticle, type SaveState } from "@/app/actions/admin-articles";
import { TitleSlugFields } from "../TitleSlugFields";
import { RichTextEditor } from "../RichTextEditor";
import { Field, Textarea, Card, Button, LinkButton } from "../ui";
import { PublishingCard, TaxonomyCard, FeaturedImageField, SeoCard } from "./SharedFields";
import { ImportPanel } from "./ImportPanel";
import { InternalLinkSuggestions } from "./InternalLinkSuggestions";
import type { ParsedArticleMeta } from "@/lib/article-import";

const initial: SaveState = { status: "idle" };

type SeedValues = {
  title: string;
  slug: string;
  excerpt: string;
  seoTitle: string;
  metaDescription: string;
  content: string;
  categoryId: string;
  tagIds: string[];
};

export function StandardArticleForm({
  article,
  featuredImageMedia,
  categories,
  authors,
  tags,
}: {
  article?: Article & { tagIds?: string[] };
  featuredImageMedia?: Media | null;
  categories: Category[];
  authors: Author[];
  tags: Tag[];
}) {
  const [state, formAction, pending] = useActionState(saveStandardArticle, initial);
  const [mode, setMode] = useState<"import" | "manual">(article ? "manual" : "import");
  const [importSeed, setImportSeed] = useState(0);
  const [liveTitle, setLiveTitle] = useState(article?.title ?? "");
  const [paragraphCount, setParagraphCount] = useState(0);
  const [seed, setSeed] = useState<SeedValues>({
    title: article?.title ?? "",
    slug: article?.slug ?? "",
    excerpt: article?.excerpt ?? "",
    seoTitle: article?.seoTitle ?? "",
    metaDescription: article?.metaDescription ?? "",
    content: article?.content ?? "",
    categoryId: article?.categoryId ?? "",
    tagIds: article?.tagIds ?? [],
  });

  function applyImport(meta: ParsedArticleMeta, bodyHtml: string) {
    const matchedCategory = meta.category
      ? categories.find((c) => c.name.toLowerCase() === meta.category!.trim().toLowerCase())
      : undefined;
    const matchedTagIds = meta.tags?.length
      ? tags
          .filter((t) => meta.tags!.some((name) => name.toLowerCase() === t.name.toLowerCase()))
          .map((t) => t.id)
      : undefined;

    setSeed((prev) => ({
      title: meta.title ?? prev.title,
      slug: meta.slug ?? prev.slug,
      excerpt: meta.excerpt ?? prev.excerpt,
      seoTitle: meta.seoTitle ?? prev.seoTitle,
      metaDescription: meta.metaDescription ?? prev.metaDescription,
      content: bodyHtml.trim() || prev.content,
      categoryId: matchedCategory?.id ?? prev.categoryId,
      tagIds: matchedTagIds ?? prev.tagIds,
    }));
    if (meta.title) setLiveTitle(meta.title);
    setImportSeed((s) => s + 1);
    setMode("manual");
  }

  const effectiveArticle = {
    ...article,
    title: seed.title,
    slug: seed.slug,
    seoTitle: seed.seoTitle,
    metaDescription: seed.metaDescription,
    categoryId: seed.categoryId,
    tagIds: seed.tagIds,
  };

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      {article && <input type="hidden" name="id" value={article.id} />}

      <div className="min-w-0 space-y-6">
        {!article && (
          <div className="flex gap-1 text-sm font-bold">
            <button
              type="button"
              onClick={() => setMode("import")}
              className={`rounded-t-sm px-4 py-2 ${mode === "import" ? "bg-ink text-white" : "bg-surface text-muted"}`}
            >
              Import
            </button>
            <button
              type="button"
              onClick={() => setMode("manual")}
              className={`rounded-t-sm px-4 py-2 ${mode === "manual" ? "bg-ink text-white" : "bg-surface text-muted"}`}
            >
              Manual
            </button>
          </div>
        )}
        {!article && mode === "import" && <ImportPanel onExtract={applyImport} />}

        <Card className="space-y-4">
          <TitleSlugFields
            key={`ts-${importSeed}`}
            defaultTitle={seed.title}
            defaultSlug={seed.slug}
            onTitleChange={setLiveTitle}
          />
          <Field label="Excerpt / dek" htmlFor="excerpt" hint="Shown under the title and in cards.">
            <Textarea key={`ex-${importSeed}`} id="excerpt" name="excerpt" rows={2} defaultValue={seed.excerpt} />
          </Field>
          <FeaturedImageField article={article} featuredImageMedia={featuredImageMedia} titleForAlt={liveTitle} />
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Content</h2>
          <RichTextEditor
            key={`rt-${importSeed}`}
            name="content"
            defaultValue={seed.content}
            placeholder="Write the article, or use the Import tab above to paste a finished draft…"
            minHeight={420}
            altBase={liveTitle}
            onParagraphCountChange={setParagraphCount}
          />
        </Card>

        <InternalLinkSuggestions
          categoryId={seed.categoryId}
          excludeId={article?.id}
          paragraphCount={paragraphCount}
        />

        <SeoCard key={`seo-${importSeed}`} article={effectiveArticle} />
      </div>

      <div className="space-y-6">
        {state.status === "error" && (
          <p role="alert" className="bg-accent-red/10 text-accent-red rounded-sm p-3 text-sm font-semibold">
            {state.message}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full justify-center">
          {pending ? "Saving…" : article ? "Save changes" : "Publish article"}
        </Button>
        <PublishingCard article={article} />
        <TaxonomyCard key={`tax-${importSeed}`} article={effectiveArticle} categories={categories} authors={authors} tags={tags} />
        <LinkButton href="/admin/articles">Back to articles</LinkButton>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import type { Article, Author, Category, Media, Tag } from "@prisma/client";
import { saveStandardArticle, type SaveState } from "@/app/actions/admin-articles";
import { TitleSlugFields } from "../TitleSlugFields";
import { RichTextEditor } from "../RichTextEditor";
import { Field, Textarea, Card, Button, LinkButton } from "../ui";
import { PublishingCard, TagsCard, FeaturedImageField, SeoCard } from "./SharedFields";
import { TopTaxonomyBar, STORAGE_KEY_CATEGORY, STORAGE_KEY_AUTHOR } from "./TopTaxonomyBar";
import { ImportPanel } from "./ImportPanel";
import { QuickArticlePanel } from "./QuickArticlePanel";
import { InternalLinkSuggestions } from "./InternalLinkSuggestions";
import { randomBackdatedPublishedAt } from "@/lib/random-backdate";
import type { ParsedArticleMeta } from "@/lib/article-import";
import type { PromptQueueItem } from "@prisma/client";

const initial: SaveState = { status: "idle" };

type SeedValues = {
  title: string;
  slug: string;
  excerpt: string;
  seoTitle: string;
  metaDescription: string;
  content: string;
  categoryId: string;
  authorId: string;
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
  const [mode, setMode] = useState<"quick" | "import" | "manual">(article ? "manual" : "quick");
  const [importSeed, setImportSeed] = useState(0);
  const [liveTitle, setLiveTitle] = useState(article?.title ?? "");
  const [keywordAltBase, setKeywordAltBase] = useState("");
  const [paragraphCount, setParagraphCount] = useState(0);
  const [promptQueueItemId, setPromptQueueItemId] = useState("");
  // Computed once, not re-rolled on every render — see src/lib/random-backdate.ts.
  const [defaultPublishedAt] = useState(() => randomBackdatedPublishedAt());
  const [seed, setSeed] = useState<SeedValues>({
    title: article?.title ?? "",
    slug: article?.slug ?? "",
    excerpt: article?.excerpt ?? "",
    seoTitle: article?.seoTitle ?? "",
    metaDescription: article?.metaDescription ?? "",
    content: article?.content ?? "",
    categoryId: article?.categoryId ?? "",
    authorId: article?.authorId ?? "",
    tagIds: article?.tagIds ?? [],
  });

  /**
   * Category + author: the pasted text is the primary source now (the
   * admin's articles mix topics, so ChatGPT states the right Category/
   * Author itself — see the roster embedded in OUTPUT_FORMAT_ADDENDUM,
   * quick-article.ts). The top bar (TopTaxonomyBar) is the fallback/
   * override when the paste doesn't match or isn't used at all. A
   * detected match also updates the remembered localStorage choice, same
   * as a manual pick at the top would.
   */
  function matchCategoryAndAuthor(meta: ParsedArticleMeta) {
    const matchedCategory = meta.category
      ? categories.find((c) => c.name.toLowerCase() === meta.category!.trim().toLowerCase())
      : undefined;
    const matchedAuthor = meta.author
      ? authors.find((a) => a.name.toLowerCase() === meta.author!.trim().toLowerCase())
      : undefined;
    if (matchedCategory) localStorage.setItem(STORAGE_KEY_CATEGORY, matchedCategory.id);
    if (matchedAuthor) localStorage.setItem(STORAGE_KEY_AUTHOR, matchedAuthor.id);
    return { matchedCategory, matchedAuthor };
  }

  function applyImport(meta: ParsedArticleMeta, bodyHtml: string) {
    const matchedTagIds = meta.tags?.length
      ? tags
          .filter((t) => meta.tags!.some((name) => name.toLowerCase() === t.name.toLowerCase()))
          .map((t) => t.id)
      : undefined;
    const { matchedCategory, matchedAuthor } = matchCategoryAndAuthor(meta);

    setSeed((prev) => ({
      ...prev,
      title: meta.title ?? prev.title,
      slug: meta.slug ?? prev.slug,
      excerpt: meta.excerpt ?? prev.excerpt,
      seoTitle: meta.seoTitle ?? prev.seoTitle,
      metaDescription: meta.metaDescription ?? prev.metaDescription,
      content: bodyHtml.trim() || prev.content,
      categoryId: matchedCategory?.id ?? prev.categoryId,
      authorId: matchedAuthor?.id ?? prev.authorId,
      tagIds: matchedTagIds ?? prev.tagIds,
    }));
    if (meta.title) setLiveTitle(meta.title);
    if (meta.keywords?.[0]) setKeywordAltBase(meta.keywords[0]);
    setImportSeed((s) => s + 1);
    setMode("manual");
  }

  function applyQuickArticle(meta: ParsedArticleMeta, bodyHtml: string, item: PromptQueueItem) {
    const { matchedCategory, matchedAuthor } = matchCategoryAndAuthor(meta);

    setSeed((prev) => ({
      ...prev,
      title: meta.title ?? prev.title,
      slug: meta.slug ?? prev.slug,
      excerpt: meta.excerpt ?? prev.excerpt,
      seoTitle: meta.seoTitle ?? prev.seoTitle,
      metaDescription: meta.metaDescription ?? prev.metaDescription,
      content: bodyHtml.trim() || prev.content,
      categoryId: matchedCategory?.id ?? prev.categoryId,
      authorId: matchedAuthor?.id ?? prev.authorId,
    }));
    if (meta.title) setLiveTitle(meta.title);
    if (meta.keywords?.[0]) setKeywordAltBase(meta.keywords[0]);
    setPromptQueueItemId(item.id);
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
    authorId: seed.authorId,
    tagIds: seed.tagIds,
  };

  const selectedWriterSlug = authors.find((a) => a.id === seed.authorId)?.slug;
  const altBase = keywordAltBase || liveTitle;

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      {article && <input type="hidden" name="id" value={article.id} />}
      {!article && promptQueueItemId && (
        <input type="hidden" name="promptQueueItemId" value={promptQueueItemId} />
      )}

      <div className="min-w-0 space-y-6">
        <TopTaxonomyBar
          categories={categories}
          authors={authors}
          categoryId={seed.categoryId}
          authorId={seed.authorId}
          onCategoryChange={(id) => setSeed((prev) => ({ ...prev, categoryId: id }))}
          onAuthorChange={(id) => setSeed((prev) => ({ ...prev, authorId: id }))}
          persist={!article}
        />

        {!article && (
          <div className="flex gap-1 text-sm font-bold">
            <button
              type="button"
              onClick={() => setMode("quick")}
              className={`rounded-t-sm px-4 py-2 ${mode === "quick" ? "bg-ink text-white" : "bg-surface text-muted"}`}
            >
              Quick Article
            </button>
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
        {!article && mode === "quick" && (
          <QuickArticlePanel writerSlug={selectedWriterSlug} onExtract={applyQuickArticle} />
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
          <FeaturedImageField article={article} featuredImageMedia={featuredImageMedia} titleForAlt={altBase} />
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Content</h2>
          <RichTextEditor
            key={`rt-${importSeed}`}
            name="content"
            defaultValue={seed.content}
            placeholder="Write the article, or use the Import tab above to paste a finished draft…"
            minHeight={420}
            altBase={altBase}
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
        <PublishingCard article={article} defaultPublishedAt={defaultPublishedAt} />
        <TagsCard key={`tax-${importSeed}`} article={effectiveArticle} tags={tags} />
        <LinkButton href="/adminiyad/articles">Back to articles</LinkButton>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import type { Article, Author, Category, ListicleItem, Media, Quiz, QuizQuestion, Tag } from "@prisma/client";
import { saveListicleArticle, type SaveState } from "@/app/actions/admin-articles";
import { TitleSlugFields } from "../TitleSlugFields";
import { ItemsEditor, type ItemDraft } from "./ItemsEditor";
import { Field, Textarea, Checkbox, Card, Button, LinkButton } from "../ui";
import { PublishingCard, TagsCard, FeaturedImageField, SeoCard } from "./SharedFields";
import { TopTaxonomyBar } from "./TopTaxonomyBar";
import { QuizBox } from "./QuizBox";

const initial: SaveState = { status: "idle" };

type ListicleItemWithMedia = ListicleItem & { media?: Media | null };

export function ListicleArticleForm({
  article,
  items,
  featuredImageMedia,
  categories,
  authors,
  tags,
  initialQuiz,
  initialCodeStats,
}: {
  article?: Article & { tagIds?: string[] };
  items?: ListicleItemWithMedia[];
  featuredImageMedia?: Media | null;
  categories: Category[];
  authors: Author[];
  tags: Tag[];
  initialQuiz?: (Quiz & { questions: QuizQuestion[] }) | null;
  initialCodeStats?: { total: number; used: number; available: number } | null;
}) {
  const [state, formAction, pending] = useActionState(saveListicleArticle, initial);
  const [liveTitle, setLiveTitle] = useState(article?.title ?? "");
  const [categoryId, setCategoryId] = useState(article?.categoryId ?? "");
  const [authorId, setAuthorId] = useState(article?.authorId ?? "");

  const defaultItems: ItemDraft[] = (items ?? []).map((it) => ({
    heading: it.heading ?? "",
    description: it.description,
    mediaId: it.mediaId ?? "",
    imageUrl: it.media?.url ?? it.imageUrl ?? "",
    imageAlt: it.media?.alt ?? it.imageAlt ?? "",
    credit: it.credit ?? "",
    sourceUrl: it.sourceUrl ?? "",
  }));

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      {article && <input type="hidden" name="id" value={article.id} />}

      <div className="min-w-0 space-y-6">
        <TopTaxonomyBar
          categories={categories}
          authors={authors}
          categoryId={categoryId}
          authorId={authorId}
          onCategoryChange={setCategoryId}
          onAuthorChange={setAuthorId}
          persist={!article}
        />

        <Card className="space-y-4">
          <TitleSlugFields defaultTitle={article?.title} defaultSlug={article?.slug} onTitleChange={setLiveTitle} />
          <Field label="Excerpt" htmlFor="excerpt" hint="Shown in cards and search results.">
            <Textarea id="excerpt" name="excerpt" rows={2} defaultValue={article?.excerpt ?? ""} />
          </Field>
          <Field label="Introduction" htmlFor="intro" hint="Shown above item 1, on the first page. Separate paragraphs with a blank line.">
            <Textarea id="intro" name="intro" rows={4} defaultValue={article?.intro ?? ""} />
          </Field>
          <FeaturedImageField article={article} featuredImageMedia={featuredImageMedia} titleForAlt={liveTitle} />
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Items</h2>
            <Checkbox
              label="Make subpages indexable by search engines"
              name="listicleIndexSubpages"
              defaultChecked={article?.listicleIndexSubpages ?? true}
            />
          </div>
          <ItemsEditor defaultItems={defaultItems} titleForAlt={liveTitle} />
        </Card>

        <SeoCard article={article} />

        {article && (
          <QuizBox
            articleId={article.id}
            articleSlug={article.slug}
            initialQuiz={initialQuiz ?? null}
            initialCodeStats={initialCodeStats ?? null}
          />
        )}
      </div>

      <div className="space-y-6">
        {state.status === "error" && (
          <p role="alert" className="bg-accent-red/10 text-accent-red rounded-sm p-3 text-sm font-semibold">
            {state.message}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full justify-center">
          {pending ? "Saving…" : article ? "Save changes" : "Publish list"}
        </Button>
        <PublishingCard article={article} />
        <TagsCard article={article} tags={tags} />
        <LinkButton href="/adminiyad/articles">Back to articles</LinkButton>
      </div>
    </form>
  );
}

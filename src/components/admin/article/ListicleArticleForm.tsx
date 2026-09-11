"use client";

import { useActionState } from "react";
import type { Article, Author, Category, ListicleItem, Media, Tag } from "@prisma/client";
import { saveListicleArticle, type SaveState } from "@/app/actions/admin-articles";
import { TitleSlugFields } from "../TitleSlugFields";
import { ItemsEditor, type ItemDraft } from "./ItemsEditor";
import { Field, Textarea, Checkbox, Card, Button, LinkButton } from "../ui";
import { PublishingCard, TaxonomyCard, FeaturedImageField, SeoCard } from "./SharedFields";

const initial: SaveState = { status: "idle" };

export function ListicleArticleForm({
  article,
  items,
  categories,
  authors,
  tags,
  media,
}: {
  article?: Article & { tagIds?: string[] };
  items?: ListicleItem[];
  categories: Category[];
  authors: Author[];
  tags: Tag[];
  media: Media[];
}) {
  const [state, formAction, pending] = useActionState(saveListicleArticle, initial);

  const defaultItems: ItemDraft[] = (items ?? []).map((it) => ({
    heading: it.heading ?? "",
    description: it.description,
    imageUrl: it.imageUrl ?? "",
    imageAlt: it.imageAlt ?? "",
    credit: it.credit ?? "",
    sourceUrl: it.sourceUrl ?? "",
  }));

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      {article && <input type="hidden" name="id" value={article.id} />}

      <div className="min-w-0 space-y-6">
        <Card className="space-y-4">
          <TitleSlugFields defaultTitle={article?.title} defaultSlug={article?.slug} />
          <Field label="Excerpt" htmlFor="excerpt" hint="Shown in cards and search results.">
            <Textarea id="excerpt" name="excerpt" rows={2} defaultValue={article?.excerpt ?? ""} />
          </Field>
          <Field label="Introduction" htmlFor="intro" hint="Shown above item 1, on the first page. Separate paragraphs with a blank line.">
            <Textarea id="intro" name="intro" rows={4} defaultValue={article?.intro ?? ""} />
          </Field>
          <FeaturedImageField article={article} media={media} />
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
          <ItemsEditor defaultItems={defaultItems} />
        </Card>

        <SeoCard article={article} />
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
        <TaxonomyCard article={article} categories={categories} authors={authors} tags={tags} />
        <LinkButton href="/admin/articles">Back to articles</LinkButton>
      </div>
    </form>
  );
}

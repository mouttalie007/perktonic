"use client";

import { useActionState } from "react";
import type { Article, Author, Category, Media, Tag } from "@prisma/client";
import { saveStandardArticle, type SaveState } from "@/app/actions/admin-articles";
import { TitleSlugFields } from "../TitleSlugFields";
import { RichTextEditor } from "../RichTextEditor";
import { Field, Textarea, Card, Button, LinkButton } from "../ui";
import { PublishingCard, TaxonomyCard, FeaturedImageField, SeoCard } from "./SharedFields";

const initial: SaveState = { status: "idle" };

export function StandardArticleForm({
  article,
  categories,
  authors,
  tags,
  media,
}: {
  article?: Article & { tagIds?: string[] };
  categories: Category[];
  authors: Author[];
  tags: Tag[];
  media: Media[];
}) {
  const [state, formAction, pending] = useActionState(saveStandardArticle, initial);

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      {article && <input type="hidden" name="id" value={article.id} />}

      <div className="min-w-0 space-y-6">
        <Card className="space-y-4">
          <TitleSlugFields defaultTitle={article?.title} defaultSlug={article?.slug} />
          <Field label="Excerpt / dek" htmlFor="excerpt" hint="Shown under the title and in cards.">
            <Textarea id="excerpt" name="excerpt" rows={2} defaultValue={article?.excerpt ?? ""} />
          </Field>
          <FeaturedImageField article={article} media={media} />
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Content</h2>
          <RichTextEditor
            name="content"
            defaultValue={article?.content ?? ""}
            placeholder="Write the article, or use Import HTML to paste a finished draft…"
            minHeight={420}
          />
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
          {pending ? "Saving…" : article ? "Save changes" : "Publish article"}
        </Button>
        <PublishingCard article={article} />
        <TaxonomyCard article={article} categories={categories} authors={authors} tags={tags} />
        <LinkButton href="/admin/articles">Back to articles</LinkButton>
      </div>
    </form>
  );
}

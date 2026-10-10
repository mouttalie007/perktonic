import type { Media, Tag, Article } from "@prisma/client";
import { Field, Input, Textarea, Select, Checkbox, Card } from "../ui";
import { PasteImageField } from "./PasteImageField";

type ArticleDefaults = Partial<Article> & { tagIds?: string[] };

export function PublishingCard({
  article,
  defaultPublishedAt,
}: {
  article?: ArticleDefaults;
  /** Used only for a brand-new article (no `article` prop) — see the random
   *  backdating in StandardArticleForm/ListicleArticleForm. */
  defaultPublishedAt?: string;
}) {
  const publishedAtValue = article?.publishedAt
    ? new Date(article.publishedAt).toISOString().slice(0, 16)
    : defaultPublishedAt ?? "";
  return (
    <Card className="space-y-4">
      <h2 className="font-bold">Publishing</h2>
      <Field label="Status" htmlFor="status">
        {/* New articles default to Published (2026-10-10) — the submit
            button already says "Publish article" for a new one; leaving
            this on Draft meant that promise was silently false unless the
            admin remembered to change it themselves, and a "published"
            article that's actually a draft doesn't show up anywhere on
            the site with no visible error. */}
        <Select id="status" name="status" defaultValue={article?.status ?? "PUBLISHED"}>
          <option value="DRAFT">Draft</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </Select>
      </Field>
      <Field label="Publish date" htmlFor="publishedAt" hint="Used for Published/Scheduled status.">
        <Input id="publishedAt" name="publishedAt" type="datetime-local" defaultValue={publishedAtValue} />
      </Field>
      <div className="space-y-2">
        <Checkbox label="Featured on homepage hero" name="isFeatured" defaultChecked={article?.isFeatured ?? false} />
        <Checkbox label="Trending" name="isTrending" defaultChecked={article?.isTrending ?? false} />
        <Checkbox label="Breaking (utility bar ticker)" name="isBreaking" defaultChecked={article?.isBreaking ?? false} />
      </div>
      <Field label="Manual priority" htmlFor="manualPriority" hint="Lower = appears first in hero/trending. Leave blank for automatic.">
        <Input id="manualPriority" name="manualPriority" type="number" defaultValue={article?.manualPriority ?? ""} className="max-w-[8rem]" />
      </Field>
      <Checkbox label="Disable all ads on this article" name="adsDisabled" defaultChecked={article?.adsDisabled ?? false} />
    </Card>
  );
}

/**
 * Tags only — Category and Author moved to the top of the form (see
 * TopTaxonomyBar, 2026-10-09), chosen before the paste instead of in the
 * sidebar after.
 */
export function TagsCard({
  article,
  tags,
}: {
  article?: ArticleDefaults;
  tags: Tag[];
}) {
  const selectedTags = new Set(article?.tagIds ?? []);
  if (tags.length === 0) return null;
  return (
    <Card className="space-y-4">
      <h2 className="font-bold">Tags</h2>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {tags.map((t) => (
          <label key={t.id} className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              name="tags"
              value={t.id}
              defaultChecked={selectedTags.has(t.id)}
              className="border-line h-4 w-4"
            />
            {t.name}
          </label>
        ))}
      </div>
    </Card>
  );
}

export function FeaturedImageField({
  article,
  featuredImageMedia,
  titleForAlt,
}: {
  article?: ArticleDefaults;
  /** The currently-set featured Media row, if any (for the preview on edit). */
  featuredImageMedia?: Media | null;
  /** Live article title, used to seed a fresh paste's alt text. */
  titleForAlt: string;
}) {
  return (
    <Field label="Featured image" htmlFor="featuredImageId-paste" hint="Click, then Ctrl+V to paste an image. Compressed automatically.">
      <PasteImageField
        name="featuredImageId"
        altBase={titleForAlt || article?.title || ""}
        altNumber={1}
        defaultValue={
          featuredImageMedia
            ? { mediaId: featuredImageMedia.id, url: featuredImageMedia.url, alt: featuredImageMedia.alt ?? "" }
            : null
        }
      />
    </Field>
  );
}

export function SeoCard({ article }: { article?: ArticleDefaults }) {
  return (
    <Card className="space-y-4">
      <h2 className="font-bold">SEO</h2>
      <Field label="SEO title" htmlFor="seoTitle" hint="Falls back to the visible title.">
        <Input id="seoTitle" name="seoTitle" defaultValue={article?.seoTitle ?? ""} />
      </Field>
      <Field label="Meta description" htmlFor="metaDescription" hint="~140–160 characters.">
        <Textarea id="metaDescription" name="metaDescription" rows={2} defaultValue={article?.metaDescription ?? ""} />
      </Field>
      <Field label="Canonical URL" htmlFor="canonicalUrl" hint="Only set if this content is republished from elsewhere.">
        <Input id="canonicalUrl" name="canonicalUrl" defaultValue={article?.canonicalUrl ?? ""} />
      </Field>
      <div className="flex gap-6">
        <Checkbox label="Indexable" name="robotsIndex" defaultChecked={article?.robotsIndex ?? true} />
        <Checkbox label="Follow links" name="robotsFollow" defaultChecked={article?.robotsFollow ?? true} />
      </div>
    </Card>
  );
}

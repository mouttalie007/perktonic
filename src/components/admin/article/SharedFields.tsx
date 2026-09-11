import type { Author, Category, Media, Tag, Article } from "@prisma/client";
import { Field, Input, Textarea, Select, Checkbox, Card } from "../ui";
import { PasteImageField } from "./PasteImageField";

type ArticleDefaults = Partial<Article> & { tagIds?: string[] };

export function PublishingCard({ article }: { article?: ArticleDefaults }) {
  const publishedAtValue = article?.publishedAt
    ? new Date(article.publishedAt).toISOString().slice(0, 16)
    : "";
  return (
    <Card className="space-y-4">
      <h2 className="font-bold">Publishing</h2>
      <Field label="Status" htmlFor="status">
        <Select id="status" name="status" defaultValue={article?.status ?? "DRAFT"}>
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

export function TaxonomyCard({
  article,
  categories,
  authors,
  tags,
}: {
  article?: ArticleDefaults;
  categories: Category[];
  authors: Author[];
  tags: Tag[];
}) {
  const selectedTags = new Set(article?.tagIds ?? []);
  return (
    <Card className="space-y-4">
      <h2 className="font-bold">Category &amp; byline</h2>
      <Field label="Category" htmlFor="categoryId">
        <Select id="categoryId" name="categoryId" defaultValue={article?.categoryId ?? ""}>
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Author" htmlFor="authorId">
        <Select id="authorId" name="authorId" defaultValue={article?.authorId ?? ""}>
          <option value="">ViralTrendly Editorial Team</option>
          {authors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>
      {tags.length > 0 && (
        <fieldset>
          <legend className="mb-1 text-sm font-semibold">Tags</legend>
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
        </fieldset>
      )}
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

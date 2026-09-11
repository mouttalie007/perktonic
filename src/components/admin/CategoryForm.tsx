import type { Category } from "@prisma/client";
import { TitleSlugFields } from "./TitleSlugFields";
import { Field, Input, Textarea, Checkbox, Card, Button, LinkButton } from "./ui";

export function CategoryForm({
  category,
  action,
}: {
  category?: Category;
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action} className="max-w-2xl space-y-6">
      {category && <input type="hidden" name="id" value={category.id} />}

      <Card className="space-y-4">
        <TitleSlugFields defaultTitle={category?.name} defaultSlug={category?.slug} />

        <Field label="Description" htmlFor="description" hint="Shown on the category page header.">
          <Textarea id="description" name="description" rows={2} defaultValue={category?.description ?? ""} />
        </Field>
        <Field label="Short description" htmlFor="shortDescription" hint="Used on the Popular Categories tile.">
          <Input id="shortDescription" name="shortDescription" defaultValue={category?.shortDescription ?? ""} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tile image URL" htmlFor="imageUrl">
            <Input id="imageUrl" name="imageUrl" defaultValue={category?.imageUrl ?? ""} />
          </Field>
          <Field label="Icon key" htmlFor="iconKey" hint="flame, users, cpu, coffee, film, plane, heart, atom, trophy, sparkles, utensils, wallet, palette, globe">
            <Input id="iconKey" name="iconKey" defaultValue={category?.iconKey ?? ""} />
          </Field>
        </div>
        <Field label="Order" htmlFor="order" hint="Lower numbers appear first in navigation.">
          <Input id="order" name="order" type="number" defaultValue={category?.order ?? 0} className="max-w-[8rem]" />
        </Field>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-bold">SEO</h2>
        <Field label="SEO title" htmlFor="seoTitle" hint="Falls back to the category name.">
          <Input id="seoTitle" name="seoTitle" defaultValue={category?.seoTitle ?? ""} />
        </Field>
        <Field label="Meta description" htmlFor="metaDescription">
          <Textarea id="metaDescription" name="metaDescription" rows={2} defaultValue={category?.metaDescription ?? ""} />
        </Field>
        <Checkbox
          label="Allow this category to be indexed by search engines"
          name="robotsIndex"
          defaultChecked={category?.robotsIndex ?? true}
        />
      </Card>

      <div className="flex gap-2">
        <Button type="submit">{category ? "Save changes" : "Create category"}</Button>
        <LinkButton href="/admin/categories">Cancel</LinkButton>
      </div>
    </form>
  );
}

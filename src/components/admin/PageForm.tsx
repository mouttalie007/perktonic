import type { Page } from "@prisma/client";
import { TitleSlugFields } from "./TitleSlugFields";
import { RichTextEditor } from "./RichTextEditor";
import { Field, Input, Textarea, Select, Checkbox, Card, Button, LinkButton } from "./ui";

export function PageForm({
  page,
  action,
}: {
  page?: Page;
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action} className="max-w-3xl space-y-6">
      {page && <input type="hidden" name="id" value={page.id} />}

      <Card className="space-y-4">
        <TitleSlugFields defaultTitle={page?.title} defaultSlug={page?.slug} />
        <Field label="Content" htmlFor="content-editor">
          <RichTextEditor name="content" defaultValue={page?.content ?? ""} />
        </Field>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-bold">Footer placement</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Footer column" htmlFor="footerColumn">
            <Select id="footerColumn" name="footerColumn" defaultValue={page?.footerColumn ?? ""}>
              <option value="">Not shown in footer</option>
              <option value="quick-links">Quick Links</option>
              <option value="resources">Resources</option>
            </Select>
          </Field>
          <Field label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={page?.status ?? "PUBLISHED"}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </Select>
          </Field>
        </div>
        <Checkbox label="Show in footer" name="showInFooter" defaultChecked={page?.showInFooter ?? true} />
      </Card>

      <Card className="space-y-4">
        <h2 className="font-bold">SEO</h2>
        <Field label="SEO title" htmlFor="seoTitle">
          <Input id="seoTitle" name="seoTitle" defaultValue={page?.seoTitle ?? ""} />
        </Field>
        <Field label="Meta description" htmlFor="metaDescription">
          <Textarea id="metaDescription" name="metaDescription" rows={2} defaultValue={page?.metaDescription ?? ""} />
        </Field>
        <Checkbox label="Allow this page to be indexed" name="robotsIndex" defaultChecked={page?.robotsIndex ?? true} />
      </Card>

      <div className="flex gap-2">
        <Button type="submit">{page ? "Save changes" : "Create page"}</Button>
        <LinkButton href="/admin/pages">Cancel</LinkButton>
      </div>
    </form>
  );
}

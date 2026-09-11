import type { Author } from "@prisma/client";
import { TitleSlugFields } from "./TitleSlugFields";
import { Field, Input, Textarea, Card, Button, LinkButton } from "./ui";

export function AuthorForm({
  author,
  action,
}: {
  author?: Author;
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action} className="max-w-2xl space-y-6">
      {author && <input type="hidden" name="id" value={author.id} />}
      <Card className="space-y-4">
        <TitleSlugFields titleLabel="Name" defaultTitle={author?.name} defaultSlug={author?.slug} />
        <Field label="Role / beat" htmlFor="role" hint='e.g. "Tech · Internet · Money · Facts"'>
          <Input id="role" name="role" defaultValue={author?.role ?? ""} />
        </Field>
        <Field label="Bio" htmlFor="bio">
          <Textarea id="bio" name="bio" rows={4} defaultValue={author?.bio ?? ""} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Avatar URL" htmlFor="avatarUrl" hint="e.g. /authors/name.png">
            <Input id="avatarUrl" name="avatarUrl" defaultValue={author?.avatarUrl ?? ""} />
          </Field>
          <Field label="Contact email" htmlFor="email">
            <Input id="email" name="email" type="email" defaultValue={author?.email ?? ""} />
          </Field>
        </div>
      </Card>
      <div className="flex gap-2">
        <Button type="submit">{author ? "Save changes" : "Create author"}</Button>
        <LinkButton href="/admin/authors">Cancel</LinkButton>
      </div>
    </form>
  );
}

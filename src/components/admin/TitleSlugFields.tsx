"use client";

import { useState } from "react";
import { slugify } from "@/lib/slug";
import { Field, Input } from "./ui";

/** Title + slug pair — the slug auto-derives from the title until the user
 *  edits it directly. Reused across category/tag/author/page/article forms. */
export function TitleSlugFields({
  titleLabel = "Title",
  titleName = "title",
  slugName = "slug",
  defaultTitle = "",
  defaultSlug = "",
}: {
  titleLabel?: string;
  titleName?: string;
  slugName?: string;
  defaultTitle?: string;
  defaultSlug?: string;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [slug, setSlug] = useState(defaultSlug);
  const [slugEdited, setSlugEdited] = useState(Boolean(defaultSlug));

  return (
    <>
      <Field label={titleLabel} htmlFor="title-field" required>
        <Input
          id="title-field"
          name={titleName}
          required
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!slugEdited) setSlug(slugify(e.target.value));
          }}
        />
      </Field>
      <Field label="Slug" htmlFor="slug-field" hint="Used in the URL — lowercase, hyphens.">
        <Input
          id="slug-field"
          name={slugName}
          required
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugEdited(true);
          }}
        />
      </Field>
    </>
  );
}

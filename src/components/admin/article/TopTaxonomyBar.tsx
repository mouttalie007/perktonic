"use client";

import { useEffect } from "react";
import type { Category, Author } from "@prisma/client";
import { Field, Select, Card } from "../ui";

/**
 * Category + author picker, moved to the top of the article form (per the
 * admin's workflow, 2026-10-09): chosen once before pasting the article,
 * not buried in the sidebar. The last choice is remembered per-browser
 * (localStorage) since articles tend to get written in batches, one
 * category/author at a time — only for a brand-new article, never
 * overriding an existing one being edited.
 */
export const STORAGE_KEY_CATEGORY = "perktonic-admin-last-category-id";
export const STORAGE_KEY_AUTHOR = "perktonic-admin-last-author-id";

export function TopTaxonomyBar({
  categories,
  authors,
  categoryId,
  authorId,
  onCategoryChange,
  onAuthorChange,
  persist,
}: {
  categories: Category[];
  authors: Author[];
  categoryId: string;
  authorId: string;
  onCategoryChange: (id: string) => void;
  onAuthorChange: (id: string) => void;
  /** Restore/save the last choice in this browser — pass false when editing an existing article. */
  persist: boolean;
}) {
  useEffect(() => {
    if (!persist) return;
    // Reading localStorage (browser-only) can't happen during SSR/first
    // paint — has to run after mount, same reasoning as the consent banner.
    const savedCategory = localStorage.getItem(STORAGE_KEY_CATEGORY);
    const savedAuthor = localStorage.getItem(STORAGE_KEY_AUTHOR);
    if (savedCategory && categories.some((c) => c.id === savedCategory)) onCategoryChange(savedCategory);
    if (savedAuthor && authors.some((a) => a.id === savedAuthor)) onAuthorChange(savedAuthor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCategoryChange(id: string) {
    onCategoryChange(id);
    if (persist) localStorage.setItem(STORAGE_KEY_CATEGORY, id);
  }

  function handleAuthorChange(id: string) {
    onAuthorChange(id);
    if (persist) localStorage.setItem(STORAGE_KEY_AUTHOR, id);
  }

  return (
    <Card className="grid gap-4 sm:grid-cols-2">
      <Field label="Category" htmlFor="categoryId">
        <Select
          id="categoryId"
          name="categoryId"
          value={categoryId}
          onChange={(e) => handleCategoryChange(e.target.value)}
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Author" htmlFor="authorId">
        <Select
          id="authorId"
          name="authorId"
          value={authorId}
          onChange={(e) => handleAuthorChange(e.target.value)}
        >
          <option value="">PerkTonic Editorial Team</option>
          {authors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { Field, Input, Textarea, Button } from "../ui";
import { LISTICLE_MIN_ITEM_DESCRIPTION } from "@/lib/listicle";

export interface ItemDraft {
  heading: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  credit: string;
  sourceUrl: string;
}

const emptyItem = (): ItemDraft => ({
  heading: "",
  description: "",
  imageUrl: "",
  imageAlt: "",
  credit: "",
  sourceUrl: "",
});

/**
 * Repeatable Top-N items — the LISTICLE editor's core (spec §4). Each item
 * renders as its own real subpage, so the heading and description here map
 * 1:1 to what the visitor sees on /story/{slug}/{n}. Reorder is up/down
 * buttons rather than drag-and-drop, to avoid an extra dependency.
 */
export function ItemsEditor({ defaultItems }: { defaultItems: ItemDraft[] }) {
  const [items, setItems] = useState<ItemDraft[]>(
    defaultItems.length >= 2 ? defaultItems : [emptyItem(), emptyItem()],
  );

  function update(i: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function move(i: number, dir: -1 | 1) {
    setItems((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function remove(i: number) {
    setItems((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  return (
    <div className="space-y-4">
      {items.map((it, i) => (
        <div key={i} className="border-line rounded-md border p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-bold">
              Item {i + 1} <span className="text-muted font-normal">/ {items.length}</span>
            </span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-muted hover:text-ink disabled:opacity-30" aria-label="Move up">
                ↑
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="text-muted hover:text-ink disabled:opacity-30" aria-label="Move down">
                ↓
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={items.length <= 2}
                className="text-accent-red ml-2 text-xs font-bold hover:underline disabled:opacity-30"
              >
                Remove
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Item heading" htmlFor={`heading-${i}`} hint="Becomes the H1 on its subpage — keep it unique.">
              <Input id={`heading-${i}`} name="item_heading" value={it.heading} onChange={(e) => update(i, { heading: e.target.value })} />
            </Field>
            <Field label="Image URL" htmlFor={`img-${i}`}>
              <Input id={`img-${i}`} name="item_imageUrl" value={it.imageUrl} onChange={(e) => update(i, { imageUrl: e.target.value })} />
            </Field>
            <Field label="Image alt text" htmlFor={`alt-${i}`}>
              <Input id={`alt-${i}`} name="item_imageAlt" value={it.imageAlt} onChange={(e) => update(i, { imageAlt: e.target.value })} />
            </Field>
            <Field label="Image credit" htmlFor={`credit-${i}`}>
              <Input id={`credit-${i}`} name="item_credit" value={it.credit} onChange={(e) => update(i, { credit: e.target.value })} />
            </Field>
          </div>

          <div className="mt-3">
            <Field
              label="Description"
              htmlFor={`desc-${i}`}
              hint={`${it.description.length} characters — aim for ${LISTICLE_MIN_ITEM_DESCRIPTION}+ so the subpage isn't thin.`}
            >
              <Textarea
                id={`desc-${i}`}
                name="item_description"
                rows={3}
                value={it.description}
                onChange={(e) => update(i, { description: e.target.value })}
              />
            </Field>
          </div>

          <div className="mt-3">
            <Field label="Source URL" htmlFor={`src-${i}`} hint="Optional — where a claim or figure comes from.">
              <Input id={`src-${i}`} name="item_sourceUrl" value={it.sourceUrl} onChange={(e) => update(i, { sourceUrl: e.target.value })} />
            </Field>
          </div>
        </div>
      ))}

      <Button type="button" variant="secondary" onClick={() => setItems((prev) => [...prev, emptyItem()])}>
        + Add item
      </Button>
    </div>
  );
}

import Link from "next/link";
import type { Route } from "next";
import { CategoryIcon } from "@/components/CategoryIcon";

type QuickNavCategory = {
  slug: string;
  name: string;
  iconKey: string | null;
};

/**
 * Horizontal category quick-navigation (spec §13). White, thin borders,
 * yellow hover accent. Scrolls horizontally on narrow screens.
 */
export function CategoryQuickNav({
  categories,
}: {
  categories: QuickNavCategory[];
}) {
  return (
    <nav
      aria-label="Browse by category"
      className="border-line bg-canvas overflow-x-auto rounded-sm border [scrollbar-width:thin]"
    >
      <ul className="flex min-w-max divide-x divide-[var(--color-line)]">
        {categories.map((c) => (
          <li key={c.slug} className="flex-1">
            <Link
              href={`/category/${c.slug}` as Route}
              className="hover:border-b-brand text-ink/75 hover:text-ink flex min-w-[92px] flex-col items-center gap-1.5 border-b-2 border-transparent px-4 py-3 text-center transition-colors"
            >
              <CategoryIcon iconKey={c.iconKey} width={22} height={22} />
              <span className="text-[0.72rem] font-bold tracking-wide uppercase">
                {c.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

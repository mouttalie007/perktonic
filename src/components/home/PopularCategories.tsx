import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import { ArrowRightIcon } from "@/components/icons";

type TileCategory = {
  slug: string;
  name: string;
  shortDescription: string | null;
  imageUrl: string | null;
};

/**
 * "Popular Categories" tile grid (spec §17). Highly visual: image, dark
 * overlay, name, short description, arrow.
 */
export function PopularCategories({
  categories,
}: {
  categories: TileCategory[];
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {categories.map((c) => (
        <li key={c.slug}>
          <Link
            href={`/category/${c.slug}` as Route}
            className="group relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-sm p-4"
          >
            {c.imageUrl ? (
              <Image
                src={c.imageUrl}
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-105"
              />
            ) : (
              <div className="from-ink to-ink-deep absolute inset-0 bg-gradient-to-br" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10 transition-colors group-hover:from-black/85" />
            <div className="relative">
              <h3 className="flex items-center gap-1 text-base font-extrabold text-white">
                {c.name}
                <ArrowRightIcon
                  width={16}
                  height={16}
                  className="text-brand transition-transform group-hover:translate-x-1"
                />
              </h3>
              {c.shortDescription && (
                <p className="mt-0.5 text-xs text-white/75">
                  {c.shortDescription}
                </p>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { DEFAULT_AUTHOR_NAME } from "@/config/site";

type Author = {
  name: string;
  role: string | null;
  bio: string | null;
  avatarUrl: string | null;
} | null;

/**
 * Author box (spec §72, §73). Trust signal — shows who is behind the story.
 * Falls back to the editorial-team identity when no individual author is set.
 */
export function AuthorBox({ author }: { author: Author }) {
  const name = author?.name ?? DEFAULT_AUTHOR_NAME;
  const bio =
    author?.bio ??
    "Stories researched, written and edited by the ViralTrendly newsroom.";

  return (
    <aside className="border-line bg-surface/60 flex gap-4 rounded-sm border p-4">
      <div className="bg-ink relative h-14 w-14 shrink-0 overflow-hidden rounded-full">
        {author?.avatarUrl ? (
          <Image src={author.avatarUrl} alt="" fill sizes="56px" className="object-cover" />
        ) : (
          <span className="text-brand flex h-full w-full items-center justify-center text-lg font-extrabold">
            {name.charAt(0)}
          </span>
        )}
      </div>
      <div>
        <p className="text-[0.7rem] font-bold tracking-[0.15em] text-[var(--color-muted)] uppercase">
          Written by
        </p>
        <p className="text-ink font-bold">{name}</p>
        {author?.role && <p className="text-muted text-sm">{author.role}</p>}
        <p className="text-muted mt-1.5 text-sm leading-relaxed">{bio}</p>
        <Link
          href={"/editorial-policy" as Route}
          className="text-accent-blue mt-2 inline-block text-xs font-semibold hover:underline"
        >
          Our editorial policy
        </Link>
      </div>
    </aside>
  );
}

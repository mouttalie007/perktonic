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
    <aside className="border-line bg-surface/60 flex gap-4 rounded-sm border p-5">
      <div className="border-line bg-ink relative h-16 w-16 shrink-0 overflow-hidden rounded-full border">
        {author?.avatarUrl ? (
          <Image
            src={author.avatarUrl}
            alt={`${name} — portrait`}
            fill
            sizes="64px"
            className="object-cover"
          />
        ) : (
          <span className="text-brand flex h-full w-full items-center justify-center text-xl font-extrabold">
            {name.charAt(0)}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[0.68rem] font-bold tracking-[0.16em] text-[var(--color-muted)] uppercase">
          Written by
        </p>
        <p className="text-ink text-[1.05rem] font-bold">{name}</p>
        {author?.role && (
          <p className="text-muted text-[0.82rem] font-medium">{author.role}</p>
        )}
        <p className="text-muted mt-2 text-[0.9rem] leading-relaxed">{bio}</p>
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

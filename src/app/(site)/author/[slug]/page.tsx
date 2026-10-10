import type { Metadata } from "next";
import type { Route } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { authorService } from "@/services/author.service";
import { articleService } from "@/services/article.service";
import { seoService } from "@/services/seo.service";
import { DEFAULT_AUTHOR_NAME } from "@/config/site";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { StoryGrid } from "@/components/story/StoryGrid";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { JsonLd } from "@/components/seo/JsonLd";

const PAGE_SIZE = 12;

type Params = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

function authorHref(slug: string, page: number): Route {
  return (page > 1 ? `/author/${slug}?page=${page}` : `/author/${slug}`) as Route;
}

function socialLinks(json: unknown): { label: string; url: string }[] {
  if (!json || typeof json !== "object") return [];
  const links = json as Record<string, unknown>;
  const labels: Record<string, string> = {
    x: "X",
    instagram: "Instagram",
    facebook: "Facebook",
    website: "Website",
  };
  return Object.entries(labels)
    .filter(([key]) => typeof links[key] === "string" && links[key])
    .map(([key, label]) => ({ label, url: links[key] as string }));
}

export async function generateStaticParams() {
  const slugs = await authorService.listPublishedSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const author = await authorService.getBySlug(slug);
  if (!author) return { title: "Author not found" };

  return seoService.buildMetadata({
    title: `${author.name} — Author at PerkTonic`,
    description:
      author.bio?.slice(0, 155) ??
      `Guides and deals written by ${author.name} on PerkTonic.`,
    path: `/author/${slug}`,
  });
}

export default async function AuthorPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const author = await authorService.getBySlug(slug);
  if (!author) notFound();

  const page = Math.max(1, Number(pageParam) || 1);
  const { items, total, totalPages } = await articleService.listByAuthor(slug, {
    page,
    pageSize: PAGE_SIZE,
  });
  if (total > 0 && page > totalPages) notFound();

  const links = socialLinks(author.socialLinks);

  return (
    <>
      <JsonLd
        data={seoService.personJsonLd({
          name: author.name,
          url: `/author/${slug}`,
          bio: author.bio,
          imageUrl: author.avatarUrl,
          sameAs: links.map((l) => l.url),
        })}
      />

      <div className="site-container py-8 sm:py-10">
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: author.name }]} />

        <header className="mt-6 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div className="border-line bg-ink relative h-20 w-20 shrink-0 overflow-hidden rounded-full border">
            {author.avatarUrl ? (
              <Image
                src={author.avatarUrl}
                alt={`${author.name} — portrait`}
                fill
                sizes="80px"
                className="object-cover"
              />
            ) : (
              <span className="text-brand flex h-full w-full items-center justify-center text-2xl font-extrabold">
                {author.name.charAt(0)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[0.68rem] font-bold tracking-[0.16em] text-[var(--color-muted)] uppercase">
              Author
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {author.name}
            </h1>
            {author.role && (
              <p className="text-muted text-sm font-medium">{author.role}</p>
            )}
          </div>
        </header>

        {author.bio && (
          <p className="text-muted mt-5 max-w-2xl text-[0.95rem] leading-relaxed">
            {author.bio}
          </p>
        )}

        {links.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-4">
            {links.map((l) => (
              <li key={l.url}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-blue text-sm font-semibold hover:underline"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10">
          {total === 0 ? (
            <EmptyState
              title={`No stories from ${author.name} yet`}
              description={`Articles by ${DEFAULT_AUTHOR_NAME} and other contributors are published regularly — check back soon.`}
            />
          ) : (
            <>
              <StoryGrid stories={items} columns={3} />
              <Pagination
                page={page}
                totalPages={totalPages}
                buildHref={(p) => authorHref(slug, p)}
                className="mt-10"
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}

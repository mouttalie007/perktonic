import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageService } from "@/services/page.service";
import { seoService } from "@/services/seo.service";

/**
 * Static / legal pages (spec §20, §21, §22, §24) rendered from the Page model.
 * Phase 1 gives every footer link a real destination; Phase 8 adds full
 * editorial content, the contact form and Phase 9 adds HTML sanitisation.
 */

type Params = { params: Promise<{ pageSlug: string }> };

export async function generateStaticParams() {
  const slugs = await pageService.listPublishedSlugs();
  return slugs.map((pageSlug) => ({ pageSlug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { pageSlug } = await params;
  const page = await pageService.getBySlug(pageSlug);
  if (!page) return { title: "Page not found" };
  return seoService.buildMetadata({
    title: page.seoTitle ?? page.title,
    description: page.metaDescription ?? undefined,
    path: `/${page.slug}`,
    robotsIndex: page.robotsIndex,
  });
}

export default async function StaticPage({ params }: Params) {
  const { pageSlug } = await params;
  const page = await pageService.getBySlug(pageSlug);
  if (!page) notFound();

  return (
    <article className="site-container py-12 sm:py-16">
      <nav aria-label="Breadcrumb" className="text-meta text-muted mb-4">
        <Link href="/" className="hover:text-ink">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{page.title}</span>
      </nav>

      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        {page.title}
      </h1>

      {page.content ? (
        // TODO(Phase 9): sanitise admin-authored HTML before rendering.
        <div
          className="page-prose mt-6"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      ) : (
        <p className="text-muted mt-6">
          This page is being written. Check back soon.
        </p>
      )}
    </article>
  );
}

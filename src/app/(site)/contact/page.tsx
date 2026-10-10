import type { Metadata } from "next";
import Link from "next/link";
import { pageService } from "@/services/page.service";
import { seoService } from "@/services/seo.service";
import { ContactForm } from "@/components/ContactForm";

export async function generateMetadata(): Promise<Metadata> {
  const page = await pageService.getBySlug("contact");
  return seoService.buildMetadata({
    title: page?.seoTitle ?? page?.title ?? "Contact",
    description: page?.metaDescription ?? "Get in touch with the PerkTonic team.",
    path: "/contact",
    robotsIndex: page?.robotsIndex ?? true,
  });
}

export default async function ContactPage() {
  const page = await pageService.getBySlug("contact");

  return (
    <article className="site-container py-12 sm:py-16">
      <nav aria-label="Breadcrumb" className="text-meta text-muted mb-4">
        <Link href="/" className="hover:text-ink">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">Contact</span>
      </nav>

      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        {page?.title ?? "Contact"}
      </h1>

      {page?.content && (
        <div
          className="page-prose mt-6 mb-10"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      )}

      <ContactForm />
    </article>
  );
}

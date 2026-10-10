/**
 * One-time data fix (2026-10-08): the DB's `/sitemap` Page row was seeded
 * before the PerkTonic category pivot and was never regenerated — it still
 * listed all 14 old categories (dead `/category/viral` etc. links) and was
 * missing the affiliate-disclosure/dmca pages added since. Regenerates it
 * from the current CATEGORIES/LEGAL_PAGES, matching seed.ts's template.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  { slug: "free-samples", name: "Free Samples & Products", shortDescription: "Real freebies, verified" },
  { slug: "ai-tools", name: "Internet Secrets & AI Tools", shortDescription: "Hidden tools & AI tricks" },
  { slug: "rewards-perks", name: "Rewards, Trials & Digital Perks", shortDescription: "Gift cards, trials & perks" },
  { slug: "money-saving", name: "Money-Saving Guides", shortDescription: "Smarter spending" },
];

const LEGAL_PAGES: { slug: string; title: string }[] = [
  { slug: "about", title: "About Us" },
  { slug: "contact", title: "Contact" },
  { slug: "privacy-policy", title: "Privacy Policy" },
  { slug: "terms-of-service", title: "Terms of Service" },
  { slug: "cookie-policy", title: "Cookie Policy" },
  { slug: "sitemap", title: "Sitemap" },
  { slug: "write-for-us", title: "Write for Us" },
  { slug: "advertise", title: "Advertise" },
  { slug: "editorial-policy", title: "Editorial Policy" },
  { slug: "disclaimer", title: "Disclaimer" },
  { slug: "accessibility", title: "Accessibility" },
  { slug: "affiliate-disclosure", title: "Affiliate Disclosure" },
  { slug: "dmca", title: "DMCA & Copyright" },
];

const sitemapContent = `
<p>A quick guide to the main sections of PerkTonic. The full machine-readable sitemap is at <a href="/sitemap.xml">/sitemap.xml</a>.</p>
<h2>Categories</h2>
<ul>
${CATEGORIES.map((c) => `<li><a href="/category/${c.slug}">${c.name}</a> — ${c.shortDescription}</li>`).join("\n")}
</ul>
<h2>Company</h2>
<ul>
${LEGAL_PAGES.filter((p) => p.slug !== "sitemap")
  .map((p) => `<li><a href="/${p.slug}">${p.title}</a></li>`)
  .join("\n")}
</ul>`.trim();

async function main() {
  const r = await prisma.page.updateMany({
    where: { slug: "sitemap" },
    data: { content: sitemapContent },
  });
  console.log(`sitemap: updated ${r.count} row(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

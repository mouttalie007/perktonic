/**
 * One-time data fix for the PerkTonic rename (2026-10-08).
 *
 * Schema `@default()` changes and a changed seed.ts CATEGORIES array don't
 * retroactively touch rows that already exist in the database — this script
 * does the two things that actually need a direct write:
 *
 *   1. Delete the 14 old "viral magazine" categories and create the new 4
 *      PerkTonic ones. Category -> Article.categoryId is `onDelete: SetNull`,
 *      so any articles pointing at a deleted category just lose their
 *      category (null), nothing cascades.
 *   2. Update the existing SiteSettings/SeoSettings singleton rows in place
 *      with the new branding, since they were already seeded with the old
 *      ViralTrendly defaults before this rename.
 *
 * Safe to run more than once (categories are upserted by slug; settings are
 * a plain update). Not part of `db:seed` — run by hand, once, per database
 * that was seeded before this rename (local dev now, production whenever
 * it's redeployed with these changes).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NEW_CATEGORIES = [
  { slug: "free-samples", name: "Free Samples & Products", iconKey: "gift", shortDescription: "Real freebies, verified", description: "Legitimate free samples, product-testing programs and freebie offers — checked for scams before we share them.", accentColor: "#047857" },
  { slug: "ai-tools", name: "Internet Secrets & AI Tools", iconKey: "cpu", shortDescription: "Hidden tools & AI tricks", description: "Free AI tools, hidden Google features and useful websites most people have never heard of.", accentColor: "#1D4ED8" },
  { slug: "rewards-perks", name: "Rewards, Trials & Digital Perks", iconKey: "trophy", shortDescription: "Gift cards, trials & perks", description: "Gift card programs, free trials, cashback apps and digital perks worth knowing about — including how to cancel before you're charged.", accentColor: "#6D28D9" },
  { slug: "money-saving", name: "Money-Saving Guides", iconKey: "wallet", shortDescription: "Smarter spending", description: "Coupon tools, price-history tricks and the discounts most people miss — practical ways to spend less.", accentColor: "#92400E" },
];

async function main() {
  console.log("→ categories");
  const keepSlugs = NEW_CATEGORIES.map((c) => c.slug);
  const deleted = await prisma.category.deleteMany({
    where: { slug: { notIn: keepSlugs } },
  });
  console.log(`  deleted ${deleted.count} old categories`);

  for (const c of NEW_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: c,
      create: c,
    });
  }
  console.log(`  upserted ${NEW_CATEGORIES.length} new categories`);

  console.log("→ site settings");
  const siteUpdate = await prisma.siteSettings.updateMany({
    where: { id: "singleton" },
    data: {
      siteName: "PerkTonic.com",
      tagline: "Free Stuff. Smart Savings. Real Perks.",
    },
  });
  console.log(`  updated ${siteUpdate.count} row(s)`);

  console.log("→ seo settings");
  const seoUpdate = await prisma.seoSettings.updateMany({
    where: { id: "singleton" },
    data: {
      defaultTitle: "PerkTonic — Free Samples, AI Tools, Rewards & Money-Saving Guides",
      titleTemplate: "%s — PerkTonic",
      defaultMetaDescription:
        "Verified free samples, hidden AI tools, real rewards and smart money-saving guides — tested and explained simply.",
      organizationName: "PerkTonic",
    },
  });
  console.log(`  updated ${seoUpdate.count} row(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

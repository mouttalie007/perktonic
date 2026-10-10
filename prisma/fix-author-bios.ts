/**
 * One-time data fix (2026-10-09): rewrites the 3 writer-persona bios/roles
 * to match PerkTonic's editorial line instead of the old ViralTrendly beats
 * (tech/culture/travel/entertainment). Mirrors the matching edit in
 * prisma/seed.ts's AUTHORS array into a database already seeded before it.
 *
 * Also fixes a real bug found while doing this: seed.ts's fallback author
 * lookup and AUTHOR_FOR_CATEGORY map still referenced the old
 * "viraltrendly-editorial-team" slug and the old 14-category slugs — both
 * silently resolved to `undefined` after the PerkTonic rename (the slug no
 * longer exists, the categories no longer exist). This script only touches
 * existing Author rows; the mapping bug itself is fixed in seed.ts for any
 * future `db:seed` run.
 *
 * Safe to run more than once (plain update by slug).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const AUTHORS = [
  {
    slug: "alex-carter",
    role: "Internet Secrets & AI Tools · Money-Saving Guides",
    bio: "Alex Carter hunts down the free AI tools, hidden internet tricks and the coupon and price-tracking tools that actually save money — then tests each one personally before writing about it. If it's free and genuinely useful, he wants to find it first.",
  },
  {
    slug: "mia-reynolds",
    role: "Free Samples & Products",
    bio: "Mia Reynolds requests the free samples and product-testing programs so you don't have to guess which ones are legit. She reads the fine print before she writes a word, and flags anything that smells like a scam before it reaches the page.",
  },
  {
    slug: "daniel-brooks",
    role: "Rewards, Trials & Digital Perks",
    bio: "Daniel Brooks specializes in the fine print behind rewards, gift cards and free trials — the cancellation steps, the eligibility rules, and the exact date a \"free\" trial turns into a charge. He got into this after one too many trials quietly billed him, and makes sure nobody else gets caught the same way.",
  },
];

async function main() {
  for (const a of AUTHORS) {
    const r = await prisma.author.updateMany({
      where: { slug: a.slug },
      data: { role: a.role, bio: a.bio },
    });
    console.log(`${a.slug}: updated ${r.count} row(s)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

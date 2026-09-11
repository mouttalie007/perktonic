/**
 * ViralTrendly — database seed.
 *
 * Two parts:
 *   1. STRUCTURAL (keep): singleton settings, categories, ad-placement slots,
 *      the default editorial author, and the legal/trust page shells.
 *   2. DEMO CONTENT (removable): a handful of published articles + one listicle
 *      so Phases 1–6 have something to render. Delete these from the Admin
 *      Dashboard once real content exists, or run `npm run db:reset`.
 *
 * Idempotent: everything is upserted by a natural key, so re-running is safe.
 */

import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

const CATEGORIES: {
  slug: string;
  name: string;
  iconKey: string;
  shortDescription: string;
  description: string;
}[] = [
  { slug: "viral", name: "Viral", iconKey: "flame", shortDescription: "Hot stories", description: "The stories everyone is talking about right now." },
  { slug: "people", name: "People", iconKey: "users", shortDescription: "Celebrities & influencers", description: "Profiles and talking points from the people shaping culture." },
  { slug: "tech", name: "Tech", iconKey: "cpu", shortDescription: "Innovation & AI", description: "How technology and AI are reshaping the way we live and work." },
  { slug: "lifestyle", name: "Lifestyle", iconKey: "coffee", shortDescription: "Live better", description: "Ideas and small changes for a better everyday life." },
  { slug: "entertainment", name: "Entertainment", iconKey: "film", shortDescription: "Movies, music & more", description: "The latest from film, TV, music and streaming." },
  { slug: "travel", name: "Travel", iconKey: "plane", shortDescription: "Discover the world", description: "Destinations, guides and the places worth seeing." },
  { slug: "health", name: "Health", iconKey: "heart", shortDescription: "Tips for a healthier you", description: "Practical takes on nutrition, fitness, sleep and wellbeing." },
  { slug: "science", name: "Science", iconKey: "atom", shortDescription: "Discoveries & space", description: "Discoveries and research that change how we see the universe." },
  { slug: "sports", name: "Sports", iconKey: "trophy", shortDescription: "The moments that matter", description: "Highlights, storylines and viral moments from sport." },
  { slug: "amazing", name: "Amazing", iconKey: "sparkles", shortDescription: "Incredible facts", description: "Extraordinary facts, feats and stories worth a double take." },
  { slug: "food", name: "Food", iconKey: "utensils", shortDescription: "Eat well", description: "Recipes, trends and food stories worth a second look." },
  { slug: "money", name: "Money", iconKey: "wallet", shortDescription: "Smarter with money", description: "Everyday money and the economy explained simply." },
  { slug: "culture", name: "Culture", iconKey: "palette", shortDescription: "Art & ideas", description: "Art, books, internet culture and the ideas moving the conversation." },
  { slug: "world", name: "World", iconKey: "globe", shortDescription: "Around the globe", description: "Notable stories and human moments from around the world." },
];

const AD_PLACEMENTS: {
  key: string;
  label: string;
  description: string;
  appliesTo: "STANDARD" | "LISTICLE" | null;
}[] = [
  { key: "top-leaderboard", label: "Top Leaderboard", description: "Above the header content, full width.", appliesTo: null },
  { key: "under-title", label: "Under Title", description: "Beneath the article H1. Repeats on every listicle subpage.", appliesTo: null },
  { key: "in-content", label: "In-Content", description: "Injected between body sections of a standard article.", appliesTo: "STANDARD" },
  { key: "between-slides", label: "Between Slides", description: "Between image and description on a listicle subpage.", appliesTo: "LISTICLE" },
  { key: "sidebar", label: "Sidebar", description: "Sticky sidebar rectangle on desktop.", appliesTo: null },
  { key: "below-article", label: "Below Article", description: "After the body, before related stories.", appliesTo: null },
  { key: "mobile-anchor", label: "Mobile Anchor", description: "Sticky anchor unit at the bottom of the viewport on mobile.", appliesTo: null },
];

// Kept sparing on purpose (spec §31) — a handful of real, reusable tags
// rather than one per article.
const TAGS: { slug: string; name: string }[] = [
  { slug: "ai", name: "AI" },
  { slug: "tiktok", name: "TikTok" },
  { slug: "viral-videos", name: "Viral Videos" },
  { slug: "travel-tips", name: "Travel Tips" },
  { slug: "space", name: "Space" },
  { slug: "wellness", name: "Wellness" },
];

// slug (demoStandard/listicle) -> tag slugs
const ARTICLE_TAGS: Record<string, string[]> = {
  "how-ai-is-changing-our-lives-in-2026": ["ai"],
  "this-dogs-reaction-will-melt-your-heart": ["viral-videos", "tiktok"],
  "a-stunning-discovery-just-changed-what-we-know-about-the-universe": ["space"],
  "scientists-discover-a-new-planet-that-could-support-life": ["space"],
  "7-foods-that-boost-your-energy-naturally": ["wellness"],
  "10-breathtaking-places-to-visit-before-they-change-forever": ["travel-tips"],
  "the-most-beautiful-road-in-the-world": ["travel-tips"],
  "this-moment-had-fans-going-crazy-around-the-world": ["viral-videos"],
  "8-everyday-habits-that-quietly-improve-your-life": ["wellness"],
};

const LEGAL_PAGES: { slug: string; title: string; footerColumn: string }[] = [
  { slug: "about", title: "About Us", footerColumn: "quick-links" },
  { slug: "contact", title: "Contact", footerColumn: "quick-links" },
  { slug: "privacy-policy", title: "Privacy Policy", footerColumn: "quick-links" },
  { slug: "terms-of-service", title: "Terms of Service", footerColumn: "quick-links" },
  { slug: "cookie-policy", title: "Cookie Policy", footerColumn: "quick-links" },
  { slug: "sitemap", title: "Sitemap", footerColumn: "quick-links" },
  { slug: "write-for-us", title: "Write for Us", footerColumn: "resources" },
  { slug: "advertise", title: "Advertise", footerColumn: "resources" },
  { slug: "editorial-policy", title: "Editorial Policy", footerColumn: "resources" },
  { slug: "disclaimer", title: "Disclaimer", footerColumn: "resources" },
  { slug: "accessibility", title: "Accessibility", footerColumn: "resources" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const img = (seed: string, w = 1200, h = 750) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

const bodyHtml = (lead: string) => `
<p>${lead}</p>
<h2>Why this matters</h2>
<p>This is placeholder editorial copy used only for local development. It exists so layout, typography, spacing and SEO components can be built and reviewed against realistic content before the real articles are written.</p>
<p>Replace it from the Admin Dashboard once Phase 7 is in place.</p>
<h2>The details</h2>
<p>Paragraphs here run at the article body measure so line length, rhythm and the reading experience can be judged properly.</p>
<h3>A closer look</h3>
<p>Sub-sections use H3 so the heading hierarchy and the auto-generated table of contents can be verified.</p>
<blockquote>A pull quote to check the blockquote treatment in the article body.</blockquote>
<p>A closing paragraph so the end of the body has something to sit against the related-stories block.</p>
`.trim();

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  console.log("→ settings");
  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  await prisma.seoSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  console.log("→ categories");
  for (const [i, c] of CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name,
        iconKey: c.iconKey,
        shortDescription: c.shortDescription,
        description: c.description,
        order: i,
      },
      create: {
        slug: c.slug,
        name: c.name,
        iconKey: c.iconKey,
        shortDescription: c.shortDescription,
        description: c.description,
        order: i,
        imageUrl: img(`cat-${c.slug}`, 800, 600),
      },
    });
  }

  console.log("→ ad placements");
  for (const [i, p] of AD_PLACEMENTS.entries()) {
    await prisma.adPlacement.upsert({
      where: { placementKey: p.key },
      update: { label: p.label, description: p.description, appliesTo: p.appliesTo },
      create: {
        placementKey: p.key,
        label: p.label,
        description: p.description,
        appliesTo: p.appliesTo,
        enabled: true,
        order: i,
        autoInject: p.key === "in-content",
        everyNParagraphs: p.key === "in-content" ? 4 : null,
        maxInjections: p.key === "in-content" ? 3 : null,
      },
    });
  }

  console.log("→ authors");
  const AUTHORS = [
    {
      slug: "viraltrendly-editorial-team",
      name: "ViralTrendly Editorial Team",
      role: "Editorial Team",
      bio: "Stories researched, written and edited by the ViralTrendly newsroom.",
      avatarUrl: null as string | null,
    },
    {
      slug: "alex-carter",
      name: "Alex Carter",
      role: "Tech · Internet · Money · Facts",
      bio: "Alex Carter writes about technology, internet culture and personal finance — the shifts in how we work, spend and get online. He is at his best turning a complicated trend into something you can actually use.",
      avatarUrl: "/authors/alex-carter.png",
    },
    {
      slug: "mia-reynolds",
      name: "Mia Reynolds",
      role: "Lifestyle · Relationships · People · Travel",
      bio: "Mia Reynolds covers lifestyle, relationships and travel, with an eye for the small habits and the far-flung trips that change how a life feels. She likes advice that is specific, honest and easy to start today.",
      avatarUrl: "/authors/mia-reynolds.png",
    },
    {
      slug: "daniel-brooks",
      name: "Daniel Brooks",
      role: "Entertainment · People · Trending · Weird Stories",
      bio: "Daniel Brooks follows the entertainment headlines, viral moments and genuinely strange stories the internet will not stop sharing — and enjoys explaining why each one blew up.",
      avatarUrl: "/authors/daniel-brooks.png",
    },
  ];

  const authorBySlug = new Map<string, string>();
  for (const a of AUTHORS) {
    const row = await prisma.author.upsert({
      where: { slug: a.slug },
      update: { name: a.name, role: a.role, bio: a.bio, avatarUrl: a.avatarUrl },
      create: a,
    });
    authorBySlug.set(a.slug, row.id);
  }
  const author = { id: authorBySlug.get("viraltrendly-editorial-team")! };

  // Which byline covers which category (spec §73 — publisher's own roster).
  const AUTHOR_FOR_CATEGORY: Record<string, string> = {
    tech: "alex-carter",
    money: "alex-carter",
    science: "alex-carter",
    lifestyle: "mia-reynolds",
    travel: "mia-reynolds",
    health: "mia-reynolds",
    people: "mia-reynolds",
    entertainment: "daniel-brooks",
    viral: "daniel-brooks",
    sports: "daniel-brooks",
    amazing: "daniel-brooks",
    culture: "daniel-brooks",
  };
  const authorIdForCategory = (slug: string) =>
    authorBySlug.get(AUTHOR_FOR_CATEGORY[slug] ?? "viraltrendly-editorial-team") ??
    author.id;

  console.log("→ tags");
  const tagBySlug = new Map<string, string>();
  for (const t of TAGS) {
    const row = await prisma.tag.upsert({
      where: { slug: t.slug },
      update: { name: t.name },
      create: { slug: t.slug, name: t.name },
    });
    tagBySlug.set(t.slug, row.id);
  }

  console.log("→ legal pages");
  for (const [i, p] of LEGAL_PAGES.entries()) {
    await prisma.page.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        title: p.title,
        footerColumn: p.footerColumn,
        order: i,
        status: "PUBLISHED",
        content: `<p>${p.title} content is managed from the Admin Dashboard.</p>`,
      },
    });
  }

  console.log("→ demo standard articles");
  const demoStandard: {
    slug: string;
    title: string;
    category: string;
    excerpt: string;
    flags?: Partial<Pick<Prisma.ArticleUncheckedCreateInput, "isFeatured" | "isTrending" | "isBreaking" | "manualPriority">>;
    days: number;
    views: number;
  }[] = [
    { slug: "10-breathtaking-places-to-visit-before-they-change-forever", title: "10 Breathtaking Places You Need to Visit Before They Change Forever", category: "travel", excerpt: "These incredible destinations are attracting attention around the world — and they may not stay this way for long.", flags: { isFeatured: true, manualPriority: 1 }, days: 0, views: 125_000 },
    { slug: "how-ai-is-changing-our-lives-in-2026", title: "How AI Is Changing Our Lives in 2026", category: "tech", excerpt: "From automated research to creative tools, artificial intelligence is reshaping everyday workflows.", flags: { isFeatured: true, isTrending: true, manualPriority: 2 }, days: 0, views: 89_200 },
    { slug: "this-dogs-reaction-will-melt-your-heart", title: "This Dog's Reaction Will Melt Your Heart", category: "viral", excerpt: "A short clip that has been shared millions of times this week — and it's easy to see why.", flags: { isFeatured: true, isTrending: true, manualPriority: 3 }, days: 1, views: 240_000 },
    { slug: "a-stunning-discovery-just-changed-what-we-know-about-the-universe", title: "A Stunning Discovery Just Changed What We Know About the Universe", category: "science", excerpt: "Researchers say the finding could reshape a long-standing model.", flags: { isTrending: true }, days: 1, views: 98_000 },
    { slug: "the-power-of-saying-no-and-why-it-changes-everything", title: "The Power of Saying “No” (And Why It Changes Everything)", category: "lifestyle", excerpt: "A small habit with an outsized effect on focus, energy and time.", days: 2, views: 72_000 },
    { slug: "7-foods-that-boost-your-energy-naturally", title: "7 Foods That Boost Your Energy Naturally", category: "health", excerpt: "Simple, widely available foods that support steady energy through the day.", flags: { isTrending: true }, days: 2, views: 64_000 },
    { slug: "this-moment-had-fans-going-crazy-around-the-world", title: "This Moment Had Fans Going Crazy Around the World", category: "sports", excerpt: "One play, countless reactions — the clip everyone was sharing.", flags: { isTrending: true }, days: 3, views: 310_000 },
    { slug: "the-most-beautiful-road-in-the-world", title: "The Most Beautiful Road in the World?", category: "travel", excerpt: "A drive that keeps showing up on travellers' lists — here's what makes it special.", days: 4, views: 187_000 },
    { slug: "a-genius-invention-thats-going-viral", title: "A Genius Invention That's Going Viral", category: "amazing", excerpt: "A simple idea, executed well — and the internet can't get enough.", days: 5, views: 162_000 },
    { slug: "scientists-discover-a-new-planet-that-could-support-life", title: "Scientists Discover a New Planet That Could Support Life", category: "science", excerpt: "The candidate world sits in its star's habitable zone, researchers say.", flags: { isBreaking: true }, days: 0, views: 54_000 },
  ];

  for (const a of demoStandard) {
    const category = await prisma.category.findUnique({ where: { slug: a.category } });
    const media = await prisma.media.upsert({
      where: { id: `demo-media-${a.slug}` },
      update: {},
      create: {
        id: `demo-media-${a.slug}`,
        url: img(a.slug),
        provider: "local",
        filename: `${a.slug}.jpg`,
        mimeType: "image/jpeg",
        width: 1200,
        height: 750,
        alt: a.title,
        credit: "Demo image — Lorem Picsum",
      },
    });
    const articleAuthorId = authorIdForCategory(a.category);
    await prisma.article.upsert({
      where: { slug: a.slug },
      update: { authorId: articleAuthorId, categoryId: category?.id ?? null },
      create: {
        type: "STANDARD",
        title: a.title,
        slug: a.slug,
        excerpt: a.excerpt,
        content: bodyHtml(a.excerpt),
        featuredImageId: media.id,
        authorId: articleAuthorId,
        categoryId: category?.id ?? null,
        status: "PUBLISHED",
        publishedAt: daysAgo(a.days),
        readingTime: 5,
        viewCount: a.views,
        isFeatured: a.flags?.isFeatured ?? false,
        isTrending: a.flags?.isTrending ?? false,
        isBreaking: a.flags?.isBreaking ?? false,
        manualPriority: a.flags?.manualPriority ?? null,
        metaDescription: a.excerpt,
      },
    });
  }

  console.log("→ demo listicle");
  const listicleSlug = "8-everyday-habits-that-quietly-improve-your-life";
  const travel = await prisma.category.findUnique({ where: { slug: "lifestyle" } });
  const listicle = await prisma.article.upsert({
    where: { slug: listicleSlug },
    update: { authorId: authorIdForCategory("lifestyle") },
    create: {
      type: "LISTICLE",
      title: "8 Everyday Habits That Quietly Improve Your Life",
      slug: listicleSlug,
      excerpt: "Small, low-effort habits with a compounding payoff over months and years.",
      intro:
        "None of these will change your life overnight. Stacked together and kept up for a few months, they add up to something that feels a lot like a different life. Here are eight worth trying.",
      authorId: authorIdForCategory("lifestyle"),
      categoryId: travel?.id ?? null,
      status: "PUBLISHED",
      publishedAt: daysAgo(1),
      readingTime: 4,
      viewCount: 143_000,
      isFeatured: false,
      isTrending: true,
      listicleIndexSubpages: true,
      metaDescription:
        "Eight small everyday habits — from a daily walk to a shutdown ritual — that quietly compound into a better life.",
    },
  });

  const items = [
    { heading: "Take a walk before noon", description: "Ten minutes of daylight early in the day helps set your body clock, which pays off as steadier energy and easier sleep that night. It is the highest-return habit on this list for the least effort." },
    { heading: "Drink a glass of water first thing", description: "You wake up mildly dehydrated after seven or eight hours without fluids. A glass of water before coffee is a tiny cue that starts the day on the front foot." },
    { heading: "Make the bed", description: "It takes under a minute and gives you one finished task before the day has really begun. The point is less the bed and more the small signal that you follow through on things." },
    { heading: "Write down the one thing that matters today", description: "Not a to-do list — a single line naming the task that would make today a win. It keeps the day pointed in a direction when everything else competes for attention." },
    { heading: "Put the phone in another room while you work", description: "Not face-down on the desk. In another room. The presence of a phone measurably reduces available attention even when it is not in use." },
    { heading: "Eat something green at lunch", description: "One vegetable at midday is an easy, unglamorous win that most people skip. It is a floor, not a ceiling — the bar is deliberately low so you actually clear it." },
    { heading: "Take a real break, away from a screen", description: "A short walk, a stretch, standing outside. Breaks that swap one screen for another do not restore attention the way a genuine change of scene does." },
    { heading: "Run a two-minute shutdown ritual", description: "At the end of the workday, close the tabs, note where you stopped, and write tomorrow's first task. It draws a line between work and the rest of your evening." },
  ];

  for (const [i, it] of items.entries()) {
    await prisma.listicleItem.upsert({
      where: { articleId_position: { articleId: listicle.id, position: i + 1 } },
      update: {},
      create: {
        articleId: listicle.id,
        position: i + 1,
        heading: it.heading,
        imageUrl: img(`${listicleSlug}-${i + 1}`, 1200, 800),
        imageAlt: it.heading,
        description: it.description,
        credit: "Demo image — Lorem Picsum",
      },
    });
  }

  // Attach a featured image to the listicle from its first item.
  await prisma.article.update({
    where: { id: listicle.id },
    data: {
      featuredImage: {
        create: {
          id: `demo-media-${listicleSlug}`,
          url: img(`${listicleSlug}-1`, 1200, 800),
          provider: "local",
          filename: `${listicleSlug}.jpg`,
          mimeType: "image/jpeg",
          width: 1200,
          height: 800,
          alt: "8 Everyday Habits That Quietly Improve Your Life",
          credit: "Demo image — Lorem Picsum",
        },
      },
    },
  }).catch(() => {
    /* featuredImage already set on a re-run */
  });

  console.log("→ article tags");
  for (const [slug, tagSlugs] of Object.entries(ARTICLE_TAGS)) {
    const article = await prisma.article.findUnique({ where: { slug } });
    if (!article) continue;
    for (const tagSlug of tagSlugs) {
      const tagId = tagBySlug.get(tagSlug);
      if (!tagId) continue;
      await prisma.articleTag.upsert({
        where: { articleId_tagId: { articleId: article.id, tagId } },
        update: {},
        create: { articleId: article.id, tagId },
      });
    }
  }

  console.log("→ demo redirect");
  await prisma.redirect.upsert({
    where: { fromPath: "/old-homepage" },
    update: {},
    create: { fromPath: "/old-homepage", toPath: "/", statusCode: 301 },
  });

  console.log("✓ seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

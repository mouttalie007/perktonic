/**
 * ViralTrendly — database seed.
 *
 * Two parts:
 *   1. STRUCTURAL (keep): singleton settings, categories, ad-placement slots,
 *      the default editorial author, and the legal/trust page shells.
 *   2. DEMO CONTENT (removable): a handful of published articles + one listicle
 *      + randomized engagement, so Phases 1–9 have something to render.
 *      Delete these from the Admin Dashboard once real content exists, run
 *      `npm run db:reset`, or — for a real deploy — just never seed them:
 *      `npm run db:seed:prod` (this same script with `--production`) skips
 *      this whole section. Never run the plain `db:seed` against a
 *      production database; it would publish 11 fake articles, fake
 *      comments and randomized reaction counts onto the real site.
 *
 * Idempotent: everything is upserted by a natural key, so re-running is safe.
 */

import { PrismaClient, type Prisma, type ReactionEmoji } from "@prisma/client";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// CLI flag, not an env var — package.json scripts stay portable across
// shells this way (no cross-env dependency, no cmd.exe vs bash inline-
// VAR=value mismatch).
const isProduction = process.argv.includes("--production");

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

// accentColor: used only as text color (category labels on the homepage
// feed/trending rail) — every value below is a Tailwind 700/800-depth shade,
// chosen because that tier reliably clears WCAG AA (~4.5:1) against a white
// background at small bold text sizes. Never use these as a background
// fill with light text — pair backgrounds with dark text instead (see the
// brand-yellow contrast note in globals.css for why that distinction matters).
const CATEGORIES: {
  slug: string;
  name: string;
  iconKey: string;
  shortDescription: string;
  description: string;
  accentColor: string;
}[] = [
  { slug: "viral", name: "Viral", iconKey: "flame", shortDescription: "Hot stories", description: "The stories everyone is talking about right now.", accentColor: "#B91C1C" },
  { slug: "people", name: "People", iconKey: "users", shortDescription: "Celebrities & influencers", description: "Profiles and talking points from the people shaping culture.", accentColor: "#6D28D9" },
  { slug: "tech", name: "Tech", iconKey: "cpu", shortDescription: "Innovation & AI", description: "How technology and AI are reshaping the way we live and work.", accentColor: "#1D4ED8" },
  { slug: "lifestyle", name: "Lifestyle", iconKey: "coffee", shortDescription: "Live better", description: "Ideas and small changes for a better everyday life.", accentColor: "#BE185D" },
  { slug: "entertainment", name: "Entertainment", iconKey: "film", shortDescription: "Movies, music & more", description: "The latest from film, TV, music and streaming.", accentColor: "#7E22CE" },
  { slug: "travel", name: "Travel", iconKey: "plane", shortDescription: "Discover the world", description: "Destinations, guides and the places worth seeing.", accentColor: "#0F766E" },
  { slug: "health", name: "Health", iconKey: "heart", shortDescription: "Tips for a healthier you", description: "Practical takes on nutrition, fitness, sleep and wellbeing.", accentColor: "#15803D" },
  { slug: "science", name: "Science", iconKey: "atom", shortDescription: "Discoveries & space", description: "Discoveries and research that change how we see the universe.", accentColor: "#0E7490" },
  { slug: "sports", name: "Sports", iconKey: "trophy", shortDescription: "The moments that matter", description: "Highlights, storylines and viral moments from sport.", accentColor: "#C2410C" },
  { slug: "amazing", name: "Amazing", iconKey: "sparkles", shortDescription: "Incredible facts", description: "Extraordinary facts, feats and stories worth a double take.", accentColor: "#92400E" },
  { slug: "food", name: "Food", iconKey: "utensils", shortDescription: "Eat well", description: "Recipes, trends and food stories worth a second look.", accentColor: "#BE123C" },
  { slug: "money", name: "Money", iconKey: "wallet", shortDescription: "Smarter with money", description: "Everyday money and the economy explained simply.", accentColor: "#047857" },
  { slug: "culture", name: "Culture", iconKey: "palette", shortDescription: "Art & ideas", description: "Art, books, internet culture and the ideas moving the conversation.", accentColor: "#A21CAF" },
  { slug: "world", name: "World", iconKey: "globe", shortDescription: "Around the globe", description: "Notable stories and human moments from around the world.", accentColor: "#4338CA" },
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

// Real editorial content for the trust/legal pages (spec §20-24). Written to
// read like an actual publication, not placeholder text. Templated legal
// language (privacy/terms/cookies) should still get a lawyer's review before
// a real launch — noted to the user separately, not on the page itself.
const LEGAL_PAGE_CONTENT: Record<string, string> = {
  about: `
<p>ViralTrendly is a digital magazine covering the stories, people and ideas the internet can't stop talking about — technology, entertainment, travel, health, science and the everyday moments that turn out to matter more than they first seemed.</p>
<h2>What we cover</h2>
<p>We publish across Viral, People, Tech, Lifestyle, Entertainment, Travel, Health, Science, Sports, Amazing, Food, Money, Culture and World. Some days that means the AI story everyone is sharing; other days it's a quiet travel guide to a place before it changes for good. The thread running through all of it is the same: is this genuinely interesting, and is it true?</p>
<h2>Our editorial philosophy</h2>
<p>We write for readers who are curious, not credulous. That means clear sourcing, no manufactured outrage, and headlines that promise what the article actually delivers. We would rather publish fewer stories we're confident in than chase every trend that crosses our feed.</p>
<h2>How stories are selected</h2>
<p>Our editors track what's genuinely trending — across search, social platforms and reader interest — and weigh that against newsworthiness, originality and whether we can add something a reader can't already get elsewhere. Stories move through drafting, editing and a final accuracy pass before they publish.</p>
<h2>Editorial independence</h2>
<p>Our reporting and recommendations are not for sale. Where an article involves a paid partnership or sponsored content, it is clearly labelled as such — see our <a href="/editorial-policy">Editorial Policy</a>. Advertising on ViralTrendly is served separately from our editorial content and never disguised as an article.</p>
<h2>Get in touch</h2>
<p>Questions, corrections or story tips: use our <a href="/contact">Contact</a> page. Interested in writing for us? See <a href="/write-for-us">Write for Us</a>.</p>`.trim(),

  contact: `<p>Have a question, a correction to flag, or a story we should know about? Fill out the form below and a member of the ViralTrendly team will get back to you. For editorial submissions, see <a href="/write-for-us">Write for Us</a> instead — it'll get to the right person faster.</p>`.trim(),

  "privacy-policy": `
<p>This Privacy Policy explains what information ViralTrendly ("we", "us") collects when you visit viraltrendly.com, how we use it, and the choices you have.</p>
<h2>Information we collect</h2>
<ul>
<li><strong>Usage data</strong> — pages viewed, general location (country/region), device and browser type, collected via analytics tools once you consent to them.</li>
<li><strong>Newsletter</strong> — your email address, if you subscribe, used only to send you our newsletter.</li>
<li><strong>Contact form</strong> — your name, email address and message, used only to respond to you.</li>
<li><strong>Cookies</strong> — see our <a href="/cookie-policy">Cookie Policy</a> for the full breakdown of necessary, analytics, advertising and preference cookies.</li>
</ul>
<h2>How we use it</h2>
<p>To operate and improve the site, to send the newsletter to those who asked for it, to respond to enquiries, and to serve advertising (where consented to) that helps keep ViralTrendly free to read.</p>
<h2>Advertising</h2>
<p>We use Google AdSense and may work with other advertising partners. These partners may use cookies to serve ads based on your prior visits to this and other websites. Where required by law, non-essential advertising and analytics cookies are only set after you consent via our cookie banner.</p>
<h2>Your rights</h2>
<p>Depending on where you live, you may have the right to access, correct, delete or export your personal data, and to withdraw consent to non-essential cookies at any time. To exercise any of these rights, contact us via the <a href="/contact">Contact page</a>.</p>
<h2>Data retention</h2>
<p>We keep newsletter and contact-form data only as long as needed for the purpose it was collected for, or until you ask us to delete it.</p>
<h2>Changes to this policy</h2>
<p>We may update this policy from time to time. Material changes will be reflected by an updated date on this page.</p>
<h2>Contact</h2>
<p>Questions about this policy: use our <a href="/contact">Contact page</a>.</p>`.trim(),

  "terms-of-service": `
<p>By accessing or using viraltrendly.com, you agree to these Terms of Service. If you do not agree, please do not use the site.</p>
<h2>Use of the site</h2>
<p>You may use ViralTrendly for personal, non-commercial purposes. You agree not to misuse the site, attempt to disrupt its operation, scrape content at scale, or use it to distribute unlawful, harmful or infringing material.</p>
<h2>Content ownership</h2>
<p>Articles, images and other content published on ViralTrendly are owned by ViralTrendly or its licensors, unless otherwise credited. You may share links to our articles freely; republishing our content in full requires our prior written permission.</p>
<h2>Third-party links and embeds</h2>
<p>Our articles may link to or embed content from third-party sites. We are not responsible for the content, accuracy or practices of external sites we link to.</p>
<h2>No professional advice</h2>
<p>Content on ViralTrendly — including in Health, Money and similar categories — is provided for general informational purposes only and is not a substitute for professional medical, financial, legal or other advice.</p>
<h2>Disclaimer of warranties</h2>
<p>The site is provided "as is" without warranties of any kind. We do not guarantee the site will be error-free, uninterrupted, or that any information is complete or current.</p>
<h2>Limitation of liability</h2>
<p>To the fullest extent permitted by law, ViralTrendly is not liable for any indirect, incidental or consequential damages arising from your use of the site.</p>
<h2>Changes</h2>
<p>We may revise these terms from time to time. Continued use of the site after changes take effect constitutes acceptance of the revised terms.</p>
<h2>Contact</h2>
<p>Questions about these terms: use our <a href="/contact">Contact page</a>.</p>`.trim(),

  "cookie-policy": `
<p>ViralTrendly uses cookies and similar technologies to run the site, understand how it's used, and — where you consent — to support advertising. This page explains what we use and why.</p>
<h2>Necessary</h2>
<p>Required for the site to function — for example, remembering your cookie preferences. These cannot be switched off.</p>
<h2>Analytics</h2>
<p>Help us understand which stories and pages are useful, so we can improve the site. Only set once you consent.</p>
<h2>Advertising</h2>
<p>Used by our advertising partners, including Google AdSense, to make the ads you see more relevant and to measure their performance. Only set once you consent.</p>
<h2>Preferences</h2>
<p>Remember choices you've made, such as dismissing a banner, so we don't ask again unnecessarily.</p>
<h2>Managing your choices</h2>
<p>You can change your cookie preferences at any time via the cookie settings link in the site footer, or by adjusting your browser settings to block or delete cookies. Blocking necessary cookies may affect how the site works.</p>
<h2>Contact</h2>
<p>Questions about this policy: use our <a href="/contact">Contact page</a>.</p>`.trim(),

  "write-for-us": `
<p>ViralTrendly accepts pitches and original articles from freelance writers who can back up a compelling story with real reporting. Here's what we're looking for and how to reach us.</p>
<h2>What we accept</h2>
<ul>
<li>Original, previously unpublished articles — long-form features and Top-N/list-style pieces alike.</li>
<li>Stories across our categories: Viral, People, Tech, Lifestyle, Entertainment, Travel, Health, Science, Sports, Amazing, Food, Money, Culture, World.</li>
<li>Clear sourcing for any claim, quote or statistic.</li>
</ul>
<h2>Editorial standards</h2>
<p>We fact-check before publishing and may ask for sources during editing. Articles should have a clear point of view without misrepresenting facts, and should credit any image, quote or data pulled from elsewhere.</p>
<h2>Originality</h2>
<p>We only publish work written for ViralTrendly. Do not submit anything published elsewhere (including on your own blog) or generated wholesale by AI and presented as original reporting — see our <a href="/editorial-policy">Editorial Policy</a> on AI-assisted content.</p>
<h2>How to submit</h2>
<p>Send a short pitch (2-3 sentences on the story and why it's timely) or a finished draft via our <a href="/contact">Contact page</a>, with "Write for Us" in the subject line. Include any relevant links or past writing samples.</p>`.trim(),

  advertise: `
<p>ViralTrendly reaches readers who come to us specifically because they want to know what's trending — across tech, culture, travel, health and more. Here's how to reach them.</p>
<h2>Ad formats</h2>
<p>We run standard display advertising (leaderboard, in-content and sidebar placements) through Google AdSense, sized and placed so they never disguise themselves as editorial content or interfere with navigation. Native/sponsored content opportunities may also be available and are always clearly labelled as sponsored.</p>
<h2>Our audience</h2>
<p>Readers come to ViralTrendly for trending stories across viral news, people, technology, lifestyle, entertainment, travel and health — an audience that's curious, mobile-first and engaged with what's happening right now.</p>
<h2>Editorial separation</h2>
<p>Advertising never influences our editorial coverage. See our <a href="/editorial-policy">Editorial Policy</a> for how we handle sponsored content disclosure.</p>
<h2>Get in touch</h2>
<p>For advertising and partnership enquiries, use our <a href="/contact">Contact page</a> with "Advertising" in the subject line and a brief description of what you're looking for.</p>`.trim(),

  "editorial-policy": `
<p>This policy explains the standards ViralTrendly holds its content to.</p>
<h2>Accuracy</h2>
<p>We aim to get every fact right the first time. Claims, quotes and statistics are checked against original or credible sources before publication.</p>
<h2>Corrections</h2>
<p>When we get something wrong, we fix it. Factual corrections are made to the article as soon as they're confirmed; for significant corrections, we note what changed and when. To flag a possible error, use our <a href="/contact">Contact page</a>.</p>
<h2>Sources</h2>
<p>Where practical, we link to the original source of a claim, study or quote so readers can verify it themselves.</p>
<h2>Original reporting</h2>
<p>We do not scrape or republish other outlets' work. Articles are written for ViralTrendly; where we reference reporting from elsewhere, it is credited and linked.</p>
<h2>Attribution and image rights</h2>
<p>Images are used under license, with appropriate permission, or are credited to their source/photographer. If you believe an image on ViralTrendly is used without proper rights, contact us and we will investigate promptly.</p>
<h2>AI-assisted content</h2>
<p>We may use AI tools to assist with research, drafting or editing efficiency, but every article is reviewed, fact-checked and edited by our editorial team before publication. We do not publish unreviewed AI-generated content as original reporting.</p>
<h2>Editorial independence</h2>
<p>Advertisers and partners have no influence over our editorial coverage or story selection.</p>
<h2>Sponsored content</h2>
<p>Any paid or sponsored content is clearly labelled as such and is held to the same accuracy standards as our regular editorial content.</p>`.trim(),

  disclaimer: `
<p>The information published on ViralTrendly is provided for general informational and entertainment purposes only.</p>
<h2>No professional advice</h2>
<p>Nothing on this site — including content in our Health, Money and Lifestyle categories — constitutes medical, legal, financial or other professional advice. Always seek the guidance of a qualified professional for decisions that affect your health, finances or legal standing.</p>
<h2>Accuracy</h2>
<p>While we work to keep our content accurate and current, we make no warranties about the completeness or reliability of any information on the site, and any reliance you place on it is at your own risk.</p>
<h2>External links</h2>
<p>ViralTrendly may link to third-party websites or embed third-party content. We do not control and are not responsible for the content, accuracy or practices of those external sites.</p>
<h2>Viral/trending content</h2>
<p>Where we report on viral videos, claims or social media posts, we do so as commentary on a cultural moment; we are not able to independently verify every underlying claim made in third-party content we discuss.</p>
<h2>Contact</h2>
<p>Questions about this disclaimer: use our <a href="/contact">Contact page</a>.</p>`.trim(),

  accessibility: `
<p>ViralTrendly is committed to making our site usable by as many people as possible, including people with disabilities.</p>
<h2>Our approach</h2>
<p>We aim to meet WCAG 2.2 Level AA guidelines across the site — semantic HTML, keyboard navigation, visible focus states, sufficient color contrast, descriptive alt text on images, and support for reduced-motion preferences.</p>
<h2>Ongoing work</h2>
<p>Accessibility is an ongoing effort rather than a one-time project. As we add new features, we review them against these same standards.</p>
<h2>Let us know</h2>
<p>If you encounter a barrier using ViralTrendly, we want to hear about it. Contact us via the <a href="/contact">Contact page</a> with details of the issue and the page it occurred on, and we'll look into it.</p>`.trim(),
};

const LEGAL_PAGE_META: Record<string, string> = {
  about: "What ViralTrendly covers, how we select stories, and our editorial philosophy.",
  contact: "Get in touch with the ViralTrendly team — questions, corrections and story tips.",
  "privacy-policy": "How ViralTrendly collects, uses and protects your information.",
  "terms-of-service": "The terms that govern your use of viraltrendly.com.",
  "cookie-policy": "The necessary, analytics, advertising and preference cookies ViralTrendly uses.",
  "write-for-us": "How to pitch or submit an article to ViralTrendly.",
  advertise: "Advertising formats, audience and how to reach the ViralTrendly team.",
  "editorial-policy": "ViralTrendly's standards on accuracy, sourcing, corrections and sponsored content.",
  disclaimer: "Important information about the content published on ViralTrendly.",
  accessibility: "ViralTrendly's commitment to an accessible site for all readers.",
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
        accentColor: c.accentColor,
        order: i,
      },
      create: {
        slug: c.slug,
        name: c.name,
        iconKey: c.iconKey,
        shortDescription: c.shortDescription,
        description: c.description,
        accentColor: c.accentColor,
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

  console.log("→ admin user");
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "mouttaliof@gmail.com";
  const existingAdmin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existingAdmin) {
    console.log(`  already exists (${ADMIN_EMAIL}) — left untouched`);
  } else {
    // Dev keeps a fixed, documented password for convenience. Production
    // gets a fresh random one, printed exactly once below — never written
    // to a file, never reused across deploys.
    const password = isProduction
      ? randomBytes(15).toString("base64url")
      : "ViralTrendly#2026";
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        name: "Iyad Ziyad",
        role: "ADMIN",
        passwordHash: await bcrypt.hash(password, 12),
      },
    });
    if (isProduction) {
      console.log("\n" + "=".repeat(64));
      console.log("  ADMIN LOGIN — shown once, save it now:");
      console.log(`    Email:    ${ADMIN_EMAIL}`);
      console.log(`    Password: ${password}`);
      console.log("  Change it immediately: /admin -> My Account.");
      console.log("=".repeat(64) + "\n");
    } else {
      console.log(`  created (${ADMIN_EMAIL} / ViralTrendly#2026 — change this)`);
    }
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
  const sitemapContent = `
<p>A quick guide to the main sections of ViralTrendly. The full machine-readable sitemap is at <a href="/sitemap.xml">/sitemap.xml</a>.</p>
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

  for (const [i, p] of LEGAL_PAGES.entries()) {
    const content =
      p.slug === "sitemap" ? sitemapContent : (LEGAL_PAGE_CONTENT[p.slug] ?? `<p>${p.title} content is managed from the Admin Dashboard.</p>`);
    const metaDescription = LEGAL_PAGE_META[p.slug];
    await prisma.page.upsert({
      where: { slug: p.slug },
      update: { content, metaDescription },
      create: {
        slug: p.slug,
        title: p.title,
        footerColumn: p.footerColumn,
        order: i,
        status: "PUBLISHED",
        content,
        metaDescription,
      },
    });
  }

  if (isProduction) {
    console.log("→ skipping demo articles/listicle/engagement/redirect (--production)");
    console.log("✓ seed complete");
    return;
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

  // Random starting engagement (user request, 2026-09-12): "make the
  // like/reaction system default and random initially for each post so it
  // shows up and we can test it." Reactions are re-randomized on every seed
  // run (that's the point — quick, repeatable test data); sample comments
  // are only added once per article so re-seeding doesn't pile up
  // duplicates.
  console.log("→ demo engagement (reactions + comments)");
  const REACTION_EMOJIS: ReactionEmoji[] = [
    "LAUGH",
    "LOVE",
    "WOW",
    "ANGRY",
    "SAD",
  ];
  const SAMPLE_COMMENTS: { name: string; body: string }[] = [
    { name: "Jordan M.", body: "This is exactly what I needed to read today, thanks for putting it together." },
    { name: "Casey R.", body: "Wait, #3 actually surprised me — did not see that coming." },
    { name: "Alex P.", body: "Sharing this with everyone I know, way too relatable." },
    { name: "Sam T.", body: "Great write-up, would love a follow-up on this." },
  ];
  const allArticles = await prisma.article.findMany({ select: { id: true } });
  for (const { id: articleId } of allArticles) {
    for (const emoji of REACTION_EMOJIS) {
      // Skewed toward small numbers with the occasional popular outlier —
      // more realistic than a flat random range for a "trending" feel.
      const count = Math.random() < 0.75
        ? Math.floor(Math.random() * 12)
        : Math.floor(Math.random() * 90) + 12;
      if (count === 0) continue;
      await prisma.articleReaction.upsert({
        where: { articleId_emoji: { articleId, emoji } },
        update: { count },
        create: { articleId, emoji, count },
      });
    }

    const existingComments = await prisma.comment.count({ where: { articleId } });
    if (existingComments === 0) {
      const n = Math.floor(Math.random() * 3) + 1; // 1-3 sample comments
      const picks = [...SAMPLE_COMMENTS].sort(() => Math.random() - 0.5).slice(0, n);
      for (const c of picks) {
        await prisma.comment.create({
          data: { articleId, name: c.name, body: c.body, status: "APPROVED" },
        });
      }
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

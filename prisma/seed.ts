/**
 * PerkTonic — database seed.
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
  seoTitle: string;
  metaDescription: string;
}[] = [
  {
    slug: "free-samples",
    name: "Free Samples & Products",
    iconKey: "gift",
    shortDescription: "Real freebies, verified",
    description: "Most \"free\" offers online are traps, but a few programs really do send products to your door. Here is how to find them, qualify, and avoid the scams.",
    accentColor: "#047857",
    seoTitle: "Free Samples & Products: Legit Ways to Get Them (2026)",
    metaDescription: "Find legit free samples and products to try or review. Real programs, honest tips, and how to spot fake freebie offers before you click.",
  },
  {
    slug: "ai-tools",
    name: "Internet Secrets & AI Tools",
    iconKey: "cpu",
    shortDescription: "Hidden tools & AI tricks",
    description: "The web is full of powerful tools hiding in plain sight. We test them, keep the ones that genuinely save time, and show you how to use them in minutes.",
    accentColor: "#1D4ED8",
    seoTitle: "Internet Secrets & Free AI Tools Worth Using",
    metaDescription: "Hidden Google features, free AI tools that rival paid software, and surprisingly useful websites most people never find. Updated regularly.",
  },
  {
    slug: "rewards-perks",
    name: "Rewards, Trials & Digital Perks",
    iconKey: "trophy",
    shortDescription: "Gift cards, trials & perks",
    description: "Not every free trial or reward is worth the hassle. We list the ones with fair terms, tell you the catch up front, and show you how to cancel before you pay.",
    accentColor: "#6D28D9",
    seoTitle: "Free Trials, Rewards & Digital Perks That Are Worth It",
    metaDescription: "Real rewards, student software offers and free trials worth your time, plus how to cancel before you're charged. No gimmicks, just clear steps.",
  },
  {
    slug: "money-saving",
    name: "Money-Saving Guides",
    iconKey: "wallet",
    shortDescription: "Smarter spending",
    description: "Small tricks add up: price trackers, coupon tools and discounts you may already qualify for. Each guide shows the exact steps and what you can realistically save.",
    accentColor: "#92400E",
    seoTitle: "Money-Saving Guides: Hidden Discounts & Deals Online",
    metaDescription: "Find hidden discounts, price history tools, coupon extensions and student or teacher deals. Practical ways to save money online.",
  },
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
<p>PerkTonic exists for one reason: to help you find the good stuff online without wasting time on scams, clickbait and "free" offers that are not free.</p>
<h2>What we cover</h2>
<p>We cover four areas: legit free samples and products, internet secrets and free AI tools, rewards and free trials, and practical ways to save money online. Some days that means a genuinely useful free AI tool most people have never heard of; other days it's a free-sample program worth your time, or the exact steps to cancel a trial before it charges you.</p>
<h2>How we work</h2>
<ul>
<li>We check every offer ourselves, or clearly say when we have not.</li>
<li>We explain the conditions and the catch up front.</li>
<li>We show a "Last updated" date on every article and re-check offers regularly.</li>
<li>We never promise results we cannot support.</li>
</ul>
<h2>Editorial independence</h2>
<p>Our recommendations are not for sale. Where an article contains affiliate links or sponsored content, it is clearly labelled as such — see our <a href="/editorial-policy">Editorial Policy</a> and <a href="/affiliate-disclosure">Affiliate Disclosure</a>. Advertising on PerkTonic is served separately from our editorial content and never disguised as an article.</p>
<h2>Get in touch</h2>
<p>Found a broken offer or have a tip? Use our <a href="/contact">Contact</a> page. Interested in writing for us? See <a href="/write-for-us">Write for Us</a>.</p>`.trim(),

  contact: `
<p>We read every message. Typical reply time: <strong>2 to 3 business days</strong>.</p>
<ul>
<li><strong>General questions and corrections:</strong> contact@perktonic.com</li>
<li><strong>Business and partnerships:</strong> contact@perktonic.com (subject: "Partnership")</li>
<li><strong>Report a broken or suspicious offer:</strong> use the form below and include the link.</li>
</ul>
<p>We do not provide personal financial advice.</p>`.trim(),

  "privacy-policy": `
<p>This Privacy Policy explains what information PerkTonic ("we", "us") collects when you visit perktonic.com, how we use it, and the choices you have.</p>
<h2>Information we collect</h2>
<ul>
<li><strong>Usage data</strong> — pages viewed, general location (country/region), device and browser type, collected via analytics tools once you consent to them.</li>
<li><strong>Newsletter</strong> — your email address, if you subscribe, used only to send you our newsletter.</li>
<li><strong>Contact form</strong> — your name, email address and message, used only to respond to you.</li>
<li><strong>Cookies</strong> — see our <a href="/cookie-policy">Cookie Policy</a> for the full breakdown of necessary, analytics, advertising and preference cookies.</li>
</ul>
<h2>How we use it</h2>
<p>To operate and improve the site, to send the newsletter to those who asked for it, to respond to enquiries, and to serve advertising (where consented to) that helps keep PerkTonic free to read.</p>
<h2>Advertising</h2>
<p>We use Google AdSense and may work with other advertising partners. These partners may use cookies to serve ads based on your prior visits to this and other websites. Where required by law, non-essential advertising and analytics cookies are only set after you consent via our cookie banner.</p>
<h2>Affiliate links</h2>
<p>Some links on PerkTonic may be affiliate links. We may earn a commission if you click through and sign up or buy, at no extra cost to you. See our <a href="/affiliate-disclosure">Affiliate Disclosure</a>.</p>
<h2>Your rights</h2>
<p>Depending on where you live, you may have the right to access, correct, delete or export your personal data, and to withdraw consent to non-essential cookies at any time. To exercise any of these rights, contact us via the <a href="/contact">Contact page</a>.</p>
<h2>Data retention</h2>
<p>We keep newsletter and contact-form data only as long as needed for the purpose it was collected for, or until you ask us to delete it.</p>
<h2>Changes to this policy</h2>
<p>We may update this policy from time to time. Material changes will be reflected by an updated date on this page.</p>
<h2>Contact</h2>
<p>Questions about this policy: use our <a href="/contact">Contact page</a>.</p>`.trim(),

  "terms-of-service": `
<p>By accessing or using perktonic.com, you agree to these Terms of Service. If you do not agree, please do not use the site.</p>
<h2>Use of the site</h2>
<p>You may use PerkTonic for personal, non-commercial purposes. You agree not to misuse the site, attempt to disrupt its operation, scrape content at scale, or use it to distribute unlawful, harmful or infringing material.</p>
<h2>Content ownership</h2>
<p>Articles, images and other content published on PerkTonic are owned by PerkTonic or its licensors, unless otherwise credited. You may share links to our articles freely; republishing our content in full requires our prior written permission.</p>
<h2>Third-party links, offers and embeds</h2>
<p>Our articles link to third-party websites, programs and offers, and may embed third-party content. We do not control them and are not responsible for their content, terms, availability or practices. Any agreement you make with a third party is between you and them.</p>
<h2>No professional advice, no guarantees</h2>
<p>Content on PerkTonic — including guidance on free samples, AI tools, rewards, trials and savings — is provided for general informational purposes only and is not a substitute for professional financial, legal or other advice. We do not guarantee that you will qualify for, receive or benefit from any offer, sample, reward, trial or discount mentioned on the site.</p>
<h2>Disclaimer of warranties</h2>
<p>The site is provided "as is" without warranties of any kind. We do not guarantee the site will be error-free, uninterrupted, or that any information is complete or current.</p>
<h2>Limitation of liability</h2>
<p>To the fullest extent permitted by law, PerkTonic is not liable for any indirect, incidental or consequential damages arising from your use of the site.</p>
<h2>Changes</h2>
<p>We may revise these terms from time to time. Continued use of the site after changes take effect constitutes acceptance of the revised terms.</p>
<h2>Contact</h2>
<p>Questions about these terms: use our <a href="/contact">Contact page</a>.</p>`.trim(),

  "cookie-policy": `
<p><strong>Last updated:</strong> October 8, 2026</p>
<h2>What are cookies?</h2>
<p>Cookies are small text files stored on your device when you visit a website. They help the site work, remember your choices and measure how it is used.</p>
<h2>Cookies we use</h2>
<table>
<thead><tr><th>Category</th><th>Purpose</th><th>Examples</th><th>Consent needed</th></tr></thead>
<tbody>
<tr><td>Strictly necessary</td><td>Security, load balancing, remembering your cookie choice</td><td>Consent cookie, session cookies</td><td>No</td></tr>
<tr><td>Analytics</td><td>Understand traffic and improve content</td><td>Google Analytics (<code>_ga</code>, <code>_ga_*</code>)</td><td>Yes</td></tr>
<tr><td>Advertising</td><td>Show and measure ads, limit repeats, prevent fraud</td><td>Google AdSense / Google Ad Manager cookies</td><td>Yes</td></tr>
<tr><td>Functionality</td><td>Remember preferences</td><td>Theme or language settings</td><td>Yes</td></tr>
</tbody>
</table>
<h2>Managing your choices</h2>
<ul>
<li>Use the <strong>cookie banner</strong> or the "Cookie settings" link in the footer to change or withdraw consent at any time.</li>
<li>You can also block or delete cookies in your browser settings. Some parts of the site may not work properly without them.</li>
<li>Opt out of personalised ads: <a href="https://adssettings.google.com">Google Ads Settings</a> and <a href="https://www.aboutads.info">aboutads.info</a>.</li>
</ul>
<h2>Contact</h2>
<p>contact@perktonic.com</p>`.trim(),

  "write-for-us": `
<p>PerkTonic accepts pitches and original articles from freelance writers who can back up a guide with real, verified research. Here's what we're looking for and how to reach us.</p>
<h2>What we accept</h2>
<ul>
<li>Original, previously unpublished articles — long-form guides and Top-N/list-style pieces alike.</li>
<li>Stories across our categories: Free Samples &amp; Products, Internet Secrets &amp; AI Tools, Rewards, Trials &amp; Digital Perks, and Money-Saving Guides.</li>
<li>Clear sourcing for any claim, and first-hand verification of every offer, tool or discount mentioned.</li>
</ul>
<h2>Editorial standards</h2>
<p>We fact-check before publishing and may ask for sources during editing. Articles should state the real conditions and "the catch" up front, and should credit any image, quote or data pulled from elsewhere.</p>
<h2>Originality</h2>
<p>We only publish work written for PerkTonic. Do not submit anything published elsewhere (including on your own blog) or generated wholesale by AI and presented as original reporting — see our <a href="/editorial-policy">Editorial Policy</a> on AI-assisted content.</p>
<h2>How to submit</h2>
<p>Send a short pitch (2-3 sentences on the story and why it's timely) or a finished draft via our <a href="/contact">Contact page</a>, with "Write for Us" in the subject line. Include any relevant links or past writing samples.</p>`.trim(),

  advertise: `
<p>PerkTonic reaches readers actively looking for verified free samples, AI tools, rewards and ways to save money online. Here's how to reach them.</p>
<h2>Ad formats</h2>
<p>We run standard display advertising (leaderboard, in-content and sidebar placements) through Google AdSense, sized and placed so they never disguise themselves as editorial content or interfere with navigation. Native/sponsored content opportunities may also be available and are always clearly labelled as sponsored.</p>
<h2>Our audience</h2>
<p>Readers come to PerkTonic specifically to find and verify an offer before acting on it — an audience that's deal-motivated, mobile-first and ready to click through once something checks out.</p>
<h2>Editorial separation</h2>
<p>Advertising never influences our editorial coverage. See our <a href="/editorial-policy">Editorial Policy</a> for how we handle sponsored content disclosure.</p>
<h2>Get in touch</h2>
<p>For advertising and partnership enquiries, use our <a href="/contact">Contact page</a> with "Advertising" in the subject line and a brief description of what you're looking for.</p>`.trim(),

  "editorial-policy": `
<h2>Our standards</h2>
<ul>
<li><strong>Accuracy first.</strong> We verify offers on the provider's official page and note the date we checked.</li>
<li><strong>First-hand testing.</strong> When we test a tool or program ourselves, we say so and show screenshots. When we have not, we say that too.</li>
<li><strong>Transparent conditions.</strong> Every offer includes requirements, limits, costs and "the catch".</li>
<li><strong>Independence.</strong> Ads and affiliate relationships never influence our conclusions.</li>
<li><strong>Original work.</strong> We write our own content. AI tools may assist with research or drafting, but every article is reviewed, edited and fact-checked by a human before publication.</li>
<li><strong>Sources.</strong> We link to official sources and credit others when we use their information.</li>
</ul>
<h2>Updates and corrections</h2>
<ul>
<li>Articles show a <strong>"Last updated"</strong> date and are reviewed at least every 6 months.</li>
<li>Outdated offers are updated or removed.</li>
<li>Found a mistake? Email contact@perktonic.com. We correct confirmed errors quickly and note significant corrections.</li>
</ul>
<h2>What we do not publish</h2>
<p>Fake giveaways, misleading "free money" claims, adult or illegal content, pirated software, or anything that requires you to share sensitive financial credentials.</p>`.trim(),

  disclaimer: `
<p><strong>Last updated:</strong> October 8, 2026</p>
<ul>
<li><strong>General information only.</strong> Content on PerkTonic is for informational and educational purposes. It is not professional financial, legal, tax or investment advice.</li>
<li><strong>Accuracy.</strong> We work hard to keep information accurate and up to date, but offers, availability, eligibility, prices and terms change without notice. Always check the official provider's website before you act.</li>
<li><strong>Results vary.</strong> Savings, rewards and outcomes described are examples, not promises.</li>
<li><strong>Third parties.</strong> We are not affiliated with, endorsed by or sponsored by the companies we mention unless clearly stated. Trademarks belong to their owners.</li>
<li><strong>External links.</strong> We are not responsible for the content or practices of external sites.</li>
<li><strong>Affiliate links and ads.</strong> The site may earn money through advertising and affiliate commissions. See our <a href="/affiliate-disclosure">Affiliate &amp; Advertising Disclosure</a>.</li>
<li><strong>Use at your own risk.</strong> You are responsible for your decisions and for reading the terms of any offer, trial or service before signing up.</li>
</ul>`.trim(),

  "affiliate-disclosure": `
<p><strong>Last updated:</strong> October 8, 2026</p>
<p>PerkTonic is free to read. We earn money in two ways:</p>
<ol>
<li><strong>Advertising.</strong> We display ads, including Google AdSense. Ads are labeled and separate from our editorial content.</li>
<li><strong>Affiliate links.</strong> Some links may be affiliate links: if you click and sign up or buy, we may earn a commission <strong>at no extra cost to you</strong>.</li>
</ol>
<h2>Our promise</h2>
<ul>
<li>Compensation never decides what we recommend or how we rate it.</li>
<li>We clearly mark sponsored or affiliate content near the top of the article.</li>
<li>We never ask you to click ads and never place content that encourages accidental clicks.</li>
<li>We only recommend offers we believe are legitimate and useful.</li>
</ul>`.trim(),

  dmca: `
<p>PerkTonic respects intellectual property rights. If you believe content on this site infringes your copyright, email <strong>contact@perktonic.com</strong> with the subject "Copyright Notice" and include:</p>
<ol>
<li>Your name and contact details.</li>
<li>A description of the copyrighted work.</li>
<li>The exact URL of the content you believe infringes.</li>
<li>A statement that you act in good faith and that the information is accurate, and that you are the owner or authorized to act for the owner.</li>
<li>Your physical or electronic signature.</li>
</ol>
<p>We review valid notices promptly and remove or disable access to infringing content where appropriate.</p>`.trim(),

  accessibility: `
<p>PerkTonic is committed to making our site usable by as many people as possible, including people with disabilities.</p>
<h2>Our approach</h2>
<p>We aim to meet WCAG 2.2 Level AA guidelines across the site — semantic HTML, keyboard navigation, visible focus states, sufficient color contrast, descriptive alt text on images, and support for reduced-motion preferences.</p>
<h2>Ongoing work</h2>
<p>Accessibility is an ongoing effort rather than a one-time project. As we add new features, we review them against these same standards.</p>
<h2>Let us know</h2>
<p>If you encounter a barrier using PerkTonic, we want to hear about it. Contact us via the <a href="/contact">Contact page</a> with details of the issue and the page it occurred on, and we'll look into it.</p>`.trim(),
};

const LEGAL_PAGE_META: Record<string, string> = {
  about: "What PerkTonic covers, how we verify offers, and our editorial philosophy.",
  contact: "Contact the PerkTonic team for questions, corrections, tips or business inquiries. We reply within 2 to 3 business days.",
  "privacy-policy": "How PerkTonic collects, uses and protects your information.",
  "terms-of-service": "The terms that govern your use of perktonic.com.",
  "cookie-policy": "Which cookies PerkTonic uses, why we use them, and how you can accept, refuse or change your cookie choices at any time.",
  "write-for-us": "How to pitch or submit an article to PerkTonic.",
  advertise: "Advertising formats, audience and how to reach the PerkTonic team.",
  "editorial-policy": "Our standards for accuracy, testing, sources, updates, corrections and independence behind every PerkTonic article.",
  disclaimer: "Important information about the accuracy of PerkTonic content, third-party offers, affiliate links and the limits of our advice.",
  accessibility: "PerkTonic's commitment to an accessible site for all readers.",
  "affiliate-disclosure": "How PerkTonic earns money through ads and affiliate links, and why it never changes our honest opinions or recommendations.",
  dmca: "How to report copyright concerns about content on PerkTonic and how we handle removal requests.",
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
  { slug: "affiliate-disclosure", title: "Affiliate Disclosure", footerColumn: "resources" },
  { slug: "dmca", title: "DMCA & Copyright", footerColumn: "resources" },
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
        seoTitle: c.seoTitle,
        metaDescription: c.metaDescription,
        order: i,
      },
      create: {
        slug: c.slug,
        name: c.name,
        iconKey: c.iconKey,
        shortDescription: c.shortDescription,
        description: c.description,
        accentColor: c.accentColor,
        seoTitle: c.seoTitle,
        metaDescription: c.metaDescription,
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
      : "PerkTonic#2026";
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
      console.log("  Change it immediately: /adminiyad -> My Account.");
      console.log("=".repeat(64) + "\n");
    } else {
      console.log(`  created (${ADMIN_EMAIL} / PerkTonic#2026 — change this)`);
    }
  }

  console.log("→ authors");
  const AUTHORS = [
    {
      slug: "perktonic-editorial-team",
      name: "PerkTonic Editorial Team",
      role: "Editorial Team",
      bio: "Guides and deals researched, verified and written by the PerkTonic team.",
      avatarUrl: null as string | null,
    },
    {
      slug: "alex-carter",
      name: "Alex Carter",
      role: "Internet Secrets & AI Tools · Money-Saving Guides",
      bio: "Alex Carter hunts down the free AI tools, hidden internet tricks and the coupon and price-tracking tools that actually save money — then tests each one personally before writing about it. If it's free and genuinely useful, he wants to find it first.",
      avatarUrl: "/authors/alex-carter.png",
    },
    {
      slug: "mia-reynolds",
      name: "Mia Reynolds",
      role: "Free Samples & Products",
      bio: "Mia Reynolds requests the free samples and product-testing programs so you don't have to guess which ones are legit. She reads the fine print before she writes a word, and flags anything that smells like a scam before it reaches the page.",
      avatarUrl: "/authors/mia-reynolds.png",
    },
    {
      slug: "daniel-brooks",
      name: "Daniel Brooks",
      role: "Rewards, Trials & Digital Perks",
      bio: "Daniel Brooks specializes in the fine print behind rewards, gift cards and free trials — the cancellation steps, the eligibility rules, and the exact date a \"free\" trial turns into a charge. He got into this after one too many trials quietly billed him, and makes sure nobody else gets caught the same way.",
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
  const author = { id: authorBySlug.get("perktonic-editorial-team")! };

  // Which byline covers which category (spec §73 — publisher's own roster).
  const AUTHOR_FOR_CATEGORY: Record<string, string> = {
    "ai-tools": "alex-carter",
    "money-saving": "alex-carter",
    "free-samples": "mia-reynolds",
    "rewards-perks": "daniel-brooks",
  };
  const authorIdForCategory = (slug: string) =>
    authorBySlug.get(AUTHOR_FOR_CATEGORY[slug] ?? "perktonic-editorial-team") ??
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

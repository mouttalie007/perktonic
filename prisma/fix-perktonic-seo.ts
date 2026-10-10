/**
 * One-time data fix for the perktonic-seo.md "trust pack" pass (2026-10-08).
 *
 * Mirrors a round of edits made to prisma/seed.ts (category SEO fields,
 * Site/SeoSettings copy, and new/rewritten legal-page content) into a
 * database that was already seeded before those edits landed. A fresh
 * `db:seed` run picks all of this up automatically; this script exists only
 * to push the same values into a database that already has rows.
 *
 * Safe to run more than once (everything here is upsert/update by a unique
 * key). Does NOT touch About, Privacy Policy or Terms of Service — those
 * still need real business facts (legal entity name, country, founder bio)
 * before they can be rewritten; left as-is intentionally.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORY_SEO = [
  {
    slug: "free-samples",
    description: "Most \"free\" offers online are traps, but a few programs really do send products to your door. Here is how to find them, qualify, and avoid the scams.",
    seoTitle: "Free Samples & Products: Legit Ways to Get Them (2026)",
    metaDescription: "Find legit free samples and products to try or review. Real programs, honest tips, and how to spot fake freebie offers before you click.",
  },
  {
    slug: "ai-tools",
    description: "The web is full of powerful tools hiding in plain sight. We test them, keep the ones that genuinely save time, and show you how to use them in minutes.",
    seoTitle: "Internet Secrets & Free AI Tools Worth Using",
    metaDescription: "Hidden Google features, free AI tools that rival paid software, and surprisingly useful websites most people never find. Updated regularly.",
  },
  {
    slug: "rewards-perks",
    description: "Not every free trial or reward is worth the hassle. We list the ones with fair terms, tell you the catch up front, and show you how to cancel before you pay.",
    seoTitle: "Free Trials, Rewards & Digital Perks That Are Worth It",
    metaDescription: "Real rewards, student software offers and free trials worth your time, plus how to cancel before you're charged. No gimmicks, just clear steps.",
  },
  {
    slug: "money-saving",
    description: "Small tricks add up: price trackers, coupon tools and discounts you may already qualify for. Each guide shows the exact steps and what you can realistically save.",
    seoTitle: "Money-Saving Guides: Hidden Discounts & Deals Online",
    metaDescription: "Find hidden discounts, price history tools, coupon extensions and student or teacher deals. Practical ways to save money online.",
  },
];

const PAGES: {
  slug: string;
  title: string;
  footerColumn: string;
  order: number;
  content: string;
  metaDescription: string;
}[] = [
  {
    slug: "contact",
    title: "Contact",
    footerColumn: "quick-links",
    order: 1,
    content: `
<p>We read every message. Typical reply time: <strong>2 to 3 business days</strong>.</p>
<ul>
<li><strong>General questions and corrections:</strong> contact@perktonic.com</li>
<li><strong>Business and partnerships:</strong> contact@perktonic.com (subject: "Partnership")</li>
<li><strong>Report a broken or suspicious offer:</strong> use the form below and include the link.</li>
</ul>
<p>We do not provide personal financial advice.</p>`.trim(),
    metaDescription: "Contact the PerkTonic team for questions, corrections, tips or business inquiries. We reply within 2 to 3 business days.",
  },
  {
    slug: "cookie-policy",
    title: "Cookie Policy",
    footerColumn: "quick-links",
    order: 4,
    content: `
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
    metaDescription: "Which cookies PerkTonic uses, why we use them, and how you can accept, refuse or change your cookie choices at any time.",
  },
  {
    slug: "editorial-policy",
    title: "Editorial Policy",
    footerColumn: "resources",
    order: 8,
    content: `
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
    metaDescription: "Our standards for accuracy, testing, sources, updates, corrections and independence behind every PerkTonic article.",
  },
  {
    slug: "disclaimer",
    title: "Disclaimer",
    footerColumn: "resources",
    order: 9,
    content: `
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
    metaDescription: "Important information about the accuracy of PerkTonic content, third-party offers, affiliate links and the limits of our advice.",
  },
  {
    slug: "affiliate-disclosure",
    title: "Affiliate Disclosure",
    footerColumn: "resources",
    order: 11,
    content: `
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
    metaDescription: "How PerkTonic earns money through ads and affiliate links, and why it never changes our honest opinions or recommendations.",
  },
  {
    slug: "dmca",
    title: "DMCA & Copyright",
    footerColumn: "resources",
    order: 12,
    content: `
<p>PerkTonic respects intellectual property rights. If you believe content on this site infringes your copyright, email <strong>contact@perktonic.com</strong> with the subject "Copyright Notice" and include:</p>
<ol>
<li>Your name and contact details.</li>
<li>A description of the copyrighted work.</li>
<li>The exact URL of the content you believe infringes.</li>
<li>A statement that you act in good faith and that the information is accurate, and that you are the owner or authorized to act for the owner.</li>
<li>Your physical or electronic signature.</li>
</ol>
<p>We review valid notices promptly and remove or disable access to infringing content where appropriate.</p>`.trim(),
    metaDescription: "How to report copyright concerns about content on PerkTonic and how we handle removal requests.",
  },
];

async function main() {
  console.log("→ category SEO fields");
  for (const c of CATEGORY_SEO) {
    const r = await prisma.category.updateMany({
      where: { slug: c.slug },
      data: {
        description: c.description,
        seoTitle: c.seoTitle,
        metaDescription: c.metaDescription,
      },
    });
    console.log(`  ${c.slug}: updated ${r.count} row(s)`);
  }

  console.log("→ site settings");
  const siteUpdate = await prisma.siteSettings.updateMany({
    where: { id: "singleton" },
    data: { tagline: "Find the good stuff before everyone else does." },
  });
  console.log(`  updated ${siteUpdate.count} row(s)`);

  console.log("→ seo settings");
  const seoUpdate = await prisma.seoSettings.updateMany({
    where: { id: "singleton" },
    data: {
      defaultTitle: "PerkTonic: Free Stuff, Hidden Web Tricks & Smart Deals",
      defaultMetaDescription:
        "Discover free samples, hidden Google features, free AI tools, rewards and money-saving tricks. Honest, tested guides updated regularly.",
    },
  });
  console.log(`  updated ${seoUpdate.count} row(s)`);

  console.log("→ legal pages");
  for (const p of PAGES) {
    await prisma.page.upsert({
      where: { slug: p.slug },
      update: { content: p.content, metaDescription: p.metaDescription },
      create: {
        slug: p.slug,
        title: p.title,
        footerColumn: p.footerColumn,
        order: p.order,
        status: "PUBLISHED",
        content: p.content,
        metaDescription: p.metaDescription,
      },
    });
    console.log(`  ${p.slug}: upserted`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

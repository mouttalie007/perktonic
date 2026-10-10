/**
 * One-time data fix (2026-10-08, round 2): the remaining legal pages that
 * still had old ViralTrendly copy — About, Privacy Policy, Terms of
 * Service, Write for Us, Advertise, Accessibility. Mirrors the matching
 * edit made to prisma/seed.ts's LEGAL_PAGE_CONTENT/LEGAL_PAGE_META into the
 * database that was already seeded before this edit landed.
 *
 * Safe to run more than once (plain update by slug).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PAGES: { slug: string; content: string; metaDescription: string }[] = [
  {
    slug: "about",
    content: `
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
    metaDescription: "What PerkTonic covers, how we verify offers, and our editorial philosophy.",
  },
  {
    slug: "privacy-policy",
    content: `
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
    metaDescription: "How PerkTonic collects, uses and protects your information.",
  },
  {
    slug: "terms-of-service",
    content: `
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
    metaDescription: "The terms that govern your use of perktonic.com.",
  },
  {
    slug: "write-for-us",
    content: `
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
    metaDescription: "How to pitch or submit an article to PerkTonic.",
  },
  {
    slug: "advertise",
    content: `
<p>PerkTonic reaches readers actively looking for verified free samples, AI tools, rewards and ways to save money online. Here's how to reach them.</p>
<h2>Ad formats</h2>
<p>We run standard display advertising (leaderboard, in-content and sidebar placements) through Google AdSense, sized and placed so they never disguise themselves as editorial content or interfere with navigation. Native/sponsored content opportunities may also be available and are always clearly labelled as sponsored.</p>
<h2>Our audience</h2>
<p>Readers come to PerkTonic specifically to find and verify an offer before acting on it — an audience that's deal-motivated, mobile-first and ready to click through once something checks out.</p>
<h2>Editorial separation</h2>
<p>Advertising never influences our editorial coverage. See our <a href="/editorial-policy">Editorial Policy</a> for how we handle sponsored content disclosure.</p>
<h2>Get in touch</h2>
<p>For advertising and partnership enquiries, use our <a href="/contact">Contact page</a> with "Advertising" in the subject line and a brief description of what you're looking for.</p>`.trim(),
    metaDescription: "Advertising formats, audience and how to reach the PerkTonic team.",
  },
  {
    slug: "accessibility",
    content: `
<p>PerkTonic is committed to making our site usable by as many people as possible, including people with disabilities.</p>
<h2>Our approach</h2>
<p>We aim to meet WCAG 2.2 Level AA guidelines across the site — semantic HTML, keyboard navigation, visible focus states, sufficient color contrast, descriptive alt text on images, and support for reduced-motion preferences.</p>
<h2>Ongoing work</h2>
<p>Accessibility is an ongoing effort rather than a one-time project. As we add new features, we review them against these same standards.</p>
<h2>Let us know</h2>
<p>If you encounter a barrier using PerkTonic, we want to hear about it. Contact us via the <a href="/contact">Contact page</a> with details of the issue and the page it occurred on, and we'll look into it.</p>`.trim(),
    metaDescription: "PerkTonic's commitment to an accessible site for all readers.",
  },
];

async function main() {
  for (const p of PAGES) {
    const r = await prisma.page.updateMany({
      where: { slug: p.slug },
      data: { content: p.content, metaDescription: p.metaDescription },
    });
    console.log(`${p.slug}: updated ${r.count} row(s)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

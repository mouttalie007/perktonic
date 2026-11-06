/**
 * Rewrites the site pages that still describe the old "free samples / rewards" site, for the tools site.
 *   npx tsx --env-file=.env scripts/refresh-site-copy.mts
 * Idempotent and careful: a page is replaced only while it still holds the old text (so edits made in the admin are
 * kept), and the privacy and cookie pages only get one extra section, once.
 * Run it locally, then once on the server after the deploy.
 */
import { prisma } from "@/lib/prisma";

const OLD = /free samples|rewards|money-saving|giveaway|sponsored content/i;

const PAGES: Record<string, { meta: string; html: string }> = {
  about: {
    meta: "PerkTonic is a set of free online tools for spreadsheets, data, documents, automation and website checks, with short technical guides. No account needed.",
    html: `<p>PerkTonic is a collection of free online tools for people who work with spreadsheets, data, documents, automation and websites. Each tool solves one concrete problem, such as fixing a broken Excel formula, converting a CSV file or checking an SSL certificate, and comes with a short guide that explains how to use it.</p>
<h2>What you will find here</h2>
<ul>
<li><strong>Spreadsheet &amp; Formula Studio:</strong> generate, explain and debug Excel and Google Sheets formulas, macros and scripts.</li>
<li><strong>Data Cleaning &amp; File Converters:</strong> clean, compare, split and convert CSV, JSON, YAML and Markdown data.</li>
<li><strong>Document &amp; Text Intelligence:</strong> extract tables from PDFs and scans, pull data out of invoices and contracts, summarize and structure text.</li>
<li><strong>Workflow &amp; Automation Utilities:</strong> regular expressions, cron schedules, webhooks, JSONPath and diagrams.</li>
<li><strong>Web &amp; Network Diagnostics:</strong> redirects, headers, DNS, SSL, email authentication, broken links and server response time.</li>
</ul>
<h2>How the tools treat your data</h2>
<ul>
<li>Most tools run in your browser: your files and text do not leave your device.</li>
<li>Website checks send the address you type to our server, which fetches it for you.</li>
<li>The AI tools send your text to our server and to the AI provider only when you press the button, and every one of those pages says so.</li>
<li>No account is needed, and the page of each tool lists its limits.</li>
</ul>
<h2>How we work</h2>
<p>We test each tool with real examples, show its limits on its page, and fix what readers report. Our guides are technical and direct: they show the steps, the expected result and the common errors, with screenshots taken from the tool itself.</p>
<h2>Independence and advertising</h2>
<p>The tools are free to use. We may show advertising or affiliate links, always labelled and never inside a tool result. See our <a href="/editorial-policy">Editorial Policy</a> and <a href="/affiliate-disclosure">Affiliate Disclosure</a>.</p>
<h2>Get in touch</h2>
<p>Found a bug, a wrong result or a tool you would like to see? Use our <a href="/contact">Contact</a> page.</p>`,
  },
  "editorial-policy": {
    meta: "How PerkTonic writes and maintains its technical guides: tested steps, screenshots from the tools, official sources, update dates and corrections.",
    html: `<p>PerkTonic publishes technical guides that explain how to solve a specific problem with one of our tools or with a standard technique. This policy describes how those guides are made and kept accurate.</p>
<h2>What a guide must do</h2>
<ul>
<li>State the problem and the answer early, then show the steps.</li>
<li>Describe what the tool does today, with screenshots taken from the tool and examples that can be reproduced.</li>
<li>Say what the tool cannot do, and when a result needs to be checked by the reader.</li>
<li>Link to official documentation when it explains a standard or a behaviour (for example a spreadsheet function or a web standard).</li>
</ul>
<h2>AI features</h2>
<p>Some tools use an AI model. Their output can be wrong, so each of these tools shows what was checked by our own code and what was not, and asks the reader to verify the result before using it.</p>
<h2>Updates and corrections</h2>
<p>Guides show the date they were last updated, and we revise them when a tool or a standard changes. If you find a mistake, tell us through the <a href="/contact">Contact</a> page and we will correct it and update the date.</p>
<h2>Advertising and links</h2>
<p>Advertising and affiliate links never decide what a guide says or which tool it describes. Where a link earns us a commission, it is labelled: see the <a href="/affiliate-disclosure">Affiliate Disclosure</a>.</p>`,
  },
  disclaimer: {
    meta: "PerkTonic tools and guides are provided for information and as is: check results before you rely on them. They are not legal, financial or professional advice.",
    html: `<p>The tools and guides on PerkTonic are provided for general information and as they are, without any warranty.</p>
<h2>Check results before you rely on them</h2>
<p>Formulas, converted files, extracted tables, OCR text, summaries and every result produced with AI can contain mistakes. Test them on a copy of your data and check them before using them in a decision, a report or a production system.</p>
<h2>Not professional advice</h2>
<p>Nothing on this site is legal, financial, medical or other professional advice. In particular, the contract and invoice tools extract text and figures from the document you give them: they do not tell you whether a contract is valid or enforceable, and a qualified professional must review any contract.</p>
<h2>Website and security checks</h2>
<p>Diagnostic tools report what they can observe from our servers at one moment in time. A clean result does not prove that a site or a mail setup is secure or compliant.</p>
<h2>External links</h2>
<p>We link to official documentation and other sites for reference. We do not control them and are not responsible for their content.</p>
<h2>Limitation</h2>
<p>To the extent the law allows, PerkTonic is not liable for losses that come from using the tools or the guides. See our <a href="/terms-of-service">Terms of Service</a>.</p>`,
  },
  "terms-of-service": {
    meta: "The terms for using PerkTonic's free online tools and guides: acceptable use, usage limits, your content, AI results, warranty and liability.",
    html: `<p>By using PerkTonic.com you agree to these terms. If you do not agree, please do not use the site.</p>
<h2>The service</h2>
<p>PerkTonic offers free online tools and technical guides. We may change, limit or remove a tool at any time, and we may apply usage limits (for example a number of AI requests per ten minutes) to keep the service available to everyone.</p>
<h2>Acceptable use</h2>
<ul>
<li>Use the tools only for lawful purposes and only on data, files and websites you are allowed to use or check.</li>
<li>Do not attack, overload or probe our service or other people's systems with it, and do not use it for automated bulk requests that go beyond the stated limits.</li>
<li>Do not send secrets, passwords or personal data to the capture and monitoring tools unless you accept that anyone with the link can see them.</li>
</ul>
<h2>Your content</h2>
<p>Your files and text stay yours. Browser tools process them on your device. Where a tool sends text to our server or to an AI provider, its page says so, and we do not claim any rights over what you send.</p>
<h2>Results and AI</h2>
<p>Results, including those produced with AI, are provided as they are and may be incomplete or wrong. You are responsible for checking them. See our <a href="/disclaimer">Disclaimer</a>.</p>
<h2>No warranty and limited liability</h2>
<p>The service is provided without warranties of any kind. To the extent the law allows, PerkTonic is not liable for indirect or consequential losses, or for loss of data or profit, arising from the use of the site.</p>
<h2>Intellectual property</h2>
<p>The site, its design, text and code belong to PerkTonic or its licensors. You may link to our pages; you may not copy them in bulk.</p>
<h2>Changes and contact</h2>
<p>We may update these terms, and the date of the last change is shown on the page. Questions: <a href="/contact">Contact</a>.</p>`,
  },
  advertise: {
    meta: "Advertising and sponsorship at PerkTonic: clearly labelled placements for a technical audience that works with spreadsheets, data and websites.",
    html: `<p>PerkTonic's readers are people who work with spreadsheets, data, documents, automation and websites. If your product is useful to them, you can reach them in a clearly labelled placement.</p>
<h2>What we accept</h2>
<ul>
<li>Display advertising and sponsorship of tools or guides, always labelled as such.</li>
<li>Products and services that are relevant to a technical audience and that we would be comfortable describing honestly.</li>
</ul>
<h2>What we do not do</h2>
<ul>
<li>Advertising inside a tool result, or presented as editorial content.</li>
<li>Paid changes to what a guide says or to which tool it recommends.</li>
</ul>
<h2>Contact</h2>
<p>Write to <a href="/contact">our contact page</a> (subject: "Advertising") with your product and what you have in mind.</p>`,
  },
  "write-for-us": {
    meta: "Write a technical guide for PerkTonic: how to propose a topic about spreadsheets, data, automation or website diagnostics, and what we expect.",
    html: `<p>We publish technical guides about spreadsheets, data files, document processing, automation and website diagnostics. If you have a practical topic that fits, you can propose it.</p>
<h2>What we look for</h2>
<ul>
<li>A specific problem with a clear answer, shown step by step.</li>
<li>Steps that can be reproduced, with the expected result and the common errors.</li>
<li>Plain, direct writing: no padding and no promotional links.</li>
</ul>
<h2>How to propose a topic</h2>
<p>Send a short outline (the problem, the steps and who it helps) through our <a href="/contact">Contact</a> page with the subject "Guide proposal". We reply within a few business days. We do not pay for guest posts, and we edit what we publish.</p>`,
  },
  sitemap: {
    meta: "All the main sections of PerkTonic: the tools, their five categories, the blog and the legal and company pages.",
    html: `<h2>Tools</h2>
<ul>
<li><a href="/tools">All tools</a></li>
<li><a href="/category/spreadsheet-studio">Spreadsheet &amp; Formula Studio</a></li>
<li><a href="/category/data-converters">Data Cleaning &amp; File Converters</a></li>
<li><a href="/category/document-intelligence">Document &amp; Text Intelligence</a></li>
<li><a href="/category/workflow-automation">Workflow &amp; Automation Utilities</a></li>
<li><a href="/category/web-diagnostics">Web &amp; Network Diagnostics</a></li>
</ul>
<h2>Guides</h2>
<ul><li><a href="/blog">Blog</a></li></ul>
<h2>Company</h2>
<ul>
<li><a href="/about">About</a></li>
<li><a href="/contact">Contact</a></li>
<li><a href="/editorial-policy">Editorial Policy</a></li>
<li><a href="/advertise">Advertise</a></li>
<li><a href="/write-for-us">Write for Us</a></li>
</ul>
<h2>Legal</h2>
<ul>
<li><a href="/privacy-policy">Privacy Policy</a></li>
<li><a href="/terms-of-service">Terms of Service</a></li>
<li><a href="/cookie-policy">Cookie Policy</a></li>
<li><a href="/disclaimer">Disclaimer</a></li>
<li><a href="/affiliate-disclosure">Affiliate Disclosure</a></li>
<li><a href="/dmca">DMCA &amp; Copyright</a></li>
<li><a href="/accessibility">Accessibility</a></li>
</ul>`,
  },
};

const PRIVACY_MARK = 'id="tools-and-your-data"';
const PRIVACY_SECTION = `<h2 ${PRIVACY_MARK}>Our tools and your data</h2>
<ul>
<li><strong>Browser tools</strong> process your files and text on your device. They are not uploaded.</li>
<li><strong>Website checks</strong> send the address you type to our server so that it can fetch it. The result is not stored.</li>
<li><strong>AI tools</strong> send the text you provide to our server and to the AI provider only when you press the button. We do not store it with your identity, and identical requests may be answered from a short-lived cache.</li>
<li><strong>Webhook test URL and cron heartbeat monitor</strong> keep what they need to work (captured requests for 60 minutes, or a monitor's name, settings and ping times) and delete it as described on their pages.</li>
</ul>
<h2>Third-party cookies</h2>
<p>If you accept advertising or analytics cookies in our consent banner, third-party providers such as Google may set cookies to measure the site and to show ads. You can change your choice at any time from the cookie settings link in the footer.</p>`;

let changed = 0;
for (const [slug, p] of Object.entries(PAGES)) {
  const row = await prisma.page.findUnique({ where: { slug } });
  if (!row) {
    console.log(`skip ${slug}: no such page`);
    continue;
  }
  if (row.content === p.html || !OLD.test(row.content ?? "")) {
    console.log(`keep ${slug}: already refreshed or edited`);
    continue;
  }
  await prisma.page.update({ where: { slug }, data: { content: p.html, metaDescription: p.meta } });
  changed++;
  console.log(`updated ${slug}`);
}
for (const slug of ["privacy-policy"]) {
  const row = await prisma.page.findUnique({ where: { slug } });
  if (!row || row.content?.includes(PRIVACY_MARK)) continue;
  await prisma.page.update({ where: { slug }, data: { content: `${row.content ?? ""}\n${PRIVACY_SECTION}` } });
  changed++;
  console.log(`added the tools section to ${slug}`);
}
console.log(`${changed} change(s)`);
await prisma.$disconnect();

/**
 * Rewrites the pages a reviewer reads to judge the site (About, Editorial Policy, Write for Us, Advertise,
 * Affiliate Disclosure) and the affiliate paragraph of the Privacy Policy, so they describe the site as it is today
 * (50 free tools + technical guides) and make no promise that is not true.
 *
 *   npx tsx --env-file=.env scripts/update-trust-pages.mts [--dry]
 *
 * Idempotent: running it again writes the same text. Run it on the local database and once on the server.
 */
import { prisma } from "@/lib/prisma";
import { TOOLS } from "@/config/tools";

const dry = process.argv.includes("--dry");
const live = TOOLS.filter((t) => t.status === "live");
const nAi = live.filter((t) => t.ai).length;
const nServer = live.filter((t) => t.serverSide && !t.ai).length;
const nLocal = live.length - nAi - nServer;

const PAGES: Record<string, { title?: string; meta: string; html: string }> = {
  about: {
    meta: `PerkTonic offers ${live.length} free online tools to clean data, convert files, extract tables from PDFs and automate routine work, with guides that show each tool on real examples.`,
    html: `<p>PerkTonic exists to give people who work with spreadsheets, data files, documents and websites a set of <strong>${live.length} free tools that run in the browser</strong>, so a routine job (fixing an Excel formula, converting a CSV to JSON, pulling a table out of a PDF, checking an SSL certificate) does not need software to install, an account, or sending a sensitive file to someone else's server.</p>
<p>Every tool comes with a page that explains how to use it step by step, shows worked examples, lists its limits and answers the common questions. Longer guides explain the problems behind the tools, with screenshots taken from the tools themselves.</p>
<h2>The five areas</h2>
<ul>
<li><strong>Spreadsheet &amp; Formula Studio:</strong> generate, explain and debug Excel and Google Sheets formulas, macros and scripts.</li>
<li><strong>Data Cleaning &amp; File Converters:</strong> clean, compare, split and convert CSV, JSON, YAML and Markdown data.</li>
<li><strong>Document &amp; Text Intelligence:</strong> extract tables from PDFs and scans, pull data out of invoices and contracts, summarize and structure text.</li>
<li><strong>Workflow &amp; Automation Utilities:</strong> regular expressions, cron schedules, webhooks, JSONPath and diagrams.</li>
<li><strong>Web &amp; Network Diagnostics:</strong> redirects, headers, DNS, SSL, email authentication, broken links and server response time.</li>
</ul>
<h2>How the tools treat your data</h2>
<p>This is stated on every tool page, directly under the tool. In short:</p>
<ul>
<li><strong>${nLocal} tools run entirely in your browser.</strong> The files and text you load are processed on your device and are not uploaded.</li>
<li><strong>${nServer} tools check a website, a domain or an address.</strong> Only the address you type is sent to our server, which fetches it for you; two of them (the webhook test URL and the cron heartbeat monitor) keep what they need to work for a limited time and say so.</li>
<li><strong>${nAi} tools use AI.</strong> Your text is sent to our server and to the AI provider only when you press the button, and every such page says so.</li>
</ul>
<p>No account is needed for any of them.</p>
<h2>How we build and check</h2>
<ul>
<li>Each tool is tested with automated tests (more than 800 across the site) and with real example files, and its known limits are written on its page.</li>
<li>Guides are checked against what the tool actually produces; where a draft claimed something the tool does not do, the text is corrected before publication. Our <a href="/editorial-policy">Editorial Policy</a> explains the process, including how AI assistance is used and how corrections are handled.</li>
<li>Reports of a bug or a wrong result are read by a person and fixed; see <a href="/contact">Contact</a>.</li>
</ul>
<h2>Independence and advertising</h2>
<p>The tools are free to use and no tool result is ever advertising. The site is funded by display advertising, which is always separate from the content; see the <a href="/advertise">Advertise</a> page and the <a href="/affiliate-disclosure">Affiliate Disclosure</a>.</p>`,
  },
  "editorial-policy": {
    meta: "How PerkTonic builds its tools and writes its technical guides: testing on real examples, screenshots from the tools, official sources, AI assistance, updates and corrections.",
    html: `<p>PerkTonic publishes free tools and technical guides that explain how to solve a specific problem with a tool or a standard technique. This policy describes how they are made and how errors are handled.</p>
<h2>What we publish</h2>
<ul>
<li><strong>Tools</strong> for spreadsheets, data files, documents, automation and website diagnostics, each with a page that explains its use, limits and data handling.</li>
<li><strong>Guides</strong> that answer one concrete question (an error message, a conversion, a setting) with the steps, the expected result and the common mistakes.</li>
</ul>
<h2>How a guide is made</h2>
<ol>
<li><strong>A specific problem.</strong> We start from a question people actually ask, not from a keyword list.</li>
<li><strong>Draft with AI assistance.</strong> We use AI to help draft and edit text. A draft is never published as it is.</li>
<li><strong>Check against the tool.</strong> The steps are run in the tool with example data, the screenshots are taken from the tool itself, and every claim about what the tool does is compared with its real output. Claims that do not match are corrected or removed.</li>
<li><strong>Check against official sources.</strong> Statements about Excel, Google Sheets, cron, DNS, HTTP and other standards are linked to the official documentation or the specification, and the links are tested.</li>
<li><strong>Publish with a date.</strong> Guides carry their publication date; when the behaviour of a product changes, the guide is updated and the update is recorded.</li>
</ol>
<h2>Independence</h2>
<p>Advertising never influences what a guide says or which tool it uses. No tool result is advertising, and we do not accept payment to change a guide. If a guide or page ever contains a sponsored or affiliate link, it is labelled near the top; see the <a href="/affiliate-disclosure">Affiliate Disclosure</a>.</p>
<h2>What we do not do</h2>
<ul>
<li>We do not give legal, financial, medical or security advice; see the <a href="/disclaimer">Disclaimer</a>.</li>
<li>We do not copy other sites' articles, and we do not publish text we have not checked.</li>
</ul>
<h2>Corrections</h2>
<p>If you find a mistake, a broken step or a wrong result, tell us through the <a href="/contact">Contact</a> page with the address of the page and what you expected. We verify it, correct the page and, when the error changed the meaning, say so on the page.</p>`,
  },
  "write-for-us": {
    meta: "Guest-guide guidelines for PerkTonic: topics in spreadsheets, data files, documents, automation and website diagnostics, quality requirements, review process and what we do not accept.",
    html: `<p>PerkTonic publishes technical guides that help someone finish a task. We accept a small number of guides from outside writers when they meet the standard below. We do not pay for guides, and publishing one is not a link-building arrangement.</p>
<h2>Topics we accept</h2>
<p>A guide must belong to one of our five areas and answer one specific question:</p>
<ul>
<li><strong>Spreadsheets:</strong> an Excel or Google Sheets formula, error, macro, Apps Script or conditional-formatting problem (for example: why a lookup returns #N/A and how to fix it).</li>
<li><strong>Data files:</strong> cleaning, comparing, splitting or converting CSV, JSON, YAML and Markdown (for example: keeping leading zeros when converting CSV to JSON).</li>
<li><strong>Documents:</strong> extracting tables or fields from PDFs, scans, invoices, contracts or meeting notes, and checking the result.</li>
<li><strong>Automation:</strong> regular expressions, cron schedules, webhooks, JSONPath, cURL and simple workflows.</li>
<li><strong>Web diagnostics:</strong> redirects, HTTP headers, DNS, SSL certificates, SPF/DKIM/DMARC, broken links, robots.txt and sitemaps.</li>
</ul>
<h2>What a guide must contain</h2>
<ul>
<li>A clear problem statement in the first paragraph and the answer or result near the top.</li>
<li>Numbered steps that a reader can reproduce, with the expected result of each step and the common errors.</li>
<li>At least one worked example with real data (anonymised) and screenshots you took yourself.</li>
<li>Between 800 and 1,500 words of original English text, written for people who do the task, not for search engines.</li>
<li>Links to the official documentation or the specification for factual claims.</li>
</ul>
<h2>What we do not accept</h2>
<ul>
<li>Text that is copied, spun or published elsewhere, or unedited AI output.</li>
<li>Promotional content, affiliate links, casino, loans, crypto promotion or links to sites unrelated to the topic.</li>
<li>Topics outside the five areas, news and opinion pieces, and lists with no steps.</li>
</ul>
<h2>How to propose a guide</h2>
<p>Use the <a href="/contact">Contact</a> page with the subject "Guide proposal" and send: the working title, the problem it solves, a five-line outline, and one example of your earlier technical writing if you have one. We reply within a few business days.</p>
<h2>What happens next</h2>
<p>If we accept the outline you send the draft; we check the steps against our tools or the product concerned, edit for clarity and accuracy, and agree the final text with you. The guide is published under your name with a short author line, and we update or correct it when the product changes. We reserve the right to decline a guide at any stage.</p>`,
  },
  advertise: {
    meta: "How advertising works on PerkTonic: labelled display ads, what we accept, what we never do, and how to ask about a sponsorship.",
    html: `<p>PerkTonic is a free site, and display advertising is how it is meant to pay for itself. This page explains what that means for readers and for anyone who wants to ask about a placement.</p>
<h2>How ads work today</h2>
<p>The site is set up for display advertising through Google AdSense. Ads are marked "Advertisement", the consent banner lets visitors choose whether advertising cookies are used, and ads never appear inside a tool or as part of a tool result. We do not sell ad space directly at the moment.</p>
<h2>Sponsorships</h2>
<p>PerkTonic is a new site and has no audience figures to publish yet. If you make a product that is useful to people who work with spreadsheets, data, documents or websites and you would like to ask about a clearly labelled sponsorship, write to us through the <a href="/contact">Contact</a> page with the subject "Advertising", your product and what you have in mind. We will answer honestly about whether it fits.</p>
<h2>What we accept</h2>
<ul>
<li>Display advertising and sponsorship, always labelled as such.</li>
<li>Products and services that are relevant to a technical audience and that we would be comfortable describing accurately.</li>
</ul>
<h2>What we do not do</h2>
<ul>
<li>Advertising inside a tool result, or presented as editorial content.</li>
<li>Paid changes to what a guide says or to which tool it recommends.</li>
<li>Ads for gambling, loans, adult content or anything misleading.</li>
</ul>`,
  },
  "affiliate-disclosure": {
    meta: "PerkTonic has no affiliate partnerships today. How the site is funded, and how any sponsored or affiliate link would be labelled if one is added.",
    html: `<p>PerkTonic's tools and guides are free, and nobody pays us to recommend anything in them.</p>
<h2>How the site is funded</h2>
<p>The site is set up to show display advertising through Google AdSense. See the <a href="/advertise">Advertise</a> page for how ads are handled.</p>
<h2>Affiliate links</h2>
<p>Today PerkTonic has <strong>no affiliate partnerships</strong>: no link on the site earns us a commission. If that changes, the page that contains such a link will say so near the top, the link will be marked as sponsored, and this page will be updated.</p>
<h2>Our commitments</h2>
<ul>
<li>Compensation never decides what a guide says or which tool it uses.</li>
<li>We never ask you to click an ad and never place content that encourages accidental clicks.</li>
<li>No tool result is ever advertising.</li>
</ul>
<p>Questions about this page: use our <a href="/contact">Contact</a> page.</p>`,
  },
};

for (const [slug, p] of Object.entries(PAGES)) {
  const page = await prisma.page.findUnique({ where: { slug }, select: { id: true, content: true } });
  if (!page) {
    console.log(`skip ${slug}: no such page`);
    continue;
  }
  console.log(`${slug}: ${page.content === p.html ? "already up to date" : "updated"} (${p.html.replace(/<[^>]+>/g, " ").split(/\s+/).length} words)`);
  if (!dry) await prisma.page.update({ where: { id: page.id }, data: { content: p.html, metaDescription: p.meta } });
}

// Privacy policy: the affiliate paragraph must not promise links that do not exist.
const priv = await prisma.page.findUnique({ where: { slug: "privacy-policy" }, select: { id: true, content: true } });
const privText = priv?.content ?? "";
if (priv) {
  const re = /<h2>Affiliate links<\/h2>\s*<p>[\s\S]*?<\/p>/;
  const next = "<h2>Affiliate links</h2>\n<p>PerkTonic has no affiliate partnerships at present. If any link ever earns us a commission, it will be labelled; see our <a href=\"/affiliate-disclosure\">Affiliate Disclosure</a>.</p>";
  if (re.test(privText) && !privText.includes("no affiliate partnerships at present")) {
    console.log("privacy-policy: affiliate paragraph updated");
    if (!dry) await prisma.page.update({ where: { id: priv.id }, data: { content: privText.replace(re, next) } });
  } else console.log("privacy-policy: nothing to change");
}
process.exit(0);

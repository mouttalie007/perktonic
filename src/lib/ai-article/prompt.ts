import blocks from "./prompt-blocks.json";
import { BRIEF_CATEGORIES, type BriefData } from "./briefs";

/**
 * Prompt assembly for the "API Articles" workflow.
 *
 * The editorial voice, hook rules, SEO spec, quality gates, length rules and
 * image rules are the ones from the Content Command Center HTML files
 * (prompt-blocks.json, extracted verbatim; two lines patched for PerkTonic's
 * real URL structure -- see the INTERNAL LINKS line). On top of that this
 * file adds a QUALITY PROTOCOL (verification discipline, claim ledger, edit
 * passes) and the exact output contract the parser in parse.ts expects.
 *
 * Everything that does not change between articles lives in the SYSTEM
 * prompt, so it is identical on every call and cacheable; the per-article
 * brief is the user message.
 */

const join = (lines: string[]) => lines.join("\n");

const ROLE = join([
  "ROLE",
  "Your deliverable is the complete, fully written article (length set by the topic: complete, never padded, never thin) plus its metadata lines, in the exact format below. You are a senior feature writer and SEO editor for PerkTonic.com. Write ONE article that can compete with the top Google results and with major online magazines: Wirecutter-level rigour, Wired/The Verge-level voice, NerdWallet-level clarity. Write entirely in English for a US/UK audience.",
]);

const OUTPUT_FORMAT = join([
  "OUTPUT FORMAT (follow EXACTLY; your entire reply must be this and nothing else)",
  "THE ARTICLE BODY IS THE MAIN DELIVERABLE. The header lines are only metadata. A reply that contains the header lines and image tags but not the full written article is a failed reply. The body must be a complete, fully written article: exactly as long as the topic needs, with no padding and no thin sections (see LENGTH AND TIGHTNESS).",
  "",
  "Title: <the final headline>",
  "Slug: <copy the 'Required slug' from the brief exactly>",
  "Meta Description: <one natural sentence, 120-159 characters>",
  "Keywords: <3-6 comma-separated keywords/phrases, most important first>",
  "Category: <copy the Category line from the brief exactly>",
  "Author: <copy the Author line from the brief exactly>",
  "Cover Alt: <alt text for the cover image, under 110 characters>",
  "---",
  "<the complete article body, clean semantic HTML: H2/H3 only, no H1, no tables, no divs>",
  "",
  "[IMAGE: a detailed description of the image needed, for an AI image generator]",
  "[IMAGE: SCREENSHOT: exact page or app, state to capture, crop and highlight, data to blur]",
  "---ALTS---",
  "1: <alt text for the 1st image tag in the body, in order>",
  "2: <alt text for the 2nd image tag>",
  "",
  "BODY SKELETON (shows the shape only; write the real article and never print these placeholders)",
  "<p>Hook paragraph...</p>",
  "<p>Promise and credibility paragraph...</p>",
  "<p><strong>Quick answer:</strong> 40-55 word direct answer...</p>",
  "[IMAGE: hero image description]",
  "<h2>First section heading</h2>",
  "<p>...</p>",
  "<h3>Sub-point</h3>",
  "<ul><li>...</li></ul>",
  "[IMAGE: second image description]",
  "<h2>More sections...</h2>",
  "<h2>My take and next step</h2>",
  "<p>...</p>",
  "<h2>Frequently asked questions</h2>",
  "<h3>Question?</h3>",
  "<p>Answer.</p>",
  "",
  "FORMAT RULES",
  "- Your reply starts with the characters 'Title:'. No preamble, no code fences, no notes, no explanations, no sign-off.",
  "- Do not output research notes, the claim ledger, verification logs, JSON-LD, schema, checklists or alternative headlines.",
  "- Title: one final headline in plain text, no quotes, no markdown, no trailing period. Keep the primary keyword. Honest and specific.",
  "- Slug: copy the brief's 'Required slug' exactly. It is fixed because other PerkTonic articles link to it.",
  "- Meta Description: one natural sentence, 120-159 characters, with the primary keyword, a concrete benefit and a soft call to action. No quotes, no emoji, no trailing ellipsis.",
  "- Keywords: 3-6 comma-separated phrases, lowercase, primary keyword first, then secondary and semantic phrases from the brief.",
  "- Category and Author are already decided: copy those two lines from the brief EXACTLY as written. Do not change, translate or reformat them, and do not mention them in the body.",
  "- Cover Alt: one plain sentence, under 110 characters, describing what the cover photo visibly shows (it is the brief's cover scene). No 'image of' or 'photo of'. Use the primary keyword only if it fits naturally.",
  "- Each header line is on its own line. Separator: a line containing only ---, then the body immediately.",
  "- Body: clean semantic HTML using only these tags: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <a>, <blockquote>. H2/H3 only, no H1, no H4+, no tables, no div, span, img, figure, class, id or inline style, no emoji. Write & as &amp;. Structure: introduction, Quick answer, body sections (with a clearly labelled 'The catch' wherever conditions or limits exist), a closing H2 with your honest opinion and one next step, then the FAQ H2.",
  "- IMAGES: place image tags automatically inside the body. Each image is ONE line that starts with [IMAGE: and ends with ], on its own line between two block elements (after a closing </p>, </ul> or </ol>), never inside a tag. There are two kinds: a normal AI photo tag, [IMAGE: ...], and a screenshot tag whose text starts with SCREENSHOT:, written [IMAGE: SCREENSHOT: ...]. Put the first image right after the Quick answer (hero image), then add one roughly every two sections only where a visual genuinely helps; typically 3-5 images in total, fewer for a short article. The image tags sit BETWEEN written paragraphs; they never replace them. The cover image is separate and is NOT one of these tags.",
  "- AI PHOTO TAGS (written for ChatGPT image generation, so use plain natural sentences, no keyword lists and no negative-prompt block): 25-60 words describing ONE concrete, candid moment tied to the paragraph just above it: who or what, doing what, where, the time of day and light, and the camera distance. Look to request in every photo tag: " +
    blocks.IMGLOOK +
    " End with: Wide 3:2 landscape, no text, no logos. Never request brand logos, real interface screenshots, real public figures or copyrighted characters; screens must be turned away, dim or out of focus. Avoid objects that look like something else: never show small flat square foil packets or sachets; prefer kraft envelopes, padded mailers, cardboard boxes, glass jars, plain tubes, tea bags, coins, paper and everyday household items.",
  "- VARIETY (important): no two images in the same article may share the same main object, setting, camera distance or colour palette. Rotate the shot type: one wide scene with a person seen from behind or cropped (no face), one medium shot of hands doing the thing, one close detail of a single object, and use a different room, time of day and light for each. Do not make every image about the main product; picture the situation around it. Never use a brand colour as an accent; let each scene keep its natural colours.",
  "- SCREENSHOT TAGS: when a paragraph points the reader at a real on-screen thing (a tool interface, a menu path, a settings page, a search results page, a price-history chart, a sign-up or checkout page), use [IMAGE: SCREENSHOT: ...] instead of an AI photo. The text after SCREENSHOT: is an instruction for the author, who will capture it by hand, so write it as clear steps, not as an image-generation prompt: (1) the exact official page or app, with its URL only if you are certain of it; (2) the exact state to capture: which tab, menu, search query or setting; (3) desktop or mobile; (4) the crop and what to mark with a box or arrow; (5) which personal data to blur. Use the screenshot candidates in the brief where they fit, and at most 3 screenshots per article. Never use an AI image to fake an interface, dashboard, result or receipt. Write the surrounding paragraph so it still reads correctly if the interface looks slightly different, and never present a screenshot as proof of the author's own results unless the author's notes supply them.",
  "- ALTS BLOCK: after the last body line put a line containing only ---ALTS---, then one line per image tag in the body, in the same order, written as '1: ...', '2: ...'. Each is a plain, factual alt text under 110 characters describing what the finished image will visibly show (for a screenshot: what the screen shows). No 'image of', no keyword stuffing. Skip the block only if the body has no image tags.",
]);

const QUALITY_PROTOCOL = join([
  "QUALITY PROTOCOL (PerkTonic API pipeline; applies on top of everything above, and where it is stricter it wins)",
  "You have live web search and web fetch tools. Quality here means: verified, specific, original and human.",
  "1. RESEARCH BEFORE WRITING (silent). At minimum: (a) search the primary keyword and open the top results to see what page one covers and what it misses; (b) search the question-style variants real readers ask; (c) for every offer, tool, price, limit, deadline or policy you will name, find and OPEN its official page; (d) run one 'problems / complaints / scam / catch' search so 'The catch' reflects what real users report, not marketing copy; (e) for time-sensitive topics, look for the most recent change or announcement.",
  "2. CLAIM LEDGER (silent, never printed). Before drafting, list every factual claim you plan to make together with the exact URL you opened that supports it. Write only ledger claims. Anything else must be plainly general knowledge, hedged ('usually', 'check the official page'), or cut. If your research contradicts the brief's premise or the working headline, trust the research and rewrite the headline honestly instead of defending the brief.",
  "3. SOURCE LADDER. Prefer: official provider or program pages > government, regulator and standards bodies > primary studies and documentation > established publications. Never cite affiliate roundups, content farms or pages that merely repeat each other, and never treat a forum thread as authority. A claim with no good source is dropped, not padded.",
  "4. FRESHNESS. Today's date is in the brief. Treat anything older than about 12 months as possibly stale unless the source is dated and current. Prefer 'check the official page' over a number you could not confirm today. Add one dated 'Last checked' line near the end only if you really verified the facts on that date.",
  "5. IF THE OFFER CHANGED OR IS GONE. If research shows the program, tool or offer no longer exists or has changed materially, say so plainly in the article (that is the most useful thing you can tell the reader) instead of describing the old version, and adjust the headline so it stays honest.",
  "6. THREE SILENT EDIT PASSES after drafting. (i) Fact-checker: every number, date, price, name and link matches the ledger; delete or fix anything that does not. (ii) Voice editor: remove every banned phrase, vary the rhythm, make sure the opinion lines ('My pick:', 'Skip this if:', 'The catch:') are real and earned, and cut AI tells (stacked triads, 'It's worth noting', 'Here's the thing', filler transitions, repeated em-dash asides). (iii) SEO and structure: primary keyword in all required places, Quick answer exactly 40-55 words, every H2 carrying new information, FAQ questions not already answered, internal links using only the exact URLs supplied, 3-6 external links each opened and relevant.",
  "7. ORIGINALITY. Do not mirror any single source's structure or wording; synthesise. Add what page one lacks: the brief's unique angle.",
  "8. SENSITIVE TOPICS (health, baby products, personal data, money, legal): general information only. State the caveat once in a natural sentence and never give personalised advice.",
  "9. IMAGE PLANNING. Decide the image tags last, after the text is final, so each one sits next to the paragraph it illustrates. Write the ALTS block and Cover Alt from the finished tags.",
  "10. FINAL CHECK. Your reply must be only the format above, starting with 'Title:'.",
]);

export function buildSystemPrompt(): string {
  return [
    ROLE,
    join(blocks.EDITORIAL),
    join(blocks.HOOKS),
    join(blocks.LENGTH),
    join(blocks.TECH),
    join(blocks.GATES),
    join(blocks.RESULT),
    OUTPUT_FORMAT,
    QUALITY_PROTOCOL,
  ].join("\n\n");
}

const CHAT_DELIVERY = join([
  "DELIVERY RULES FOR THIS CHAT (these override every earlier line about code fences, 'no preamble' or how the reply starts)",
  "- Do the research first with web search (open the pages, don't rely on memory), think carefully, and verify every claim exactly as the QUALITY PROTOCOL says. Do this silently: show no research notes.",
  "- Then put your COMPLETE final answer, and nothing else, inside ONE single code block (three backticks, the word text, a new line, the answer, a new line, three backticks) so I can copy it with one click. The first line INSIDE the block is 'Title:'. Write nothing before or after the code block.",
  "- Never split the answer over several code blocks and never use three backticks inside it. If the article is long, it still goes completely into that one block: the whole article, the image tags and the ---ALTS--- lines.",
  "- Do not ask me questions; make sensible assumptions silently.",
]);

/**
 * The same prompt, adapted for pasting into a claude.ai chat: one message
 * (instructions + brief) and the answer delivered in a single copyable code
 * block, which parseGeneratedArticle unwraps.
 */
export function buildChatPrompt(userPrompt: string): string {
  const system = buildSystemPrompt()
    .replace(
      "your entire reply must be this and nothing else",
      "your entire reply must be this, inside one code block (see DELIVERY RULES), and nothing else",
    )
    .replace(
      "- Your reply starts with the characters 'Title:'. No preamble, no code fences, no notes, no explanations, no sign-off.",
      "- Your reply is ONE code block (see DELIVERY RULES) whose first line starts with 'Title:'. No preamble, no notes, no explanations, no sign-off outside it.",
    )
    .replace(
      "You have live web search and web fetch tools.",
      "Use web search (and open the result pages) for the research.",
    )
    .replace(
      "10. FINAL CHECK. Your reply must be only the format above, starting with 'Title:'.",
      "10. FINAL CHECK. Your reply must be only the format above, inside one code block, its first line starting with 'Title:'.",
    );
  const brief = userPrompt
    .replace(
      "Use your web search and web fetch tools before writing",
      "Use web search before writing",
    )
    .replace(
      "Reply now with the finished, fully written article in the exact output format.",
      "Reply now with the finished, fully written article in the exact output format, inside one code block.",
    );
  return [system, "=".repeat(60), brief, "=".repeat(60), CHAT_DELIVERY].join(
    "\n\n",
  );
}

export interface PromptContext {
  /** YYYY-MM-DD */
  today: string;
  categoryHubUrl: string;
  slug: string;
  related: { title: string; pk: string; url: string; live: boolean }[];
  liveArticles: { title: string; url: string; category: string | null }[];
  notes?: string | null;
}

const AUTHORS = blocks.AUTHORS as Record<string, string>;
const TYPEHINT = blocks.TYPEHINT as Record<string, string>;

export function buildUserPrompt(brief: BriefData, ctx: PromptContext): string {
  const cat = BRIEF_CATEGORIES[brief.cat];
  const L: string[] = [];

  L.push("ARTICLE BRIEF");
  L.push(`- Current date: ${ctx.today}`);
  L.push(
    `- Working title (you may sharpen it; keep the primary keyword and an honest promise): ${brief.title}`,
  );
  L.push(`- Category (fixed): ${cat.name} (hub: ${ctx.categoryHubUrl})`);
  L.push(
    `- Byline (fixed): ${cat.author}. ${AUTHORS[cat.author] ? `Beat: ${AUTHORS[cat.author]} ` : ""}This is a team byline, not a person: write in a plain editorial voice ("we" or neutral), never invent a personal backstory, and never claim to have personally tested something unless the author's notes below say so.`,
  );
  L.push(`- Primary keyword: ${brief.pk}`);
  L.push(`- Secondary keywords and entities: ${brief.sk.join("; ")}`);
  L.push(`- Search intent: ${brief.intent}`);
  L.push(`- Description of the article: ${brief.summary}`);
  L.push(
    `- Unique angle (what must make this better than page one): ${brief.angle}`,
  );
  L.push(`- Hook seed for the introduction: ${brief.hook}`);
  L.push(`- Format: ${TYPEHINT[brief.type] ?? ""}`);
  L.push(
    "- Length: no word target. Let the topic decide (see LENGTH AND TIGHTNESS). Deliver exactly what the headline promises, no more.",
  );
  if (brief.shots?.length) {
    L.push(
      "- Screenshot candidates (real captures the author will take by hand; use a SCREENSHOT tag where one fits the text, skip any that do not help the reader):",
    );
    for (const s of brief.shots) L.push(`  * ${s}`);
  } else {
    L.push(
      "- Screenshots: none planned. Use a SCREENSHOT tag only if a paragraph truly points at a real on-screen item.",
    );
  }
  L.push(`- Required slug: ${ctx.slug} (fixed; do not change it)`);
  L.push(`- Category line to copy exactly: Category: ${cat.name}`);
  L.push(`- Author line to copy exactly: Author: ${cat.author}`);
  L.push(
    "- Cover image scene (for your Cover Alt line; the image itself is produced separately): " +
      brief.cover,
  );
  L.push(
    "- Related articles to link naturally (internal links; use these exact URLs):",
  );
  if (ctx.related.length) {
    for (const r of ctx.related) {
      L.push(
        `  * "${r.title}" -> ${r.url} (anchor idea: ${r.pk})${r.live ? "" : " [scheduled to be published soon]"}`,
      );
    }
  } else {
    L.push("  * (none)");
  }
  L.push(
    `- Category hub URL (one natural link to it is welcome): ${ctx.categoryHubUrl}`,
  );
  if (ctx.liveArticles.length) {
    L.push(
      "- LIVE SITE ARTICLES (already published on PerkTonic; link to one of these only when it is directly relevant to the sentence, using its exact URL; never link to a PerkTonic URL that is not listed in this brief):",
    );
    for (const a of ctx.liveArticles) {
      L.push(
        `  * "${a.title}" -> ${a.url}${a.category ? ` [${a.category}]` : ""}`,
      );
    }
  }
  if (brief.first) {
    if (ctx.notes && ctx.notes.trim()) {
      L.push(
        "- AUTHOR'S FIRST-HAND NOTES (real, supplied by the author; the ONLY source of personal experience; do not embellish or add anything beyond them):",
      );
      L.push(ctx.notes.trim());
    } else {
      L.push(
        "- FIRST-HAND REQUIREMENT NOT MET: the author supplied no real test notes. Do NOT claim any personal testing, numbers or results. Rewrite the headline into an honest research-based version (drop 'I tested' or 'I replaced' wording) and write the article as a researched guide.",
      );
    }
  }
  if (brief.tsens) {
    L.push(
      "- TIME-SENSITIVE: offers, prices, eligibility and dates change. Follow the FRESHNESS rule strictly and verify on the official source today.",
    );
  }
  L.push("");
  L.push("STEP 0: RESEARCH (do this first; silent, never printed)");
  L.push(
    "Use your web search and web fetch tools before writing, as set out in the QUALITY PROTOCOL: study page one for the primary keyword, collect People Also Ask style questions, find 3-6 authoritative external sources for the specific claims you will make and OPEN each to confirm it loads, is current and truly supports the point you will link it to, and verify every offer, price, date and eligibility rule on the official source.",
  );
  L.push("");
  L.push(
    "Reply now with the finished, fully written article in the exact output format. Do not ask questions; make sensible assumptions silently.",
  );
  return L.join("\n");
}

/** The featured-image prompt (shown in the admin's image popup, step 1). */
export function buildCoverPrompt(
  brief: BriefData,
  articleTitle: string,
): string {
  return [
    `Create a photo for the top of a PerkTonic article titled "${articleTitle}". It is also the thumbnail in article lists.`,
    "",
    `Scene: ${brief.cover}`,
    "",
    `Look: ${blocks.IMGLOOK}`,
    "People: no faces. Show hands, a person from behind, or a softly out-of-focus figure. Natural hands with five fingers.",
    "Objects: no logos or readable text anywhere. For packaging use plain kraft paper, cardboard, glass jars or plain tubes, never small flat square foil packets. Screens are turned away, dim or out of focus. Everything sits the way it would really sit: nothing floating, nothing standing without support.",
    "Colour: keep the natural colours of the scene; do not add any brand colour accent.",
    "Format: wide 3:2 landscape (1536x1024). Keep the main subject near the centre so a square crop also works.",
    "Avoid: glossy AI polish, symmetrical arrangement, plastic-looking surfaces, extra fingers, warped or gibberish text.",
  ].join("\n");
}

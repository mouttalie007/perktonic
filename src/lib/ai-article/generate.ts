import Anthropic from "@anthropic-ai/sdk";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readingTimeMinutes } from "@/lib/reading-time";
import { getAnthropicApiKey } from "./api-key";
import { asBriefData, BRIEF_CATEGORIES, briefSlug, type BriefData } from "./briefs";
import { buildCoverPrompt, buildSystemPrompt, buildUserPrompt } from "./prompt";
import { GenerationParseError, parseGeneratedArticle } from "./parse";
import { fallbackAlt, type ImageSlot } from "./slots";

/** The model the admin asked for ("Claude API Sonnet 5.5"). */
export const AI_MODEL = "claude-sonnet-5-5";

/** Rough price per million tokens (USD) -- used only for the cost estimate shown in the admin. */
export const PRICE_PER_MTOK = { input: 2, output: 10, webSearch: 10 / 1000 };

const MAX_TOKENS = 48_000;
const MAX_CONTINUATIONS = 8;
const REQUEST_TIMEOUT_MS = 15 * 60 * 1000;

export interface ModelResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  webSearches: number;
}

/**
 * One article = one (streamed) call, continued while the server-side web
 * tools pause the turn. Streaming is required for a request this large;
 * `fallbacks: "default"` lets the API re-run the request on another model
 * if the first one declines it (opt-in, same call, no extra code here).
 */
export async function callClaudeForArticle(apiKey: string, system: string, user: string): Promise<ModelResult> {
  const client = new Anthropic({ apiKey, maxRetries: 3, timeout: REQUEST_TIMEOUT_MS });

  const tools: Anthropic.Beta.BetaToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: 10 },
    // max_content_tokens caps what ONE fetched page can add to the context --
    // an uncapped fetch of a long page is what made the first test run cost
    // ~$1.3 (half a million input tokens across the continuation turns).
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: 8, max_content_tokens: 25_000 },
  ];

  let messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: user }];
  const turnTexts: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let webSearches = 0;

  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const stream = client.beta.messages.stream({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // Auto-caches the growing prefix, so each pause_turn continuation
      // re-reads the research so far at the cache-read price, not full price.
      cache_control: { type: "ephemeral" },
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools,
      messages,
    });
    const msg = await stream.finalMessage();

    // "Billable-equivalent" input tokens: cache writes cost 1.25x, cache reads 0.1x.
    inputTokens += Math.round(
      msg.usage.input_tokens +
        1.25 * (msg.usage.cache_creation_input_tokens ?? 0) +
        0.1 * (msg.usage.cache_read_input_tokens ?? 0),
    );
    outputTokens += msg.usage.output_tokens;
    webSearches += msg.usage.server_tool_use?.web_search_requests ?? 0;

    turnTexts.push(
      msg.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join(""),
    );

    if (msg.stop_reason === "pause_turn") {
      messages = [...messages, { role: "assistant", content: msg.content }];
      continue;
    }
    if (msg.stop_reason === "refusal") {
      throw new Error("The model declined to write this article (safety refusal).");
    }
    if (msg.stop_reason === "max_tokens") {
      throw new Error("The model ran out of output tokens before finishing the article.");
    }
    break;
  }

  const text = [...turnTexts].reverse().find((t) => /^\s*Title:/im.test(t)) ?? turnTexts.join("\n");
  return { text, inputTokens, outputTokens, webSearches };
}

interface SiteContext {
  catByName: Map<string, { id: string; slug: string }>;
  authorByName: Map<string, string>;
  liveArticles: { title: string; slug: string; category: string | null }[];
  knownSlugs: Set<string>;
  categorySlugs: Set<string>;
}

async function loadSiteContext(): Promise<SiteContext> {
  const [categories, authors, live, allBriefs] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true, slug: true } }),
    prisma.author.findMany({ select: { id: true, name: true } }),
    prisma.article.findMany({
      where: { status: "PUBLISHED", publishedAt: { lte: new Date() } },
      orderBy: { publishedAt: "desc" },
      take: 60,
      select: { title: true, slug: true, category: { select: { name: true } } },
    }),
    prisma.articleBrief.findMany({ select: { data: true } }),
  ]);

  const knownSlugs = new Set<string>(live.map((a) => a.slug));
  for (const b of allBriefs) knownSlugs.add(briefSlug(asBriefData(b.data).pk));

  return {
    catByName: new Map(categories.map((c) => [c.name, { id: c.id, slug: c.slug }])),
    authorByName: new Map(authors.map((a) => [a.name, a.id])),
    liveArticles: live.map((a) => ({ title: a.title, slug: a.slug, category: a.category?.name ?? null })),
    knownSlugs,
    categorySlugs: new Set(categories.map((c) => c.slug)),
  };
}

function shortError(e: unknown): string {
  if (e instanceof Anthropic.APIError) {
    return `Claude API error ${e.status ?? ""}: ${e.message}`.slice(0, 500);
  }
  return (e instanceof Error ? e.message : String(e)).slice(0, 500);
}

/** Runs one brief end to end. Never throws: failures are recorded on the brief. */
export async function generateBrief(briefId: string): Promise<void> {
  const brief = await prisma.articleBrief.findUnique({ where: { id: briefId } });
  if (!brief || brief.status === "PUBLISHED") return;

  await prisma.articleBrief.update({
    where: { id: briefId },
    data: { status: "GENERATING", error: null, startedAt: new Date(), finishedAt: null },
  });

  try {
    const { key } = await getAnthropicApiKey();
    if (!key) throw new Error("No Claude API key is configured. Add one in Settings → AI Articles.");

    const data: BriefData = asBriefData(brief.data);
    const cat = BRIEF_CATEGORIES[data.cat];
    const site = await loadSiteContext();
    const dbCat = site.catByName.get(cat.name);
    if (!dbCat) throw new Error(`The category "${cat.name}" does not exist in the database.`);
    const slug = briefSlug(data.pk);

    const liveSlugs = new Set(site.liveArticles.map((a) => a.slug));
    const user = buildUserPrompt(data, {
      today: new Date().toISOString().slice(0, 10),
      categoryHubUrl: `/category/${dbCat.slug}`,
      slug,
      related: (data.relResolved ?? []).map((r) => ({
        title: r.title,
        pk: r.pk,
        url: `/story/${briefSlug(r.pk)}`,
        live: liveSlugs.has(briefSlug(r.pk)),
      })),
      liveArticles: site.liveArticles
        .filter((a) => a.slug !== slug)
        .map((a) => ({ title: a.title, url: `/story/${a.slug}`, category: a.category })),
      notes: brief.notes,
    });

    const result = await callClaudeForArticle(key, buildSystemPrompt(), user);

    const parsed = parseGeneratedArticle(result.text, {
      isKnownInternal: (href) => {
        const path = href.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
        if (path === "/") return true;
        if (path.startsWith("/story/")) return site.knownSlugs.has(path.slice("/story/".length));
        if (path.startsWith("/category/")) return site.categorySlugs.has(path.slice("/category/".length));
        return false;
      },
    });

    // Category + author are fixed by the brief, whatever the model wrote.
    const authorId = site.authorByName.get(cat.author) ?? null;

    const existing = await prisma.article.findUnique({ where: { slug }, select: { id: true } });
    if (existing && existing.id !== brief.articleId) {
      throw new Error(`An article with the slug "${slug}" already exists, so this brief can't create its draft.`);
    }

    const articleData = {
      type: "STANDARD" as const,
      title: parsed.title,
      slug,
      excerpt: parsed.metaDescription || null,
      metaDescription: parsed.metaDescription || null,
      content: parsed.bodyHtml,
      readingTime: readingTimeMinutes(parsed.bodyHtml),
      status: "DRAFT" as const,
      publishedAt: null,
      categoryId: dbCat.id,
      authorId,
      featuredImageId: null,
    } satisfies Partial<Prisma.ArticleUncheckedCreateInput>;

    const article = brief.articleId
      ? await prisma.article.update({ where: { id: brief.articleId }, data: articleData })
      : await prisma.article.create({ data: articleData });

    const slots: ImageSlot[] = [
      {
        kind: "cover",
        prompt: buildCoverPrompt(data, parsed.title),
        alt: parsed.coverAlt || `${data.pk}`,
        mediaId: null,
        url: null,
      },
      ...parsed.markers.map((m, i): ImageSlot => ({
        kind: m.kind,
        prompt: m.prompt,
        alt: parsed.alts[i] || fallbackAlt(m.prompt, m.kind, data.pk),
        mediaId: null,
        url: null,
      })),
    ];

    await prisma.articleBrief.update({
      where: { id: briefId },
      data: {
        status: "DRAFTED",
        title: parsed.title,
        articleId: article.id,
        coverPrompt: slots[0].prompt,
        imageSlots: slots as unknown as Prisma.InputJsonValue,
        error: parsed.warnings.length ? parsed.warnings.join(" | ") : null,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        webSearches: result.webSearches,
        finishedAt: new Date(),
      },
    });
  } catch (e) {
    await prisma.articleBrief.update({
      where: { id: briefId },
      data: {
        status: "FAILED",
        error: e instanceof GenerationParseError ? `Unusable reply: ${e.message}` : shortError(e),
        finishedAt: new Date(),
      },
    });
  }
}

export function estimateCostUsd(b: { inputTokens: number | null; outputTokens: number | null; webSearches: number | null }): number | null {
  if (b.inputTokens == null || b.outputTokens == null) return null;
  return (
    (b.inputTokens / 1e6) * PRICE_PER_MTOK.input +
    (b.outputTokens / 1e6) * PRICE_PER_MTOK.output +
    (b.webSearches ?? 0) * PRICE_PER_MTOK.webSearch
  );
}

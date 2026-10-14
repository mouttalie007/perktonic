import { prisma } from "@/lib/prisma";

/**
 * Pre-launch demo engagement (perktonic workflow, 2026-10-09, tuned
 * 2026-10-10) — makes a freshly published article look like an established
 * site to anyone previewing it (reactions + a handful of comments with
 * real-looking names/avatars), without waiting for real traffic. Every row
 * this writes is clearly marked so "Clear demo engagement"
 * (src/app/actions/demo-engagement.ts) can remove exactly this and nothing
 * a real visitor added.
 */

/** Plain-name fallback only — used when randomuser.me is unreachable, never by default. */
const PLACEHOLDER_NAMES = [
  "Sam",
  "Jordan",
  "Taylor",
  "Casey",
  "Morgan",
  "Jamie",
  "Riley",
  "Drew",
  "Alex P.",
  "Chris T.",
  "Jess",
  "Pat",
  "Robin",
  "Dana",
  "Lee K.",
];

/** Every emoji in the same 10-100 range — looks organic, not implausibly huge for a new site. */
const REACTION_MIN = 10;
const REACTION_MAX = 100;
const REACTION_EMOJIS = ["LAUGH", "LOVE", "WOW", "ANGRY", "SAD"] as const;

const COMMENT_COUNT_MIN = 5;
const COMMENT_COUNT_MAX = 10;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (copy.length > 0 && out.length < n) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

/** Parses the admin-pasted comment pool: one comment per non-empty line. */
export function parseCommentPool(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

interface FakeUser {
  name: string;
  avatarUrl: string | null;
}

interface RandomUserApiResult {
  name?: { first?: string; last?: string };
  picture?: { medium?: string };
}

/**
 * Real-looking name + avatar per comment, from randomuser.me (free, no key,
 * built exactly for this kind of placeholder-data use case). Fetched once
 * here, at seed time — never live on page render. Falls back to a plain
 * name with no avatar if the API is unreachable, so a network hiccup never
 * blocks publishing.
 */
async function fetchFakeUsers(n: number): Promise<FakeUser[]> {
  if (n === 0) return [];
  try {
    const res = await fetch(
      `https://randomuser.me/api/?results=${n}&inc=name,picture&noinfo`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) throw new Error(`randomuser.me responded ${res.status}`);
    const data = (await res.json()) as { results?: RandomUserApiResult[] };
    const users = (data.results ?? []).map((r) => ({
      name: [r.name?.first, r.name?.last].filter(Boolean).join(" ") || "Guest",
      avatarUrl: r.picture?.medium ?? null,
    }));
    if (users.length === n) return users;
    throw new Error("randomuser.me returned an unexpected result count");
  } catch {
    return Array.from({ length: n }, () => ({
      name: PLACEHOLDER_NAMES[randomInt(0, PLACEHOLDER_NAMES.length - 1)],
      avatarUrl: null,
    }));
  }
}

async function seedReactions(articleId: string): Promise<void> {
  await prisma.articleReaction.createMany({
    data: REACTION_EMOJIS.map((emoji) => ({
      articleId,
      emoji,
      count: randomInt(REACTION_MIN, REACTION_MAX),
    })),
    skipDuplicates: true,
  });
}

async function seedComments(
  articleId: string,
  publishedAt: Date,
  pool: string[],
): Promise<number> {
  if (pool.length === 0) return 0;

  const maxComments = Math.min(COMMENT_COUNT_MAX, pool.length);
  const minComments = Math.min(COMMENT_COUNT_MIN, maxComments);
  const commentCount = randomInt(minComments, maxComments);
  const bodies = pickRandom(pool, commentCount);
  const users = await fetchFakeUsers(bodies.length);

  const now = Date.now();
  const start = publishedAt.getTime();
  const span = Math.max(now - start, 0);

  await prisma.comment.createMany({
    data: bodies.map((body, i) => ({
      articleId,
      name: users[i].name,
      avatarUrl: users[i].avatarUrl,
      body,
      status: "APPROVED",
      isSeed: true,
      createdAt: new Date(start + Math.random() * span),
    })),
  });
  return bodies.length;
}

async function loadPool(): Promise<string[]> {
  const settings = await prisma.siteSettings.findUnique({
    where: { id: "singleton" },
  });
  return parseCommentPool(settings?.demoCommentPool);
}

/**
 * Applies random reactions + a random subset of comments to one article.
 * Call only for articles with zero existing reactions/comments — this
 * doesn't check that itself, callers (the publish hook) decide when it's
 * appropriate.
 */
export async function applyDemoEngagementToArticle(
  articleId: string,
  publishedAt: Date,
): Promise<void> {
  const pool = await loadPool();
  await seedReactions(articleId);
  await seedComments(articleId, publishedAt, pool);
}

/**
 * Seeds only what an article is still missing (reactions and/or comments).
 * Used by every publish path, so a draft published later gets engagement too,
 * while an article that already has some is never doubled.
 */
export async function ensureDemoEngagement(
  articleId: string,
  publishedAt: Date,
): Promise<void> {
  const [reactions, comments, pool] = await Promise.all([
    prisma.articleReaction.count({ where: { articleId } }),
    prisma.comment.count({ where: { articleId } }),
    loadPool(),
  ]);
  if (reactions === 0) await seedReactions(articleId);
  if (comments === 0) await seedComments(articleId, publishedAt, pool);
}

/**
 * Backfill: fills in whatever is missing on every published article --
 * reactions where it has none, comments where it has none. (It used to skip
 * any article that already had reactions, so once the comment pool was
 * pasted AFTER articles were published, they never got comments.)
 */
export async function applyDemoEngagementToAllMissing(): Promise<number> {
  const pool = await loadPool();
  const candidates = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { reactions: { none: {} } },
        ...(pool.length ? [{ comments: { none: {} } }] : []),
      ],
    },
    select: {
      id: true,
      publishedAt: true,
      _count: { select: { reactions: true, comments: true } },
    },
  });
  for (const a of candidates) {
    if (a._count.reactions === 0) await seedReactions(a.id);
    if (a._count.comments === 0)
      await seedComments(a.id, a.publishedAt ?? new Date(), pool);
  }
  return candidates.length;
}

/** Wipes every seeded reaction/comment — run once, right before going live with real traffic. */
export async function clearAllDemoEngagement(): Promise<{
  reactions: number;
  comments: number;
}> {
  const comments = await prisma.comment.deleteMany({ where: { isSeed: true } });
  const reactions = await prisma.articleReaction.deleteMany({});
  return { reactions: reactions.count, comments: comments.count };
}

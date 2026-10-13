import { prisma } from "@/lib/prisma";
import { asBriefData, BRIEF_CATEGORIES } from "./briefs";
import { estimateCostUsd } from "./generate";
import { sweepStaleBriefs } from "./queue";
import { asSlots } from "./slots";

/** What the API Articles board needs per brief (plain JSON: crosses to a client component). */
export interface BriefView {
  id: string;
  briefNo: number;
  title: string;
  categoryName: string;
  type: string;
  pk: string;
  first: boolean;
  tsens: boolean;
  status: "PENDING" | "QUEUED" | "GENERATING" | "DRAFTED" | "PUBLISHED" | "FAILED";
  /** Failure reason, or (for a DRAFTED brief) review warnings. */
  message: string | null;
  notes: string | null;
  articleId: string | null;
  slug: string | null;
  slotsDone: number;
  slotsTotal: number;
  costUsd: number | null;
  webSearches: number | null;
}

export async function getBriefViews(): Promise<BriefView[]> {
  await sweepStaleBriefs();
  const rows = await prisma.articleBrief.findMany({
    orderBy: [{ source: "asc" }, { briefNo: "asc" }],
    include: { article: { select: { slug: true } } },
  });
  return rows.map((b) => {
    const data = asBriefData(b.data);
    const slots = asSlots(b.imageSlots);
    const cost = estimateCostUsd(b);
    return {
      id: b.id,
      briefNo: b.briefNo,
      title: b.title,
      categoryName: BRIEF_CATEGORIES[data.cat]?.name ?? b.categoryKey,
      type: data.type,
      pk: data.pk,
      first: Boolean(data.first),
      tsens: Boolean(data.tsens),
      status: b.status as BriefView["status"],
      message: b.error,
      notes: b.notes,
      articleId: b.articleId,
      slug: b.article?.slug ?? null,
      slotsDone: slots.filter((s) => s.url).length,
      slotsTotal: slots.length,
      costUsd: cost,
      webSearches: b.webSearches,
    };
  });
}

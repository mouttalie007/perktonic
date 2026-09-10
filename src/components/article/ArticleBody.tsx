import { Fragment } from "react";
import { processArticleHtml } from "@/lib/article-html";
import { adService } from "@/services/ad.service";
import { AdSlot } from "@/components/ads/AdSlot";
import { TableOfContents } from "./TableOfContents";

type BodyArticle = {
  content: string | null;
  adsDisabled: boolean;
  adOverrides: unknown;
};

/**
 * Renders the article body (spec §25, §27): styled prose, an auto table of
 * contents (3+ headings) and in-content ads injected every Nth paragraph
 * when the placement rule is active.
 */
export async function ArticleBody({ article }: { article: BodyArticle }) {
  const rule = await adService.getInContentRule("STANDARD");
  const { toc, segments } = processArticleHtml(article.content ?? "", {
    adEveryNParagraphs: rule?.everyNParagraphs,
    maxAds: rule?.maxInjections,
  });

  const adCtx = {
    adsDisabled: article.adsDisabled,
    adOverrides: (article.adOverrides ?? null) as Record<
      string,
      string | null
    > | null,
  };

  return (
    <>
      {toc.length >= 3 && <TableOfContents items={toc} />}
      <div className="article-prose">
        {segments.map((seg, i) => (
          <Fragment key={i}>
            <div dangerouslySetInnerHTML={{ __html: seg }} />
            {i < segments.length - 1 && (
              <AdSlot placement="in-content" article={adCtx} className="my-8" />
            )}
          </Fragment>
        ))}
      </div>
    </>
  );
}

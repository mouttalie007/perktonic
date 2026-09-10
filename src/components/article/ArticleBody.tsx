import { Fragment } from "react";
import type { TocItem } from "@/lib/article-html";
import { AdSlot } from "@/components/ads/AdSlot";
import { TableOfContents } from "./TableOfContents";

/**
 * Renders the prepared article body (spec §25, §27): the inline table of
 * contents (3+ headings, mobile/tablet only), styled prose, and in-content
 * ads between the pre-split segments.
 */
export function ArticleBody({
  segments,
  toc,
  adCtx,
}: {
  segments: string[];
  toc: TocItem[];
  adCtx: {
    adsDisabled: boolean;
    adOverrides: Record<string, string | null> | null;
  };
}) {
  return (
    <>
      {toc.length >= 3 && <TableOfContents items={toc} variant="inline" />}
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

"use client";

import { useEffect, useRef, useState } from "react";
import { seoCheck, seoScore, type Check } from "@/lib/seo-check";
import { Card } from "@/components/admin/ui";

const ICON = { ok: "✓", warn: "!", bad: "×" } as const;
const TONE = {
  ok: "text-emerald-700 bg-emerald-50",
  warn: "text-amber-700 bg-amber-50",
  bad: "text-rose-700 bg-rose-50",
} as const;

/**
 * Live on-page SEO and style check of the article being written (rules in src/lib/seo-check.ts).
 * It reads the surrounding <form> once a second, because the title, the editor and the SEO fields are uncontrolled inputs.
 */
export function SeoChecklist({ siteHost }: { siteHost: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [checks, setChecks] = useState<Check[]>([]);

  useEffect(() => {
    const read = () => {
      const form = box.current?.closest("form");
      if (!form) return;
      const f = new FormData(form);
      const v = (n: string) => String(f.get(n) ?? "");
      setChecks(
        seoCheck({
          title: v("title"),
          slug: v("slug"),
          excerpt: v("excerpt"),
          seoTitle: v("seoTitle"),
          metaDescription: v("metaDescription"),
          html: v("content"),
          hasFeaturedImage: !!v("featuredImageId"),
          siteHost,
        }),
      );
    };
    read();
    const t = setInterval(read, 1000);
    return () => clearInterval(t);
  }, [siteHost]);

  const score = seoScore(checks);
  const bad = checks.filter((c) => c.status === "bad").length;
  const warn = checks.filter((c) => c.status === "warn").length;

  return (
    <Card className="space-y-3" >
      <div ref={box} className="flex items-baseline justify-between gap-2">
        <h2 className="font-bold">SEO check</h2>
        <span className={`rounded-sm px-2 py-0.5 text-sm font-bold ${score >= 85 ? TONE.ok : score >= 60 ? TONE.warn : TONE.bad}`} aria-label={`SEO score ${score} out of 100`}>
          {score}/100
        </span>
      </div>
      <p className="text-muted text-xs">
        {bad ? `${bad} to fix` : "Nothing blocking"}
        {warn ? `, ${warn} to improve` : ""}. Updates as you type.
      </p>
      <ul className="space-y-1.5">
        {checks.map((c) => (
          <li key={c.id} className="flex gap-2 text-sm">
            <span className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${TONE[c.status]}`} aria-hidden>
              {ICON[c.status]}
            </span>
            <span>
              <span className="font-semibold">{c.label}.</span> <span className="text-muted">{c.detail}</span>
              <span className="sr-only"> ({c.status === "ok" ? "passed" : c.status === "warn" ? "to improve" : "to fix"})</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

import type { DocStats, Warning } from "../src/logic/types";

/**
 * The converter's output for fixtures/sample.docx, shown when the page opens so
 * the converter does not have to load first. A test keeps it identical to a live
 * conversion; regenerate with UPDATE_SAMPLE=1 npx vitest run src/tools/docx-to-markdown-converter.
 */
export const SAMPLE_RESULT: { markdown: string; warnings: Warning[]; stats: DocStats; imageCount: number } = {
  "markdown": "# Checkout redesign brief\n\n# Why we are doing this\n\nMobile checkout converts at **1.9%**, against *3.4%* on desktop[^1]. Most drop-offs happen on the address step. See the [analytics dashboard](https://example.com/analytics/checkout).\n\n## Goals\n\n- Cut checkout to two steps\n  - Address lookup by postcode\n  - Remember the last delivery address\n- Add wallet payments[^2]\n\n## Plan\n\n1. Prototype and test with 8 customers\n2. Build behind a feature flag\n3. Roll out to 10% of traffic, then everyone\n\n## Budget\n\n| **Item** | **Owner** | **Cost (EUR)** |\n| --- | --- | --- |\n| Design sprint | Ada | 6,000 |\n| Address lookup API | Linus | 1,200 per year |\n\n## Conversion by step\n\n![Conversion by checkout step](images/image1.png)\n\nExpected gain:\n\nDecision needed by 15 November\n\n## Event we send\n\n```\nanalytics.track(\"checkout_step\", {\n  step: \"address\",\n  ms: 5400\n});\n```\n\n[^1]: Measured over 30 days in September 2026.\n\n[^2]: Apple Pay and Google Pay, behind a feature flag.\n",
  "warnings": [
    {
      "feature": "Footnotes",
      "count": 2,
      "level": "changed",
      "action": "Converted to Markdown footnotes ([^1] in the text, the note at the end)."
    },
    {
      "feature": "Comments",
      "count": 1,
      "level": "lost",
      "action": "Not included: Markdown has no comments. The commented text itself is kept."
    },
    {
      "feature": "Tracked changes",
      "count": 2,
      "level": "changed",
      "action": "Accepted as in Word's final view: 1 insertion kept, 1 deletion removed."
    },
    {
      "feature": "Text boxes",
      "count": 1,
      "level": "changed",
      "action": "Their text was placed as ordinary paragraphs where the box is anchored; the box and its position are lost."
    },
    {
      "feature": "Equations",
      "count": 1,
      "level": "lost",
      "action": "Not converted: Word equations (OMML) are dropped. Retype them in LaTeX ($…$) if your Markdown renderer supports it."
    },
    {
      "feature": "Headers and footers",
      "count": 2,
      "level": "lost",
      "action": "Not included: page headers and footers have no place in Markdown."
    }
  ],
  "stats": {
    "headings": 7,
    "paragraphs": 15,
    "lists": 3,
    "tables": 1,
    "images": 1,
    "links": 1,
    "codeBlocks": 1,
    "footnotes": 2
  },
  "imageCount": 1
};

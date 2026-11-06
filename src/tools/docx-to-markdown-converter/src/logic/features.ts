import type { Warning } from "./types";

/** The XML parts of a .docx that matter for the feature scan. */
export type DocxParts = Record<string, string>;

export interface FeatureCounts {
  comments: number;
  insertions: number;
  deletions: number;
  textBoxes: number;
  equations: number;
  headersWithText: number;
  footersWithText: number;
  charts: number;
  smartArt: number;
  embeddedObjects: number;
  footnotes: number;
  endnotes: number;
  fields: number;
  mergedCells: number;
}

const count = (xml: string | undefined, re: RegExp) => (xml ? (xml.match(re) ?? []).length : 0);
const hasText = (xml: string) => /<w:t[ >][^<]*\S/.test(xml);

/** Counts what the Markdown cannot hold, straight from the Word XML, so nothing goes missing without a warning. */
export function scanDocx(parts: DocxParts): FeatureCounts {
  const doc = parts["word/document.xml"] ?? "";
  const names = Object.keys(parts);
  return {
    comments: count(doc, /<w:commentReference\b/g),
    insertions: count(doc, /<w:ins\b/g),
    deletions: count(doc, /<w:del\b/g),
    textBoxes: count(doc, /<w:txbxContent\b/g),
    // An equation block (oMathPara) holds oMath children; count the outer ones only.
    equations: count(doc, /<m:oMath\b/g) - count(doc, /<m:oMathPara\b[^>]*>\s*<m:oMath\b/g) + count(doc, /<m:oMathPara\b/g),
    headersWithText: names.filter((n) => /^word\/header\d*\.xml$/.test(n) && hasText(parts[n])).length,
    footersWithText: names.filter((n) => /^word\/footer\d*\.xml$/.test(n) && hasText(parts[n])).length,
    charts: count(doc, /<c:chart\b/g),
    smartArt: count(doc, /<dgm:relIds\b/g),
    embeddedObjects: count(doc, /<w:object\b/g),
    footnotes: count(doc, /<w:footnoteReference\b/g),
    endnotes: count(doc, /<w:endnoteReference\b/g),
    fields: count(doc, /<w:instrText[^>]*>\s*(TOC|INDEX)\b/g),
    mergedCells: count(doc, /<w:gridSpan\b/g) + count(doc, /<w:vMerge\b(?![^>]*w:val="restart")/g),
  };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function warningsFor(c: FeatureCounts): Warning[] {
  const w: Warning[] = [];
  if (c.footnotes) w.push({ feature: "Footnotes", count: c.footnotes, level: "changed", action: "Converted to Markdown footnotes ([^1] in the text, the note at the end)." });
  if (c.endnotes) w.push({ feature: "Endnotes", count: c.endnotes, level: "changed", action: "Converted to Markdown footnotes, numbered after the footnotes." });
  if (c.comments) w.push({ feature: "Comments", count: c.comments, level: "lost", action: "Not included: Markdown has no comments. The commented text itself is kept." });
  if (c.insertions || c.deletions)
    w.push({ feature: "Tracked changes", count: c.insertions + c.deletions, level: "changed", action: `Accepted as in Word's final view: ${plural(c.insertions, "insertion")} kept, ${plural(c.deletions, "deletion")} removed.` });
  if (c.textBoxes) w.push({ feature: "Text boxes", count: c.textBoxes, level: "changed", action: "Their text was placed as ordinary paragraphs where the box is anchored; the box and its position are lost." });
  if (c.equations) w.push({ feature: "Equations", count: c.equations, level: "lost", action: "Not converted: Word equations (OMML) are dropped. Retype them in LaTeX ($…$) if your Markdown renderer supports it." });
  if (c.headersWithText || c.footersWithText)
    w.push({ feature: "Headers and footers", count: c.headersWithText + c.footersWithText, level: "lost", action: "Not included: page headers and footers have no place in Markdown." });
  if (c.charts) w.push({ feature: "Charts", count: c.charts, level: "lost", action: "Not converted. Paste the chart into Word as a picture first if you need it." });
  if (c.smartArt) w.push({ feature: "SmartArt", count: c.smartArt, level: "lost", action: "Not converted. Save it as a picture in Word first if you need it." });
  if (c.embeddedObjects) w.push({ feature: "Embedded objects", count: c.embeddedObjects, level: "lost", action: "Not converted (OLE objects such as embedded spreadsheets)." });
  if (c.fields) w.push({ feature: "Table of contents or index", count: c.fields, level: "changed", action: "Kept as the text Word last generated, without page numbers or links." });
  if (c.mergedCells) w.push({ feature: "Merged table cells", count: c.mergedCells, level: "changed", action: "Markdown tables cannot merge cells: each merged cell is written once and the others are left empty." });
  return w;
}

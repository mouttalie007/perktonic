// Loaded with import() only when the visitor downloads a .docx (the docx library is not in the initial bundle).
import { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { DOC_TYPES, SECTIONS } from "../limits";
import type { SopDoc } from "../types";

const border = { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" };
const borders = { top: border, bottom: border, left: border, right: border };

function table(head: string[], rows: string[][]): Table {
  const cell = (text: string, bold = false) => new TableCell({ borders, children: [new Paragraph({ children: [new TextRun({ text, bold })] })] });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ tableHeader: true, children: head.map((h) => cell(h, true)) }), ...rows.map((r) => new TableRow({ children: r.map((c) => cell(c)) }))],
  });
}

const paragraphs = (text: string) => text.split(/\n+/).filter((l) => l.trim()).map((l) => new Paragraph({ children: [new TextRun(l.trim())], spacing: { after: 120 } }));
const h = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } });

export function buildDocx(doc: SopDoc): Document {
  const [purpose, scope, roles, steps, kpis, revisions] = SECTIONS;
  const type = DOC_TYPES.find((d) => d.id === doc.docType)!;
  return new Document({
    title: doc.title,
    sections: [
      {
        children: [
          new Paragraph({ text: doc.title, heading: HeadingLevel.TITLE }),
          new Paragraph({ children: [new TextRun({ text: type.label, italics: true })], alignment: AlignmentType.LEFT, spacing: { after: 240 } }),
          h(`1. ${purpose}`),
          ...paragraphs(doc.purpose),
          h(`2. ${scope}`),
          ...paragraphs(doc.scope),
          h(`3. ${roles}`),
          table(["Role", "Responsibility"], doc.roles.map((r) => [r.role, r.responsibility])),
          h(`4. ${steps}`),
          table([doc.docType === "onboarding" ? "Done" : "#", "Action", "Owner"], doc.steps.map((s) => [doc.docType === "onboarding" ? `☐ ${s.n}` : String(s.n), s.action, s.owner])),
          h(`5. ${kpis}`),
          table(["KPI", "How it is measured"], doc.kpis.map((k) => [k.name, k.howMeasured])),
          h(`6. ${revisions}`),
          table(["Version", "Date", "Author", "Change"], doc.revisions.map((v) => [v.version, v.date, v.author, v.change])),
        ],
      },
    ],
  });
}

export const docxBlob = (doc: SopDoc) => Packer.toBlob(buildDocx(doc));

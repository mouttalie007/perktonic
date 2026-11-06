// Loaded with import() only when the visitor downloads a .docx (the docx library is not in the initial bundle).
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, BorderStyle } from "docx";
import type { Minutes } from "../types";

const border = { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" };
const borders = { top: border, bottom: border, left: border, right: border };
const cell = (text: string, bold = false) => new TableCell({ borders, children: [new Paragraph({ children: [new TextRun({ text, bold })] })] });
const h = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } });
const bullet = (text: string) => new Paragraph({ text, bullet: { level: 0 } });

export function buildDocx(m: Minutes): Document {
  const actions = m.actionItems.length
    ? [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ tableHeader: true, children: ["Task", "Owner", "Due"].map((t) => cell(t, true)) }), ...m.actionItems.map((i) => new TableRow({ children: [cell(i.task), cell(i.owner ?? "Unassigned"), cell(i.dueDate ?? i.dueText ?? "")] }))] })]
    : [bullet("None recorded")];
  return new Document({
    title: m.title ?? "Meeting minutes",
    sections: [
      {
        children: [
          new Paragraph({ text: m.title ?? "Meeting minutes", heading: HeadingLevel.TITLE }),
          ...(m.date ? [new Paragraph({ children: [new TextRun({ text: `Date: ${m.date}`, italics: true })] })] : []),
          h("Attendees"),
          ...(m.attendees.length ? m.attendees.map((a) => bullet(`${a.name}${a.role ? ` (${a.role})` : ""}`)) : [bullet("Not stated in the transcript")]),
          h("Agenda"),
          ...m.agenda.flatMap((t, i) => [new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${t.topic}`, bold: true })], spacing: { before: 120 } }), new Paragraph({ text: t.summary })]),
          h("Decisions"),
          ...(m.decisions.length ? m.decisions.map((d) => bullet(d.text)) : [bullet("None recorded")]),
          h("Action items"),
          ...actions,
          h("Open questions"),
          ...(m.openQuestions.length ? m.openQuestions.map((q) => bullet(q.text)) : [bullet("None")]),
        ],
      },
    ],
  });
}

export const docxBlob = (m: Minutes) => Packer.toBlob(buildDocx(m));

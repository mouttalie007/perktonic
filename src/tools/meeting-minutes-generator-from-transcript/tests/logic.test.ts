import { strFromU8, unzipSync } from "fflate";
import { Packer } from "docx";
import { describe, expect, test } from "vitest";
import { makeDocx } from "../fixtures/makeDocx";
import { sampleAnswer } from "../fixtures/sampleAnswer";
import { sampleInput } from "../fixtures/sampleInput";
import { sampleResult } from "../fixtures/sampleResult";
import { SAMPLE_VTT, SAMPLE_VTT_TEXT } from "../fixtures/sampleVtt";
import { sniff } from "../src/logic/docFile";
import { readDocx } from "../src/logic/readDocx";
import { toActionsCsv, toChecklist, toMarkdown, toPlainText } from "../src/logic/render";
import { buildResult, nameInText } from "../src/logic/result";
import { buildDocx } from "../src/logic/toDocx";
import { detectFormat, normaliseTranscript, parseCues } from "../src/logic/transcript";

const SRT = `1
00:00:01,000 --> 00:00:04,000
Maria: We need the budget by Friday.

2
00:00:04,500 --> 00:00:07,000
Maria: And the slides.

3
00:01:10,000 --> 00:01:12,000
Tom: I'll do the slides.
`;

describe("transcript files: our WebVTT and SRT parser", () => {
  test("WebVTT: <v Name> speakers, headers and tags dropped", () => {
    expect(detectFormat(SAMPLE_VTT)).toBe("vtt");
    const out = normaliseTranscript(SAMPLE_VTT, { timestamps: false });
    expect(out.text).toBe(SAMPLE_VTT_TEXT);
    expect(out.speakers).toEqual(["Jo", "Ben"]);
    expect(parseCues("WEBVTT\n\nNOTE a comment\n\n00:01.000 --> 00:02.000\n<v.loud Ana><i>Hello</i> &amp; welcome", "vtt")).toEqual([{ start: 1, speaker: "Ana", text: "Hello & welcome" }]);
  });
  test("SRT: 'Name:' speakers, same-speaker cues joined, optional [mm:ss] times", () => {
    expect(detectFormat(SRT)).toBe("srt");
    expect(normaliseTranscript(SRT, { timestamps: false }).text).toBe("Maria: We need the budget by Friday. And the slides.\nTom: I'll do the slides.");
    expect(normaliseTranscript(SRT, { timestamps: true }).text).toBe("[00:01] Maria: We need the budget by Friday. And the slides.\n[01:10] Tom: I'll do the slides.");
    expect(normaliseTranscript("Plain text\r\nstays", { timestamps: true })).toMatchObject({ text: "Plain text\nstays", format: "text" });
  });
  test("files: .vtt, .srt and .txt are text; .docx is read with mammoth; audio is refused with a clear message", async () => {
    const t = new TextEncoder().encode("WEBVTT");
    expect(sniff("call.vtt", t, { md: false, docx: true }).kind).toBe("text");
    expect(sniff("call.srt", t, { md: false, docx: true }).kind).toBe("text");
    expect(sniff("call.mp3", Uint8Array.from([0x49, 0x44, 0x33]), { md: false, docx: true }).error).toMatch(/Audio and video files are not supported/);
    expect((await readDocx(makeDocx(["Ana: Hello.", "Ben: Hi."]))).trim()).toBe("Ana: Hello.\n\nBen: Hi.");
  });
});

describe("server rules", () => {
  test("the saved sample keeps everything and resolves the relative dates", () => {
    if (sampleResult.status !== "ok") throw new Error("expected ok");
    expect(sampleResult.adjustments).toEqual({ droppedDecisions: 0, droppedActions: 0, droppedQuestions: 0, attendeesRemoved: 0, ownersCleared: 0, datesCleared: 0, datesCorrected: 0, titleCleared: false, dateCleared: false });
    expect(sampleResult.actionItems.map((i) => [i.owner, i.dueDate])).toEqual([["Lena Park", "2026-11-04"], ["Sam Okafor", "2026-11-13"], [null, "2026-11-30"]]);
  });

  test("invented quotes, attendees, owners, far dates, titles and dates are removed or cleared, and counted", () => {
    const r = buildResult(
      {
        ...sampleAnswer,
        title: "Q4 strategy offsite",
        date: "2026-11-20",
        attendees: [...sampleAnswer.attendees, { name: "Olivia Grant", role: "CEO" }],
        decisions: [...sampleAnswer.decisions, { text: "Cut prices by 10%.", quote: "We cut prices by 10%." }],
        openQuestions: [{ text: "x", quote: "Is this real?" }],
        actionItems: [
          { ...sampleAnswer.actionItems[0], owner: "Olivia" },
          { ...sampleAnswer.actionItems[1], dueDate: "2040-01-01", dueText: null },
          { task: "Book the venue", owner: "Marco", dueDate: null, dueText: null, quote: "Marco will book the venue." },
        ],
      },
      sampleInput,
      false,
    );
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.attendees.map((a) => a.name)).not.toContain("Olivia Grant");
    expect(r.decisions).toHaveLength(1);
    expect(r.actionItems).toHaveLength(2);
    expect(r.actionItems[0].owner).toBeNull();
    expect(r.actionItems[1].dueDate).toBeNull();
    expect(r.adjustments).toMatchObject({ droppedDecisions: 1, droppedActions: 1, droppedQuestions: 1, attendeesRemoved: 1, ownersCleared: 1, datesCleared: 1, titleCleared: true, dateCleared: true });
    expect(r.title).toBeNull();
    expect(r.date).toBeNull();
  });

  test("the form's title and date win; first names count as named", () => {
    const r = buildResult({ ...sampleAnswer, title: null, date: null }, { ...sampleInput, title: "Mobile sync", date: "2026-11-02" }, false);
    expect(r.status === "ok" && [r.title, r.date]).toEqual(["Mobile sync", "2026-11-02"]);
    expect(nameInText("Lena Park", "Lena: hello")).toBe(true);
    expect(nameInText("Olivia Grant", "Lena: hello")).toBe(false);
    expect(nameInText("Al", "Also: hello")).toBe(false);
  });
});

describe("exports", () => {
  if (sampleResult.status !== "ok") throw new Error("expected ok");
  const m = sampleResult;
  test("Markdown minutes, the action checklist, CSV with BOM and plain text", () => {
    const md = toMarkdown(m);
    expect(md.split("\n")[0]).toBe("# weekly product sync for the mobile app");
    expect([...md.matchAll(/^## (.+)$/gm)].map((x) => x[1])).toEqual(["Attendees", "Agenda", "Decisions", "Action items", "Open questions"]);
    expect(toChecklist(m).split("\n")[2]).toBe("- [ ] Renew the support domain (Unassigned, due 2026-11-30)");
    const csv = toActionsCsv(m);
    expect(csv.startsWith("﻿task,owner,due_date,due_text,quote\r\n")).toBe(true);
    expect(csv).toContain("Update the pricing page copy,Lena Park,2026-11-04,by Wednesday,I'll update the pricing page copy by Wednesday.");
    expect(toPlainText(m)).toContain("ACTION ITEMS\n- Update the pricing page copy (Lena Park, due 2026-11-04)");
  });
  test("DOCX holds every section", async () => {
    const xml = strFromU8(unzipSync(new Uint8Array(await Packer.toBuffer(buildDocx(m))))["word/document.xml"]);
    for (const s of ["Attendees", "Agenda", "Decisions", "Action items", "Open questions", "Renew the support domain", "Unassigned"]) expect(xml).toContain(s);
  }, 15000);
});

import { describe, expect, test } from "vitest";
import { resolveDue, withinWindow } from "../src/logic/dates";
import { toCsv, toMarkdown } from "../src/logic/export";
import { containsCollapsed, findQuote } from "../src/logic/text";

const REF = "2026-11-02"; // a Monday

describe("relative dates resolved against the reference date", () => {
  test("today, tomorrow, weekdays, next weekday, end of month/week, in N days, written dates", () => {
    expect(resolveDue("tomorrow", REF)).toBe("2026-11-03");
    expect(resolveDue("by Wednesday", REF)).toBe("2026-11-04");
    expect(resolveDue("Monday", REF)).toBe("2026-11-02");
    expect(resolveDue("before next Friday", REF)).toBe("2026-11-13");
    expect(resolveDue("next Monday", REF)).toBe("2026-11-09");
    expect(resolveDue("at the end of the month", REF)).toBe("2026-11-30");
    expect(resolveDue("end of the week", REF)).toBe("2026-11-06");
    expect(resolveDue("within 2 weeks", REF)).toBe("2026-11-16");
    expect(resolveDue("on 9 November", REF)).toBe("2026-11-09");
    expect(resolveDue("by December 4", REF)).toBe("2026-12-04");
    expect(resolveDue("15 January", REF)).toBe("2027-01-15");
    expect(resolveDue("March 3, 2027", REF)).toBe("2027-03-03");
  });
  test("phrases it cannot resolve return null (the model's date is then kept if valid)", () => {
    expect(resolveDue("demain", REF)).toBeNull();
    expect(resolveDue("within 30 days of the Effective Date", REF)).toBeNull();
    expect(resolveDue("soon", REF)).toBeNull();
    expect(resolveDue("February 30", REF)).toBeNull();
  });
  test("the 5-year window and ISO validation", () => {
    expect(withinWindow("2031-11-02", REF, 5)).toBe(true);
    expect(withinWindow("2031-11-03", REF, 5)).toBe(false);
    expect(withinWindow("2026-13-01", REF, 5)).toBe(false);
    expect(withinWindow("next week", REF, 5)).toBe(false);
  });
});

describe("quotes, owners and exports", () => {
  test("matching ignores differences in whitespace, and findQuote returns the offsets in the original text", () => {
    const text = "Intro.\nSam will collect the slowest\n   examples today.";
    expect(containsCollapsed(text, "Sam will collect the slowest examples today.")).toBe(true);
    expect(containsCollapsed(text, "sam will", true)).toBe(true);
    expect(containsCollapsed(text, "Sam will collect all examples")).toBe(false);
    const [s, e] = findQuote(text, "the slowest examples")!;
    expect(text.slice(s, e)).toBe("the slowest\n   examples");
  });
  test("CSV has a BOM, quotes commas and neutralises formula-looking cells; Markdown is a checklist", () => {
    const items = [
      { task: "Send the quote, signed", owner: "Marie", dueDate: "2026-11-03", dueText: "demain", quote: 'She said "today"' },
      { task: "=HYPERLINK(\"x\")", owner: null, dueDate: null, dueText: null, quote: "q" },
    ];
    const csv = toCsv(items);
    expect(csv.startsWith("﻿Task,Owner,Due date,Due (as written),Quote\r\n")).toBe(true);
    expect(csv).toContain('"Send the quote, signed",Marie,2026-11-03,demain,"She said ""today"""');
    expect(csv).toContain(`"'=HYPERLINK(""x"")",Unassigned`);
    expect(toMarkdown(items)).toBe('- [ ] Send the quote, signed (Marie, 2026-11-03)\n- [ ] =HYPERLINK("x") (Unassigned)\n');
  });
});

import { decodeTextFile } from "../src/logic/file";

describe("reading .txt and .md files in the browser", () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  test("accepts UTF-8 text (with or without BOM) and normalises line endings", () => {
    expect(decodeTextFile("notes.txt", enc("﻿Line one\r\nLine two"))).toEqual({ ok: true, text: "Line one\nLine two" });
    expect(decodeTextFile("notes.md", enc("سيقوم أحمد بإرسال التقرير"))).toMatchObject({ ok: true });
  });
  test("refuses other extensions, PDFs and ZIP files by their magic bytes, and too-long text", () => {
    expect(decodeTextFile("notes.docx", enc("x")).ok).toBe(false);
    expect(decodeTextFile("fake.txt", new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toMatchObject({ ok: false, error: expect.stringMatching(/PDF/) });
    expect(decodeTextFile("fake.txt", new Uint8Array([0x50, 0x4b, 3, 4]))).toMatchObject({ ok: false, error: expect.stringMatching(/ZIP/) });
    expect(decodeTextFile("long.txt", enc("a".repeat(20001)))).toMatchObject({ ok: false, error: expect.stringMatching(/does not split long texts/) });
  });
});

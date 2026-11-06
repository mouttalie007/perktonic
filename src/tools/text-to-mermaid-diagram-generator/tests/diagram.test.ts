// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import { checkInput, detectKind, formatMermaidError, MAX_CHARS, strictModeNotes } from "../src/logic/diagram";
import { exportName, findUnsafeSvg, pngSize, standaloneSvg, svgSize } from "../src/logic/svg";
import { BROKEN_FLOWCHART, HOSTILE_FLOWCHART, TEMPLATES, type DiagramKind } from "../fixtures/templates";

type MermaidApi = {
  initialize: (c: Record<string, unknown>) => void;
  parse: (code: string) => Promise<{ diagramType: string }>;
};
let mermaid: MermaidApi;

beforeAll(async () => {
  mermaid = (await import("mermaid")).default as unknown as MermaidApi;
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", htmlLabels: false });
});

const parseError = async (code: string) => {
  try {
    await mermaid.parse(code);
  } catch (err) {
    return formatMermaidError(err, code);
  }
  throw new Error("expected a parse error");
};

describe("diagram types", () => {
  it("every template parses with Mermaid and is detected as the right type", async () => {
    const expected: Record<DiagramKind, RegExp> = {
      flowchart: /flowchart/,
      sequence: /sequence/,
      er: /er/,
      gantt: /gantt/,
      state: /state/,
      class: /class/,
    };
    for (const [kind, t] of Object.entries(TEMPLATES) as [DiagramKind, { code: string }][]) {
      const r = await mermaid.parse(t.code);
      expect(r.diagramType).toMatch(expected[kind]);
      expect(detectKind(t.code)).toEqual({ ok: true, kind });
    }
  });

  it("detects the type after front matter, comments and directives", () => {
    expect(detectKind("---\ntitle: Orders\n---\n%% a comment\n%%{init: {\"theme\": \"forest\"}}%%\ngraph LR\n a-->b")).toEqual({ ok: true, kind: "flowchart" });
    expect(detectKind("stateDiagram\n [*] --> A")).toEqual({ ok: true, kind: "state" });
    const bad = detectKind("\n\npiechart\n a: 1");
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.line).toBe(3);
      expect(bad.error).toContain("piechart");
    }
    expect(detectKind("   ").ok).toBe(false);
  });
});

describe("errors", () => {
  it("reports the line of a syntax error in plain words", async () => {
    const e = await parseError(BROKEN_FLOWCHART);
    expect(e.line).toBe(4);
    expect(e.source).toBe("B -- No --> -->");
    expect(e.message).toBe("Line 4: Mermaid did not expect another arrow here. A node, arrow target or closing bracket is probably missing.");
    expect(e.message).toMatch(/^Line 4: /);
    expect(e.message).not.toMatch(/Expecting/);
  });

  it("handles a missing closing bracket and an error at the end of the input", async () => {
    const e = await parseError("flowchart LR\n    A[Start --> B");
    expect(e.line).toBe(2);
    const end = await parseError("sequenceDiagram\n    Alice->>");
    expect(end.line).toBe(2);
    expect(end.message).toMatch(/Line 2/);
  });

  it("falls back to a readable message for unknown errors", () => {
    expect(formatMermaidError(new Error("No diagram type detected matching given configuration for text: hello"), "hello").message).toMatch(/No diagram type found/);
    expect(formatMermaidError("weird", "x").message).toBe("weird");
  });
});

describe("strict security", () => {
  it("flags click handlers, init overrides and HTML so the page can explain they are ignored", () => {
    const notes = strictModeNotes(HOSTILE_FLOWCHART);
    expect(notes).toHaveLength(3);
    expect(strictModeNotes(TEMPLATES.flowchart.code)).toEqual([]);
  });

  it("rejects SVG that still contains scripts, handlers or external content", () => {
    expect(findUnsafeSvg('<svg><script>alert(1)</script></svg>')).toContain("script element");
    expect(findUnsafeSvg('<svg><g onclick="x()"></g></svg>')).toContain("event handler attribute");
    expect(findUnsafeSvg('<svg><a href="javascript:alert(1)"></a></svg>')).toContain("javascript: link");
    expect(findUnsafeSvg('<svg><image href="https://evil.example/x.png"/></svg>')).toContain("external image");
    expect(findUnsafeSvg('<svg viewBox="0 0 10 10"><style>.a{fill:red}</style><text class="a">ok</text></svg>')).toEqual([]);
  });

  it("enforces the 20,000 character limit", () => {
    expect(checkInput("a".repeat(MAX_CHARS)).ok).toBe(true);
    const r = checkInput("a".repeat(MAX_CHARS + 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("20,000");
  });
});

describe("export", () => {
  const svg = '<svg id="m1" width="100%" xmlns="http://www.w3.org/2000/svg" style="max-width: 812.5px;" viewBox="-8 -8 812.5 430"><g/></svg>';

  it("reads the drawing size from the viewBox", () => {
    expect(svgSize(svg)).toEqual({ width: 812.5, height: 430 });
    expect(svgSize('<svg width="40" height="20"></svg>')).toEqual({ width: 40, height: 20 });
    expect(svgSize("<svg></svg>")).toBeNull();
  });

  it("renders PNG at 2× and scales down huge diagrams to stay within canvas limits", () => {
    expect(pngSize({ width: 812.5, height: 430 })).toEqual({ width: 1625, height: 860, scale: 2 });
    const huge = pngSize({ width: 12000, height: 3000 });
    expect(huge.width).toBeLessThanOrEqual(16384);
    expect(huge.width * huge.height).toBeLessThanOrEqual(16_777_216);
    expect(huge.width / huge.height).toBeCloseTo(4, 1);
  });

  it("makes a standalone SVG file with fixed size and background", () => {
    const out = standaloneSvg(svg, "#ffffff");
    expect(out.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg')).toBe(true);
    expect(out).toContain('width="812.5" height="430"');
    expect(out).toContain('style="background-color: #ffffff"');
    expect(out).not.toContain("max-width");
    expect((out.match(/xmlns=/g) ?? []).length).toBe(1);
    expect(exportName("flowchart", "png")).toBe("flowchart-diagram.png");
  });
});

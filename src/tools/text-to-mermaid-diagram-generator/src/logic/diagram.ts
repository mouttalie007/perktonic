import type { DiagramKind } from "../../fixtures/templates";

export const MAX_CHARS = 20_000;
/** Above this size the preview re-renders only when asked, because Mermaid layout blocks the main thread. */
export const LARGE_CHARS = 5_000;

export type Theme = "light" | "dark";

const KIND_PATTERNS: [RegExp, DiagramKind][] = [
  [/^(flowchart|graph)\b/, "flowchart"],
  [/^sequenceDiagram\b/, "sequence"],
  [/^erDiagram\b/, "er"],
  [/^gantt\b/, "gantt"],
  [/^stateDiagram(-v2)?\b/, "state"],
  [/^classDiagram(-v2)?\b/, "class"],
];

/** Strips YAML front matter, %% comments and %%{init}%% directives, returning the remaining lines with their original numbers. */
function meaningfulLines(code: string): { text: string; line: number }[] {
  const lines = code.split(/\r?\n/);
  let start = 0;
  if (lines[0]?.trim() === "---") {
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
    if (end > 0) start = end + 1;
  }
  const out: { text: string; line: number }[] = [];
  for (let i = start; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === "" || t.startsWith("%%")) continue;
    out.push({ text: t, line: i + 1 });
  }
  return out;
}

export type KindResult = { ok: true; kind: DiagramKind } | { ok: false; error: string; line: number | null };

export function detectKind(code: string): KindResult {
  const first = meaningfulLines(code)[0];
  if (!first) return { ok: false, error: "The editor is empty. Pick a template or type Mermaid code.", line: null };
  for (const [re, kind] of KIND_PATTERNS) if (re.test(first.text)) return { ok: true, kind };
  const word = first.text.split(/\s+/)[0];
  return {
    ok: false,
    line: first.line,
    error: `Line ${first.line} starts with “${word}”, which is not a supported diagram type. Start with flowchart, sequenceDiagram, erDiagram, gantt, stateDiagram-v2 or classDiagram.`,
  };
}

export type InputCheck = { ok: true } | { ok: false; error: string };

export function checkInput(code: string): InputCheck {
  if (code.length > MAX_CHARS) {
    return { ok: false, error: `The code is ${code.length.toLocaleString("en-US")} characters long. The limit is ${MAX_CHARS.toLocaleString("en-US")}; split the diagram into smaller ones.` };
  }
  return { ok: true };
}

/** Lines that strict mode will ignore, so the page can say so instead of failing silently. */
export function strictModeNotes(code: string): string[] {
  const notes: string[] = [];
  if (/^\s*click\s/m.test(code)) notes.push("Click handlers and links (click …) are disabled for safety, so nodes are not clickable.");
  if (/%%\{\s*init[\s\S]*?securityLevel/i.test(code)) notes.push("The securityLevel setting in %%{init}%% is ignored; this tool always renders in strict mode.");
  if (/<\s*(script|img|iframe|a)\b/i.test(code)) notes.push("HTML inside labels is shown as text or removed; it never runs.");
  return notes;
}

export interface DiagramError {
  line: number | null;
  message: string;
  /** The code line the error points at, for display. */
  source: string | null;
}

interface MermaidLikeError {
  message?: unknown;
  hash?: { line?: unknown; loc?: { first_line?: unknown }; token?: unknown; expected?: unknown };
}

// Mermaid's grammar token names, translated; unknown ALL_CAPS tokens get a generic message.
const TOKEN_NAMES: Record<string, string> = {
  EOF: "the end of the diagram",
  NEWLINE: "a line break",
  SPACE: "a space",
  LINK: "another arrow",
  ARROW_POINT: "another arrow",
  SQS: "an opening [",
  SQE: "a closing ]",
  PS: "an opening (",
  PE: "a closing )",
  DIAMOND_START: "an opening {",
  DIAMOND_STOP: "a closing }",
  TEXT: "text",
  STR: "a quoted text",
  COLON: "a colon",
  NODE_STRING: "a node name",
  PIPE: "a | character",
};

/**
 * Turns a Mermaid parser error into one human sentence with a line number.
 * Mermaid's message line is sometimes off by one; the parser's location
 * object is preferred when present.
 */
export function formatMermaidError(err: unknown, code: string): DiagramError {
  const e = (err ?? {}) as MermaidLikeError;
  const raw = typeof e.message === "string" ? e.message : String(err);
  let line: number | null = null;
  const locLine = e.hash?.loc?.first_line;
  if (typeof locLine === "number" && locLine > 0) line = locLine;
  else {
    const m = /on line (\d+)/i.exec(raw);
    if (m) line = Number(m[1]);
  }
  const lines = code.split(/\r?\n/);
  if (line !== null && (line < 1 || line > lines.length)) line = Math.min(Math.max(line, 1), lines.length);
  // When the parser hits the end of the input, the real culprit is the last non-empty line.
  if (e.hash?.token === "EOF" && line !== null) {
    for (let i = Math.min(line, lines.length) - 1; i >= 0; i--) {
      if (lines[i].trim() !== "") {
        line = i + 1;
        break;
      }
    }
  }

  let message: string;
  if (/^Lexical error/i.test(raw)) message = "Mermaid does not recognise some text here. Check for a typo in a keyword or an unclosed bracket or quote.";
  else if (/^Parse error/i.test(raw)) {
    const got = /got '([^']+)'/.exec(raw)?.[1];
    const what = got ? TOKEN_NAMES[got] ?? (/^[A-Z_]+$/.test(got) ? null : `“${got}”`) : null;
    message = what
      ? `Mermaid did not expect ${what} here. A node, arrow target or closing bracket is probably missing.`
      : "Mermaid could not understand this line. Check the arrow syntax and brackets.";
  } else if (/No diagram type detected|UnknownDiagramError/i.test(raw)) {
    message = "No diagram type found. The first line must be flowchart, sequenceDiagram, erDiagram, gantt, stateDiagram-v2 or classDiagram.";
  } else {
    message = raw.split("\n")[0].slice(0, 200) || "Mermaid could not draw this diagram.";
  }
  const source = line !== null ? lines[line - 1]?.trim() ?? null : null;
  return { line, message: line !== null ? `Line ${line}: ${message}` : message, source };
}

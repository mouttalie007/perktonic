// WebVTT and SubRip (SRT) cues → clean text with speaker labels. Our own parser.

export interface Cue {
  start: number;
  speaker: string | null;
  text: string;
}

export type Format = "vtt" | "srt" | "text";

const TIME = /(\d{1,2}:)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;
const ARROW = /-->/;

function seconds(t: string): number {
  const m = TIME.exec(t);
  if (!m) return 0;
  return (m[1] ? parseInt(m[1], 10) * 3600 : 0) + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
}

export function detectFormat(text: string): Format {
  const t = text.replace(/^﻿/, "").trimStart();
  if (/^WEBVTT/.test(t)) return "vtt";
  if (/^\d+\s*\r?\n\s*\d{1,2}:\d{2}:\d{2},\d{1,3}\s*-->/.test(t)) return "srt";
  return "text";
}

/** Tags such as <c>, <i>, <00:00:01.000> are dropped; `<v Name>` gives the speaker. */
function cleanCueText(lines: string[]): { speaker: string | null; text: string } {
  let speaker: string | null = null;
  const parts = lines.map((l) => {
    const v = /<v(?:\.[^\s>]+)?\s+([^>]+)>/.exec(l);
    if (v) speaker = v[1].trim();
    return l.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").trim();
  });
  let text = parts.filter(Boolean).join(" ");
  // "Name: words" at the start of a cue (common in SRT exports).
  if (!speaker) {
    const m = /^([\p{Lu}][\p{L}'’.-]*(?: [\p{Lu}][\p{L}'’.-]*){0,3}):\s+(.+)$/u.exec(text);
    if (m) {
      speaker = m[1];
      text = m[2];
    }
  }
  return { speaker, text };
}

export function parseCues(raw: string, format: "vtt" | "srt"): Cue[] {
  const blocks = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split(/\n\s*\n/);
  const cues: Cue[] = [];
  for (const b of blocks) {
    const lines = b.split("\n").filter((l) => l.trim() !== "");
    const at = lines.findIndex((l) => ARROW.test(l));
    if (at < 0) continue; // WEBVTT header, NOTE, STYLE, REGION blocks
    if (format === "vtt" && /^(NOTE|STYLE|REGION)\b/.test(lines[0])) continue;
    const { speaker, text } = cleanCueText(lines.slice(at + 1));
    if (text) cues.push({ start: seconds(lines[at]), speaker, text });
  }
  return cues;
}

const stamp = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h ? `[${h}:${p(m)}:${p(sec)}]` : `[${p(m)}:${p(sec)}]`;
};

/** Consecutive cues of the same speaker are joined into one paragraph. */
export function cuesToText(cues: Cue[], timestamps: boolean): string {
  const out: string[] = [];
  let last: { speaker: string | null; line: string } | null = null;
  for (const c of cues) {
    if (last && last.speaker === c.speaker) {
      last.line += ` ${c.text}`;
      out[out.length - 1] = last.line;
      continue;
    }
    const line = `${timestamps ? `${stamp(c.start)} ` : ""}${c.speaker ? `${c.speaker}: ` : ""}${c.text}`;
    last = { speaker: c.speaker, line };
    out.push(line);
  }
  return out.join("\n");
}

/** A transcript file or pasted text → the text the tool works on. Plain text is kept as it is. */
export function normaliseTranscript(raw: string, opts: { timestamps: boolean }): { text: string; format: Format; cues: number; speakers: string[] } {
  const format = detectFormat(raw);
  if (format === "text") return { text: raw.replace(/\r\n?/g, "\n").trim(), format, cues: 0, speakers: [] };
  const cues = parseCues(raw, format);
  return { text: cuesToText(cues, opts.timestamps), format, cues: cues.length, speakers: [...new Set(cues.map((c) => c.speaker).filter((s): s is string => !!s))] };
}

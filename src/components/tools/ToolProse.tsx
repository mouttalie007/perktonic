import type { ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";

/**
 * Renders the small Markdown subset used by tool content files: paragraphs,
 * bullet and numbered lists, fenced code, **bold**, `code` and [links](/path).
 * Output is React elements only (no raw HTML), so developer text can't inject markup.
 */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (m[1]) {
      out.push(
        <code key={key++} className="bg-primary-soft text-navy rounded px-1.5 py-0.5 text-[0.88em] [overflow-wrap:anywhere]">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (m[2]) {
      out.push(<strong key={key++}>{inline(tok.slice(2, -2))}</strong>);
    } else {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      const href = lm?.[2] ?? "";
      if (lm && href.startsWith("/")) {
        out.push(
          <Link key={key++} href={href as Route} className="text-primary font-semibold underline">
            {lm[1]}
          </Link>,
        );
      } else {
        out.push(tok);
      }
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { kind: "p"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "code"; text: string };

function parseBlocks(md: string): Block[] {
  const lines = md.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
    } else if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push({ kind: "code", text: code.join("\n") });
    } else if (/^\s*[-*] /.test(line) || /^\s*\d+\. /.test(line)) {
      const ordered = /^\s*\d+\. /.test(line);
      const marker = ordered ? /^\s*\d+\. / : /^\s*[-*] /;
      const items: string[] = [];
      while (i < lines.length && marker.test(lines[i])) items.push(lines[i++].replace(marker, ""));
      blocks.push({ kind: ordered ? "ol" : "ul", items });
    } else {
      const para: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !lines[i].startsWith("```") &&
        !/^\s*[-*] /.test(lines[i]) &&
        !/^\s*\d+\. /.test(lines[i])
      ) {
        para.push(lines[i++]);
      }
      blocks.push({ kind: "p", text: para.join(" ") });
    }
  }
  return blocks;
}

export function ToolProse({ markdown }: { markdown: string }) {
  return (
    <div className="text-slate-ink space-y-4 text-[1.02rem] leading-relaxed">
      {parseBlocks(markdown).map((b, i) => {
        if (b.kind === "p") return <p key={i}>{inline(b.text)}</p>;
        if (b.kind === "code") {
          return (
            <pre key={i} className="bg-ink-deep overflow-x-auto rounded-xl p-4 text-[0.85rem] leading-relaxed text-slate-100">
              <code>{b.text}</code>
            </pre>
          );
        }
        if (b.kind === "ol") {
          return (
            <ol key={i} className="space-y-3.5">
              {b.items.map((it, j) => (
                <li key={j} className="flex items-start gap-3.5">
                  <span
                    aria-hidden
                    className="bg-primary-soft text-primary-dark mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[0.8rem] font-extrabold"
                  >
                    {j + 1}
                  </span>
                  <span className="min-w-0 pt-0.5">{inline(it)}</span>
                </li>
              ))}
            </ol>
          );
        }
        return (
          <ul key={i} className="marker:text-primary list-disc space-y-1.5 pl-6">
            {b.items.map((it, j) => (
              <li key={j}>{inline(it)}</li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}

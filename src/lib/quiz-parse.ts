/**
 * Parses the admin's pasted quiz text into a title + exactly 10 questions of
 * exactly 3 options each. Pure function (no I/O) so it's easy to unit-test
 * and reuse between the server action and any future preview UI.
 *
 * Expected format:
 *
 *   Title: How Well Do You Know Free Samples?
 *
 *   1. What's the safest sign a free sample offer is legitimate?
 *   A) It asks for your full SSN
 *   B) It has a real company name and privacy policy
 *   C) It asks you to pay "shipping" with a wire transfer
 *
 *   2. ...
 *   A) ...
 *   B) ...
 *   C) ...
 */

export interface ParsedQuizQuestion {
  position: number;
  question: string;
  options: [string, string, string];
}

export type ParseQuizResult =
  | { ok: true; title: string; questions: ParsedQuizQuestion[] }
  | { ok: false; error: string };

const TITLE_RE = /^title:\s*(.+)$/i;
const QUESTION_RE = /^(\d{1,2})\.\s*(.+)$/;
const OPTION_RE = /^[A-Ca-c][).]\s*(.+)$/;

export function parseQuizPaste(raw: string): ParseQuizResult {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { ok: false, error: "Paste the quiz title and 10 questions first." };
  }

  const titleMatch = TITLE_RE.exec(lines[0]);
  if (!titleMatch) {
    return { ok: false, error: 'First line must be "Title: <quiz title>".' };
  }
  const title = titleMatch[1].trim();
  if (!title) {
    return { ok: false, error: "Quiz title can't be empty." };
  }

  const questions: ParsedQuizQuestion[] = [];
  let i = 1;
  let expectedPosition = 1;

  while (i < lines.length) {
    const qMatch = QUESTION_RE.exec(lines[i]);
    if (!qMatch) {
      return {
        ok: false,
        error: `Expected a numbered question like "${expectedPosition}. Question text?" at: "${lines[i]}"`,
      };
    }
    const position = Number(qMatch[1]);
    if (position !== expectedPosition) {
      return {
        ok: false,
        error: `Questions must be numbered in order (1, 2, 3...). Expected "${expectedPosition}." but found "${position}."`,
      };
    }
    const question = qMatch[2].trim();
    i++;

    const options: string[] = [];
    while (i < lines.length && OPTION_RE.test(lines[i]) && options.length < 3) {
      options.push(OPTION_RE.exec(lines[i])![1].trim());
      i++;
    }

    if (options.length !== 3) {
      return {
        ok: false,
        error: `Question ${position} needs exactly 3 options (A), B), C)) -- found ${options.length}.`,
      };
    }

    questions.push({ position, question, options: options as [string, string, string] });
    expectedPosition++;
  }

  if (questions.length !== 10) {
    return {
      ok: false,
      error: `Need exactly 10 questions -- found ${questions.length}.`,
    };
  }

  return { ok: true, title, questions };
}

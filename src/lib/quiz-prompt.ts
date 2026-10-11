/** Builds the ChatGPT prompt for generating a 10-question quiz from a live article URL. */
export function buildQuizPrompt(articleUrl: string): string {
  return `Read the article at this link: ${articleUrl}

Based on it, write a 10-question quiz in exactly this format (English only, no extra text before or after):

Title: <a short, catchy quiz title related to the article>

1. <question 1 based on the article>?
A) <option>
B) <option>
C) <option>

2. <question 2>?
A) <option>
B) <option>
C) <option>

(continue the same way through question 10)

Rules:
- Exactly 10 questions, numbered 1 to 10.
- Exactly 3 options per question, labeled A), B), C).
- Do not say or mark which option is correct -- just the question and its three options, nothing else.
- Keep each question and option short and clear.`;
}

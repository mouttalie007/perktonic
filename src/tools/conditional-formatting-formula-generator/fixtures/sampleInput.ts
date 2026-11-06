import type { PromptInput } from "../src/llm/prompt";

export const sampleInput: PromptInput = {
  "description": "Highlight the whole row when Status in column E is Overdue and the Amount in column D is over 1000.",
  "range": "A2:G200",
  "platform": "excel" as const
};

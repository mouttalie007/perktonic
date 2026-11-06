import type { PromptInput } from "../src/llm/prompt";

export const sampleInput: PromptInput = {
  "task": "When the Status column (D) changes to \"Done\", send an email to the address in column C of that row with the task name from column B, and write the date sent in column E.",
  "sheet": "Sheet \"Tasks\": A Task ID, B Task, C Owner email, D Status, E Notified on. Header in row 1.",
  "trigger": "installable-onedit"
};

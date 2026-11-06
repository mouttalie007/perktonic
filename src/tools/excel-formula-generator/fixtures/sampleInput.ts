import type { PromptInput } from "../src/llm/prompt";

export const sampleInput: PromptInput = {
  request: "Add up the sales in column C where the region in column B is North and the date in column A is in March 2026.",
  platform: "excel365",
  columns: "A: Order date, B: Region, C: Sales. Headers in row 1, data in rows 2 to 500.",
};

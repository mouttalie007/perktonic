import type { PromptInput } from "../src/llm/prompt";

export const sampleInput: PromptInput = {
  formula: "=VLOOKUP(A2,Products!A2:C200,4)",
  error: "#REF!",
  platform: "excel365",
  cell: "",
  description: "Products sheet: A = product code, B = name, C = category, D = price. I want the price of the code in A2.",
};

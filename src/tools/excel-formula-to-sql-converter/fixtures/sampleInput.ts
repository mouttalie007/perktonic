import type { PromptInput } from "../src/llm/prompt";

export const sampleInput: PromptInput = {
  "source": "=SUMIFS(Sales!$C:$C,Sales!$A:$A,$A2,Sales!$B:$B,\">=\"&DATE(2026,1,1))  (filled down next to a list of regions in A2:A10)",
  "schema": "sales(region text, order_date date, amount numeric)",
  "target": "postgresql" as const
};

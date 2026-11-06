import type { PromptInput } from "../src/llm/prompt";

export const sampleInput: PromptInput = {
  "text": "Weekly product sync, Monday 2 November 2026\nPresent: Lina, Marco, Priya, Sam\n\n1. Pricing page\nMarco will update the pricing page with the new annual plan by Wednesday.\nLina asked for a second opinion on the wording; Priya agreed to review the copy tomorrow.\n\n2. Customer feedback\nWe heard from three customers that exports are slow. Sam will collect the slowest examples and share them in the channel before next Friday.\nDecision: we keep the CSV export as it is for now.\n\n3. Admin\nSomeone needs to renew the support domain before it expires at the end of the month.\nPriya: send the updated onboarding checklist to the new hires on 9 November.\n\nNext meeting: Monday 9 November.",
  "referenceDate": "2026-11-02"
};

// The saved narration the page opens with (nothing is sent). A test checks it equals buildNarration(sampleAnswer).
import type { Narration } from "../src/types";
import { sampleAnswer } from "./sampleAnswer";
import { sampleInput } from "./sampleInput";

export const sampleResult: Narration = {
  status: "ok",
  formula: sampleInput.formula,
  summary: sampleAnswer.summary,
  steps: sampleAnswer.steps,
  dropped: 0,
  cached: false,
};

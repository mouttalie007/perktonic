// The saved AI diagnosis the page opens with (nothing is sent). A test checks it equals buildAiResult(sampleAnswer).
import type { AiDiagnosis } from "../src/types";
import { sampleAnswer } from "./sampleAnswer";
import { sampleInput } from "./sampleInput";

export const sampleResult: AiDiagnosis = {
  status: "ok",
  formula: sampleInput.formula,
  diagnosis: sampleAnswer.diagnosis,
  correctedFormula: sampleAnswer.correctedFormula,
  assumptions: sampleAnswer.assumptions,
  preventionTips: sampleAnswer.preventionTips,
  warnings: [],
  notes: [],
  cached: false,
};

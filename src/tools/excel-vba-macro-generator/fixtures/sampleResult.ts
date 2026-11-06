// The saved result the page opens with (Explain mode, nothing is sent). A test checks it equals explainResult(sampleAnswer).
import type { MacroResult } from "../src/types";
import { sampleAnswer } from "./sampleAnswer";
import { SAMPLE_CODE } from "./sampleCode";

export const sampleResult: MacroResult = {
  mode: "explain",
  status: "ok",
  code: SAMPLE_CODE,
  summary: sampleAnswer.summary,
  lines: sampleAnswer.lines,
  dropped: 0,
  unexplained: [],
  safety: [
    {
      id: "kill",
      line: 15,
      severity: "high",
      title: "Kill",
      what: "Deletes files from disk. Deleted files do not go to the Recycle Bin.",
      excerpt: "If Dir(target) <> \"\" Then Kill target"
    }
  ],
  platformNotes: [],
  modelRisks: sampleAnswer.risks,
  cached: false,
};

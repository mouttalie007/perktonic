// The saved result the page opens with (nothing is sent). A test checks it equals buildResult(sampleAnswer).
import type { ExtractResult } from "../src/types";
import { sampleAnswer } from "./sampleAnswer";
import { sampleInput } from "./sampleInput";

export const sampleResult: ExtractResult = {
  status: "ok",
  referenceDate: sampleInput.referenceDate,
  items: sampleAnswer.items,
  count: sampleAnswer.items.length,
  adjustments: { droppedQuotes: 0, ownersCleared: 0, datesCleared: 0, datesCorrected: 0 },
  cached: false,
};

// The saved result the page opens with (nothing is sent): the sample answer passed through our own checks.
import { buildResult } from "../src/logic/result";
import type { SummaryResult } from "../src/types";
import { sampleAnswer } from "./sampleAnswer";
import { sampleInput } from "./sampleInput";

export const sampleResult: SummaryResult = buildResult(sampleAnswer, sampleInput, false);

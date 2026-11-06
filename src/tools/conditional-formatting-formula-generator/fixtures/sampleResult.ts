// The saved AI answer the page opens with (nothing is sent). A test checks it equals buildAiResult(sampleAnswer).
import type { AiRule } from "../src/types";
import { sampleAnswer } from "./sampleAnswer";

export const sampleResult: AiRule = { ...sampleAnswer, warnings: [], cached: false };

// The saved result the page opens with (nothing is sent). A test checks it equals buildResult(sampleAnswer).
import type { ConvertResult } from "../src/types";
import { sampleAnswer } from "./sampleAnswer";

export const sampleResult: ConvertResult = { ...sampleAnswer, target: "postgresql", check: { kind: "sql", result: { status: "ok" } }, notes: [], cached: false };

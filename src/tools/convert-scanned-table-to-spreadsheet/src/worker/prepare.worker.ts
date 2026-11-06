/// <reference lib="webworker" />
// Image clean-up off the main thread (grayscale, contrast, deskew, threshold, upscale, rule lines).
import { prepare, toImageData, type PrepareOptions } from "../logic/preprocess";
import { findRuleLines } from "../logic/rules";

export interface PrepareRequest {
  width: number;
  height: number;
  buffer: ArrayBuffer;
  options: PrepareOptions;
}
export interface PrepareResult {
  width: number;
  height: number;
  buffer: ArrayBuffer;
  skew: number;
  scale: number;
  rules: { h: number[]; v: number[] };
}

self.onmessage = (e: MessageEvent<PrepareRequest>) => {
  const { width, height, buffer, options } = e.data;
  const out = prepare({ width, height, data: new Uint8ClampedArray(buffer) }, options);
  const rules = findRuleLines(out.image);
  const rgba = toImageData(out.image);
  const res: PrepareResult = { width: rgba.width, height: rgba.height, buffer: rgba.data.buffer as ArrayBuffer, skew: out.skew, scale: out.scale, rules };
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(res, [res.buffer]);
};

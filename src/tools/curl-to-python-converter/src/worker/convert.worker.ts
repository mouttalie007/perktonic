import { convert, type Result } from "../logic/convert";
import type { Target } from "../logic/generate";
import { ConvertError } from "../logic/model";
import { ShellError } from "../logic/shell";

export type WorkerRequest = { jobId: number; text: string; target: Target };
export type WorkerResponse =
  | { jobId: number; ok: true; result: Result }
  | { jobId: number; ok: false; message: string };

// A 5 MB command takes about a second to convert, so it runs here and the page stays responsive and cancellable.
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { jobId, text, target } = event.data;
  let reply: WorkerResponse;
  try {
    reply = { jobId, ok: true, result: convert(text, target) };
  } catch (e) {
    const known = e instanceof ConvertError || e instanceof ShellError;
    reply = { jobId, ok: false, message: known ? (e as Error).message : "Something went wrong while reading this input. Check the quoting and try again." };
  }
  (self as unknown as Worker).postMessage(reply);
};

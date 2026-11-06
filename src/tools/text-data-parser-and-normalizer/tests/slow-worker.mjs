// Runs a catastrophically backtracking regex; the test terminates this worker after the time limit.
import { parentPort, workerData } from "node:worker_threads";
const re = new RegExp(workerData.pattern, workerData.flags);
parentPort.postMessage({ matched: re.test(workerData.text) });

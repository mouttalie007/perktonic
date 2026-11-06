// Thin entry point: the tool's handler lives in src/tools/redirect-chain-checker.
// Segment config must be declared here (it can't be re-exported).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { POST } from "@/tools/redirect-chain-checker/src/api/route";

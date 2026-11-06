// Thin entry point: the tool's handler lives in src/tools/http-response-header-analyzer.
// Segment config must be declared here (it can't be re-exported).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { POST } from "@/tools/http-response-header-analyzer/src/api/route";

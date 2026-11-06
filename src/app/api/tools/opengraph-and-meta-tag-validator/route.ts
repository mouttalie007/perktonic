// Thin entry point: the tool's handler lives in src/tools/opengraph-and-meta-tag-validator.
// Segment config must be declared here (it can't be re-exported).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { POST } from "@/tools/opengraph-and-meta-tag-validator/src/api/route";

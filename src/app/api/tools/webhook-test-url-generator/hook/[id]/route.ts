import { handleCapture } from "@/tools/webhook-test-url-generator/src/api/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const h = async (req: Request, { params }: { params: Promise<{ id: string }> }) => handleCapture(req, (await params).id);
export { h as GET, h as POST, h as PUT, h as PATCH, h as DELETE, h as HEAD, h as OPTIONS };

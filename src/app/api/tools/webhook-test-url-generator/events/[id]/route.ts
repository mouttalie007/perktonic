import { handleEvents } from "@/tools/webhook-test-url-generator/src/api/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleEvents(req, (await params).id);
}

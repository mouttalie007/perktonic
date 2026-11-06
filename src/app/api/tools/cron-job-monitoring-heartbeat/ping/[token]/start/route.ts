import { handlePing } from "@/tools/cron-job-monitoring-heartbeat/src/api/ping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const h = async (req: Request, { params }: { params: Promise<{ token: string }> }) => handlePing(req, (await params).token, "start");
export { h as GET, h as POST, h as HEAD };

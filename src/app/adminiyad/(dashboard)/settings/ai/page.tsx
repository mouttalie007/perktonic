import type { Metadata } from "next";
import { PageHeader, Card } from "@/components/admin/ui";
import { ApiKeyForm } from "@/components/admin/ai/ApiKeyForm";
import { AI_MODEL } from "@/lib/ai-article/generate";
import { getKeyStatus } from "@/lib/ai-article/api-key";
import { requireUser } from "@/lib/require-admin";

export const metadata: Metadata = { title: "AI Articles settings" };
export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  await requireUser("ADMIN");
  const status = await getKeyStatus(AI_MODEL);

  return (
    <div>
      <PageHeader title="AI Articles settings" description="The Claude API key used by the API Articles page." />
      <Card className="max-w-xl space-y-4">
        <ApiKeyForm status={status} />
        <p className="text-muted border-line border-t pt-4 text-xs leading-relaxed">
          The key is stored encrypted and never shown again (only its first and last characters). Articles are written with{" "}
          <strong>{status.model}</strong> using extended thinking, live web search and page fetching, so each one costs
          real API credits (typically a few tenths of a dollar to about a dollar). To rotate the key, paste the new one
          here and press Save; revoke the old one in the Anthropic Console.
        </p>
      </Card>
    </div>
  );
}

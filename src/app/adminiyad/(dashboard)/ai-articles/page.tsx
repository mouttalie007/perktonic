import type { Metadata } from "next";
import { PageHeader, LinkButton } from "@/components/admin/ui";
import { AiArticlesBoard } from "@/components/admin/ai/AiArticlesBoard";
import { AI_MODEL } from "@/lib/ai-article/generate";
import { getKeyStatus } from "@/lib/ai-article/api-key";
import { getBriefViews } from "@/lib/ai-article/views";
import { requireUser } from "@/lib/require-admin";

export const metadata: Metadata = { title: "API Articles" };
export const dynamic = "force-dynamic";

export default async function AiArticlesPage() {
  await requireUser("EDITOR");
  const [briefs, key] = await Promise.all([getBriefViews(), getKeyStatus(AI_MODEL)]);

  return (
    <div>
      <PageHeader
        title="API Articles"
        description="Articles written by the Claude API from your briefs. They are created as drafts only: add the images, then publish."
        action={<LinkButton href="/adminiyad/settings/ai">API key &amp; settings</LinkButton>}
      />
      {briefs.length === 0 ? (
        <p className="text-muted py-10 text-center text-sm">
          No briefs imported yet. They are imported from the HTML files in <code>content/briefs/</code> on every deploy
          (or run <code>npm run db:import-briefs</code>).
        </p>
      ) : (
        <AiArticlesBoard initial={briefs} keyConfigured={key.configured} />
      )}
    </div>
  );
}

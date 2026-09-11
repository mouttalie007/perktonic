import Link from "next/link";
import { PageHeader, Card } from "@/components/admin/ui";

export default function NewArticleTypePage() {
  return (
    <div>
      <PageHeader title="New Article" description="Choose a format." />
      <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <Link href="/admin/articles/new/standard">
          <Card className="hover:shadow-[var(--shadow-raised)] h-full transition-shadow">
            <h2 className="font-bold">Standard Article</h2>
            <p className="text-muted mt-1 text-sm">
              A long-form article with a rich-text body, headings, links and images.
            </p>
          </Card>
        </Link>
        <Link href="/admin/articles/new/listicle">
          <Card className="hover:shadow-[var(--shadow-raised)] h-full transition-shadow">
            <h2 className="font-bold">Top N List</h2>
            <p className="text-muted mt-1 text-sm">
              A countdown/list article — each item gets its own page with next/previous.
            </p>
          </Card>
        </Link>
      </div>
    </div>
  );
}

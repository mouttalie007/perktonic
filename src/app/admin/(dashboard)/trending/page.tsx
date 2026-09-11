import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Input, Button } from "@/components/admin/ui";
import { setTrending } from "@/app/actions/admin-trending";

export default async function TrendingPage() {
  const [trending, others] = await Promise.all([
    prisma.article.findMany({
      where: { status: "PUBLISHED", isTrending: true },
      orderBy: [{ manualPriority: "asc" }, { viewCount: "desc" }],
      include: { category: true },
    }),
    prisma.article.findMany({
      where: { status: "PUBLISHED", isTrending: false },
      orderBy: { publishedAt: "desc" },
      take: 20,
      include: { category: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Trending"
        description="Manual override for the homepage Trending Now module. Lower priority number = appears first."
      />

      <h2 className="mb-2 font-bold">Currently trending ({trending.length})</h2>
      <div className="mb-8 space-y-2">
        {trending.length === 0 && <p className="text-muted text-sm">Nothing marked trending yet.</p>}
        {trending.map((a) => (
          <Card key={a.id} className="py-3">
            <form action={setTrending} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="isTrending" value="on" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{a.title}</span>
              <span className="text-muted text-xs">{a.category?.name}</span>
              <Input name="manualPriority" type="number" defaultValue={a.manualPriority ?? ""} placeholder="priority" className="w-24" />
              <Button type="submit" variant="secondary" className="text-xs">
                Update
              </Button>
            </form>
            <RemoveTrendingButton id={a.id} />
          </Card>
        ))}
      </div>

      <h2 className="mb-2 font-bold">Recent articles — mark as trending</h2>
      <div className="space-y-2">
        {others.map((a) => (
          <Card key={a.id} className="py-3">
            <form action={setTrending} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="isTrending" value="on" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{a.title}</span>
              <span className="text-muted text-xs">{a.category?.name}</span>
              <Button type="submit" variant="secondary" className="text-xs">
                Mark trending
              </Button>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RemoveTrendingButton({ id }: { id: string }) {
  return (
    <form action={setTrending} className="mt-1">
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-accent-red text-xs font-bold hover:underline">
        Remove
      </button>
    </form>
  );
}

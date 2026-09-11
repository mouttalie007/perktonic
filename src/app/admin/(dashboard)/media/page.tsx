import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Input, Button } from "@/components/admin/ui";
import { MediaUploadForm } from "@/components/admin/MediaUploadForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { deleteMedia, updateMediaMeta } from "@/app/actions/admin-media";

export default async function MediaPage() {
  const media = await prisma.media.findMany({
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return (
    <div>
      <PageHeader title="Media Library" description="Uploaded images, with SEO attribution." />

      <Card className="mb-6">
        <MediaUploadForm />
      </Card>

      {media.length === 0 ? (
        <p className="text-muted text-sm">No media uploaded yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((m) => (
            <Card key={m.id} className="space-y-3">
              <div className="bg-surface relative aspect-video overflow-hidden rounded-sm">
                <Image src={m.url} alt={m.alt ?? ""} fill sizes="320px" className="object-cover" />
              </div>
              <form action={updateMediaMeta} className="space-y-2">
                <input type="hidden" name="id" value={m.id} />
                <Input name="alt" defaultValue={m.alt ?? ""} placeholder="Alt text" />
                <Input name="credit" defaultValue={m.credit ?? ""} placeholder="Credit" />
                <div className="flex items-center justify-between">
                  <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
                    Save
                  </Button>
                  <span className="text-muted truncate text-xs">{m.filename}</span>
                </div>
              </form>
              <form action={deleteMedia}>
                <input type="hidden" name="id" value={m.id} />
                <DeleteButton label="Delete image" />
              </form>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

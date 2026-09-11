import { prisma } from "@/lib/prisma";
import { PageHeader, Badge, Card } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { formatDate } from "@/lib/format";
import { setContactMessageStatus, deleteContactMessage } from "@/app/actions/admin-contact";

export default async function ContactMessagesPage() {
  const messages = await prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div>
      <PageHeader title="Contact Messages" description="Submissions from the public /contact form." />

      {messages.length === 0 ? (
        <p className="text-muted text-sm">No messages yet.</p>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <Card key={m.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{m.subject}</p>
                  <p className="text-muted text-xs">
                    {m.name} · {m.email} · {formatDate(m.createdAt)}
                  </p>
                </div>
                <Badge tone={m.status === "new" ? "warning" : m.status === "archived" ? "default" : "success"}>
                  {m.status}
                </Badge>
              </div>
              <p className="mt-3 text-sm whitespace-pre-wrap">{m.message}</p>
              <div className="mt-3 flex items-center gap-3">
                {m.status !== "read" && (
                  <form action={setContactMessageStatus}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="status" value="read" />
                    <button type="submit" className="text-accent-blue text-xs font-bold hover:underline">
                      Mark read
                    </button>
                  </form>
                )}
                {m.status !== "archived" && (
                  <form action={setContactMessageStatus}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="status" value="archived" />
                    <button type="submit" className="text-muted text-xs font-bold hover:underline">
                      Archive
                    </button>
                  </form>
                )}
                <form action={deleteContactMessage}>
                  <input type="hidden" name="id" value={m.id} />
                  <DeleteButton />
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { PageHeader, Card } from "@/components/admin/ui";
import { CodeLookupForm } from "@/components/admin/CodeLookupForm";

export const metadata: Metadata = { title: "Quiz Codes — PerkTonic Admin" };

export default function QuizCodesPage() {
  return (
    <div>
      <PageHeader
        title="Quiz Codes"
        description="Paste a code a visitor sent you to see which article it's from and whether it's already been checked."
      />
      <Card className="max-w-xl">
        <CodeLookupForm />
      </Card>
    </div>
  );
}

import type { Metadata } from "next";
import { UnsubscribeForm } from "@/components/UnsubscribeForm";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: true },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="site-container flex flex-col items-center py-16 text-center sm:py-24">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
        Unsubscribe from the newsletter
      </h1>
      <p className="text-muted mt-2 max-w-sm">
        Confirm your email address below and we&apos;ll take you off the list right away.
      </p>
      <div className="mt-6">
        <UnsubscribeForm defaultEmail={email ?? ""} />
      </div>
    </div>
  );
}

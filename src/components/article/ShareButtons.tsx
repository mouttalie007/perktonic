"use client";

import { useState } from "react";
import {
  FacebookIcon,
  XIcon,
  WhatsappIcon,
  TelegramIcon,
  MailIcon,
  LinkIcon,
  CheckIcon,
} from "@/components/icons";

/**
 * Lightweight social sharing (spec §51). Plain share URLs + a copy button —
 * no third-party SDKs. Always uses the canonical article URL.
 */
export function ShareButtons({
  url,
  title,
  className = "",
}: {
  url: string;
  title: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);

  const links = [
    { label: "Share on Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, Icon: FacebookIcon },
    { label: "Share on X", href: `https://twitter.com/intent/tweet?url=${u}&text=${t}`, Icon: XIcon },
    { label: "Share on WhatsApp", href: `https://wa.me/?text=${t}%20${u}`, Icon: WhatsappIcon },
    { label: "Share on Telegram", href: `https://t.me/share/url?url=${u}&text=${t}`, Icon: TelegramIcon },
    { label: "Share by email", href: `mailto:?subject=${t}&body=${u}`, Icon: MailIcon },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-muted text-meta mr-1 font-bold tracking-wider uppercase">
        Share
      </span>
      {links.map(({ label, href, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className="border-line text-ink hover:bg-ink inline-flex h-9 w-9 items-center justify-center rounded-sm border transition-colors hover:text-white"
        >
          <Icon width={16} height={16} />
        </a>
      ))}
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Link copied" : "Copy link"}
        className="border-line text-ink hover:bg-ink inline-flex h-9 items-center gap-1.5 rounded-sm border px-3 text-[0.8rem] font-semibold transition-colors hover:text-white"
      >
        {copied ? <CheckIcon width={15} height={15} /> : <LinkIcon width={15} height={15} />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

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
 * Places where a visitor can post a link WITHOUT an account. None of them
 * accepts a pre-filled link in the URL, so the button copies the title + link
 * first and then opens the site's "new post" page: the visitor just pastes.
 * To add another site, add a row here (verify it first: no sign-up needed).
 */
const ANONYMOUS_POST_TARGETS: { label: string; href: string }[] = [
  { label: "Posteezy", href: "https://posteezy.com/node/add/post" },
];

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
  const [pasteHint, setPasteHint] = useState(false);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);

  const links = [
    {
      label: "Share on Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      Icon: FacebookIcon,
    },
    {
      label: "Share on X",
      href: `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
      Icon: XIcon,
    },
    {
      label: "Share on WhatsApp",
      href: `https://wa.me/?text=${t}%20${u}`,
      Icon: WhatsappIcon,
    },
    {
      label: "Share on Telegram",
      href: `https://t.me/share/url?url=${u}&text=${t}`,
      Icon: TelegramIcon,
    },
    {
      label: "Share by email",
      href: `mailto:?subject=${t}&body=${u}`,
      Icon: MailIcon,
    },
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

  // Not awaited on purpose: the click must stay a plain link navigation (popup blockers),
  // while the copy happens in the same user gesture.
  function copyForPaste() {
    navigator.clipboard?.writeText(`${title} ${url}`).catch(() => {
      /* clipboard unavailable: the visitor can still copy the link by hand */
    });
    setPasteHint(true);
    setTimeout(() => setPasteHint(false), 6000);
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
        {copied ? (
          <CheckIcon width={15} height={15} />
        ) : (
          <LinkIcon width={15} height={15} />
        )}
        {copied ? "Copied" : "Copy link"}
      </button>
      {ANONYMOUS_POST_TARGETS.map(({ label, href }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={copyForPaste}
          title={`Copies the link, then opens ${label}: no account needed, just paste it into your post`}
          className="border-line text-ink hover:bg-ink inline-flex h-9 items-center rounded-sm border px-3 text-[0.8rem] font-semibold transition-colors hover:text-white"
        >
          {label}
        </a>
      ))}
      {pasteHint && (
        <span role="status" className="text-muted basis-full text-xs">
          Link copied. Paste it (Ctrl+V) into the post on the page that just
          opened.
        </span>
      )}
    </div>
  );
}

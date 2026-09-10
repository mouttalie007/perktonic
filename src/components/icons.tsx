import type { SVGProps } from "react";

/**
 * Inline SVG icons. No icon library (spec §43 — keep JS/deps small).
 * All icons use `currentColor`, are hidden from AT by default, and are
 * non-focusable. Pass `aria-hidden={false}` + a title when an icon is the
 * only content of an interactive element.
 */

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
    focusable: false as const,
    ...props,
  };
}

/* --- UI --- */

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor">
      <path d="M12 2s5 4.5 5 9.5a5 5 0 0 1-10 0c0-1.6.6-3 1.4-4.2C8 9.7 8 11 9 12c0-3 1.5-7 3-10Zm-1.2 12.3c.6.9 1.6 1.2 2.6.9.9-.3 1.5-1.2 1.4-2.2 1 1.8.2 4.2-1.9 4.8-1.9.5-3.8-.7-4.1-2.6-.2-1 .1-2 .8-2.7-.1 1 .3 2 1.2 2.6Z" />
    </svg>
  );
}

/* --- Social (Simple Icons paths, 24x24) --- */

export function FacebookIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor">
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor">
      <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.15h7.6l5.24 6.93 6.06-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.4Z" />
    </svg>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor">
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16ZM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.13 1.38A5.9 5.9 0 0 0 .63 4.14c-.3.76-.5 1.64-.56 2.91C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.72 1.46 1.38 2.13.67.66 1.34 1.08 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.9 5.9 0 0 0 2.13-1.38 5.9 5.9 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.9 5.9 0 0 0-1.38-2.13A5.9 5.9 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0Zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.41-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88Z" />
    </svg>
  );
}

export function YoutubeIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor">
      <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.08 0 12 0 12s0 3.92.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.92 24 12 24 12s0-3.92-.5-5.81ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" />
    </svg>
  );
}

export function TiktokIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor">
      <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94a6.98 6.98 0 0 1-5.53 3.05c-1.3.08-2.6-.28-3.71-.94a6.9 6.9 0 0 1-3.34-5.17c-.02-.45-.03-.9-.01-1.34a6.89 6.89 0 0 1 8-6.11c.02 1.48-.04 2.96-.04 4.44a3.14 3.14 0 0 0-4.01 1.94c-.2.55-.14 1.16-.13 1.74a3.13 3.13 0 0 0 3.22 2.63 3.1 3.1 0 0 0 2.56-1.49c.2-.35.42-.7.43-1.11.1-1.9.06-3.79.07-5.69.01-4.27-.01-8.53.02-12.79Z" />
    </svg>
  );
}

export function WhatsappIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor">
      <path d="M17.5 14.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35ZM12.04 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.42 9.42 0 0 1-1.44-5.02c0-5.2 4.24-9.44 9.46-9.44a9.4 9.4 0 0 1 6.69 2.77 9.38 9.38 0 0 1 2.77 6.68c-.01 5.2-4.25 9.45-9.45 9.45Zm8.05-17.5A11.32 11.32 0 0 0 12.04 0C5.79 0 .71 5.08.7 11.32c0 2 .52 3.94 1.51 5.66L.6 24l7.17-1.88a11.3 11.3 0 0 0 5.42 1.38h.01c6.24 0 11.32-5.08 11.33-11.33a11.26 11.26 0 0 0-3.33-8.02Z" />
    </svg>
  );
}

export function TelegramIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor">
      <path d="M23.9 3.2 20.3 20.3c-.27 1.2-.98 1.5-1.98.93l-5.5-4.05-2.65 2.55c-.3.3-.54.54-1.1.54l.4-5.6L19.5 5.94c.44-.4-.1-.62-.68-.22L6.2 13.53l-5.42-1.7c-1.18-.37-1.2-1.18.25-1.75L22.38 1.5c.98-.36 1.84.22 1.52 1.7Z" />
    </svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
      <path d="m3 6 9 7 9-7" />
    </svg>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 15 15 9M11 6.5l.9-.9a4 4 0 0 1 5.66 5.66l-.9.9M13 17.5l-.9.9a4 4 0 0 1-5.66-5.66l.9-.9" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

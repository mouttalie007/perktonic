"use client";

import { useEffect, useRef } from "react";
import { ADSENSE } from "@/config/ads";

/**
 * Renders a stored AdUnit's markup and triggers a single `adsbygoogle` push
 * once mounted. The markup itself (the `<ins>` tag) is authored in the Admin
 * Dashboard — we never synthesise or modify AdSense code (spec §46).
 *
 * With ads disabled (no publisher id / NEXT_PUBLIC_ADSENSE_ENABLED=false) the
 * homepage never mounts this — see AdSlot.
 */
export function AdUnitRender({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current || !ADSENSE.enabled) return;
    pushed.current = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {
      /* AdSense script not present yet — it loads via the consent layer */
    }
  }, []);

  return (
    <div
      ref={ref}
      className="mx-auto w-full"
      // Ad markup is admin-authored and trusted; sanitisation of admin HTML
      // is handled at author time in Phase 7.
      dangerouslySetInnerHTML={{ __html: code }}
    />
  );
}

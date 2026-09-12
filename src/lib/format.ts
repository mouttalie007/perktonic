const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const dateFmtLong = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

/** "Sep 10, 2026" */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return dateFmt.format(d);
}

/** "September 10, 2026" */
export function formatDateLong(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return dateFmtLong.format(d);
}

/** True when two dates fall on different calendar days. */
export function isDifferentDay(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined,
): boolean {
  if (!a || !b) return false;
  return formatDate(a) !== formatDate(b);
}

/** ISO date for <time dateTime> / structured data. */
export function isoDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString();
}

/** 1_250 -> "1.3K", 2_400_000 -> "2.4M" */
export function compactNumber(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const v = n / 1000;
    return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}K`;
  }
  const v = n / 1_000_000;
  return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}M`;
}

/** "125K views" */
export function formatViews(n: number): string {
  return `${compactNumber(n)} view${n === 1 ? "" : "s"}`;
}

/** "5 min read" */
export function formatReadingTime(minutes: number): string {
  return `${Math.max(1, minutes)} min read`;
}

/**
 * "26 mins ago" / "2 hrs ago" / "3 days ago", falling back to the absolute
 * date past a week out (matches the homepage feed reference design).
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(d);
}

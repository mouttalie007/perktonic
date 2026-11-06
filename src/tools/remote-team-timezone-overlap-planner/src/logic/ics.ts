const pad = (n: number) => String(n).padStart(2, "0");

function stamp(t: number): string {
  const d = new Date(t);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** A one-event calendar file in UTC, which every calendar app converts to the reader's own zone. */
export function toIcs(from: number, to: number, title: string, description: string, now: number): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PerkTonic//Time Zone Overlap Planner//EN",
    "BEGIN:VEVENT",
    `UID:${from}-${to}@perktonic.com`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(from)}`,
    `DTEND:${stamp(to)}`,
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

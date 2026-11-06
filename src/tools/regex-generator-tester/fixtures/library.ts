/** Ready patterns the visitor can pick and edit. Each has a plain explanation and a test text that it matches. */
export interface LibraryPattern {
  id: string;
  name: string;
  pattern: string;
  flags: string;
  explanation: string;
  test: string;
}

export const LIBRARY: LibraryPattern[] = [
  {
    id: "email",
    name: "Email address",
    pattern: String.raw`[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,}`,
    flags: "g",
    explanation: "Letters, digits, dots, plus and hyphens before the @, then a domain with a top-level part of two letters or more. Practical, not a full RFC 5322 check.",
    test: "Write to ada.lovelace+news@example.co.uk or support@my-shop.io (not to bob@localhost).",
  },
  {
    id: "url",
    name: "URL (http/https)",
    pattern: String.raw`https?:\/\/[\w-]+(?:\.[\w-]+)+(?::\d{2,5})?(?:\/[^\s"'<>]*)?`,
    flags: "gi",
    explanation: "http:// or https://, a host with at least one dot, an optional port, then an optional path that stops at spaces and quotes.",
    test: "Docs: https://example.com/docs?page=2#intro and http://api.example.org:8080/v1/items.",
  },
  {
    id: "ipv4",
    name: "IPv4 address",
    pattern: String.raw`\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b`,
    flags: "g",
    explanation: "Four numbers from 0 to 255 separated by dots. 256.1.1.1 and 10.0.0 do not match.",
    test: "Gateway 192.168.1.1, DNS 8.8.8.8, invalid 256.10.0.1 and 10.0.0.",
  },
  {
    id: "ipv6",
    name: "IPv6 address (full or compressed)",
    pattern: String.raw`\b(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}\b|\b(?:[0-9a-f]{1,4}:){1,7}:(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,6})?(?![0-9a-f:])`,
    flags: "gi",
    explanation: "Eight groups of up to four hex digits, or a shortened form with ::. It does not validate every edge case (such as embedded IPv4).",
    test: "Server 2001:db8:85a3:0:0:8a2e:370:7334 or 2001:db8::1, loopback fe80::1.",
  },
  {
    id: "date-iso",
    name: "Date (YYYY-MM-DD)",
    pattern: String.raw`\b(?<year>\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\d|3[01])\b`,
    flags: "g",
    explanation: "A four-digit year, a month 01–12 and a day 01–31, with named groups. It does not know month lengths: 2026-02-30 matches.",
    test: "Invoice 2026-10-28, due 2026-11-27; not a date: 2026-13-01.",
  },
  {
    id: "date-dmy",
    name: "Date (DD/MM/YYYY)",
    pattern: String.raw`\b(0[1-9]|[12]\d|3[01])[/.-](0[1-9]|1[0-2])[/.-](\d{4})\b`,
    flags: "g",
    explanation: "Day, month and year separated by /, . or -. Use it only when you know the text uses day-first dates.",
    test: "Shipped 28/10/2026, delivered 03.11.2026.",
  },
  {
    id: "time",
    name: "Time (24-hour, optional seconds)",
    pattern: String.raw`\b(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b`,
    flags: "g",
    explanation: "Hours 00–23, minutes 00–59 and optional seconds.",
    test: "Doors open 09:30, show at 20:15:00; 24:00 is not valid here.",
  },
  {
    id: "phone-intl",
    name: "Phone number (international, E.164)",
    pattern: String.raw`\+[1-9]\d{6,14}\b`,
    flags: "g",
    explanation: "A + followed by 7 to 15 digits without spaces, the E.164 format used by most APIs.",
    test: "Call +442071838750 or +15551234567.",
  },
  {
    id: "phone-us",
    name: "Phone number (US, with separators)",
    pattern: String.raw`(?:\+1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b`,
    flags: "g",
    explanation: "An optional +1, a three-digit area code with or without brackets, then 3 and 4 digits separated by spaces, dots or hyphens.",
    test: "Office (555) 123-4567, mobile 555.987.6543, toll-free +1 800 555 0199.",
  },
  {
    id: "hex-color",
    name: "Hex colour",
    pattern: String.raw`#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b`,
    flags: "gi",
    explanation: "A # followed by 3, 4, 6 or 8 hex digits (with alpha), as in CSS.",
    test: "Primary #0B5CFF, text #0b1530, overlay #00000080, short #fff.",
  },
  {
    id: "slug",
    name: "URL slug",
    pattern: String.raw`^[a-z0-9]+(?:-[a-z0-9]+)*$`,
    flags: "gm",
    explanation: "Lower-case letters and digits in words joined by single hyphens, with no hyphen at either end. With m, each line is checked.",
    test: "regex-tester-online\nBad--slug\n-leading-hyphen\ncsv-to-json-2",
  },
  {
    id: "uuid",
    name: "UUID",
    pattern: String.raw`\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b`,
    flags: "gi",
    explanation: "Five groups of hex digits (8-4-4-4-12), with a version digit 1–8 and the RFC 9562 variant.",
    test: "Request id 3f2b8c1e-9d4a-4f6b-8a2e-1c5d7e9f0a3b; not a UUID: 1234-5678.",
  },
  {
    id: "semver",
    name: "Semantic version",
    pattern: String.raw`\bv?(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<pre>[0-9A-Za-z.-]+))?(?:\+(?<build>[0-9A-Za-z.-]+))?\b`,
    flags: "g",
    explanation: "MAJOR.MINOR.PATCH with an optional pre-release (-beta.2) and build part (+sha), with named groups.",
    test: "Upgrade from v1.4.2 to 2.0.0-rc.1+build.7.",
  },
  {
    id: "zip-us",
    name: "US ZIP code",
    pattern: String.raw`\b\d{5}(?:-\d{4})?\b`,
    flags: "g",
    explanation: "Five digits, optionally followed by a hyphen and four more (ZIP+4).",
    test: "Boston, MA 02134 or 02134-1234.",
  },
  {
    id: "postcode-uk",
    name: "UK postcode",
    pattern: String.raw`\b[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}\b`,
    flags: "gi",
    explanation: "The UK outward code (SW1A, M1, CB2), an optional space, then the inward code (1AA).",
    test: "Send it to SW1A 1AA or CB2 1TN.",
  },
  {
    id: "card",
    name: "Card-like number (13–19 digits)",
    pattern: String.raw`\b(?:\d[ -]?){12,18}\d\b`,
    flags: "g",
    explanation: "13 to 19 digits, possibly grouped with spaces or hyphens. It finds card-shaped numbers for masking; it does not check the Luhn digit.",
    test: "Test card 4242 4242 4242 4242, order 123456.",
  },
  {
    id: "mac",
    name: "MAC address",
    pattern: String.raw`\b(?:[0-9a-f]{2}([:-]))(?:[0-9a-f]{2}\1){4}[0-9a-f]{2}\b`,
    flags: "gi",
    explanation: "Six pairs of hex digits with the same separator throughout (a backreference to the first separator).",
    test: "Adapters 00:1A:2B:3C:4D:5E and 00-1a-2b-3c-4d-5e; mixed 00:1A-2B:3C:4D:5E is rejected.",
  },
  {
    id: "hashtag",
    name: "Hashtag",
    pattern: String.raw`(?<![\p{L}\p{N}_])#[\p{L}\p{N}_]+`,
    flags: "gu",
    explanation: "A # not preceded by a letter or digit, followed by letters, digits or _ in any script (needs the u flag).",
    test: "Loving #RegEx and #café_life, but not C#.",
  },
  {
    id: "duplicate-words",
    name: "Repeated word",
    pattern: String.raw`\b(\w+)\s+\1\b`,
    flags: "gi",
    explanation: "A word followed by the same word again, using a backreference. Handy for proofreading.",
    test: "This is is a test of the the tool.",
  },
  {
    id: "password",
    name: "Password rule (8+ chars, upper, lower, digit)",
    pattern: String.raw`^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$`,
    flags: "gm",
    explanation: "Three lookaheads check for a lower-case letter, an upper-case letter and a digit; then at least 8 characters.",
    test: "Summer2026\npassword\nSHORT1a\nCorrect-Horse-9",
  },
  {
    id: "trailing-space",
    name: "Trailing whitespace",
    pattern: String.raw`[ \t]+$`,
    flags: "gm",
    explanation: "Spaces or tabs at the end of each line (m flag), to find or remove them.",
    test: "line with spaces   \nclean line\ntab at end\t",
  },
  {
    id: "markdown-link",
    name: "Markdown link",
    pattern: String.raw`\[(?<text>[^\]]+)\]\((?<url>[^)\s]+)(?:\s+"(?<title>[^"]*)")?\)`,
    flags: "g",
    explanation: "[text](url \"optional title\"), with named groups for the text, URL and title.",
    test: "See [the docs](https://example.com/docs \"Docs\") and [home](/).",
  },
  {
    id: "quoted",
    name: "Quoted string with escapes",
    pattern: String.raw`"(?:[^"\\]|\\.)*"`,
    flags: "g",
    explanation: "A double-quoted string where \\\" and other backslash escapes are allowed inside.",
    test: String.raw`name = "Ada \"Countess\" Lovelace", city = "London"`,
  },
];

/** Opened when the page loads: a log with dates and levels, using named groups. */
export const EXAMPLE = {
  pattern: String.raw`^(?<date>\d{4}-\d{2}-\d{2}) (?<time>\d{2}:\d{2}:\d{2}) \[(?<level>ERROR|WARN)\] (?<message>.+)$`,
  flags: "gm",
  text: `2026-10-28 09:14:02 [INFO] Server started on port 8080
2026-10-28 09:15:47 [WARN] Disk usage at 81% on /var
2026-10-28 09:16:03 [ERROR] Payment webhook failed: timeout after 10s
2026-10-28 09:16:04 [INFO] Retrying payment webhook
2026-10-28 09:16:09 [ERROR] Payment webhook failed: 502 Bad Gateway`,
};

/** A pattern that backtracks catastrophically, for the timeout example. */
export const SLOW = { pattern: "^(a+)+$", flags: "", text: `${"a".repeat(40)}!` };

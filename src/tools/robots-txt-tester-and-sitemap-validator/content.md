---
title: "robots.txt Tester and Sitemap Validator, Free Online"
metaDescription: "A robots.txt tester and sitemap validator: see which crawlers may fetch each URL, the rule that decides, and whether sitemaps and lastmod dates are valid."
h1: "robots.txt Tester and Sitemap Validator"
---

## Hero

This robots.txt tester and sitemap validator reads a site's robots.txt and sitemaps. It shows which crawler may fetch which URL, and which rule decides. It also checks sitemap structure, URL counts and lastmod dates.

## How to use

1. Enter a domain, or any URL on the site.
2. Optionally list up to 10 URLs or paths to test, and pick up to 5 crawlers (Googlebot, Bingbot, GPTBot…), or type another crawler's name.
3. Press "Check robots.txt and sitemaps". Our server fetches `/robots.txt`, the sitemaps it lists and `/sitemap.xml`.
4. Read the verdicts, the problems found in robots.txt (with line numbers) and the report for each sitemap.
5. Change the test URLs or crawlers: the verdicts update instantly, without a new check. Copy the report as text, or download it as JSON.

## Examples

**nodejs.org** ("Try an example"). Its robots.txt has one group for every crawler, with `Allow: /dist/latest/` and `Disallow: /dist/`.

- `https://nodejs.org/dist/latest/` is **Allowed** for Googlebot: "Allowed by “Allow: /dist/latest/” (line 2), the longest matching rule in the group for *."
- `https://nodejs.org/dist/v18.0.0/` is **Blocked** by `Disallow: /dist/` (line 5).
- Both sitemaps listed in the file are checked: `/sitemap.xml` (1,666 URLs, 1.6 MB, all lastmod dates valid) and `/learn/sitemap.xml` (90 URLs).
- The first gets a warning: 8 of its URLs point to other hosts (openjsf.org pages), which the sitemap protocol does not allow unless those hosts list the sitemap themselves.

**A shop with mistakes.** In this robots.txt:

```
User-agent: *
Disallow: /checkout/
Allow: /checkout/help
Dissallow: /tmp/
Sitemap: /sitemap.xml
```

- `/checkout/help` is allowed, because the longer rule wins.
- Line 4 is flagged as a misspelling of Disallow.
- Line 5 is an error: Sitemap needs a full URL.

**A sitemap with bad dates.** `<lastmod>28/10/2026</lastmod>` is reported as "not in W3C Datetime format… use YYYY-MM-DD, not a local date format". A date next year is reported as "in the future".

## Tips and limits

- Rules follow RFC 9309, as Google applies it:
  - `*` matches anything, and `$` anchors the end of the URL.
  - The longest matching rule wins, and Allow wins a tie.
  - Groups with the same user-agent are merged. A crawler without its own group falls back to the most specific match (Googlebot-Image uses `googlebot`), then to `*`.
- A missing robots.txt (4xx) means everything is allowed. A 5xx answer makes Google pause crawling, and the tool says so.
- Only the first 500 KiB of robots.txt is read, the same limit Google uses.
- Up to 5 sitemap files per check, each up to 2 MB. A sitemap index is followed one level deep. `.xml.gz` files are unpacked, up to 10 MB.
- Larger files are counted from their first 2 MB and flagged. Google's own limits are 50,000 URLs and 50 MB per file.
- Only sitemaps on the same domain as the site are fetched.
- Each sitemap URL is also tested against robots.txt for Googlebot, since a sitemap should not list blocked pages.

## FAQ

**How do I test robots.txt?**
Enter your domain, add the URLs you care about and pick the crawlers. Each result names the exact rule and line that decided it.

**What does Disallow: / do?**
It blocks the whole site for the crawlers in that group. Under `User-agent: *`, it blocks every crawler that has no group of its own. Pages can still appear in search results, without a description, if other sites link to them.

**How big can a sitemap be?**
Google accepts up to 50,000 URLs and 50 MB uncompressed per file. Larger sites split their URLs over several files and list them in a sitemap index.

**Does robots.txt hide a page from Google?**
No. It stops crawling, not indexing. To keep a page out of search results, allow crawling and add a `noindex` meta tag.

**Does Google use Crawl-delay?**
No. Bing and Yandex honour it; Google ignores it.

**Why is my sitemap called invalid when it opens in my browser?**
Browsers forgive mistakes that crawlers do not, such as a raw `&` in a URL (write `&amp;`), a missing namespace or relative URLs.

## Privacy note

Only the domain and the files it publishes are fetched, by our server, with the user agent "PerkTonicBot/1.0". The test URLs you enter are sent with the check and returned with the verdicts; any later changes are tested in your browser only. We do not store the domain, the files or the results, and nothing is logged.

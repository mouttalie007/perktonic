---
title: "Bulk URL Status Code Checker: 50 URLs, CSV Export"
metaDescription: "A bulk URL status code checker for up to 50 URLs: see each status code, final URL after redirects, response time and content type, then export to CSV."
h1: "Bulk URL Status Code Checker"
---

## Hero

This bulk URL status code checker tests up to 50 URLs in one go. For each one you get the HTTP status, the final URL after redirects, the response time and the content type. You can filter the table and export it as CSV.

## How to use

1. Paste your URLs, one per line, or upload a `.txt` or `.csv` file. In a CSV, the URL column is found by its name (URL, Address, Link…) or by its content.
2. Check the line under the box: it says how many URLs will be checked and lists any skipped lines (duplicates, lines that are not URLs).
3. Choose whether to follow redirects, and whether to try a fast HEAD request first.
4. Press "Check". Results appear in batches of 5 with a progress bar, and you can press Cancel at any time.
5. Filter by status group, search, sort by any column, then copy the table or download it as CSV.

## Examples

**A documentation link audit** ("Try an example"). The list has 12 lines: nodejs.org and pypi.org pages, `http://nodejs.org/`, a page that does not exist, a URL without `https://`, a duplicate and the text "not a url".

- 10 URLs are checked. The duplicate (the same page with a `#installers` fragment) and "not a url" are skipped with a reason.
- `http://nodejs.org/` shows **200 OK** with 2 redirects (308 → 307 → 200), ending at `https://nodejs.org/en`.
- `https://nodejs.org/en/this-page-does-not-exist` shows **404 Not Found**, marked "via GET": the tool asked again with GET to confirm the 404.
- `nodejs.org/learn/sitemap.xml` gets `https://` added and returns 200 with the type `application/xml`.

**A migration check from a spreadsheet.** A CSV such as:

```
Page title,Address,Owner
Home,https://www.example.com/,web team
"Pricing, plans",https://www.example.com/pricing,sales
Contact,/contact,web team
```

is read as "CSV (comma-separated) with a header, column “Address”". The quoted title with a comma is handled. The `/contact` row is skipped with the note "A path without a domain."

**Redirects not followed.** Untick "Follow redirects" and `http://nodejs.org/` shows **308 Permanent Redirect**, with the target `https://nodejs.org/` in the Final URL column and "not followed" in the Redirects column.

## Tips and limits

- Up to 50 URLs per check. Lines beyond the 50th are listed as not checked. Our server takes 5 URLs per request and allows 30 requests per 10 minutes per visitor, which is 150 URLs.
- Requests to the same site go one at a time, at least 0.25 s apart, and three sites are checked in parallel. A list of 50 pages on one site therefore takes 15–30 seconds.
- Each request times out after 10 seconds, and at most 10 redirects are followed. Loops are detected and reported.
- HEAD is fast, but some servers answer it wrongly. When HEAD returns an error status such as 403, 404, 405 or 501, the URL is asked again with GET, and the row says "via GET".
- The time shown is request time only, summed over every redirect hop.
- Only http and https on the standard ports are checked. Private and internal addresses are refused.
- The CSV is UTF-8 with a BOM, so Excel opens accents correctly. Cells that start with `=`, `+`, `-` or `@` get a leading apostrophe so they are not run as formulas.
- No crawling: only the URLs you give are requested.

## FAQ

**How do I check many URLs at once?**
Paste them one per line, or upload a CSV export from your spreadsheet or SEO tool, then press Check. The table fills in as each batch of 5 finishes.

**What do the status codes mean?**
2xx means the page loaded (200 OK). 3xx is a redirect: 301 and 308 are permanent, 302 and 307 temporary. 4xx is a client error, such as 404 Not Found or 410 Gone. 5xx means the server failed.

**Is there a URL limit?**
Yes: 50 URLs per check, and 30 batches of 5 every 10 minutes per visitor. Split longer lists into several checks.

**Why does a page show 403 here but open in my browser?**
Some sites block requests that do not come from a browser, or block data-centre addresses. The tool reports what the server answered to our request.

**Can I check any website?**
Use the tool only on URLs you are allowed to test, such as your own sites or public pages at this small scale. Do not use it to probe systems you have no permission to test.

## Privacy note

Your list is sent to our server only to make the requests, 5 URLs at a time, and the results come straight back to your browser. We do not store the URLs or the results, and we do not log them. The sites you check see a request from our server with the user agent "PerkTonicBot/1.0", not from your computer.

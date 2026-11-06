---
title: "Broken Link Checker Online: Crawl a Small Site Politely"
metaDescription: "A free broken link checker online: crawls up to 50 pages, obeys robots.txt, and lists broken links, redirects and missing images with a CSV export."
h1: "Broken Link Checker Online"
---

## Hero

This broken link checker online crawls a page or a small website and lists its broken links, redirected links and missing images. For each one it shows the page and the anchor text where it was found. It obeys robots.txt and stops after 90 seconds.

## How to use

1. Enter the address of the page to start from, for example your home page.
2. Choose the depth: only this page, the pages it links to, or one level further. Then choose how many pages may be crawled (up to 50).
3. Decide whether external links and images should be checked too.
4. Confirm that you own the site or are allowed to test it, then press "Start crawl". A progress line shows pages, links and problems as they are found; press "Cancel" at any time.
5. Read the lists, then download the CSV to fix the links in your site.

## Examples

**A small shop.** Starting from the home page, the crawler reads robots.txt, crawls 8 pages and checks 21 links. It reports 6 broken links, 1 missing image and 2 redirects:

```
404   https://partner.example/gone      on /       "Spring offer"
—     https://slow.example/             on /       "Shipping tracker"  No answer within 10 s
500   /blog/2019-sale                   on /blog   "2019 sale"
404   /img/missing-banner.jpg           on /       "Autumn sale banner"   (missing image)
301   /blog/  →  /blog                  on /       "Blog"
```

The cart and admin pages were skipped because robots.txt disallows them for our crawler. A fourth `?page=` variant of the products page was skipped to avoid endless listings. Links to `mailto:`, `tel:` and `javascript:` were ignored.

**A site with a slow server.** When a site asks for a crawl delay of 30 seconds in robots.txt, the crawler honours it. After 90 seconds it stops, shows what it found so far and says the crawl stopped early.

## Tips and limits

- **Only crawl sites you own or are authorised to test.** The crawler identifies itself as `PerkTonicBot/1.0 (+https://perktonic.com/tools)`, so it is easy to recognise in your server logs.
- **robots.txt is always read first.** Rules for PerkTonicBot win over the rules for `*`. If robots.txt cannot be read because of a server error, the crawler does not continue, as the robots.txt standard requires.
- **Politeness:** at least 250 ms between two requests to the same site (longer if robots.txt sets a Crawl-delay), and at most 4 requests at once.
- **Same site only:** pages on the start URL's domain are crawled. External links and images are only checked, with a HEAD request; if a server refuses HEAD, a short GET is sent instead.
- **Redirects** are listed with their target and are not counted as broken. Fix them anyway: every redirect adds a round trip for visitors.
- **Limits:** depth 2, 50 pages, 300 checked links and 90 seconds per crawl, and 3 crawls per 10 minutes per visitor. Pages over 1 MB are only read up to 1 MB.
- **Not covered:** links created by JavaScript after the page loads, pages behind a login, and links inside PDFs.

## FAQ

**How do I find broken links on my site?**
Enter your home page, keep depth 2 and press "Start crawl". The "Broken links" list shows every link that answered with an error or did not answer, with the page and the link text where it appears.

**Why are some links marked as redirected?**
They still work, but the server answered with a redirect (301, 302, 307 or 308) to another address. Update the link to the final address to save visitors a round trip.

**Will it slow my site down?**
No. It sends at most one request every 250 ms to your site (or slower if robots.txt asks), and no more than 300 requests in total.

**Why was a page skipped?**
It is disallowed by robots.txt, it is deeper than the depth you chose, or it is one of too many query-string variants of the same page.

**Why does a link work in my browser but show as broken here?**
Some sites block automated requests or require cookies. A 403 or 429 for an external link may be such a block rather than a real broken link.

## Privacy note

The start URL you enter is sent to our server, which crawls the site and returns the results to your browser as they come in. Nothing is stored after the crawl, apart from a short-lived counter for the rate limit; closing the page or pressing Cancel stops the crawl.

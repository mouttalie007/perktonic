---
title: "Redirect Chain Checker 301 302: See Every Hop"
metaDescription: "A redirect chain checker for 301 and 302 redirects that follows a URL hop by hop, times each step, finds loops and tells you how to collapse the chain."
h1: "Redirect Chain Checker (301/302)"
---

## Hero

This redirect chain checker for 301, 302, 303, 307 and 308 redirects follows a URL one hop at a time. It shows each status code, target and response time, then tells you how to shorten the chain.

## How to use

1. Enter a URL. If you leave out the scheme, the check starts at http://, so the HTTPS upgrade is tested too.
2. Optionally pick a user agent (Googlebot smartphone, Bingbot, Chrome or Safari on iPhone) to see whether bots are redirected differently.
3. Click Check redirects. Each hop appears with its status, the URL it points to and how long it took.
4. Read the recommendation and the findings below the chain.
5. Copy the report as text, or download it as CSV or JSON.

## Examples

**Two redirects that should be one.** Checking `www.github.com` on 29 October 2026 gave:

```
1. 301 Moved Permanently  http://www.github.com/   → https://www.github.com/
2. 301 Moved Permanently  https://www.github.com/  → https://github.com/
3. 200 OK                 https://github.com/
```

Recommendation: "Collapse to a single 301: redirect http://www.github.com/ straight to https://github.com/." The findings note that HTTPS (hop 1) and the non-www host (hop 2) are fixed in separate hops.

**A loop.** If `/sale` sends a 302 to `/sale/` and `/sale/` sends a 301 back to `/sale`, the checker stops before asking for `/sale` again. It reports "Redirect loop: Hop 2 redirects back to https://shop.example.com/sale, which was already visited." and suggests making one of the URLs answer 200.

**Mixed types.** A chain of 302 → 308 → 307 → 301 gets a warning about mixed redirect types (301, 302, 307, 308) and one warning for each temporary hop, saying to use 301 or 308 if the move is permanent.

## Tips and limits

- Status codes: 301 and 308 count as permanent; 302, 303 and 307 as temporary. 308 and 307 also keep the request method (POST stays POST).
- Relative Location headers such as `/new-page` are resolved against the current URL and flagged as information.
- A redirect from HTTPS back to HTTP is reported as a problem. A site that never reaches HTTPS gets a warning.
- Meta refresh tags and JavaScript redirects on the final page are listed as information only; they are not followed.
- The checker follows up to 10 redirects. It waits up to 10 seconds per hop and reads at most 256 KB of each response.
- Each request is sent from our server, so the timings show the distance from our server to the site, not from your location.
- You can run 10 checks every 10 minutes. Addresses on private or local networks (192.168.x.x, localhost and similar), URLs with a user name or password, and ports other than 80 and 443 are refused.
- Use the tool only on URLs you are allowed to test.

## FAQ

**What is a redirect chain?**
It is a series of redirects in a row: URL A points to B, which points to C. Every extra hop costs a round trip, often 50–300 ms, and gives crawlers one more step to give up on.

**Is a 302 bad for SEO?**
Not by itself. A 302 says the move is temporary, so search engines may keep the old URL in their index. For pages that have moved for good, a 301 or 308 is the clearer signal.

**How many redirects are too many?**
Aim for one. Google follows up to 10 hops and browsers stop at about 20, but every hop slows visitors down. This tool warns at two or more.

**What does "collapse to a single 301" mean?**
Change the first redirect so it points straight at the final URL. For example, send `http://www.example.com/` directly to `https://example.com/` instead of going through `https://www.example.com/`.

**Why does Googlebot get a different chain than my browser?**
Some sites redirect by device or user agent, for example to a mobile subdomain. Pick the Googlebot user agent here to see what the crawler gets.

**Does the checker follow meta refresh or JavaScript redirects?**
No. It shows them so you know they exist, but a server-side 301 is more reliable for search engines.

## Privacy note

When you click Check, our server requests the URL you entered and the URLs it redirects to, and sends the results back to your browser. We do not store the URLs or the results, and we do not log them. Rate limiting counts requests per IP address for 10 minutes and keeps nothing else.

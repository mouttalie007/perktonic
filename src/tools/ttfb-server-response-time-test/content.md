---
title: "TTFB Server Response Time Test: Waterfall and Rating"
metaDescription: "A free ttfb server response time test that times DNS, connect, TLS, server wait and download over three runs and rates the result against Google's guidance."
h1: "TTFB Server Response Time Test"
---

## Hero

This ttfb server response time test measures how long your server takes to send the first byte of a page. It splits that time into DNS, connection, TLS, server wait and download, and rates the result against Google's published guidance.

## How to use

1. Enter the full address of the page, for example `https://www.example.com/pricing`. Without a scheme, `https://` is used.
2. Press "Test TTFB". The page is requested three times, one request after another and half a second apart.
3. Read the median TTFB and its rating: good, needs improvement or poor.
4. Compare the phases in the waterfall to see where the time goes, and read the suggestions underneath.
5. Copy the report, or download every run as CSV or JSON.

## Examples

**A page served through a CDN.** One test of `https://nodejs.org/en` during development returned these three runs:

```
          DNS  Connect  TLS  Wait  Download   TTFB   Total
Run 1      4      1      3    79      21       87    108
Run 2      8      3      4    80      21       95    116
Run 3      4      1      3    86      26       94    120
Median TTFB 94 ms → Good
```

The waterfall is almost all "wait". The cache header reads `cf-cache-status: DYNAMIC`, so the HTML was built by the origin rather than served from the CDN's cache. The suggestion explains that caching the page would cut the wait.

**A URL that redirects.** `http://nodejs.org/` answers with `308` and `Location: https://nodejs.org/`. The tester does not follow it. It shows "This URL redirects (308) to https://nodejs.org/. The times above are for the redirect response only", with a button to test the target. A redirect adds a full extra round trip for every visitor who uses the old address.

**A slow application page.** A median TTFB of 1,450 ms with a wait of 1,380 ms is rated "needs improvement". If the site sends a `Server-Timing` header such as `db;dur=412`, it is listed, which often points straight at the slow query.

## Tips and limits

- **One location.** Every request comes from the server that runs this site, so visitors on other continents will see different numbers. Run the test from the region your visitors are in if you can, and compare like with like.
- **Three runs, median shown.** The first run often includes a cold cache or a fresh connection. The median smooths that out, and every run is shown so you can spot outliers.
- **Thresholds.** Google's guidance on web.dev rates TTFB as good at 0.8 seconds or less and poor above 1.8 seconds. It applies those values to the 75th percentile of real visits, while a lab test is a small sample.
- **Redirects are not followed**, so you always see the cost of the exact URL you typed.
- **Timeouts.** A request that takes longer than 10 seconds is stopped. If one run times out, the median uses the others; if all three do, you get a clear error.
- **IPv4, IPv6 and protocols.** The server's IP address and version are shown. HTTP/2 or HTTP/3 support is reported when the server advertises it in the `alt-svc` header.
- **Limits:** 10 tests per 10 minutes per visitor, at most three requests per test, URLs up to 2,048 characters, public addresses on ports 80 and 443 only.

## FAQ

**What is TTFB?**
Time to First Byte is the time from starting a request to receiving the first byte of the response. It includes the DNS lookup, connecting, the TLS handshake and the time the server spends preparing the page.

**What is a good TTFB?**
Google's guidance calls 0.8 seconds or less good and anything over 1.8 seconds poor. Fast cached pages often come in under 200 ms from a nearby location.

**How do I reduce it?**
Cache whole pages at a CDN or in the application, speed up slow database queries, and avoid calls to other services before the first byte. Then remove redirects and enable TLS 1.3. The waterfall shows which of these matters most for your page.

**Why do my three runs differ?**
The first request may hit a cold cache or open a new connection, and busy servers vary from second to second. That is why the median is shown.

**Why is my TTFB different in Chrome DevTools?**
Your browser is in a different place, may reuse an open connection and may have the page cached. Both numbers are correct for where they were measured.

**Does the tester follow redirects?**
No. It measures the URL you typed and offers a button to test the redirect target separately.

## Privacy note

The URL you enter is sent to our server, which requests it three times and returns the timings. The URL and the results are not stored. The only thing kept is a short-lived counter for the rate limit, and the site you test sees a request from our server, not from you.

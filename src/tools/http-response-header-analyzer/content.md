---
title: "HTTP Response Header Analyzer: Security Grade & Fixes"
metaDescription: "An http response header analyzer that lists every header, grades HSTS, CSP and four more security headers, and gives Nginx, Apache and Caddy fixes."
h1: "HTTP Response Header Analyzer"
---

## Hero

This http response header analyzer fetches a URL, lists every response header and grades six security headers out of 100. It also checks caching, compression and cookies, and writes the configuration that fixes what is missing.

## How to use

1. Enter a URL. Without a scheme, https:// is used.
2. Keep HEAD as the method (it is fast and downloads no body) or choose GET. If a server refuses HEAD, the tool switches to GET by itself.
3. Optionally add up to 10 request headers, such as `Accept-Language: de`, to see how the response changes.
4. Click Analyse headers and read the grade, the notes for each header and the caching and compression checks.
5. Open the Nginx, Apache or Caddy tab and copy the configuration that adds the missing headers.

## Examples

**A well-configured site.** On 29 October 2026, `https://github.com/` scored 90/100, grade A. Strict-Transport-Security (`max-age=31536000; includeSubdomains; preload`) got 25/25, with a note that it meets the preload list requirements. Content-Security-Policy got 25/25, X-Frame-Options (`deny`) and X-Content-Type-Options (`nosniff`) got 15/15 each, and Referrer-Policy got 10/10. That header lists two values, and the tool explains that browsers use the last one they understand, `strict-origin-when-cross-origin`. Permissions-Policy was missing (0/10), so the Nginx tab shows one line:

```
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
```

Its three Set-Cookie headers are listed separately, and all have Secure and SameSite.

**An older PHP site.** Headers such as `Server: Apache/2.4.41 (Ubuntu)`, `X-Powered-By: PHP/7.4.3`, `Strict-Transport-Security: max-age=86400` and `Content-Security-Policy: default-src * 'unsafe-inline' 'unsafe-eval'` score 17/100, grade F. The tool flags the version numbers, the one-day HSTS, the unsafe CSP sources, a session cookie without Secure or HttpOnly, and HTML sent without compression. The Apache tab then includes `ServerTokens Prod` and the missing headers.

## Tips and limits

- The grade covers six headers worth 100 points in total: HSTS 25, CSP 25, X-Frame-Options 15, X-Content-Type-Options 15, Referrer-Policy 10, Permissions-Policy 10. The full rubric is shown below the tool. Grades: A+ from 95, A from 85, B from 70, C from 55, D from 40, otherwise F.
- Caching, compression, cookies and version leaks are reported but do not change the grade.
- HSTS only counts over HTTPS; browsers ignore it on plain HTTP responses.
- CSP `'unsafe-inline'` is not penalised when a nonce, hash or `'strict-dynamic'` is also present, because modern browsers then ignore it.
- A CSP for a real site needs your own domains; the snippet is a strict starting point to try in Report-Only mode first.
- Redirects are followed (up to 10) unless you turn that off. Each request waits up to 10 seconds; with GET, only the first 64 KB of the body is read.
- You can run 30 checks every 10 minutes. Private and local addresses, URLs with credentials and ports other than 80 and 443 are refused. Use the tool only on sites you are allowed to test.

## FAQ

**What are security headers?**
They are HTTP response headers that tell the browser to apply extra protection: always use HTTPS (HSTS), only run approved scripts (CSP), refuse to be framed (X-Frame-Options), and not guess file types (X-Content-Type-Options).

**What is a good security score?**
85 or more (grade A) means all the important headers are present and strict. Most sites can reach it by adding four or five lines to their server configuration; a strict CSP usually takes the most work.

**How do I add HSTS?**
Serve the site over HTTPS, then add `Strict-Transport-Security: max-age=31536000; includeSubDomains` to HTTPS responses. In Nginx: `add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;`. Add `preload` only once every subdomain supports HTTPS.

**Why did the tool use GET when I chose HEAD?**
Some servers answer HEAD with 405, 501 or even 403/404. When the GET result differs, the tool uses GET and reads only the first 64 KB.

**Is X-XSS-Protection still needed?**
No. Browsers removed the XSS auditor, and the header can cause problems in old ones. Setting it to 0, as GitHub does, is fine.

**Why is compression marked as missing?**
The response was text (HTML, CSS, JavaScript or JSON) without Content-Encoding. Brotli or gzip usually shrinks text by 60–80%.

## Privacy note

Our server sends the request to the URL you entered, including any request headers you added, and returns the response headers to your browser. We do not store or log the URL, your custom headers or the results. Rate limiting counts requests per IP address for 10 minutes.

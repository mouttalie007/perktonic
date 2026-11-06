---
title: "DNS Lookup Tool Online: Records, TTLs and WHOIS (RDAP)"
metaDescription: "A free dns lookup tool online: A, AAAA, CNAME, MX, TXT, NS, SOA and CAA records with TTLs, RDAP registration dates and warnings about DNS mistakes."
h1: "DNS Lookup Tool Online"
---

## Hero

This DNS lookup tool online shows a domain's A, AAAA, CNAME, MX, TXT, NS, SOA and CAA records with their TTLs. It also shows registration data and points out mistakes such as a missing MX record or a dangling CNAME.

## How to use

1. Type a domain such as `example.com`. A URL or an email address also works: the domain is taken from it.
2. Keep all eight record types ticked, or choose only the ones you need.
3. Leave "Registration data (RDAP)" ticked to see the registrar, the creation and expiry dates, and the name servers.
4. Press "Look up" and read the warnings first, then the records.
5. Copy the report, or download the records as CSV or JSON.

## Examples

**A company domain.** A lookup of a typical domain returns two MX records (`10 mx1…` and `20 mx2…`), three TXT records and two name servers, each with its TTL (for example `60 min` or `24 h`). The tool then warns:

```
Warning  The MX host mx1.example.net is a CNAME. Mail servers expect MX
         targets to have their own A or AAAA records (RFC 2181).
Note     No AAAA (IPv6) record.
Note     1 record(s) have a TTL under 60 seconds (lowest 30 s).
```

The registration card shows the registrar with its IANA ID, the creation date (14 Jan 1995), the expiry date (13 Jan 2027), the status codes and whether the zone is DNSSEC-signed at the registry.

**A forgotten subdomain.** `old.example.net` is a CNAME to `retired-app.paas-host.example`, a name that no longer exists. The tool reports a **dangling CNAME**. This is worth fixing quickly: if someone else registers the target, they can serve content on your subdomain.

**A name behind a CDN.** For `www.example.net` the tool shows the CNAME chain in order, `www.example.net → example-net.cdn-host.example → edge-17.cdn-host.example`, followed by the final A and AAAA addresses.

## Tips and limits

- **Where the answers come from:** the records are fetched through Cloudflare's public resolver (1.1.1.1) over HTTPS, so your domain name is sent to Cloudflare. The TTLs are the ones the resolver returns, which may already have counted down from the zone's value.
- **Registration data** comes from RDAP, the modern replacement for WHOIS. The registry is found through IANA's list. Some country-code domains have no RDAP server; the page says so and still shows every DNS record. Registrant names and contact details are never shown.
- **Subdomains:** registration data is looked up for the registered domain, for example `example.co.uk` for `shop.example.co.uk`.
- **IDN domains** such as `bücher.de` are converted to their punycode form (`xn--bcher-kva.de`) and shown in both forms. IP addresses are not accepted: this tool looks up names.
- **Long TXT records**, such as DKIM keys, are stored by DNS as 255-character strings. They are shown joined and are never shortened.
- **Limits:** 20 lookups per 10 minutes per visitor, at most 8 DNS queries and 2 registry requests per lookup. Only the preferred MX host is checked for a CNAME when all eight types are requested.

## FAQ

**How do I look up DNS records?**
Enter the domain and press "Look up". Each record type gets its own rows with its value and TTL; a type with no record says "No record of this type".

**What is an MX record?**
It names the mail servers that accept email for the domain, each with a priority: lower numbers are tried first. Without MX records most senders will not deliver mail to the domain.

**How long do DNS changes take?**
As long as the old record's TTL. A record with a 1-hour TTL can be cached for an hour after you change it, so lower the TTL a day before a planned change.

**What does "dangling CNAME" mean?**
The name points to another name that no longer exists, usually a deleted cloud service. Remove the CNAME, or recreate the target.

**Why is my domain's WHOIS information missing?**
The registry may have no RDAP server, or it may have limited our requests for a while. Privacy rules also mean contact details are rarely published.

**What is a CAA record?**
It lists the certificate authorities allowed to issue certificates for the domain. Without one, any authority may issue them.

## Privacy note

The domain you enter is sent to Cloudflare's public DNS resolver and, for registration data, to the domain registry's RDAP server. Nothing is stored or logged with your identity; only a short-lived counter for the rate limit is kept.

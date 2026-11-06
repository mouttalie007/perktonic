---
title: "SPF DKIM DMARC Checker with Suggested Fixes"
metaDescription: "A free spf dkim dmarc checker: counts SPF lookups through every include, checks DMARC tags and DKIM keys, MTA-STS and BIMI, and suggests corrected records."
h1: "SPF, DKIM and DMARC Checker"
---

## Hero

This SPF DKIM DMARC checker reads a domain's email authentication records and explains each problem in plain words. It counts SPF lookups through every include, checks DMARC and DKIM, MTA-STS and BIMI, and suggests corrected records you can copy.

## How to use

1. Enter your domain, or any email address on it.
2. If you know your DKIM selector, enter it. It is the `s=` value in the DKIM-Signature header of a message you sent. Otherwise 20 common selectors are tried.
3. Press "Check".
4. Read the coloured summary, then each section: the record as published, the findings, and a suggested record where one would help.
5. Copy the suggestions into your DNS, or download the full report.

## Examples

**A small company still on p=none.** The SPF record `v=spf1 include:_spf.mail-host.example include:servers.newsletter.example ip4:192.0.2.0/24 ~all` uses 5 of the 10 allowed DNS lookups once nested includes are counted. The include tree shows where each lookup comes from. DMARC is `p=none; pct=50`, so the checker warns twice and suggests:

```
v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com,mailto:reports@dmarc-vendor.example; adkim=r; aspf=r
```

The probe finds two DKIM keys: `google` (2048-bit RSA) and `selector1` (1024-bit, marked t=y for testing), which gets a warning. The MTA-STS policy is in testing mode and does not list one of the two MX hosts. BIMI is published, but no logo will show while DMARC is p=none.

**Too many includes.** A record with three includes, each including more, plus `mx`, `a` and `ptr`, needs **11** lookups. Receivers stop at 10 and SPF fails with "permerror". The checker says so, flags `ptr` as deprecated, and suggests the same record without `ptr`.

**Two SPF records.** When a domain publishes `v=spf1 ip4:192.0.2.0/33 ptr +all` next to a second SPF record, the checker reports both records (only one is allowed), the invalid `/33` range and `+all`. It then suggests one merged record that ends in `~all`.

## Tips and limits

- **SPF lookups:** `include`, `a`, `mx`, `ptr`, `exists` and `redirect` each count as one, including inside nested includes. The limit is 10. Lookups that return nothing ("void lookups") are limited to 2. Loops are detected, and recursion stops at 10 levels.
- **DMARC:** the record at `_dmarc.<domain>` is checked, or the organisational domain's record if the subdomain has none. The tags `p`, `sp`, `pct`, `rua`, `ruf`, `adkim`, `aspf`, `fo` and `ri` are validated.
- **DKIM:** not finding a key among the 20 guessed selectors does not prove that DKIM is missing; selectors can have any name. Check the exact selector from a sent message.
- **MTA-STS** is checked through the `_mta-sts` record and the policy file at `https://mta-sts.<domain>/.well-known/mta-sts.txt`. A redirect on that URL is reported as an error, because senders ignore redirected policies.
- **BIMI:** only the record's presence and syntax are checked; the logo and certificate are not downloaded.
- **What this tool cannot tell you:** whether a particular message will be delivered. It checks the published records, not your messages.
- **Limits:** 15 checks per 10 minutes per visitor, and at most 40 DNS queries per check. A very deep SPF tree may be only partly followed; the page says so.

## FAQ

**What are SPF, DKIM and DMARC?**
SPF lists the servers allowed to send mail for your domain. DKIM signs each message with a key published in DNS. DMARC tells receivers what to do when a message fails both, and where to send reports.

**Why do my emails go to spam?**
Missing or failing authentication is a common cause, but content, sending reputation and complaint rates also matter. Fix the problems shown here first, then look at the DMARC reports.

**How many lookups can SPF have?**
Ten DNS lookups in total, counting nested includes, plus at most two lookups that return nothing. Above that, SPF fails for every message.

**Should I use ~all or -all?**
Use `~all` while you check your DMARC reports; switch to `-all` once every legitimate sender is listed. Avoid `+all` and `?all`.

**What DMARC policy should I use?**
Start with `p=none` and an `rua` address to collect reports. Move to `quarantine` and then `reject` once your own mail passes.

## Privacy note

The domain you enter is looked up through a public DNS resolver (Cloudflare), and the MTA-STS policy file is requested from the domain's own website. Nothing is stored or logged with your identity; only a short-lived counter for the rate limit is kept.

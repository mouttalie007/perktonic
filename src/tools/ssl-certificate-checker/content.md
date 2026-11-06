---
title: "SSL Certificate Checker: Expiry, Chain and TLS Versions"
metaDescription: "A free ssl certificate checker: days until expiry, name match, chain completeness, key size and the TLS versions your server accepts, in plain words."
h1: "SSL Certificate Checker"
---

## Hero

This SSL certificate checker connects to your server and tells you how many days the certificate has left. It also checks whether the certificate covers your domain and whether the chain is complete, and which TLS versions the server accepts, each in plain words.

## How to use

1. Enter a domain such as `example.com`, or paste a URL.
2. Keep port 443 for a website, or pick 465 (SMTPS), 993 (IMAPS), 995 (POP3S) or 8443.
3. Press "Check". The server is contacted five times: once to read the certificate, and once for each TLS version from 1.0 to 1.3.
4. Read the verdict and the countdown, then the individual checks, the protocol table and the certificate chain.
5. Copy the report or download it as JSON.

## Examples

**A healthy site.** For `shop.example.com` the checker shows **54 days left** and the verdict "The certificate is valid, trusted and covers shop.example.com." The chain reads: server certificate (ECDSA 256-bit, issued by Let's Encrypt R11), then the R11 intermediate, then the ISRG Root X1 root. TLS 1.2 and 1.3 are accepted; TLS 1.0 and 1.1 are refused.

**An old server that needs attention.** `legacy.example.com` gets four findings:

```
Warning   Expires in 9 days. Renew it this week.
Problem   Weak key: RSA 1024 bits. Use at least 2048 bits.
Warning   Accepts TLS 1.0 and TLS 1.1. These versions were deprecated in 2021 (RFC 8996).
Note      TLS 1.3 is not supported.
```

**A certificate that fails in some apps.** When a server sends only its own certificate and not the intermediate, the checker reports **"The chain is incomplete"**. Many desktop browsers fetch the missing certificate themselves, so the site can look fine to you while mobile apps, older Android phones and API clients refuse to connect. Install the full chain (often called `fullchain.pem`).

## Tips and limits

- **Expiry warnings** start at 30 days and become more urgent at 14 and 7 days. An expired certificate is reported with how many days ago it ended.
- **Name matching:** the certificate must list the exact name you check. A certificate for `www.example.com` does not cover `example.com` unless both names are on it.
- **Trust problems** are translated into plain words: expired, self-signed, untrusted root, incomplete chain, name mismatch, not yet valid or revoked.
- **The root certificate** at the end of the chain usually comes from our own trust store, not from your server, and the page says so.
- **Validity longer than 398 days** is pointed out: browsers have rejected such newly issued public certificates since September 2020.
- **Ciphers:** only the cipher negotiated with our server is shown. A full list of supported ciphers is not part of this check.
- **Limits:** 15 checks per 10 minutes per visitor, at most 5 connections per check, ports 443, 465, 993, 995 and 8443 only, and public addresses only.

## FAQ

**How do I check when my SSL certificate expires?**
Enter your domain and press "Check". The countdown shows the days left, and the server certificate card shows the exact end date.

**What is an incomplete chain?**
Browsers trust a certificate through a chain: your certificate, one or more intermediates, then a trusted root. If the server does not send the intermediate, clients that cannot fetch it themselves fail to connect.

**What does SNI mean?**
Server Name Indication: the client says which host name it wants during the TLS handshake, so one IP address can serve several certificates. This checker always sends the name you enter, as browsers do.

**Why is TLS 1.0 a problem?**
TLS 1.0 and 1.1 have known weaknesses and were formally deprecated in 2021. Every current browser supports TLS 1.2, so turning the old versions off rarely breaks anything.

**Can I check a mail server?**
Yes, if it uses implicit TLS: choose port 465 for SMTP, 993 for IMAP or 995 for POP3. Port 587 with STARTTLS is not supported.

**Does the result match what my visitors see?**
Mostly: the certificate is the same for everyone, but trust stores and supported versions vary a little between browsers and devices.

## Privacy note

The host you enter is contacted by our server over TLS, from one location. Only the certificate details and protocol results are returned to you; nothing is stored or logged with your identity, apart from a short-lived counter for the rate limit.

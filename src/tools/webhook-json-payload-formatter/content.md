---
title: "Webhook JSON Payload Formatter for Stripe, GitHub, Shopify"
metaDescription: "A free webhook json payload formatter that pretty-prints the body, shows the path of every field and checks Stripe, GitHub, Shopify and Slack payloads."
h1: "Webhook JSON Payload Formatter and Inspector"
---

## Hero

This webhook json payload formatter pretty-prints a webhook body and shows the exact path of every field. It checks Stripe, GitHub, Shopify and Slack payloads against their public documentation and masks secrets before you copy anything. The payload never leaves your browser.

## How to use

1. Paste the request body from your logs, from the provider's dashboard or from a request catcher. You can also open a `.json` file.
2. Leave "Provider checks" on "Detect automatically", or choose Stripe, GitHub, Shopify or Slack yourself.
3. Read the summary: the provider, the event and the size of the payload.
4. Go through the checks. Each one says what the documentation describes, what the payload contains and which page it comes from.
5. Expand the tree and press "copy path" next to any field to get a path such as `$.data.object.id`.
6. Copy or download the formatted JSON. Masking is on by default, so tokens, emails and card-like numbers are hidden.

## Examples

**A Stripe event** (loaded when the page opens). A `payment_intent.succeeded` event for €49.00 is recognised as Stripe from `"object": "event"` and the `evt_` ID. Thirteen fields match the Event object reference, for example:

```
✓ $.created is a Unix timestamp in seconds    Found 1761990410.
✓ The event type matches data.object.object   "payment_intent.succeeded" is about a payment_intent.
```

The key fields table lists `$.data.object.amount` → `4900` and `$.data.object.currency` → `"eur"`. With masking on, `receipt_email` becomes `"***@example.com"` and `client_secret` becomes `"[redacted]"` in the view, the copy and the download.

**A payload that differs from the docs.** If `created` is sent in milliseconds (`1761990410000`) and `amount` arrives as the string `"49.00"`, two checks are flagged:

```
! $.created should be a Unix timestamp in seconds       Found 1761990410000 (an integer).
! $.data.object.amount should be an integer in the smallest currency unit (cents)
```

**A Slack event.** An `event_callback` wrapping an `app_mention` is checked for `team_id`, `api_app_id`, `event_id` and `event_time`. The check also notes that the top-level `token` is Slack's deprecated verification token and points to the page on signing secrets.

## Tips and limits

- **Checks:** Stripe event envelopes, GitHub common properties plus push, pull_request, issues and ping events, Shopify orders (and the basics of products and customers), and the Slack Events API. Every check is advisory and links to the page it was written from. A difference is a reason to look, not proof of a bug.
- **What is not checked:** signatures. They need the raw request, its headers and your secret, so verify `Stripe-Signature`, `X-Hub-Signature-256`, `X-Shopify-Hmac-Sha256` or `X-Slack-Signature` on your server.
- **Headers:** GitHub and Shopify name the event in a header (`X-GitHub-Event`, `X-Shopify-Topic`), so the tool guesses the event from the body's fields and says so.
- **Masking:** API keys and tokens with a known prefix (`sk_live_`, `whsec_`, `ghp_`, `xoxb-`, `shpat_`, JWTs, Bearer values) are masked, as are fields named like `token`, `secret`, `password` or `signature`. Emails keep only their domain, and card numbers that pass the Luhn check keep their last four digits.
- **Numbers:** they are kept exactly as written, so large IDs such as Shopify's are never rounded.
- **Size:** paste up to 5 MB or open a file of up to 50 MB. Processing runs in a background thread, with progress and a Cancel button for large files. In Chrome, 5 MB takes about 1.5 seconds and 40 MB about 15.

## FAQ

**How do I read a Stripe webhook payload?**
Start with `type` (what happened) and `data.object` (the object it happened to, such as a PaymentIntent). On `*.updated` events, `data.previous_attributes` holds the old values. `created` is in seconds, and amounts are in cents.

**How do I find the path of a field?**
Expand the tree to the field and press "copy path". You get a JSONPath such as `$.pull_request.head.sha` or `$.line_items[0].price`, which works in most JSONPath tools.

**Is my payload uploaded?**
No. Parsing, checks and masking all happen in your browser tab. The tool never sends or receives a request.

**Why are Shopify prices strings?**
Shopify's REST payloads send money as decimal strings, such as `"94.90"`, to avoid floating-point rounding. Convert them with a decimal type, not a float.

**Does masking make the JSON safe to share?**
It removes the common secrets and personal data, but names, addresses and phone numbers stay. Read the result before you share it.

**Can I check a provider that is not listed?**
Choose "None (format only)" to get the formatted view, the tree with paths and masking without any checks.

## Privacy note

Payloads you paste or open are processed only in your browser, in a background thread. Nothing is uploaded, logged or stored, and the data is gone when you close or reload the page.

/** Release notes using every Markdown feature the Word export keeps, plus an image path that cannot be embedded. */
export const SAMPLE_MARKDOWN = `# Release notes: checkout v2

Checkout v2 cuts the **mobile** checkout from four steps to two.[^1] It ships behind the \`checkout_v2\` flag on *15 November*.

## What changed

- Address lookup by postcode
  - UK and Ireland first
- Wallet payments (Apple Pay, Google Pay)
- [x] Load testing done
- [ ] Accessibility review

## Rollout

1. 10% of traffic for one week
2. 50% if conversion holds
3. Everyone

| Step | Before | After |
|:-----|-------:|------:|
| Address | 41% drop-off | 18% drop-off |
| Payment | 12% drop-off | 9% drop-off |

> Keep the old flow available for two weeks after full rollout.

## Tracking

\`\`\`js
analytics.track("checkout_step", { step: "address", ms: 5400 });
\`\`\`

![Conversion by step](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAAwCAIAAABhdOiYAAAAcElEQVR42u3ZoQ0AIAwEwHpWZH+BYwIYoZgaesnrT3ru0xjzpFk7z689AQgQIECAAAECBAgQIEAFQJ2Pf+kBBAgQIECAAAECBAgQoAogY9WaBwQIECBAgAABAgQIkL+YNQ8IECBAgAABAgQIEKAGQBehN0I79Q/s9gAAAABJRU5ErkJggg==)

Questions go to [the checkout channel](https://example.com/chat/checkout). A diagram of the old flow is at ![old flow](diagrams/old-flow.png).

[^1]: Measured on 30 days of September 2026 traffic.
`;

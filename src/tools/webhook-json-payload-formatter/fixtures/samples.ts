import type { ProviderId } from "../src/logic/providers";

/**
 * Sample payloads written for this tool from each provider's public
 * documentation. IDs, names and addresses are invented.
 */

const stripe = {
  id: "evt_3QK8m2LkdIwHu7ix0vR4cT1a",
  object: "event",
  api_version: "2024-06-20",
  created: 1761990410,
  data: {
    object: {
      id: "pi_3QK8m2LkdIwHu7ix0b9XyZ12",
      object: "payment_intent",
      amount: 4900,
      amount_received: 4900,
      capture_method: "automatic_async",
      client_secret: "pi_3QK8m2LkdIwHu7ix0b9XyZ12_secret_Wq81vNfB2kLx0pR7sT3uYc",
      created: 1761990402,
      currency: "eur",
      customer: "cus_R2bX7nQ4LmP9sZ",
      description: "Pro plan, annual",
      latest_charge: "ch_3QK8m2LkdIwHu7ix0aB4cD5e",
      livemode: false,
      metadata: { order_id: "A-1042", plan: "pro_annual" },
      payment_method: "pm_1QK8lzLkdIwHu7ixYt6Rb8Nq",
      payment_method_types: ["card"],
      receipt_email: "ada.lovelace@example.com",
      status: "succeeded",
    },
  },
  livemode: false,
  pending_webhooks: 1,
  request: { id: "req_m7Qe2RuXk9TzLp", idempotency_key: "8d1f4f0a-63b4-4e7e-9c1d-2a6f1b7e3c55" },
  type: "payment_intent.succeeded",
};

const github = {
  action: "opened",
  number: 128,
  pull_request: {
    url: "https://api.github.com/repos/octo-shop/storefront/pulls/128",
    id: 2101934561,
    node_id: "PR_kwDOLx1c8M59Rk7h",
    html_url: "https://github.com/octo-shop/storefront/pull/128",
    number: 128,
    state: "open",
    locked: false,
    title: "Add Apple Pay to checkout",
    user: { login: "ada-dev", id: 5810234, type: "User" },
    body: "Adds the Apple Pay button behind the `apple_pay` flag. Reviewed with @grace-ops.",
    created_at: "2026-11-01T09:12:44Z",
    updated_at: "2026-11-01T09:12:44Z",
    merged: false,
    draft: false,
    head: { label: "ada-dev:feature/apple-pay", ref: "feature/apple-pay", sha: "9f3c2a1b7e6d5c4b3a291807f6e5d4c3b2a19081" },
    base: { label: "octo-shop:main", ref: "main", sha: "1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d" },
    commits: 3,
    additions: 214,
    deletions: 17,
    changed_files: 6,
  },
  repository: {
    id: 734512908,
    node_id: "R_kgDOK8xYzA",
    name: "storefront",
    full_name: "octo-shop/storefront",
    private: true,
    owner: { login: "octo-shop", id: 98123456, type: "Organization" },
    html_url: "https://github.com/octo-shop/storefront",
    default_branch: "main",
  },
  organization: { login: "octo-shop", id: 98123456 },
  sender: { login: "ada-dev", id: 5810234, type: "User" },
};

const shopify = {
  id: 5987345612345,
  admin_graphql_api_id: "gid://shopify/Order/5987345612345",
  name: "#1042",
  email: "grace.hopper@example.org",
  phone: "+447700900123",
  created_at: "2026-11-01T10:15:31+01:00",
  updated_at: "2026-11-01T10:15:33+01:00",
  currency: "EUR",
  presentment_currency: "EUR",
  subtotal_price: "89.00",
  total_tax: "14.83",
  total_discounts: "0.00",
  total_price: "94.90",
  financial_status: "paid",
  fulfillment_status: null,
  test: false,
  customer: { id: 7123456789012, email: "grace.hopper@example.org", first_name: "Grace", last_name: "Hopper" },
  line_items: [
    { id: 14567890123456, product_id: 8123456789012, variant_id: 45123456789012, title: "Merino Beanie", variant_title: "Navy", sku: "BEANIE-NAVY", quantity: 2, price: "29.50" },
    { id: 14567890123457, product_id: 8123456789099, variant_id: 45123456789099, title: "Wool Socks (3 pack)", variant_title: "M", sku: "SOCKS-3-M", quantity: 1, price: "30.00" },
  ],
  shipping_lines: [{ title: "Standard", price: "5.90" }],
  shipping_address: { first_name: "Grace", last_name: "Hopper", address1: "12 Example Street", city: "Dublin", zip: "D02 X285", country_code: "IE" },
};

const slack = {
  token: "Jhj5dZrVaK7ZwHHjRyZWjbDl",
  team_id: "T061EG9R6",
  api_app_id: "A0MDYCDME",
  event: {
    type: "app_mention",
    user: "U061F7AUR",
    text: "<@U0LAN0Z89> can you post the deploy status for storefront?",
    ts: "1761991231.000200",
    channel: "C0LAN2Q65",
    event_ts: "1761991231.000200",
  },
  type: "event_callback",
  event_id: "Ev0LAN670R",
  event_time: 1761991231,
  authorizations: [{ enterprise_id: null, team_id: "T061EG9R6", user_id: "U0LAN0Z89", is_bot: true, is_enterprise_install: false }],
  is_ext_shared_channel: false,
};

export const SAMPLES: Record<ProviderId, string> = {
  stripe: JSON.stringify(stripe, null, 2),
  github: JSON.stringify(github, null, 2),
  shopify: JSON.stringify(shopify, null, 2),
  slack: JSON.stringify(slack, null, 2),
};

/** A copy with a typical mistake, for the error example: a trailing comma. */
export const BROKEN = `{
  "id": "evt_3QK8m2LkdIwHu7ix0vR4cT1a",
  "object": "event",
  "type": "invoice.paid",
  "data": {
    "object": { "id": "in_1QK9aBLkdIwHu7ix", "object": "invoice", "amount_paid": 4900, },
  }
}`;

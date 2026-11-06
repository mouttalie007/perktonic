import { pathString } from "./format";
import type { Node } from "./parser";

/**
 * Advisory checks written from each provider's public documentation (read in
 * October 2026). Providers add fields and versions over time, so a "missing"
 * result means "not what the docs describe", not "your webhook is broken".
 */

export type ProviderId = "stripe" | "github" | "shopify" | "slack";

export const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: "stripe", label: "Stripe" },
  { id: "github", label: "GitHub" },
  { id: "shopify", label: "Shopify" },
  { id: "slack", label: "Slack" },
];

export interface DocRef {
  title: string;
  url: string;
}

export const DOCS = {
  stripeEvent: { title: "Stripe API reference: The Event object", url: "https://docs.stripe.com/api/events/object" },
  stripeWebhooks: { title: "Stripe docs: Receive Stripe events in your webhook endpoint", url: "https://docs.stripe.com/webhooks" },
  stripeTypes: { title: "Stripe API reference: Types of events", url: "https://docs.stripe.com/api/events/types" },
  githubPayloads: { title: "GitHub Docs: Webhook events and payloads", url: "https://docs.github.com/en/webhooks/webhook-events-and-payloads" },
  githubValidate: { title: "GitHub Docs: Validating webhook deliveries", url: "https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries" },
  shopifyWebhooks: { title: "Shopify docs: About webhooks", url: "https://shopify.dev/docs/apps/build/webhooks" },
  shopifyOrder: { title: "Shopify Admin REST API: Order resource", url: "https://shopify.dev/docs/api/admin-rest/latest/resources/order" },
  shopifyGid: { title: "Shopify docs: Global IDs in the GraphQL Admin API", url: "https://shopify.dev/docs/api/usage/gids" },
  slackEvents: { title: "Slack docs: The Events API", url: "https://docs.slack.dev/apis/events-api/" },
  slackVerify: { title: "Slack docs: Verifying requests from Slack", url: "https://docs.slack.dev/authentication/verifying-requests-from-slack" },
} satisfies Record<string, DocRef>;

export type Level = "pass" | "warn" | "info";

export interface Check {
  level: Level;
  /** What was expected, in one line. */
  title: string;
  /** What was found. */
  detail: string;
  path: string;
  doc: DocRef;
}

export interface Inspection {
  provider: ProviderId | null;
  /** How the provider was chosen. */
  detectedBy: "auto" | "manual" | "none";
  /** "payment_intent.succeeded", "pull_request (opened)", "orders (Order resource)"… */
  event: string | null;
  checks: Check[];
  /** Paths worth reading first for this provider and event. */
  keyPaths: string[];
}

// ------------------------------------------------------------------ helpers

type Step = string | number;

function get(root: Node, steps: Step[]): Node | undefined {
  let node: Node | undefined = root;
  for (const s of steps) {
    if (!node) return undefined;
    if (node.t === "object" && typeof s === "string") {
      const i = node.keys.lastIndexOf(s);
      node = i < 0 ? undefined : node.values[i];
    } else if (node.t === "array" && typeof s === "number") node = node.items[s];
    else return undefined;
  }
  return node;
}

const str = (n: Node | undefined): string | null => (n?.t === "string" ? n.value : null);
const isInt = (n: Node | undefined) => n?.t === "number" && /^-?\d+$/.test(n.raw);
const typeName = (n: Node | undefined) => (n === undefined ? "missing" : n.t === "number" && /^-?\d+$/.test(n.raw) ? "an integer" : n.t === "number" ? "a number" : n.t === "object" ? "an object" : n.t === "array" ? "an array" : n.t === "null" ? "null" : `a ${n.t}`);
const show = (n: Node | undefined) => (n === undefined ? "missing" : n.t === "string" ? (n.raw.length > 60 ? `${n.raw.slice(0, 57)}…"` : n.raw) : n.t === "number" ? n.raw : n.t === "boolean" || n.t === "null" ? String(n.t === "boolean" ? n.value : "null") : typeName(n));

class Checker {
  checks: Check[] = [];
  constructor(
    private root: Node,
    private doc: DocRef,
  ) {}
  useDoc(doc: DocRef) {
    this.doc = doc;
    return this;
  }
  /** Expects a node of a type (and optionally a shape); records pass or warn. */
  expect(steps: Step[], what: string, ok: (n: Node | undefined) => boolean, optional = false): Node | undefined {
    const n = get(this.root, steps);
    const path = pathString(steps);
    if (n === undefined && optional) return n;
    this.checks.push(ok(n) ? { level: "pass", title: `${path} is ${what}`, detail: `Found ${show(n)}.`, path, doc: this.doc } : { level: "warn", title: `${path} should be ${what}`, detail: n === undefined ? "Not found in this payload." : `Found ${show(n)} (${typeName(n)}).`, path, doc: this.doc });
    return n;
  }
  info(title: string, detail: string, path = "$") {
    this.checks.push({ level: "info", title, detail, path, doc: this.doc });
  }
  warn(title: string, detail: string, path: string) {
    this.checks.push({ level: "warn", title, detail, path, doc: this.doc });
  }
}

const isObj = (n?: Node) => n?.t === "object";
const isArr = (n?: Node) => n?.t === "array";
const isBool = (n?: Node) => n?.t === "boolean";
const isStr = (n?: Node) => n?.t === "string";
const strMatching = (re: RegExp) => (n?: Node) => n?.t === "string" && re.test(n.value);
const objOrNull = (n?: Node) => n?.t === "object" || n?.t === "null";
const strOrNull = (n?: Node) => n?.t === "string" || n?.t === "null";
/** Unix time in seconds between 2010 and 2100: catches milliseconds sent by mistake. */
const unixSeconds = (n?: Node) => isInt(n) && Number((n as { raw: string }).raw) > 1_262_304_000 && Number((n as { raw: string }).raw) < 4_102_444_800;
const ISO_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const SHA = /^[0-9a-f]{40}$/;
const DECIMAL_STRING = /^-?\d+(?:\.\d+)?$/;

// ------------------------------------------------------------------ detection

export function detect(root: Node): ProviderId | null {
  if (root.t !== "object") return null;
  const object = str(get(root, ["object"]));
  const id = str(get(root, ["id"]));
  if (object === "event" || (id?.startsWith("evt_") && get(root, ["data", "object"]))) return "stripe";
  const type = str(get(root, ["type"]));
  if (type === "event_callback" || type === "url_verification" || type === "app_rate_limited" || (get(root, ["api_app_id"]) && get(root, ["team_id"]))) return "slack";
  if (str(get(root, ["admin_graphql_api_id"]))?.startsWith("gid://shopify/")) return "shopify";
  if (str(get(root, ["sender", "login"])) !== null || str(get(root, ["repository", "full_name"])) !== null || (get(root, ["zen"]) && get(root, ["hook_id"]))) return "github";
  return null;
}

// ------------------------------------------------------------------ Stripe

function stripe(root: Node): Omit<Inspection, "provider" | "detectedBy"> {
  const c = new Checker(root, DOCS.stripeEvent);
  c.expect(["id"], 'a string starting with "evt_"', strMatching(/^evt_\w+$/));
  c.expect(["object"], '"event"', strMatching(/^event$/));
  const type = c.expect(["type"], "an event type such as payment_intent.succeeded", strMatching(/^[a-z_]+(?:\.[a-z_]+)+$/));
  c.expect(["api_version"], "the API version string, such as 2024-06-20", (n) => n?.t === "string" || n?.t === "null");
  c.expect(["created"], "a Unix timestamp in seconds", unixSeconds);
  c.expect(["livemode"], "a boolean", isBool);
  c.expect(["pending_webhooks"], "an integer", isInt);
  c.expect(["request"], "an object with id and idempotency_key, or null", objOrNull);
  c.expect(["data"], "an object", isObj);
  const obj = c.expect(["data", "object"], "the object the event is about", isObj);
  const objType = str(get(root, ["data", "object", "object"]));
  const t = str(type);
  if (obj && t && objType) {
    const resource = t.slice(0, t.lastIndexOf("."));
    if (resource === objType || resource.endsWith(`.${objType}`) || resource.replace(/\./g, "_") === objType) c.checks.push({ level: "pass", title: "The event type matches data.object.object", detail: `“${t}” is about a ${objType}.`, path: "$.data.object.object", doc: DOCS.stripeTypes });
    else c.checks.push({ level: "info", title: "The event type and data.object.object differ", detail: `“${t}” carries a ${objType}. Some events do this on purpose (for example customer.source.* events carry a card); check the event list.`, path: "$.data.object.object", doc: DOCS.stripeTypes });
  }
  if (t?.endsWith(".updated")) {
    const prev = get(root, ["data", "previous_attributes"]);
    c.useDoc(DOCS.stripeEvent);
    if (prev) c.expect(["data", "previous_attributes"], "an object with the old values of changed fields", isObj);
    else c.info("No data.previous_attributes", "Stripe usually includes the old values of changed fields on *.updated events.", "$.data.previous_attributes");
  }
  const amount = get(root, ["data", "object", "amount"]);
  if (amount) {
    c.useDoc(DOCS.stripeEvent);
    c.expect(["data", "object", "amount"], "an integer in the smallest currency unit (cents)", isInt);
    c.expect(["data", "object", "currency"], "a lower-case three-letter currency code", strMatching(/^[a-z]{3}$/));
  }
  c.useDoc(DOCS.stripeWebhooks).info("Signature not checked here", "Verify the Stripe-Signature header with your endpoint's signing secret (whsec_…) on your server. A pasted payload cannot be verified.");
  const id = str(get(root, ["data", "object", "id"]));
  return {
    event: t ? `${t}${id ? ` (${id})` : ""}` : null,
    checks: c.checks,
    keyPaths: ["$.id", "$.type", "$.created", "$.livemode", "$.api_version", "$.data.object.id", "$.data.object.object", "$.data.object.amount", "$.data.object.currency", "$.data.object.status", "$.data.object.customer", "$.data.object.metadata", "$.request.idempotency_key"],
  };
}

// ------------------------------------------------------------------ GitHub

function githubEvent(root: Node): string | null {
  if (get(root, ["zen"]) && get(root, ["hook_id"])) return "ping";
  if (get(root, ["ref"]) && get(root, ["before"]) && get(root, ["after"]) && get(root, ["commits"])) return "push";
  if (get(root, ["pull_request"]) && get(root, ["review"])) return "pull_request_review";
  if (get(root, ["pull_request"]) && get(root, ["number"])) return "pull_request";
  if (get(root, ["issue"]) && get(root, ["comment"])) return "issue_comment";
  if (get(root, ["issue"])) return "issues";
  if (get(root, ["release"])) return "release";
  if (get(root, ["workflow_run"])) return "workflow_run";
  if (get(root, ["check_run"])) return "check_run";
  if (get(root, ["ref_type"]) && get(root, ["ref"])) return "create or delete";
  if (get(root, ["starred_at"]) !== undefined) return "star";
  return null;
}

function github(root: Node): Omit<Inspection, "provider" | "detectedBy"> {
  const c = new Checker(root, DOCS.githubPayloads);
  const event = githubEvent(root);
  const action = str(get(root, ["action"]));
  const keyPaths = ["$.action", "$.sender.login", "$.repository.full_name", "$.organization.login", "$.installation.id"];
  if (event === "ping") {
    c.expect(["zen"], "a string", isStr);
    c.expect(["hook_id"], "an integer", isInt);
    c.expect(["hook"], "an object describing the webhook", isObj);
    keyPaths.push("$.zen", "$.hook_id", "$.hook.events");
  } else {
    c.expect(["sender"], "an object (the user who triggered the event)", isObj);
    c.expect(["sender", "login"], "a string", isStr);
    c.expect(["sender", "id"], "an integer", isInt);
    if (get(root, ["repository"])) {
      c.expect(["repository", "id"], "an integer", isInt);
      c.expect(["repository", "full_name"], "owner/name", strMatching(/^[^/\s]+\/[^/\s]+$/));
      c.expect(["repository", "owner", "login"], "a string", isStr);
    } else c.info("No repository object", "Organization-, app- and sponsorship-level events have no repository; repository events always do.", "$.repository");
  }
  if (event === "push") {
    c.expect(["ref"], "a full ref such as refs/heads/main", strMatching(/^refs\/(heads|tags)\/.+/));
    c.expect(["before"], "a 40-character commit SHA", strMatching(SHA));
    c.expect(["after"], "a 40-character commit SHA", strMatching(SHA));
    const commits = c.expect(["commits"], "an array (up to 2048 commits)", isArr);
    if (commits?.t === "array" && commits.items.length) {
      c.expect(["commits", 0, "id"], "a 40-character commit SHA", strMatching(SHA));
      c.expect(["commits", 0, "message"], "a string", isStr);
      c.expect(["commits", 0, "author", "email"], "a string", isStr);
    }
    c.expect(["head_commit"], "an object, or null when the push deleted a branch", objOrNull);
    keyPaths.push("$.ref", "$.before", "$.after", "$.head_commit.id", "$.head_commit.message", "$.pusher.name");
  }
  if (event === "pull_request" || event === "pull_request_review") {
    c.expect(["action"], "a string such as opened, closed or synchronize", isStr);
    if (event === "pull_request") {
      const num = c.expect(["number"], "an integer", isInt);
      const prNum = get(root, ["pull_request", "number"]);
      if (num?.t === "number" && prNum?.t === "number") {
        if (num.raw === prNum.raw) c.checks.push({ level: "pass", title: "$.number equals $.pull_request.number", detail: `Both are ${num.raw}.`, path: "$.number", doc: DOCS.githubPayloads });
        else c.warn("$.number should equal $.pull_request.number", `${num.raw} vs ${prNum.raw}.`, "$.number");
      }
    }
    c.expect(["pull_request", "state"], '"open" or "closed"', strMatching(/^(open|closed)$/));
    c.expect(["pull_request", "head", "sha"], "a 40-character commit SHA", strMatching(SHA));
    c.expect(["pull_request", "base", "ref"], "the target branch name", isStr);
    if (action === "closed") c.expect(["pull_request", "merged"], "a boolean (true when the PR was merged, not just closed)", isBool);
    keyPaths.push("$.number", "$.pull_request.title", "$.pull_request.html_url", "$.pull_request.head.ref", "$.pull_request.head.sha", "$.pull_request.base.ref", "$.pull_request.merged");
  }
  if (event === "issues" || event === "issue_comment") {
    c.expect(["action"], "a string such as opened, edited or closed", isStr);
    c.expect(["issue", "number"], "an integer", isInt);
    c.expect(["issue", "title"], "a string", isStr);
    if (get(root, ["issue", "pull_request"])) c.info("This issue is a pull request", "GitHub sends comments on pull requests as issue_comment events; $.issue.pull_request is set for them.", "$.issue.pull_request");
    if (event === "issue_comment") c.expect(["comment", "body"], "a string", isStr);
    keyPaths.push("$.issue.number", "$.issue.title", "$.issue.html_url", "$.comment.body");
  }
  c.useDoc(DOCS.githubPayloads).info(event ? `Looks like a “${event}” event` : "Event type not recognised", event ? `Guessed from the payload's fields. The X-GitHub-Event header names the event for certain.${action ? ` Action: ${action}.` : ""}` : "GitHub names the event only in the X-GitHub-Event header; only the common properties were checked.");
  c.useDoc(DOCS.githubValidate).info("Signature not checked here", "Verify the X-Hub-Signature-256 header (HMAC-SHA256 of the raw body with your webhook secret) on your server.");
  return { event: event ? `${event}${action ? ` (${action})` : ""}` : null, checks: c.checks, keyPaths };
}

// ------------------------------------------------------------------ Shopify

function shopify(root: Node): Omit<Inspection, "provider" | "detectedBy"> {
  const c = new Checker(root, DOCS.shopifyGid);
  const gid = str(get(root, ["admin_graphql_api_id"]));
  const m = gid ? /^gid:\/\/shopify\/([A-Za-z]+)\/(\d+)$/.exec(gid) : null;
  const resource = m?.[1] ?? null;
  c.expect(["id"], "an integer", isInt);
  c.expect(["admin_graphql_api_id"], "gid://shopify/<Resource>/<id>", strMatching(/^gid:\/\/shopify\/[A-Za-z]+\/\d+$/));
  const id = get(root, ["id"]);
  if (m && id?.t === "number") {
    if (m[2] === id.raw) c.checks.push({ level: "pass", title: "The global ID ends with $.id", detail: `${gid} ↔ ${id.raw}.`, path: "$.admin_graphql_api_id", doc: DOCS.shopifyGid });
    else c.warn("The global ID should end with $.id", `${gid} vs ${id.raw}.`, "$.admin_graphql_api_id");
  }
  c.useDoc(DOCS.shopifyWebhooks);
  c.expect(["created_at"], "an ISO 8601 date with a time-zone offset", strMatching(ISO_OFFSET), true);
  c.expect(["updated_at"], "an ISO 8601 date with a time-zone offset", strMatching(ISO_OFFSET), true);
  const keyPaths = ["$.id", "$.admin_graphql_api_id", "$.created_at", "$.updated_at"];
  if (resource === "Order") {
    c.useDoc(DOCS.shopifyOrder);
    c.expect(["name"], "the order name shown to merchants, such as #1001", isStr);
    c.expect(["currency"], "a three-letter ISO 4217 code", strMatching(/^[A-Z]{3}$/));
    c.expect(["total_price"], 'a decimal string such as "199.00" (Shopify sends money as strings)', strMatching(DECIMAL_STRING));
    c.expect(["subtotal_price"], "a decimal string", strMatching(DECIMAL_STRING), true);
    c.expect(["total_tax"], "a decimal string", strMatching(DECIMAL_STRING), true);
    c.expect(["financial_status"], "one of pending, authorized, partially_paid, paid, partially_refunded, refunded, voided", (n) => n?.t === "string" && /^(pending|authorized|partially_paid|paid|partially_refunded|refunded|voided)$/.test(n.value));
    c.expect(["fulfillment_status"], "null, fulfilled, partial or restocked", (n) => n?.t === "null" || (n?.t === "string" && /^(fulfilled|partial|restocked|unfulfilled)$/.test(n.value)));
    const items = c.expect(["line_items"], "an array of line items", isArr);
    if (items?.t === "array" && items.items.length) {
      c.expect(["line_items", 0, "id"], "an integer", isInt);
      c.expect(["line_items", 0, "quantity"], "an integer", isInt);
      c.expect(["line_items", 0, "price"], "a decimal string", strMatching(DECIMAL_STRING));
      c.expect(["line_items", 0, "title"], "a string", isStr);
    }
    c.expect(["email"], "a string or null", strOrNull, true);
    keyPaths.push("$.name", "$.email", "$.total_price", "$.currency", "$.financial_status", "$.fulfillment_status", "$.line_items", "$.customer.id", "$.shipping_address");
  } else if (resource === "Product") {
    c.expect(["title"], "a string", isStr);
    c.expect(["variants"], "an array of variants", isArr);
    keyPaths.push("$.title", "$.handle", "$.status", "$.variants");
  } else if (resource === "Customer") {
    c.expect(["email"], "a string or null", strOrNull);
    keyPaths.push("$.email", "$.first_name", "$.last_name", "$.orders_count");
  }
  c.useDoc(DOCS.shopifyWebhooks).info(resource ? `Looks like a ${resource} payload` : "Resource not recognised", `Shopify sends the topic (for example orders/create) in the X-Shopify-Topic header, not in the body. Verify the X-Shopify-Hmac-Sha256 header with your app's client secret on your server.`);
  return { event: resource ? `${resource} resource${m ? ` (${m[2]})` : ""}` : null, checks: c.checks, keyPaths };
}

// ------------------------------------------------------------------ Slack

function slack(root: Node): Omit<Inspection, "provider" | "detectedBy"> {
  const c = new Checker(root, DOCS.slackEvents);
  const type = str(get(root, ["type"]));
  const keyPaths = ["$.type", "$.team_id", "$.api_app_id", "$.event_id", "$.event_time", "$.event.type", "$.event.user", "$.event.channel", "$.event.text", "$.event.ts"];
  c.expect(["type"], "event_callback, url_verification or app_rate_limited", strMatching(/^(event_callback|url_verification|app_rate_limited)$/));
  if (type === "url_verification") {
    c.expect(["challenge"], "a string", isStr);
    c.info("Reply with the challenge", "Your endpoint must answer this request with the challenge value (as plain text or as {\"challenge\": …}) within 3 seconds.", "$.challenge");
  } else if (type === "event_callback") {
    c.expect(["team_id"], 'a workspace ID starting with "T"', strMatching(/^T[A-Z0-9]+$/));
    c.expect(["api_app_id"], 'an app ID starting with "A"', strMatching(/^A[A-Z0-9]+$/));
    c.expect(["event_id"], 'a unique ID starting with "Ev" (use it to ignore retries)', strMatching(/^Ev[A-Z0-9]+$/));
    c.expect(["event_time"], "a Unix timestamp in seconds", unixSeconds);
    c.expect(["event"], "an object (the inner event)", isObj);
    c.expect(["event", "type"], "a string such as message or app_mention", isStr);
    c.expect(["event", "event_ts"], 'a timestamp string such as "1730462410.000200"', strMatching(/^\d{10}\.\d{6}$/), true);
    c.expect(["authorizations"], "an array (who the event is visible to)", isArr, true);
  }
  c.useDoc(DOCS.slackVerify);
  if (get(root, ["token"])) c.warn("$.token is the deprecated verification token", "Slack recommends checking the X-Slack-Signature header with your signing secret instead of this field.", "$.token");
  else c.info("Signature not checked here", "Verify the X-Slack-Signature and X-Slack-Request-Timestamp headers with your signing secret on your server.");
  const inner = str(get(root, ["event", "type"]));
  return { event: type === "event_callback" && inner ? `event_callback → ${inner}` : type, checks: c.checks, keyPaths };
}

// ------------------------------------------------------------------ entry point

export function inspect(root: Node, choice: ProviderId | "auto" | "none"): Inspection {
  if (choice === "none") return { provider: null, detectedBy: "none", event: null, checks: [], keyPaths: [] };
  const provider = choice === "auto" ? detect(root) : choice;
  if (!provider) return { provider: null, detectedBy: "auto", event: null, checks: [], keyPaths: [] };
  const run = { stripe, github, shopify, slack }[provider];
  return { provider, detectedBy: choice === "auto" ? "auto" : "manual", ...run(root) };
}

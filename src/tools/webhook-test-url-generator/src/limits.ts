// Shared by the browser component and the server. No imports on purpose.

export const SLUG = "webhook-test-url-generator";
/** Where the Integrator mounts handleCapture and handleEvents (see README). */
export const HOOK_PATH = "/api/tools/webhook-test-url-generator/hook/";
export const EVENTS_PATH = "/api/tools/webhook-test-url-generator/events/";
export const ACTIONS_PATH = "/api/tools/webhook-test-url-generator";

export const TTL_MINUTES = 60;
export const MAX_EXTENSIONS = 3;
export const MAX_ACTIVE_PER_IP = 5;
export const MAX_ENDPOINTS = 2000;
export const MAX_REQUESTS = 50;
export const MAX_BODY_BYTES = 256 * 1024;
export const MAX_HEADER_BYTES = 64 * 1024;
export const CAPTURES_PER_MINUTE = 60;
export const CREATE_LIMIT = { limit: 10, windowSec: 600 } as const;
export const REPLAY_LIMIT = { limit: 10, windowSec: 600 } as const;
/** list is polled every 3 s when the live connection is unavailable, so it has its own, larger budget. */
export const READ_LIMIT = { limit: 400, windowSec: 600 } as const;
export const WRITE_LIMIT = { limit: 60, windowSec: 600 } as const;
export const MAX_REPLY_BODY = 10 * 1024;
export const MAX_DELAY_MS = 5000;
export const MAX_URL_CHARS = 2048;
export const HEARTBEAT_MS = 15000;
export const POLL_MS = 3000;

export const REPLY_TYPES = ["text/plain", "application/json", "application/xml", "text/html", "application/x-www-form-urlencoded"] as const;
export type ReplyType = (typeof REPLY_TYPES)[number];

export const PUBLIC_NOTE = "Anyone who has the URL can see the requests sent to it. Do not send real secrets, tokens or customer data.";

// Shared by the browser component and the server. No imports on purpose.

export const SLUG = "cron-job-monitoring-heartbeat";
export const TOOL_PATH = "/tools/cron-job-monitoring-heartbeat";
export const ACTIONS_PATH = "/api/tools/cron-job-monitoring-heartbeat";
/** The Integrator mounts handlePing at …/ping/<token>, …/ping/<token>/fail and …/ping/<token>/start. */
export const PING_PATH = "/api/tools/cron-job-monitoring-heartbeat/ping/";

export const MAX_NAME = 60;
export const MIN_INTERVAL_SEC = 60;
export const MAX_INTERVAL_SEC = 7 * 86400;
export const MIN_GRACE_SEC = 60;
export const MAX_GRACE_SEC = 86400;
export const MAX_EMAILS = 2;
export const MAX_MONITORS = 5000;
export const MAX_URL_CHARS = 2048;
export const FAIL_BODY_BYTES = 1024;
export const HISTORY = 50;
/** Pings closer together than this are answered but not recorded. */
export const MIN_RECORD_GAP_SEC = 10;
export const SWEEP_EVERY_SEC = 30;
export const NEVER_PINGED_DAYS = 7;
export const IDLE_DAYS = 90;
export const WEBHOOK_ATTEMPTS = 3;
export const CREATE_LIMIT = { limit: 3, windowSec: 86400 } as const;
export const PING_LIMIT = { limit: 60, windowSec: 60 } as const;
export const ACTION_LIMIT = { limit: 30, windowSec: 600 } as const;

export const STORED_NOTE = "We store the monitor's name, its settings, the alert webhook URL (if you add one) and the ping times, and nothing else. Unused monitors are removed: never pinged after 7 days, or not pinged for 90 days.";

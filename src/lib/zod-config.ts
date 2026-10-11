import { z } from "zod";

/**
 * Zod v4 probes `new Function("")` once to decide whether it can use a
 * faster JIT-compiled validator path. The probe is wrapped in try/catch and
 * always degrades gracefully, but our CSP has no 'unsafe-eval' in script-src
 * (by design), so strict browsers still log it as a blocked
 * securitypolicyviolation in DevTools -- Zod's own source even has a
 * comment acknowledging this exact case. `jitless` skips the probe
 * entirely, silencing the noise with no functional or security trade-off
 * (we were never allowing eval anyway).
 */
z.config({ jitless: true });

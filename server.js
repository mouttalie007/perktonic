/**
 * Custom server entry point — required for Namecheap Stellar Plus (cPanel +
 * Phusion Passenger), see deploy/namecheap-cpanel.md. cPanel's "Setup
 * Node.js App" needs a literal "NAME.js" startup file to launch with
 * `node`; it can't be pointed at the `next start` CLI directly the way a
 * systemd unit could. Passenger assigns the real listening port via the
 * PORT env var and proxies the domain to it — this file just has to read
 * that var and bind to it, same as `next start` does internally; this is
 * the officially documented Next.js custom-server pattern, so nothing else
 * (middleware, API routes, Image Optimization, ISR) changes behavior.
 *
 * Not used in local dev (`npm run dev` still runs `next dev` directly) or
 * on the VPS deploy (systemd invokes `npm run start` -> `next start`,
 * which already reads PORT the same way) — this file only matters for a
 * host that requires a literal JS entry point, i.e. cPanel/Passenger.
 */

const { createServer } = require("http");
const next = require("next");

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, () => {
    console.log(`> Ready on port ${port}`);
  });
});

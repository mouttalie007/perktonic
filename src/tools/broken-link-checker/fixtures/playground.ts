// Used only by the sandbox's local HTTP stand-in, so the dev page can crawl the demo site without network access.
import { SITE } from "./site";

export const PLAYGROUND = {
  http: Object.fromEntries(Object.entries(SITE).filter(([, p]) => !p.error).map(([url, p]) => [url, { status: p.status, body: p.body ?? "", headers: p.headers ?? {} }])),
};

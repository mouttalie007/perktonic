// Used only by the sandbox's local DNS/HTTP stand-ins, so the dev page works without network access.
import { HTTP } from "./fetch";
import { ZONES } from "./zones";

export const PLAYGROUND = { zone: ZONES, http: HTTP };

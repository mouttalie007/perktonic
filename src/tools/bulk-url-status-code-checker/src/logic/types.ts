// No imports: shared by the client component and the route.

export type ErrorCode = "invalid_url" | "blocked_host" | "timeout" | "too_large" | "network" | "too_many_redirects" | "redirect_loop" | "skipped";

export interface CheckResult {
  url: string;
  /** Status of the last response; null when no response arrived. */
  status: number | null;
  statusText: string;
  /** Where the URL ends up (after redirects when they are followed, else the Location of a redirect). */
  finalUrl: string | null;
  redirects: number;
  /** Status of every hop, e.g. [301, 302, 200]. */
  chain: number[];
  timeMs: number;
  contentType: string | null;
  method: "HEAD" | "GET";
  error: { code: ErrorCode; message: string } | null;
}

export interface CheckOptions {
  followRedirects: boolean;
  headFirst: boolean;
}

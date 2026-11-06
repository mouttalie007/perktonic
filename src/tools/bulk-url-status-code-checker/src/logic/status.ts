// No imports: used by the client table and the route.

const TEXT: Record<number, string> = {
  100: "Continue", 101: "Switching Protocols", 200: "OK", 201: "Created", 202: "Accepted", 203: "Non-Authoritative Information", 204: "No Content", 206: "Partial Content",
  300: "Multiple Choices", 301: "Moved Permanently", 302: "Found", 303: "See Other", 304: "Not Modified", 307: "Temporary Redirect", 308: "Permanent Redirect",
  400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed", 406: "Not Acceptable", 408: "Request Timeout", 409: "Conflict", 410: "Gone",
  411: "Length Required", 412: "Precondition Failed", 414: "URI Too Long", 415: "Unsupported Media Type", 418: "I'm a teapot", 421: "Misdirected Request", 422: "Unprocessable Content",
  425: "Too Early", 426: "Upgrade Required", 428: "Precondition Required", 429: "Too Many Requests", 431: "Request Header Fields Too Large", 451: "Unavailable For Legal Reasons",
  500: "Internal Server Error", 501: "Not Implemented", 502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout", 505: "HTTP Version Not Supported", 520: "Unknown Error (Cloudflare)",
  521: "Web Server Is Down (Cloudflare)", 522: "Connection Timed Out (Cloudflare)", 523: "Origin Is Unreachable (Cloudflare)", 524: "A Timeout Occurred (Cloudflare)", 525: "SSL Handshake Failed (Cloudflare)", 526: "Invalid SSL Certificate (Cloudflare)",
};

export function statusText(status: number): string {
  return TEXT[status] ?? (status >= 500 ? "Server error" : status >= 400 ? "Client error" : status >= 300 ? "Redirect" : status >= 200 ? "Success" : "Informational");
}

export type StatusGroup = "2xx" | "3xx" | "4xx" | "5xx" | "error";

export function statusGroup(status: number | null): StatusGroup {
  if (status === null || status < 200) return "error";
  if (status < 300) return "2xx";
  if (status < 400) return "3xx";
  if (status < 500) return "4xx";
  return status < 600 ? "5xx" : "error";
}

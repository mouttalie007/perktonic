/** 128-bit random, URL-safe (base64url, 22 characters). Uses the Web Crypto API (Node and browsers). */
export function newId(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const isId = (s: string) => /^[A-Za-z0-9_-]{22}$/.test(s);

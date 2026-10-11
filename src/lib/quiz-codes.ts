import "server-only";
import { randomBytes } from "node:crypto";

// Excludes 0/O and 1/I/L -- easy to misread when copied off a screen or
// scribbled down. Uppercase only, matches the "X6E8"-style example.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateQuizCode(): string {
  const bytes = randomBytes(4);
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

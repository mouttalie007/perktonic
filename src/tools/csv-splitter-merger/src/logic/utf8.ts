/** Byte length of a string in UTF-8, without allocating (TextEncoder would copy every row). */
export function utf8Length(s: string): number {
  let n = s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) continue;
    if (c < 0x800) n += 1;
    else if (c >= 0xd800 && c <= 0xdbff) {
      // A surrogate pair is 2 code units and 4 bytes.
      n += 2;
      i++;
    } else n += 2;
  }
  return n;
}

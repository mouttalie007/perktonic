// .docx → plain text with mammoth (BSD-2-Clause). Imported with import() only when a .docx is opened.
import mammoth from "mammoth";

export async function readDocx(bytes: Uint8Array): Promise<string> {
  // The browser build of mammoth reads `arrayBuffer`, the Node build (tests) reads `buffer`.
  const input = { arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, buffer: bytes } as { arrayBuffer: ArrayBuffer };
  const { value } = await mammoth.extractRawText(input);
  return value;
}

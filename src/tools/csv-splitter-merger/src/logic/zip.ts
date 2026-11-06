import { Zip, ZipDeflate } from "fflate";
import type { Sink } from "./split";

/** A Sink that deflates each part into a streaming ZIP. Text is batched so fflate gets 64 KB pieces. */
export function zipSink(onData: (data: Uint8Array) => void, done: () => void): Sink & { end(): void } {
  const enc = new TextEncoder();
  const zip = new Zip((err, data, final) => {
    if (err) throw err;
    onData(data);
    if (final) done();
  });
  const files: { f: ZipDeflate; buf: string[]; len: number }[] = [];
  const flush = (id: number, final: boolean) => {
    const x = files[id];
    x.f.push(enc.encode(x.buf.join("")), final);
    x.buf = [];
    x.len = 0;
  };
  return {
    open(name) {
      const f = new ZipDeflate(name, { level: 6 });
      zip.add(f);
      files.push({ f, buf: [], len: 0 });
      return files.length - 1;
    },
    write(id, text) {
      const x = files[id];
      x.buf.push(text);
      x.len += text.length;
      if (x.len >= 65536) flush(id, false);
    },
    close(id) {
      flush(id, true);
    },
    end() {
      zip.end();
    },
  };
}


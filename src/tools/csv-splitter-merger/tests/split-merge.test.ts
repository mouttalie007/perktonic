import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/logic/csvParser";
import { NameRegistry, sanitizeFileName } from "../src/logic/filenames";
import type { SplitOptions } from "../src/logic/limits";
import { mapRow, planMerge } from "../src/logic/merge";
import { SplitError, Splitter, type Sink } from "../src/logic/split";
import { utf8Length } from "../src/logic/utf8";
import { zipSink } from "../src/logic/zip";
import { MERGE_SAMPLES, ORDERS_CSV } from "../fixtures/samples";

/** Keeps every part in memory, for checking. */
function memorySink() {
  const files: { name: string; text: string; closed: boolean }[] = [];
  const sink: Sink = {
    open: (name) => files.push({ name, text: "", closed: false }) - 1,
    write: (id, t) => {
      files[id].text += t;
    },
    close: (id) => {
      files[id].closed = true;
    },
  };
  return { files, sink };
}

const base: SplitOptions = { mode: "rows", rowsPerPart: 10, maxBytes: 1024, column: 0, hasHeader: true, bom: false };

function run(csv: string, opts: Partial<SplitOptions>, name = "orders") {
  const { files, sink } = memorySink();
  const s = new Splitter({ ...base, ...opts }, ",", name, sink);
  // Feed in small chunks of rows, as the worker does.
  const rows = parseCsv(csv, ",").rows;
  for (let i = 0; i < rows.length; i += 7) s.push(rows.slice(i, i + 7));
  return { parts: s.finish(), files, splitter: s };
}

describe("splitting", () => {
  it("splits by row count and repeats the header in every part", () => {
    const { parts, files } = run(ORDERS_CSV, { rowsPerPart: 15 });
    expect(parts.map((p) => [p.name, p.rows])).toEqual([
      ["orders-part-001.csv", 15],
      ["orders-part-002.csv", 15],
      ["orders-part-003.csv", 10],
    ]);
    for (const f of files) {
      expect(f.text.startsWith("order_id,order_date,customer,country,product,quantity,total_eur\r\n")).toBe(true);
      expect(f.closed).toBe(true);
    }
    // The quoted field with a comma and doubled quotes survives unchanged.
    const all = files.map((f) => parseCsv(f.text, ",").rows.slice(1)).flat().filter((r) => r.length > 1);
    expect(all).toHaveLength(40);
    expect(all.find((r) => r[0] === "A-1046")?.[4]).toBe('Rain Jacket, "Storm" edition');
  });

  it("splits by size accurately: no part over the limit, and each is within one row of it", () => {
    const csv = "id,city,note\r\n" + Array.from({ length: 500 }, (_, i) => `${i},Zürich,café ☕ ${"x".repeat(i % 40)}`).join("\r\n") + "\r\n";
    const max = 4096;
    const { files } = run(csv, { mode: "size", maxBytes: max, bom: true });
    const enc = new TextEncoder();
    for (const [i, f] of files.entries()) {
      const bytes = enc.encode(f.text).length;
      expect(f.text.startsWith("﻿id,city,note\r\n")).toBe(true);
      expect(bytes).toBeLessThanOrEqual(max);
      if (i < files.length - 1) {
        const nextRow = files[i + 1].text.split("\r\n")[1] + "\r\n";
        expect(bytes + enc.encode(nextRow).length).toBeGreaterThan(max);
      }
    }
    expect(utf8Length("café ☕ 😀")).toBe(enc.encode("café ☕ 😀").length);
  });

  it("splits by column value with safe, unique file names", () => {
    const { parts } = run(ORDERS_CSV, { mode: "column", column: 3 });
    expect(parts.map((p) => p.name).sort()).toEqual(["Côte d'Ivoire.csv", "France.csv", "Germany.csv", "Morocco.csv", "N_A.csv", "Spain.csv", "United Kingdom.csv"]);
    expect(parts.find((p) => p.name === "France.csv")?.rows).toBe(11);
    expect(parts.reduce((n, p) => n + p.rows, 0)).toBe(40);
    const names = new NameRegistry();
    expect([sanitizeFileName("a/b\\c:d*e?f\"g<h>i|j"), sanitizeFileName("CON"), sanitizeFileName("  report.  "), sanitizeFileName(""), sanitizeFileName("x".repeat(200)).length]).toEqual(["a_b_c_d_e_f_g_h_i_j", "_CON", "report", "_empty", 80]);
    expect([names.take("France", ".csv"), names.take("france", ".csv"), names.take("FRANCE", ".csv")]).toEqual(["France.csv", "france-2.csv", "FRANCE-3.csv"]);
  });

  it("refuses more than 500 output files and other impossible requests with a clear message", () => {
    const ids = "id\r\n" + Array.from({ length: 501 }, (_, i) => `v${i}`).join("\r\n");
    expect(() => run(ids, { mode: "column", column: 0 })).toThrow(/more than 500 different values/);
    expect(() => run("a,b\r\n1,2\r\n", { mode: "column", column: 5 })).toThrow("The file has 2 columns, so column 6 does not exist.");
    expect(() => run("a,b\r\n", {})).toThrow(SplitError);
    expect(() => run("a,b\r\n", {})).toThrow("The file has a header but no data rows to split.");
  });

  it("streams 1,000,000 rows through the splitter without keeping them", () => {
    let written = 0;
    let opened = 0;
    const sink: Sink = { open: () => opened++, write: (_id, t) => void (written += t.length), close: () => {} };
    const s = new Splitter({ ...base, rowsPerPart: 100_000 }, ",", "big", sink);
    s.push([["id", "email", "amount"]]);
    const batch: string[][] = [];
    for (let i = 0; i < 1_000_000; i++) {
      batch.push([String(i), `user${i}@example.com`, (i % 997).toFixed(2)]);
      if (batch.length === 10_000) s.push(batch.splice(0));
    }
    const parts = s.finish();
    expect(parts).toHaveLength(10);
    expect(parts.every((p) => p.rows === 100_000)).toBe(true);
    expect(s.rows).toBe(1_000_000);
    expect(opened).toBe(10);
    expect(written).toBeGreaterThan(30_000_000);
  }, 30_000);

  it("writes a valid ZIP whose files match the parts", () => {
    const chunks: Uint8Array[] = [];
    let done = false;
    const sink = zipSink((d) => chunks.push(d), () => (done = true));
    const s = new Splitter({ ...base, mode: "column", column: 3 }, ",", "orders", sink);
    s.push(parseCsv(ORDERS_CSV, ",").rows);
    const parts = s.finish();
    sink.end();
    expect(done).toBe(true);
    const zip = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let o = 0;
    for (const c of chunks) {
      zip.set(c, o);
      o += c.length;
    }
    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual(parts.map((p) => p.name).sort());
    const spain = strFromU8(files["Spain.csv"]);
    // The header plus 8 orders, one of them the quoted "Rain Jacket, ""Storm"" edition" row.
    expect(parseCsv(spain, ",").rows.filter((r) => r.length > 1)).toHaveLength(9);
  });
});

describe("merging", () => {
  it("aligns columns by header name, leaves missing columns empty and reports differences", () => {
    const headers = MERGE_SAMPLES.map((s) => ({ name: s.name, header: parseCsv(s.text, s.name === "shop-lyon.csv" ? ";" : ",").rows[0] }));
    const plan = planMerge(headers, { looseHeaders: true, addSource: true });
    expect(plan.columns).toEqual(["order_id", "date", "customer", "email", "total", "Coupon", "channel", "source_file"]);
    expect(plan.report[1]).toMatchObject({ name: "shop-lyon.csv", missing: ["email", "channel"], extra: ["Coupon"] });
    expect(plan.report[2].renamed).toContainEqual({ from: "Email ", to: "email" });
    const lyonRow = parseCsv(MERGE_SAMPLES[1].text, ";").rows[2];
    expect(mapRow(lyonRow, plan.maps[1], "shop-lyon.csv")).toEqual(["L-78", "2026-10-05", "Hopper; Grace", "", "30,00", "", "", "shop-lyon.csv"]);
  });

  it("keeps differently spelled headers apart when loose matching is off, and avoids a clashing source column", () => {
    const plan = planMerge(
      [
        { name: "a.csv", header: ["id", "source_file"] },
        { name: "b.csv", header: ["ID", "id "] },
      ],
      { looseHeaders: false, addSource: true },
    );
    expect(plan.columns).toEqual(["id", "source_file", "ID", "id ", "source_file_2"]);
    expect(plan.maps[1]).toEqual([-1, -1, 0, 1]);
  });
});

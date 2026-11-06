// Test-fixture PDF writer (tests and the built-in sample only; never shipped to visitors as a feature).
// Writes small, valid PDFs by hand so that every fixture is generated in code: Helvetica text,
// stroked lines and rectangles, page rotation, an image-only page, and a Type 3 font with a
// ToUnicode map for right-to-left (Arabic) text.

export type Op =
  | { t: "text"; x: number; y: number; s: string; size?: number; bold?: boolean; rotate90?: boolean }
  | { t: "arabic"; x: number; y: number; s: string; size?: number }
  | { t: "line"; x0: number; y0: number; x1: number; y1: number; w?: number }
  | { t: "rect"; x: number; y: number; w: number; h: number; fill?: boolean }
  | { t: "image"; x: number; y: number; w: number; h: number };

export interface PageSpec {
  width?: number;
  height?: number;
  rotate?: 0 | 90 | 180 | 270;
  ops: Op[];
}

const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);

/** Every Arabic character used in fixtures gets one code in the Type 3 font (from 33 up). */
function arabicCodes(pages: PageSpec[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of pages) for (const op of p.ops) if (op.t === "arabic") for (const ch of op.s) if (!map.has(ch)) map.set(ch, 33 + map.size);
  return map;
}

const hex4 = (n: number) => n.toString(16).toUpperCase().padStart(4, "0");
const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");

export function makePdf(pages: PageSpec[], opts: { title?: string } = {}): Uint8Array {
  const objs: string[] = [];
  const add = (body: string) => {
    objs.push(body);
    return objs.length;
  };
  const catalog = add("");
  const pagesObj = add("");
  const helv = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const helvB = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const codes = arabicCodes(pages);
  let arabicFont = 0;
  if (codes.size) {
    const entries = [...codes.entries()];
    const procs = entries.map(([, code]) => `/g${code} ${add("<< /Length 7 >>\nstream\n500 0 d0\nendstream")} 0 R`).join(" ");
    const cmap = `/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CMapName /Fx def /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapType 2 def 1 begincodespacerange <00> <FF> endcodespacerange ${entries.length} beginbfchar ${entries.map(([ch, code]) => `<${hex2(code)}> <${hex4(ch.codePointAt(0)!)}>`).join(" ")} endbfchar endcmap CMapName currentdict /CMap defineresource pop end end`;
    const toUni = add(`<< /Length ${cmap.length} >>\nstream\n${cmap}\nendstream`);
    const first = 33;
    const last = 32 + entries.length;
    arabicFont = add(
      `<< /Type /Font /Subtype /Type3 /FontBBox [0 0 500 700] /FontMatrix [0.001 0 0 0.001 0 0] /CharProcs << ${procs} >> /Encoding << /Type /Encoding /Differences [${first} ${entries.map(([, c]) => `/g${c}`).join(" ")}] >> /FirstChar ${first} /LastChar ${last} /Widths [${entries.map(() => "500").join(" ")}] /ToUnicode ${toUni} 0 R /Resources << >> >>`,
    );
  }
  const kids: number[] = [];
  for (const p of pages) {
    const w = p.width ?? 595;
    const h = p.height ?? 842;
    const parts: string[] = [];
    let image = false;
    for (const op of p.ops) {
      if (op.t === "text") {
        const size = op.size ?? 10;
        const tm = op.rotate90 ? `0 1 -1 0 ${op.x} ${op.y} Tm` : `1 0 0 1 ${op.x} ${op.y} Tm`;
        parts.push(`BT /${op.bold ? "F2" : "F1"} ${size} Tf ${tm} (${esc(op.s)}) Tj ET`);
      } else if (op.t === "arabic") {
        // Written in visual order (reversed), as real PDF producers do; readers restore logical order.
        const visual = [...op.s].reverse();
        const hexs = visual.map((ch) => hex2(codes.get(ch)!)).join("");
        parts.push(`BT /F3 ${op.size ?? 10} Tf 1 0 0 1 ${op.x} ${op.y} Tm <${hexs}> Tj ET`);
      } else if (op.t === "line") {
        parts.push(`${op.w ?? 0.6} w ${op.x0} ${op.y0} m ${op.x1} ${op.y1} l S`);
      } else if (op.t === "rect") {
        parts.push(`0.6 w ${op.x} ${op.y} ${op.w} ${op.h} re ${op.fill ? "f" : "S"}`);
      } else {
        image = true;
        parts.push(`q ${op.w} 0 0 ${op.h} ${op.x} ${op.y} cm /Im1 Do Q`);
      }
    }
    const content = parts.join("\n");
    const stream = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    let xobj = "";
    if (image) {
      // An 8x8 grey image: a "scan" with no text layer.
      const px = Array.from({ length: 64 }, (_, i) => hex2(i % 3 === 0 ? 40 : 220)).join("");
      const img = add(`<< /Type /XObject /Subtype /Image /Width 8 /Height 8 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length ${px.length + 1} >>\nstream\n${px}>\nendstream`);
      xobj = ` /XObject << /Im1 ${img} 0 R >>`;
    }
    const fonts = `/F1 ${helv} 0 R /F2 ${helvB} 0 R${arabicFont ? ` /F3 ${arabicFont} 0 R` : ""}`;
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${w} ${h}]${p.rotate ? ` /Rotate ${p.rotate}` : ""} /Resources << /Font << ${fonts} >>${xobj} >> /Contents ${stream} 0 R >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  const info = opts.title ? add(`<< /Title (${esc(opts.title)}) >>`) : 0;
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R${info ? ` /Info ${info} 0 R` : ""} >>\nstartxref\n${xref}\n%%EOF\n`;
  // One byte per character, as WinAnsiEncoding expects ("€" is 0x80); the Arabic text is written as hex codes.
  return Uint8Array.from(out, (ch) => (ch === "€" ? 0x80 : ch.charCodeAt(0) <= 0xff ? ch.charCodeAt(0) : 0x3f));
}

/** Helper: a ruled grid with text centred-left in each cell. rows[r][c]; colX are the vertical rule positions. */
export function ruledTable(x: number[], yTop: number, rowH: number, rows: (string | null)[][], opts: { skipV?: [number, number][]; bold?: number } = {}): Op[] {
  const ops: Op[] = [];
  const yBottom = yTop - rowH * rows.length;
  for (let r = 0; r <= rows.length; r++) ops.push({ t: "line", x0: x[0], y0: yTop - r * rowH, x1: x.at(-1)!, y1: yTop - r * rowH });
  for (let c = 0; c < x.length; c++) {
    // skipV: [row, colBoundaryIndex] pairs where the vertical rule is absent (a merged cell).
    for (let r = 0; r < rows.length; r++) {
      if (opts.skipV?.some(([sr, sc]) => sr === r && sc === c)) continue;
      ops.push({ t: "line", x0: x[c], y0: yTop - r * rowH, x1: x[c], y1: yTop - (r + 1) * rowH });
    }
  }
  rows.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell) ops.push({ t: "text", x: x[c] + 4, y: yTop - (r + 1) * rowH + rowH * 0.32, s: cell, bold: r < (opts.bold ?? 0) });
    }),
  );
  void yBottom;
  return ops;
}

/** Helper: a borderless table; each column has a left x (text) or a right edge for right-aligned numbers. */
export function alignedTable(cols: { x: number; align?: "left" | "right" }[], yTop: number, lineH: number, rows: string[][], size = 10): Op[] {
  const ops: Op[] = [];
  rows.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (!cell) return;
      const col = cols[c];
      const x = col.align === "right" ? col.x - helvWidth(cell, size) : col.x;
      ops.push({ t: "text", x: Math.round(x * 100) / 100, y: yTop - r * lineH, s: cell, size, bold: false });
    }),
  );
  return ops;
}

// Helvetica advance widths (per 1000 em) for the characters our fixtures use.
const W: Record<string, number> = {
  " ": 278, ",": 278, ".": 278, "-": 333, "(": 333, ")": 333, "%": 889, "/": 278, ":": 278, "€": 556, $: 556, "£": 556, "+": 584, "#": 556, "&": 667, "'": 191,
  "0": 556, "1": 556, "2": 556, "3": 556, "4": 556, "5": 556, "6": 556, "7": 556, "8": 556, "9": 556,
};
export function helvWidth(s: string, size: number): number {
  let w = 0;
  for (const ch of s) w += W[ch] ?? (ch === ch.toUpperCase() && /[A-Z]/.test(ch) ? 667 : /[il]/.test(ch) ? 222 : /[mw]/.test(ch) ? 833 : 556);
  return (w * size) / 1000;
}

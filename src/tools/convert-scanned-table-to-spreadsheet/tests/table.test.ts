import { describe, expect, test } from "vitest";
import { centred, layout } from "../fixtures/layout";
import { mockRecogniser } from "../fixtures/mockRecogniser";
import { samplePage } from "../fixtures/sampleResult";
import { sampleWords } from "../fixtures/sampleWords";
import { LOW_CONFIDENCE, looksRtl, reconstruct, type Grid } from "../src/logic/table";

const texts = (g: Grid) => g.rows.map((r) => r.map((c) => c.text));
const spans = (g: Grid) => g.rows.map((r) => r.map((c) => c.span));
const allWords = (ws: { text: string }[]) => ws.map((w) => w.text).sort();
const gridWords = (g: Grid) => g.rows.flat().flatMap((c) => c.text.split(/\s+/).filter(Boolean)).sort();

describe("table reconstruction from word boxes", () => {
  test("a borderless table: rows by vertical centre, columns by shared gaps; low confidence kept per cell", () => {
    const words = layout([["Item", "Qty", "Price"], ["Laser paper A4", "12", "24.50"], ["Toner", "3", "89.90"], ["Desk organiser", "5", "1O.00"]], { cols: [40, 260, 420], top: 40, rowH: 30, right: [false, true, true], confidence: { "1O.00": 51 } });
    const g = reconstruct(words, { rtl: false });
    expect(texts(g)).toEqual([["Item", "Qty", "Price"], ["Laser paper A4", "12", "24.50"], ["Toner", "3", "89.90"], ["Desk organiser", "5", "1O.00"]]);
    expect(g.rows[3][2].confidence).toBeLessThan(LOW_CONFIDENCE);
    expect(g.rows[1][0].box).toEqual({ x0: 40, y0: 77, x1: 166, y1: 93 });
  });

  test("ruled lines define the cells when the image has them", () => {
    const words = layout([["Item", "Qty"], ["Paper", "12"], ["Ink", "3"]], { cols: [40, 200], top: 40, rowH: 30 });
    const g = reconstruct(words, { rtl: false, rules: { h: [40, 70, 100, 130], v: [30, 190, 300] } });
    expect(texts(g)).toEqual([["Item", "Qty"], ["Paper", "12"], ["Ink", "3"]]);
  });

  test("a merged header phrase over two columns becomes one spanning cell", () => {
    const words = [...layout([["Region"]], { cols: [40], top: 30, rowH: 30 }), ...centred("Revenue by quarter", 337, 37), ...layout([["", "Q1", "Q2"], ["North", "1,250", "1,410"], ["South", "980", "1,105"], ["West", "1,630", "1,702"]], { cols: [40, 300, 420], top: 60, rowH: 30, right: [false, true, true] })];
    const g = reconstruct(words, { rtl: false });
    expect(texts(g)[0]).toEqual(["Region", "Revenue by quarter", ""]);
    expect(spans(g)[0]).toEqual([1, 2, 0]);
    expect(texts(g)[2]).toEqual(["North", "1,250", "1,410"]);
  });

  test("Arabic, right to left, with Arabic-Indic digits: column 1 is the rightmost, words stay in reading order", () => {
    const words = [...layout([["المنتج", "الكمية", "السعر"], ["قهوة عربية", "٤", "١٢٠"], ["شاي", "١٠", "٣٥"]], { cols: [560, 360, 200], top: 40, rowH: 30, rtl: true }), ...centred("الإيرادات الفصلية", 300, 140, { rtl: true })];
    expect(looksRtl(words)).toBe(true);
    const g = reconstruct(words.slice(0, -2), { rtl: true });
    expect(texts(g)).toEqual([["المنتج", "الكمية", "السعر"], ["قهوة عربية", "٤", "١٢٠"], ["شاي", "١٠", "٣٥"]]);
  });

  test("a line that does not fit (title above, note below a ruled table) becomes its own spanning row; nothing is dropped", () => {
    const g = samplePage.grid;
    expect(texts(g)[0][0]).toBe("Stock count - Warehouse B - 31 October 2026");
    expect(spans(g)[0]).toEqual([5, 0, 0, 0, 0]);
    expect(texts(g)[1]).toEqual(["SKU", "Product", "Shelf", "Count", "Unit cost"]);
    expect(texts(g)[4]).toEqual(["01233", "Hand sanitiser 1 L", "A-07", "1O5", "6.75"]);
    expect(g.rows[4][3].confidence).toBeLessThan(LOW_CONFIDENCE);
    expect(gridWords(g)).toEqual(allWords(sampleWords));
  });

  test("a stray word between columns is placed, not lost; the OCR mock reports progress", async () => {
    const words = [...layout([["A", "1"], ["B", "2"], ["C", "3"]], { cols: [40, 200], top: 40, rowH: 30 }), { text: "x", confidence: 30, bbox: { x0: 120, y0: 150, x1: 128, y1: 166 } }];
    const ocr = mockRecogniser(words);
    const progress: number[] = [];
    const got = await ocr({ width: 10, height: 10, data: new Uint8ClampedArray(400) }, "eng", (f) => progress.push(f));
    expect(progress).toEqual([0.5, 1]);
    expect(ocr.calls).toEqual([{ lang: "eng", width: 10 }]);
    const g = reconstruct(got, { rtl: false });
    expect(gridWords(g)).toEqual(allWords(words));
    expect(reconstruct([], { rtl: false }).rows).toEqual([]);
  });
});

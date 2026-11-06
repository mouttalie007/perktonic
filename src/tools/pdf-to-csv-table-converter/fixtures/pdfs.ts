// The PDFs the tests read cell by cell, generated in code (each is a few KB).
import { alignedTable, makePdf, ruledTable, type Op } from "./makePdf";

const H = 842;

export function ruledInvoicePdf(): Uint8Array {
  return makePdf([
    {
      ops: [
        { t: "text", x: 50, y: H - 60, s: "Northwind Supplies Ltd - Invoice INV-2026-0412", size: 14, bold: true },
        { t: "text", x: 50, y: H - 80, s: "Invoice date: 14/10/2026" },
        ...ruledTable([50, 250, 320, 420, 520], H - 110, 20, [
          ["Item", "Qty", "Unit price", "Amount"],
          ["Laser paper A4 (box)", "12", "24.50", "294.00"],
          ["Toner cartridge TN-421", "3", "89.90", "269.70"],
          ["Desk organiser", "5", "12.00", "60.00"],
          ["Shipping", "1", "15.00", "15.00"],
        ], { bold: 1 }),
        { t: "text", x: 420, y: H - 230, s: "Total: 638.70" },
      ],
    },
  ]);
}

export function borderlessFinancialPdf(): Uint8Array {
  const cols = [{ x: 60 }, { x: 330, align: "right" as const }, { x: 430, align: "right" as const }, { x: 530, align: "right" as const }];
  return makePdf([
    {
      ops: [
        { t: "text", x: 60, y: H - 60, s: "Consolidated income statement (EUR thousands)", size: 13, bold: true },
        ...alignedTable(cols, H - 100, 16, [
          ["", "2026", "2025", "Change"],
          ["Revenue", "12.480,5", "11.032,0", "13,1%"],
          ["Cost of sales", "(7.215,3)", "(6.540,8)", "10,3%"],
          ["Gross profit", "5.265,2", "4.491,2", "17,2%"],
          ["Operating expenses", "(3.104,9)", "(2.987,4)", "3,9%"],
          ["Operating profit", "2.160,3", "1.503,8", "43,7%"],
        ]),
        { t: "text", x: 60, y: H - 220, s: "Figures are unaudited." },
      ],
    },
  ]);
}

/** One table over three pages, with the header repeated at the top of pages 2 and 3. */
export function threePagePdf(): Uint8Array {
  const x = [50, 110, 330, 440, 545];
  const header = ["Date", "Description", "Reference", "Amount"];
  const pages = [0, 1, 2].map((p) => {
    const rows = [header, ...Array.from({ length: p === 2 ? 4 : 30 }, (_, i) => {
      const n = p * 30 + i + 1;
      return [`2026-09-${String((n % 28) + 1).padStart(2, "0")}`, `Card payment ${n}`, `REF${String(n).padStart(5, "0")}`, `${(n * 7.25).toFixed(2)}`];
    })];
    const ops: Op[] = [...ruledTable(x, H - (p === 0 ? 90 : 50), 20, rows, { bold: 1 })];
    if (p === 0) ops.unshift({ t: "text", x: 50, y: H - 60, s: "Statement of account - September 2026", size: 13, bold: true });
    ops.push({ t: "text", x: 280, y: 30, s: `Page ${p + 1} of 3`, size: 8 });
    return { ops };
  });
  return makePdf(pages);
}

/** "Revenue" spans two columns over "Q1" and "Q2"; "Region" spans two rows. */
export function mergedHeaderPdf(): Uint8Array {
  return makePdf([
    {
      ops: [
        ...ruledTable([60, 200, 320, 440], H - 80, 22, [
          ["Region", "Revenue", null],
          [null, "Q1", "Q2"],
          ["North", "1,250", "1,410"],
          ["South", "980", "1,105"],
          ["West", "1,630", "1,702"],
        ], { skipV: [[0, 2]], bold: 2 }).filter((op) => !(op.t === "line" && op.y0 === H - 102 && op.x0 === 60 && op.x1 === 440)),
        // The rule under row 1 stops at x 200, so "Region" spans two rows; it continues under "Revenue".
        { t: "line", x0: 200, y0: H - 102, x1: 440, y1: H - 102 },
      ],
    },
  ]);
}

/** Two separate borderless tables with titles. */
export function twoTablesPdf(): Uint8Array {
  const c1 = [{ x: 60 }, { x: 260, align: "right" as const }, { x: 360, align: "right" as const }];
  return makePdf([
    {
      ops: [
        { t: "text", x: 60, y: H - 60, s: "Table 1. Headcount by office", size: 12, bold: true },
        ...alignedTable(c1, H - 90, 15, [["Office", "2025", "2026"], ["London", "42", "48"], ["Paris", "18", "23"], ["Berlin", "11", "15"]]),
        { t: "text", x: 60, y: H - 200, s: "Table 2. Open positions", size: 12, bold: true },
        ...alignedTable([{ x: 60 }, { x: 250 }, { x: 420, align: "right" as const }], H - 230, 15, [["Role", "Office", "Openings"], ["Data analyst", "London", "2"], ["Sales lead", "Paris", "1"], ["Engineer", "Berlin", "3"]]),
      ],
    },
  ]);
}

/** A scan: one image and a frame, no text at all. */
export function noTextPdf(): Uint8Array {
  return makePdf([{ ops: [{ t: "image", x: 40, y: 300, w: 500, h: 400 }, { t: "rect", x: 40, y: 300, w: 500, h: 400 }] }]);
}

/** A right-to-left (Arabic) ruled table: product, quantity, price. */
export function arabicPdf(): Uint8Array {
  const x = [80, 230, 360, 520];
  const yTop = H - 80;
  const rowH = 22;
  const rows = [
    ["السعر", "الكمية", "المنتج"],
    ["120", "4", "قهوة"],
    ["35", "10", "شاي"],
    ["18", "6", "سكر"],
  ];
  const ops: Op[] = [];
  for (let r = 0; r <= rows.length; r++) ops.push({ t: "line", x0: x[0], y0: yTop - r * rowH, x1: x[3], y1: yTop - r * rowH });
  for (const xx of x) ops.push({ t: "line", x0: xx, y0: yTop, x1: xx, y1: yTop - rows.length * rowH });
  rows.forEach((row, r) =>
    row.forEach((cell, c) => {
      const y = yTop - (r + 1) * rowH + 7;
      if (/^\d+$/.test(cell)) ops.push({ t: "text", x: x[c] + 8, y, s: cell });
      else ops.push({ t: "arabic", x: x[c] + 8, y, s: cell });
    }),
  );
  return makePdf([{ ops }]);
}

/** A landscape table on a portrait page turned with /Rotate 90 (text and rules are drawn rotated). */
export function rotatedPdf(): Uint8Array {
  // In display space (842 wide, 595 high) the table sits at display (X, Y). User space: x = Y, y = X.
  const ops: Op[] = [];
  const cols = [60, 260, 400, 560];
  const top = 80;
  const rowH = 22;
  const rows = [["Product", "Units", "Revenue"], ["Basic plan", "1,200", "14,400"], ["Pro plan", "340", "16,660"], ["Team plan", "85", "12,665"]];
  const toUser = (X: number, Y: number) => ({ x: Y, y: X });
  for (let r = 0; r <= rows.length; r++) {
    const a = toUser(cols[0], top + r * rowH);
    const b = toUser(cols.at(-1)!, top + r * rowH);
    ops.push({ t: "line", x0: a.x, y0: a.y, x1: b.x, y1: b.y });
  }
  for (const X of cols) {
    const a = toUser(X, top);
    const b = toUser(X, top + rows.length * rowH);
    ops.push({ t: "line", x0: a.x, y0: a.y, x1: b.x, y1: b.y });
  }
  rows.forEach((row, r) =>
    row.forEach((cell, c) => {
      const p = toUser(cols[c] + 6, top + (r + 1) * rowH - 7);
      ops.push({ t: "text", x: p.x, y: p.y, s: cell, rotate90: true });
    }),
  );
  return makePdf([{ width: 595, height: 842, rotate: 90, ops }]);
}

/** The built-in sample: a short invoice with a ruled line-item table and a borderless summary. */
export function samplePdf(): Uint8Array {
  return makePdf(
    [
      {
        ops: [
          { t: "text", x: 50, y: H - 60, s: "Harbor Office Supply - Invoice 2026-118", size: 14, bold: true },
          { t: "text", x: 50, y: H - 80, s: "Customer: Riverside Dental Clinic    Date: 28/10/2026" },
          ...ruledTable([50, 110, 300, 370, 450, 545], H - 110, 20, [
            ["SKU", "Description", "Qty", "Unit price", "Amount"],
            ["00417", "Nitrile gloves, box of 100", "20", "8.90", "178.00"],
            ["00982", "Printer paper A4, 5 reams", "4", "21.50", "86.00"],
            ["01233", "Hand sanitiser 1 L", "6", "6.75", "40.50"],
            ["02310", "Waiting room chair", "2", "149.00", "298.00"],
          ], { bold: 1 }),
          { t: "text", x: 50, y: H - 250, s: "Summary", size: 12, bold: true },
          ...alignedTable([{ x: 50 }, { x: 250, align: "right" }, { x: 330 }], H - 275, 15, [
            ["Subtotal", "602.50", "USD"],
            ["Sales tax 8%", "48.20", "USD"],
            ["Total due", "650.70", "USD"],
          ]),
          { t: "text", x: 50, y: H - 340, s: "Questions? Call +1 555 0134 or write to billing@harbor.example" },
        ],
      },
    ],
    { title: "Sample invoice" },
  );
}

// The rule library: every formula is built by our own pure functions, with anchors that match the
// applied range (for A2:F100 highlighted by column D the formula is =$D2="Done", never =D2="Done").
// Steps are written for both Excel (Windows/Mac, Microsoft 365) and Google Sheets, whose menus differ.

import { absColumn, colLetters, colNumber, parseRange, rangeText, rowAnchored, topLeft, type Range } from "./range";

export type ParamKey = "range" | "column" | "value" | "n" | "min" | "max" | "source" | "colour";

export const COLOURS = {
  red: { label: "Light red fill, dark red text", fill: "#FFC7CE", text: "#9C0006" },
  green: { label: "Light green fill, dark green text", fill: "#C6EFCE", text: "#006100" },
  yellow: { label: "Light yellow fill, dark yellow text", fill: "#FFEB9C", text: "#9C5700" },
  blue: { label: "Light blue fill", fill: "#DDEBF7", text: "#1F3864" },
  grey: { label: "Light grey fill", fill: "#EDEDED", text: "#262626" },
} as const;
export type ColourId = keyof typeof COLOURS;

export interface Params {
  range: string;
  column: string;
  value: string;
  n: string;
  min: string;
  max: string;
  source: string;
  colour: ColourId;
}

export interface Built {
  kind: "cf" | "dv";
  /** The exact formula to paste, or null for a built-in rule that needs none. */
  formula: string | null;
  appliesTo: string;
  /** What to choose in the rule dialog. */
  criteria: { excel: string; sheets: string };
  format: string | null;
  stepsExcel: string[];
  stepsSheets: string[];
  notes: string[];
}

export type BuildResult = { ok: true; rule: Built } | { ok: false; error: string };

export interface Template {
  id: string;
  kind: "cf" | "dv";
  group: string;
  title: string;
  /** Parameters the form shows, with their labels. */
  params: Partial<Record<ParamKey, string>>;
  defaults: Partial<Params>;
  build(p: Params, r: Range): BuildResult;
}

// ------------------------------------------------------------------ helpers

const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
const fail = (error: string): BuildResult => ({ ok: false, error });

function columnOf(p: Params, r: Range, label = "Column"): number | string {
  const c = p.column.trim().toUpperCase().replace(/\$/g, "");
  if (!/^[A-Z]{1,3}$/.test(c)) return `${label}: type a column letter such as D.`;
  const n = colNumber(c);
  if (n < r.c1 || n > r.c2) return `${label} ${c} is outside ${rangeText(r)}. Pick a column between ${colLetters(r.c1)} and ${colLetters(r.c2)}.`;
  return n;
}

function single(r: Range): string | null {
  return r.c1 === r.c2 ? null : `This rule works on one column. Use a range like ${colLetters(r.c1)}${r.r1}:${colLetters(r.c1)}${r.r2}.`;
}

function positiveInt(s: string, label: string, max = 1_000_000): number | string {
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : `${label} must be a whole number from 1 to ${max.toLocaleString("en-US")}.`;
}

function num(s: string, label: string): number | string {
  const n = Number(s.trim());
  return s.trim() !== "" && Number.isFinite(n) ? n : `${label} must be a number.`;
}

function isoDate(s: string, label: string): string[] | string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return `${label} must be a date written as YYYY-MM-DD.`;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return `${label} is not a real date.`;
  return [m[1], String(+m[2]), String(+m[3])];
}

function fmt(p: Params): string {
  const c = COLOURS[p.colour] ?? COLOURS.red;
  return `${c.label} (fill ${c.fill}, text ${c.text})`;
}

function cfSteps(applies: string, start: string, formula: string, p: Params): { stepsExcel: string[]; stepsSheets: string[] } {
  const c = COLOURS[p.colour] ?? COLOURS.red;
  return {
    stepsExcel: [
      `Select ${applies}, starting from ${start} so that ${start} is the active (white) cell.`,
      "Home > Conditional Formatting > New Rule.",
      "Choose “Use a formula to determine which cells to format”.",
      `In “Format values where this formula is true”, paste: ${formula}`,
      `Click Format… > Fill, pick ${c.fill} (and the font colour ${c.text} on the Font tab), then OK > OK.`,
    ],
    stepsSheets: [
      `Select ${applies}.`,
      "Format > Conditional formatting.",
      `Check that “Apply to range” says ${applies}.`,
      "Under “Format cells if…”, choose “Custom formula is”.",
      `Paste: ${formula}`,
      `Under “Formatting style”, choose a custom fill ${c.fill} and text colour ${c.text}, then click Done.`,
    ],
  };
}

function cf(p: Params, r: Range, formula: string, notes: string[] = []): BuildResult {
  const applies = rangeText(r);
  return { ok: true, rule: { kind: "cf", formula, appliesTo: applies, criteria: { excel: "Use a formula to determine which cells to format", sheets: "Custom formula is" }, format: fmt(p), ...cfSteps(applies, topLeft(r), formula, p), notes } };
}

function dvCustom(r: Range, formula: string, message: string, notes: string[] = []): BuildResult {
  const applies = rangeText(r);
  return {
    ok: true,
    rule: {
      kind: "dv",
      formula,
      appliesTo: applies,
      criteria: { excel: "Allow: Custom", sheets: "Custom formula is" },
      format: null,
      stepsExcel: [`Select ${applies}, starting from ${topLeft(r)}.`, "Data > Data Validation (in the Data Tools group).", "On the Settings tab, set Allow to “Custom”.", `In Formula, paste: ${formula}`, `On the Error Alert tab, keep Style “Stop” and type a message such as “${message}”, then OK.`],
      stepsSheets: [`Select ${applies}.`, "Data > Data validation > Add rule.", "Under Criteria, choose “Custom formula is”.", `Paste: ${formula}`, "Open Advanced options, choose “Reject the input” and add help text, then click Done."],
      notes,
    },
  };
}

const RANGE_WHOLE = { range: "Range to format (whole rows)", column: "Column to test" };
const RANGE_COL = { range: "Range (one column)" };

// ------------------------------------------------------------------ the library

export const TEMPLATES: Template[] = [
  {
    id: "duplicates-column",
    kind: "cf",
    group: "Duplicates",
    title: "Duplicates in one column",
    params: { ...RANGE_COL, colour: "Colour" },
    defaults: { range: "B2:B100", colour: "red" },
    build(p, r) {
      const e = single(r);
      if (e) return fail(e);
      return cf(p, r, `=COUNTIF(${absColumn(r.c1, r)},${topLeft(r)})>1`, ["Every copy of a repeated value is highlighted, including the first one.", "COUNTIF ignores upper and lower case: “ab” and “AB” count as duplicates."]);
    },
  },
  {
    id: "duplicates-block",
    kind: "cf",
    group: "Duplicates",
    title: "Duplicates across several columns (anywhere in the block)",
    params: { range: "Range (several columns)", colour: "Colour" },
    defaults: { range: "A2:C100", colour: "red" },
    build(p, r) {
      return cf(p, r, `=COUNTIF(${rangeText(r, { abs: true })},${topLeft(r)})>1`, ["A value is highlighted when it appears more than once anywhere in the block, in any column.", "Empty cells are not highlighted."].concat([]));
    },
  },
  {
    id: "duplicate-rows",
    kind: "cf",
    group: "Duplicates",
    title: "Duplicate rows (same values in every column)",
    params: { range: "Range (whole rows)", colour: "Colour" },
    defaults: { range: "A2:C100", colour: "yellow" },
    build(p, r) {
      if (r.c2 - r.c1 > 9) return fail("Pick at most 10 columns for duplicate rows.");
      const parts: string[] = [];
      for (let c = r.c1; c <= r.c2; c++) parts.push(`${absColumn(c, r)},${rowAnchored(c, r)}`);
      return cf(p, r, `=COUNTIFS(${parts.join(",")})>1`, ["A row is highlighted when another row has the same value in every column of the range."]);
    },
  },
  {
    id: "unique-values",
    kind: "cf",
    group: "Duplicates",
    title: "Unique values (appear only once)",
    params: { ...RANGE_COL, colour: "Colour" },
    defaults: { range: "B2:B100", colour: "green" },
    build(p, r) {
      const e = single(r);
      if (e) return fail(e);
      return cf(p, r, `=AND(${topLeft(r)}<>"",COUNTIF(${absColumn(r.c1, r)},${topLeft(r)})=1)`);
    },
  },
  {
    id: "overdue",
    kind: "cf",
    group: "Dates",
    title: "Overdue dates (before today)",
    params: { ...RANGE_WHOLE, column: "Date column", colour: "Colour" },
    defaults: { range: "A2:F100", column: "D", colour: "red" },
    build(p, r) {
      const c = columnOf(p, r, "Date column");
      if (typeof c === "string") return fail(c);
      const a = rowAnchored(c, r);
      return cf(p, r, `=AND(${a}<>"",${a}<TODAY())`, ["TODAY() changes every day, so the highlighting updates by itself.", "Dates typed as text are not real dates and are never highlighted."]);
    },
  },
  {
    id: "due-next-7",
    kind: "cf",
    group: "Dates",
    title: "Due in the next 7 days",
    params: { ...RANGE_WHOLE, column: "Date column", n: "Number of days", colour: "Colour" },
    defaults: { range: "A2:F100", column: "D", n: "7", colour: "yellow" },
    build(p, r) {
      const c = columnOf(p, r, "Date column");
      if (typeof c === "string") return fail(c);
      const n = positiveInt(p.n, "Number of days", 3650);
      if (typeof n === "string") return fail(n);
      const a = rowAnchored(c, r);
      return cf(p, r, `=AND(${a}>=TODAY(),${a}<=TODAY()+${n})`, [`Today counts as day 0, so the rule covers today and the next ${n} days.`]);
    },
  },
  {
    id: "today",
    kind: "cf",
    group: "Dates",
    title: "Today's date",
    params: { ...RANGE_WHOLE, column: "Date column", colour: "Colour" },
    defaults: { range: "A2:F100", column: "D", colour: "blue" },
    build(p, r) {
      const c = columnOf(p, r, "Date column");
      if (typeof c === "string") return fail(c);
      return cf(p, r, `=INT(${rowAnchored(c, r)})=TODAY()`, ["INT() drops the time, so date-times from today also match."]);
    },
  },
  {
    id: "weekends",
    kind: "cf",
    group: "Dates",
    title: "Weekends (Saturday and Sunday)",
    params: { ...RANGE_WHOLE, column: "Date column", colour: "Colour" },
    defaults: { range: "A2:F100", column: "A", colour: "grey" },
    build(p, r) {
      const c = columnOf(p, r, "Date column");
      if (typeof c === "string") return fail(c);
      const a = rowAnchored(c, r);
      return cf(p, r, `=AND(${a}<>"",WEEKDAY(${a},2)>5)`, ["WEEKDAY(…,2) numbers Monday 1 to Sunday 7, so >5 means Saturday or Sunday."]);
    },
  },
  {
    id: "top-n",
    kind: "cf",
    group: "Rankings",
    title: "Top N values",
    params: { ...RANGE_COL, n: "N", colour: "Colour" },
    defaults: { range: "B2:B100", n: "10", colour: "green" },
    build(p, r) {
      const e = single(r);
      if (e) return fail(e);
      const n = positiveInt(p.n, "N", r.r2 - r.r1 + 1);
      if (typeof n === "string") return fail(n);
      return cf(p, r, `=AND(ISNUMBER(${topLeft(r)}),${topLeft(r)}>=LARGE(${absColumn(r.c1, r)},${n}))`, ["Ties with the N-th value are highlighted too, so you may see more than N cells.", "Excel also has a built-in Top/Bottom Rules menu; the formula version works the same in Google Sheets."]);
    },
  },
  {
    id: "top-percent",
    kind: "cf",
    group: "Rankings",
    title: "Top N percent",
    params: { ...RANGE_COL, n: "Percent", colour: "Colour" },
    defaults: { range: "B2:B100", n: "10", colour: "green" },
    build(p, r) {
      const e = single(r);
      if (e) return fail(e);
      const n = positiveInt(p.n, "Percent", 99);
      if (typeof n === "string") return fail(n);
      return cf(p, r, `=AND(ISNUMBER(${topLeft(r)}),${topLeft(r)}>=PERCENTILE(${absColumn(r.c1, r)},${(100 - n) / 100}))`, [`Highlights values at or above the ${100 - n}th percentile.`]);
    },
  },
  {
    id: "bottom-n",
    kind: "cf",
    group: "Rankings",
    title: "Bottom N values",
    params: { ...RANGE_COL, n: "N", colour: "Colour" },
    defaults: { range: "B2:B100", n: "5", colour: "red" },
    build(p, r) {
      const e = single(r);
      if (e) return fail(e);
      const n = positiveInt(p.n, "N", r.r2 - r.r1 + 1);
      if (typeof n === "string") return fail(n);
      return cf(p, r, `=AND(ISNUMBER(${topLeft(r)}),${topLeft(r)}<=SMALL(${absColumn(r.c1, r)},${n}))`);
    },
  },
  {
    id: "above-average",
    kind: "cf",
    group: "Rankings",
    title: "Above average",
    params: { ...RANGE_COL, colour: "Colour" },
    defaults: { range: "B2:B100", colour: "green" },
    build(p, r) {
      const e = single(r);
      if (e) return fail(e);
      return cf(p, r, `=AND(ISNUMBER(${topLeft(r)}),${topLeft(r)}>AVERAGE(${absColumn(r.c1, r)}))`);
    },
  },
  {
    id: "below-average",
    kind: "cf",
    group: "Rankings",
    title: "Below average",
    params: { ...RANGE_COL, colour: "Colour" },
    defaults: { range: "B2:B100", colour: "red" },
    build(p, r) {
      const e = single(r);
      if (e) return fail(e);
      return cf(p, r, `=AND(ISNUMBER(${topLeft(r)}),${topLeft(r)}<AVERAGE(${absColumn(r.c1, r)}))`, ["Empty cells are skipped (ISNUMBER), otherwise they would count as 0 and be highlighted."]);
    },
  },
  {
    id: "blanks",
    kind: "cf",
    group: "Cells",
    title: "Blank cells",
    params: { range: "Range", colour: "Colour" },
    defaults: { range: "A2:F100", colour: "yellow" },
    build(p, r) {
      return cf(p, r, `=LEN(TRIM(${topLeft(r)}))=0`, ["Cells that contain only spaces, or a formula returning \"\", count as blank."]);
    },
  },
  {
    id: "non-blanks",
    kind: "cf",
    group: "Cells",
    title: "Non-blank cells",
    params: { range: "Range", colour: "Colour" },
    defaults: { range: "A2:F100", colour: "blue" },
    build(p, r) {
      return cf(p, r, `=LEN(TRIM(${topLeft(r)}))>0`);
    },
  },
  {
    id: "text-contains",
    kind: "cf",
    group: "Cells",
    title: "Text contains a word",
    params: { range: "Range", value: "Text to find", colour: "Colour" },
    defaults: { range: "B2:B100", value: "urgent", colour: "red" },
    build(p, r) {
      const v = p.value.trim();
      if (!v || v.length > 100) return fail("Text to find: type 1 to 100 characters.");
      return cf(p, r, `=ISNUMBER(SEARCH(${q(v)},${topLeft(r)}))`, ["SEARCH ignores upper and lower case; use FIND instead to match case exactly.", "In SEARCH, ? and * are wildcards; put ~ before them to search for the characters themselves."]);
    },
  },
  {
    id: "row-by-value",
    kind: "cf",
    group: "Rows",
    title: "Highlight the whole row by one cell's value",
    params: { ...RANGE_WHOLE, value: "Value", colour: "Colour" },
    defaults: { range: "A2:F100", column: "D", value: "Done", colour: "green" },
    build(p, r) {
      const c = columnOf(p, r);
      if (typeof c === "string") return fail(c);
      const v = p.value.trim();
      if (!v) return fail("Value: type the value that should highlight the row.");
      const isNum = /^-?\d+(\.\d+)?$/.test(v);
      return cf(p, r, `=${rowAnchored(c, r)}=${isNum ? v : q(v)}`, [`The $ before ${colLetters(c)} keeps every cell of the row looking at column ${colLetters(c)}; the row number has no $ so it moves down row by row.`, "Text comparison ignores upper and lower case."]);
    },
  },
  {
    id: "banding",
    kind: "cf",
    group: "Rows",
    title: "Alternating rows (banding)",
    params: { range: "Range", colour: "Colour" },
    defaults: { range: "A2:F100", colour: "grey" },
    build(p, r) {
      return cf(p, r, `=MOD(ROW()-ROW(${rangeText({ ...r, c2: r.c1, r2: r.r1 }, { abs: true })}),2)=1`, ["Counting from the first row of the range keeps the pattern the same wherever the range starts; rows 2, 4, 6… of the range are shaded.", "Sorting or filtering keeps the stripes, because the formula uses the row number."]);
    },
  },
  {
    id: "differs-from-above",
    kind: "cf",
    group: "Rows",
    title: "Cells that differ from the cell above",
    params: { ...RANGE_COL, colour: "Colour" },
    defaults: { range: "B2:B100", colour: "blue" },
    build(p, r) {
      const e = single(r);
      if (e) return fail(e);
      if (r.r1 < 2) return fail("Start the range on row 2 or lower, so each cell has a cell above it.");
      const above = `${colLetters(r.c1)}${r.r1 - 1}`;
      return cf(p, r, `=AND(ROW()>${r.r1},${topLeft(r)}<>${above})`, ["Marks where a new value starts in a sorted column; the first cell of the range is skipped because the cell above it is usually the header."]);
    },
  },
  {
    id: "dropdown-range",
    kind: "dv",
    group: "Data validation",
    title: "Dropdown from a range",
    params: { range: "Cells that get the dropdown", source: "List range (e.g. Lists!A2:A20)" },
    defaults: { range: "C2:C100", source: "Lists!A2:A20" },
    build(p, r) {
      const src = parseRange(p.source);
      if (!src) return fail("List range: type a range such as Lists!A2:A20.");
      if (src.c1 !== src.c2 && src.r1 !== src.r2) return fail("List range must be one column or one row.");
      const abs = rangeText(src, { abs: true, sheet: true });
      const plain = rangeText(src, { sheet: true });
      const applies = rangeText(r);
      return {
        ok: true,
        rule: {
          kind: "dv",
          formula: `=${abs}`,
          appliesTo: applies,
          criteria: { excel: "Allow: List", sheets: "Dropdown (from a range)" },
          format: null,
          stepsExcel: [`Select ${applies}.`, "Data > Data Validation.", "Settings tab: Allow “List”, keep “In-cell dropdown” ticked.", `Source: =${abs}`, "Error Alert tab: Style “Stop”, then OK."],
          stepsSheets: [`Select ${applies}.`, "Data > Data validation > Add rule.", "Criteria: “Dropdown (from a range)”.", `Range: ${plain}`, "Advanced options: “Reject the input”, then Done."],
          notes: ["The $ signs keep the list fixed when the rule is copied.", "A list on another sheet works in both Excel (2010 and later) and Google Sheets. To let the list grow, use an Excel table column or a named range as the source."],
        },
      };
    },
  },
  {
    id: "dropdown-list",
    kind: "dv",
    group: "Data validation",
    title: "Dropdown from a typed list",
    params: { range: "Cells that get the dropdown", source: "Items, separated by commas" },
    defaults: { range: "D2:D100", source: "Open, In progress, Done" },
    build(p, r) {
      const items = p.source
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (items.length < 2) return fail("Items: type at least two items separated by commas.");
      if (items.join(",").length > 255) return fail("Excel limits a typed list to 255 characters; put the items in cells and use “Dropdown from a range”.");
      const applies = rangeText(r);
      return {
        ok: true,
        rule: {
          kind: "dv",
          formula: null,
          appliesTo: applies,
          criteria: { excel: "Allow: List", sheets: "Dropdown" },
          format: null,
          stepsExcel: [`Select ${applies}.`, "Data > Data Validation.", "Settings tab: Allow “List”, keep “In-cell dropdown” ticked.", `Source: ${items.join(",")}`, "Error Alert tab: Style “Stop”, then OK."],
          stepsSheets: [`Select ${applies}.`, "Data > Data validation > Add rule.", "Criteria: “Dropdown”.", `Type one item per box: ${items.join(" | ")} (click “Add another item” for each).`, "Advanced options: “Reject the input”, then Done."],
          notes: ["In Excel set to a locale that uses semicolons (German, French…), separate the items with ; instead of ,.", "An item cannot contain the separator itself."],
        },
      };
    },
  },
  {
    id: "whole-number-between",
    kind: "dv",
    group: "Data validation",
    title: "Whole number between two values",
    params: { range: "Cells to check", min: "Minimum", max: "Maximum" },
    defaults: { range: "E2:E100", min: "1", max: "100" },
    build(p, r) {
      const lo = num(p.min, "Minimum");
      const hi = num(p.max, "Maximum");
      if (typeof lo === "string") return fail(lo);
      if (typeof hi === "string") return fail(hi);
      if (lo > hi) return fail("Minimum must not be larger than Maximum.");
      const applies = rangeText(r);
      const c = topLeft(r);
      const formula = `=AND(ISNUMBER(${c}),INT(${c})=${c},${c}>=${lo},${c}<=${hi})`;
      return {
        ok: true,
        rule: {
          kind: "dv",
          formula,
          appliesTo: applies,
          criteria: { excel: "Allow: Whole number, between", sheets: "Custom formula is" },
          format: null,
          stepsExcel: [`Select ${applies}.`, "Data > Data Validation.", `Settings tab: Allow “Whole number”, Data “between”, Minimum ${lo}, Maximum ${hi}.`, "Error Alert tab: Style “Stop” and a message such as “Enter a whole number from " + lo + " to " + hi + "”, then OK."],
          stepsSheets: [`Select ${applies}.`, "Data > Data validation > Add rule.", "Criteria: “Custom formula is” (Sheets’ “Is between” also accepts decimals).", `Paste: ${formula}`, "Advanced options: “Reject the input”, then Done."],
          notes: ["Excel has a built-in whole-number check; Google Sheets needs the formula to refuse decimals."],
        },
      };
    },
  },
  {
    id: "date-between",
    kind: "dv",
    group: "Data validation",
    title: "Date between two dates",
    params: { range: "Cells to check", min: "First date (YYYY-MM-DD)", max: "Last date (YYYY-MM-DD)" },
    defaults: { range: "D2:D100", min: "2026-01-01", max: "2026-12-31" },
    build(p, r) {
      const a = isoDate(p.min, "First date");
      const b = isoDate(p.max, "Last date");
      if (typeof a === "string") return fail(a);
      if (typeof b === "string") return fail(b);
      if (p.min.trim() > p.max.trim()) return fail("First date must not be after Last date.");
      const applies = rangeText(r);
      const c = topLeft(r);
      const formula = `=AND(ISNUMBER(${c}),${c}>=DATE(${a.join(",")}),${c}<=DATE(${b.join(",")}))`;
      return {
        ok: true,
        rule: {
          kind: "dv",
          formula,
          appliesTo: applies,
          criteria: { excel: "Allow: Date, between", sheets: "Date is between" },
          format: null,
          stepsExcel: [`Select ${applies}.`, "Data > Data Validation.", `Settings tab: Allow “Date”, Data “between”, Start date =DATE(${a.join(",")}), End date =DATE(${b.join(",")}).`, "Error Alert tab: Style “Stop”, then OK."],
          stepsSheets: [`Select ${applies}.`, "Data > Data validation > Add rule.", `Criteria: “Date is between”, then type ${p.min.trim()} and ${p.max.trim()}.`, "Advanced options: “Reject the input”, then Done."],
          notes: ["DATE(year,month,day) avoids typing dates in a locale-specific format.", `The same rule as a custom formula: ${formula}`],
        },
      };
    },
  },
  {
    id: "text-length",
    kind: "dv",
    group: "Data validation",
    title: "Text length at most N characters",
    params: { range: "Cells to check", n: "Maximum length" },
    defaults: { range: "B2:B100", n: "50" },
    build(p, r) {
      const n = positiveInt(p.n, "Maximum length", 32767);
      if (typeof n === "string") return fail(n);
      const applies = rangeText(r);
      const formula = `=LEN(${topLeft(r)})<=${n}`;
      return {
        ok: true,
        rule: {
          kind: "dv",
          formula,
          appliesTo: applies,
          criteria: { excel: "Allow: Text length, less than or equal to", sheets: "Custom formula is" },
          format: null,
          stepsExcel: [`Select ${applies}.`, "Data > Data Validation.", `Settings tab: Allow “Text length”, Data “less than or equal to”, Maximum ${n}.`, "Error Alert tab: Style “Stop”, then OK."],
          stepsSheets: [`Select ${applies}.`, "Data > Data validation > Add rule.", "Criteria: “Custom formula is” (Sheets has no text-length option).", `Paste: ${formula}`, "Advanced options: “Reject the input”, then Done."],
          notes: [],
        },
      };
    },
  },
  {
    id: "no-duplicates",
    kind: "dv",
    group: "Data validation",
    title: "No duplicates in the column",
    params: { range: "Cells to check (one column)" },
    defaults: { range: "A2:A500" },
    build(_p, r) {
      const e = single(r);
      if (e) return fail(e);
      return dvCustom(r, `=COUNTIF(${absColumn(r.c1, r)},${topLeft(r)})=1`, "This value is already in the list.", ["Validation only checks new typing: values pasted over the cells, or already there, are not checked. Pair it with the “Duplicates in one column” highlight."]);
    },
  },
  {
    id: "email-like",
    kind: "dv",
    group: "Data validation",
    title: "Text that looks like an email address",
    params: { range: "Cells to check" },
    defaults: { range: "C2:C500" },
    build(_p, r) {
      const c = topLeft(r);
      const formula = `=AND(LEN(${c})-LEN(SUBSTITUTE(${c},"@",""))=1,ISNUMBER(FIND(".",${c},FIND("@",${c})+2)),ISERROR(FIND(" ",${c})),RIGHT(${c},1)<>".")`;
      return dvCustom(r, formula, "Enter an email address such as name@example.com.", ["A simple check without regular expressions: exactly one @, a dot at least one character after it, no spaces, and no dot at the end. It does not prove the address exists."]);
    },
  },
  {
    id: "required",
    kind: "dv",
    group: "Data validation",
    title: "Required (not blank)",
    params: { range: "Cells that must be filled" },
    defaults: { range: "A2:A100" },
    build(_p, r) {
      return dvCustom(r, `=LEN(TRIM(${topLeft(r)}))>0`, "This cell cannot be left blank.", ["In Excel, untick “Ignore blank” so that clearing a cell is refused.", "Validation cannot force someone to fill a cell they never touch; add the “Blank cells” highlight to see what is missing."]);
    },
  },
];

export function findTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function defaultParams(t: Template): Params {
  return { range: "", column: "", value: "", n: "", min: "", max: "", source: "", colour: "red", ...t.defaults };
}

export function buildRule(id: string, params: Params): BuildResult {
  const t = findTemplate(id);
  if (!t) return fail("Unknown rule.");
  const r = parseRange(params.range);
  if (!r) return fail("Range: type a range such as A2:F100 (start row and end row included).");
  if (r.r2 - r.r1 > 1_048_575) return fail("Range is too large.");
  return t.build(params, r);
}

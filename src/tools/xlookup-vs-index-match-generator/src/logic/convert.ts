import { detectSeparator, findCall, FormulaError, parseFormula, textOf, type Node } from "./formula";
import { columns, formatRange, orientation, parseRange, rows, sameColumns, sameRows, spanColumns, spanRows, width, height, type Range } from "./range";

export type Style = "VLOOKUP" | "HLOOKUP" | "INDEX-MATCH" | "XLOOKUP";
export type MatchMode = "exact" | "nextSmaller" | "nextLarger" | "wildcard";
export type SearchMode = "first" | "last" | "binaryAsc" | "binaryDesc";

/** A lookup described independently of the function that wrote it. */
export interface LookupSpec {
  source: Style;
  lookupValue: string;
  /** The row or column that is searched. */
  lookupRange: string;
  /** The row(s) or column(s) that are returned. */
  returnRange: string;
  orientation: "vertical" | "horizontal";
  match: MatchMode;
  search: SearchMode;
  /** Value shown when nothing is found (from XLOOKUP's 4th argument, IFERROR or IFNA). */
  ifNotFound: string | null;
  notFoundSource: "IFERROR" | "IFNA" | "XLOOKUP" | null;
  /** How many rows/columns are returned (null when unknown, e.g. a named range). */
  returnCount: number | null;
  /** Set when the return position was not a plain number (e.g. VLOOKUP(…, MATCH(…), …)). */
  dynamicIndex: { table: string; index: string } | null;
}

export interface Output {
  style: Style;
  formula: string | null;
  /** Why the conversion is impossible, when formula is null. */
  impossible: string | null;
  notes: string[];
}

export class ConvertError extends Error {}

const LOOKUPS = new Set(["VLOOKUP", "HLOOKUP", "XLOOKUP", "INDEX"]);

function isIndexMatch(n: Node): boolean {
  return n.kind === "call" && n.name === "INDEX" && n.args[1]?.kind === "call" && n.args[1].name === "MATCH";
}

function isLookupCall(n: Node): boolean {
  return n.kind === "call" && LOOKUPS.has(n.name) && (n.name !== "INDEX" || isIndexMatch(n));
}

function literal(n: Node | undefined): string | null {
  return n && n.kind === "leaf" ? n.text.toUpperCase() : null;
}

function rangeOf(formula: string, n: Node | undefined): Range | null {
  return n && n.kind === "leaf" && n.type === "ref" ? parseRange(n.text) : null;
}

function approx(arg: Node | undefined, fn: string): MatchMode {
  if (!arg || arg.kind === "empty") return "nextSmaller";
  const v = literal(arg);
  if (v === "FALSE" || v === "0") return "exact";
  if (v === "TRUE" || v === "1") return "nextSmaller";
  throw new ConvertError(`The last argument of ${fn} must be TRUE or FALSE (or 1/0) so the match type is known.`);
}

function hasWildcard(lookupValue: string): boolean {
  return /^".*[*?~].*"$/.test(lookupValue);
}

/** Reads the first lookup in the formula into a LookupSpec. */
export function extract(formula: string): { spec: LookupSpec; node: Node; root: Node; sep: "," | ";" } {
  const sep = detectSeparator(formula);
  let root: Node;
  try {
    root = parseFormula(formula, sep);
  } catch (e) {
    if (e instanceof FormulaError) throw new ConvertError(`The formula could not be read: ${e.message}`);
    throw e;
  }
  const wrapper = findCall(root, (c) => (c.name === "IFERROR" || c.name === "IFNA") && c.args.length === 2 && isLookupCall(c.args[0]));
  const call = wrapper ? (wrapper.args[0] as Extract<Node, { kind: "call" }>) : findCall(root, (c) => isLookupCall(c));
  if (!call) {
    const nested = findCall(root, (c) => c.name === "INDEX");
    if (nested) throw new ConvertError("INDEX was found, but without MATCH as its row (or column) argument, so it is not a lookup that can be converted.");
    throw new ConvertError("No VLOOKUP, HLOOKUP, XLOOKUP or INDEX/MATCH was found in this formula.");
  }
  const t = (n: Node | undefined) => (n ? textOf(formula, n) : "");
  const spec: LookupSpec = {
    source: "XLOOKUP",
    lookupValue: "",
    lookupRange: "",
    returnRange: "",
    orientation: "vertical",
    match: "exact",
    search: "first",
    ifNotFound: wrapper ? t(wrapper.args[1]) : null,
    notFoundSource: wrapper ? (wrapper.name as "IFERROR" | "IFNA") : null,
    returnCount: 1,
    dynamicIndex: null,
  };

  if (call.name === "VLOOKUP" || call.name === "HLOOKUP") {
    const vertical = call.name === "VLOOKUP";
    if (call.args.length < 3 || call.args.length > 4) throw new ConvertError(`${call.name} needs 3 or 4 arguments: lookup value, table, ${vertical ? "column" : "row"} number and match type.`);
    const [value, tableNode, indexNode, modeNode] = call.args;
    spec.source = call.name;
    spec.orientation = vertical ? "vertical" : "horizontal";
    spec.lookupValue = t(value);
    spec.match = approx(modeNode, call.name);
    if (spec.match === "exact" && hasWildcard(spec.lookupValue)) spec.match = "wildcard";
    const table = rangeOf(formula, tableNode);
    const tableText = t(tableNode);
    const pick = vertical ? columns : rows;
    const idx = literal(indexNode);
    if (table) spec.lookupRange = formatRange(pick(table, 1)!);
    else spec.lookupRange = vertical ? `INDEX(${tableText}${sep} 0${sep} 1)` : `INDEX(${tableText}${sep} 1${sep} 0)`;
    if (idx && /^\d+$/.test(idx)) {
      const n = Number(idx);
      if (n < 1) throw new ConvertError(`The ${vertical ? "column" : "row"} number must be 1 or more.`);
      const size = table ? (vertical ? width(table) : height(table)) : null;
      if (size !== null && n > size) throw new ConvertError(`${call.name} asks for ${vertical ? "column" : "row"} ${n}, but the table ${tableText} has only ${size}. Excel would return #REF!.`);
      const ret = table ? pick(table, n) : null;
      spec.returnRange = ret ? formatRange(ret) : vertical ? `INDEX(${tableText}${sep} 0${sep} ${n})` : `INDEX(${tableText}${sep} ${n}${sep} 0)`;
    } else if (idx && /^\{[\d,;\s]+\}$/.test(idx)) {
      const nums = idx.slice(1, -1).split(/[,;]/).map((s) => Number(s.trim()));
      spec.returnCount = nums.length;
      const contiguous = nums.every((v, i) => i === 0 || v === nums[i - 1] + 1);
      if (table && contiguous) spec.returnRange = formatRange(pick(table, nums[0], nums[nums.length - 1])!);
      else spec.returnRange = `${vertical ? "CHOOSECOLS" : "CHOOSEROWS"}(${tableText}${sep} ${nums.join(sep + " ")})`;
    } else {
      spec.dynamicIndex = { table: tableText, index: t(indexNode) };
      spec.returnRange = vertical ? `INDEX(${tableText}${sep} 0${sep} ${t(indexNode)})` : `INDEX(${tableText}${sep} ${t(indexNode)}${sep} 0)`;
      spec.returnCount = 1;
    }
  } else if (call.name === "XLOOKUP") {
    if (call.args.length < 3 || call.args.length > 6) throw new ConvertError("XLOOKUP needs 3 to 6 arguments: lookup value, lookup array, return array, and optionally if_not_found, match_mode and search_mode.");
    const [value, look, ret, nf, mm, sm] = call.args;
    spec.lookupValue = t(value);
    spec.lookupRange = t(look);
    spec.returnRange = t(ret);
    if (nf && nf.kind !== "empty") {
      spec.ifNotFound = t(nf);
      spec.notFoundSource = "XLOOKUP";
    }
    const modes: Record<string, MatchMode> = { "0": "exact", "-1": "nextSmaller", "1": "nextLarger", "2": "wildcard" };
    const searches: Record<string, SearchMode> = { "1": "first", "-1": "last", "2": "binaryAsc", "-2": "binaryDesc" };
    const mmText = mm && mm.kind !== "empty" ? t(mm).replace(/\s/g, "") : "0";
    const smText = sm && sm.kind !== "empty" ? t(sm).replace(/\s/g, "") : "1";
    if (!(mmText in modes)) throw new ConvertError("XLOOKUP's match_mode must be 0, -1, 1 or 2.");
    if (!(smText in searches)) throw new ConvertError("XLOOKUP's search_mode must be 1, -1, 2 or -2.");
    spec.match = modes[mmText];
    spec.search = searches[smText];
    const l = rangeOf(formula, look);
    const r = rangeOf(formula, ret);
    spec.orientation = l && orientation(l) === "horizontal" ? "horizontal" : "vertical";
    if (r) spec.returnCount = spec.orientation === "vertical" ? width(r) : height(r);
    else spec.returnCount = null;
  } else {
    // INDEX(return, MATCH(value, lookup, type)[, column])
    const [retNode, matchNode, third] = call.args;
    const m = matchNode as Extract<Node, { kind: "call" }>;
    if (m.args.length < 2 || m.args.length > 3) throw new ConvertError("MATCH needs 2 or 3 arguments: lookup value, lookup range and match type.");
    if (call.args.length > 3) throw new ConvertError("INDEX with an area number (4th argument) is not supported.");
    spec.source = "INDEX-MATCH";
    spec.lookupValue = t(m.args[0]);
    spec.lookupRange = t(m.args[1]);
    const type = m.args[2] && m.args[2].kind !== "empty" ? t(m.args[2]).replace(/\s/g, "") : "1";
    const types: Record<string, MatchMode> = { "0": "exact", "1": "nextSmaller", "-1": "nextLarger" };
    if (!(type in types)) throw new ConvertError("MATCH's match type must be 0, 1 or -1.");
    spec.match = types[type];
    if (spec.match === "exact" && hasWildcard(spec.lookupValue)) spec.match = "wildcard";
    if (spec.match === "nextLarger") spec.search = "binaryDesc";
    const l = rangeOf(formula, m.args[1]);
    spec.orientation = l && orientation(l) === "horizontal" ? "horizontal" : "vertical";
    const retRange = rangeOf(formula, retNode);
    if (third && third.kind !== "empty") {
      const n = literal(third);
      if (third.kind === "call" && third.name === "MATCH") throw new ConvertError("This is a two-way INDEX/MATCH/MATCH lookup (row and column). Only one-way lookups are converted.");
      if (n && /^\d+$/.test(n) && retRange) {
        const sub = spec.orientation === "vertical" ? columns(retRange, Number(n)) : rows(retRange, Number(n));
        if (!sub) throw new ConvertError(`INDEX asks for column ${n}, which is outside ${t(retNode)}.`);
        spec.returnRange = formatRange(sub);
      } else {
        spec.dynamicIndex = { table: t(retNode), index: t(third) };
        spec.returnRange = spec.orientation === "vertical" ? `INDEX(${t(retNode)}${sep} 0${sep} ${t(third)})` : `INDEX(${t(retNode)}${sep} ${t(third)}${sep} 0)`;
      }
    } else {
      spec.returnRange = t(retNode);
      if (retRange) spec.returnCount = spec.orientation === "vertical" ? width(retRange) : height(retRange);
    }
  }
  return { spec, node: wrapper ?? call, root, sep };
}

const join = (sep: string, args: string[]) => args.join(sep + " ");

function wrapNotFound(inner: string, spec: LookupSpec, sep: string, notes: string[]): string {
  if (spec.ifNotFound === null) return inner;
  if (spec.notFoundSource === "IFERROR") {
    notes.push("Kept IFERROR: it also hides real mistakes such as #REF! or #VALUE!. IFNA only catches “not found”.");
    return `IFERROR(${join(sep, [inner, spec.ifNotFound])})`;
  }
  return `IFNA(${join(sep, [inner, spec.ifNotFound])})`;
}

function sortNote(spec: LookupSpec, fn: string): string | null {
  if (spec.match === "nextSmaller") return `Approximate match: ${fn} needs the lookup ${spec.orientation === "vertical" ? "column" : "row"} sorted A→Z / smallest first, or it can return wrong results without any error.`;
  if (spec.match === "nextLarger") return `Next-larger match: ${fn} needs the lookup ${spec.orientation === "vertical" ? "column" : "row"} sorted Z→A / largest first.`;
  return null;
}

export function toXlookup(spec: LookupSpec, sep: string): Output {
  const notes: string[] = [];
  const args = [spec.lookupValue, spec.lookupRange, spec.returnRange];
  const mm = { exact: null, nextSmaller: "-1", nextLarger: "1", wildcard: "2" }[spec.match];
  const sm = { first: null, last: "-1", binaryAsc: "2", binaryDesc: "-2" }[spec.search];
  // From INDEX/MATCH or VLOOKUP, approximate matches were binary searches on sorted data; XLOOKUP does not need sorting for -1/1.
  const searchArg = spec.source !== "XLOOKUP" && spec.search === "binaryDesc" ? null : sm;
  if (spec.notFoundSource === "IFERROR") {
    notes.push("IFERROR became XLOOKUP's if_not_found argument. Unlike IFERROR, it only replaces “not found”; other errors still show, which makes mistakes easier to spot.");
  }
  if (spec.ifNotFound !== null || mm !== null || searchArg !== null) args.push(spec.ifNotFound ?? "");
  if (mm !== null || searchArg !== null) args.push(mm ?? "0");
  if (searchArg !== null) args.push(searchArg);
  if (spec.match === "nextSmaller" && spec.source !== "XLOOKUP") notes.push("Match mode -1 (exact or next smaller) gives the same result as the approximate match, without needing sorted data.");
  if (spec.match === "wildcard" && spec.source !== "XLOOKUP") notes.push("Match mode 2 is needed: XLOOKUP only treats * and ? as wildcards when asked to.");
  if (spec.dynamicIndex) notes.push(`The ${spec.orientation === "vertical" ? "column" : "row"} is chosen by ${spec.dynamicIndex.index}, so INDEX(…, 0, …) picks it out of ${spec.dynamicIndex.table}.`);
  if (spec.returnCount !== null && spec.returnCount > 1) notes.push(`Returns ${spec.returnCount} adjacent cells, which spill to the right (or down).`);
  notes.push("Needs Excel 2021, Excel for Microsoft 365, Excel for the web or Google Sheets. Not available in Excel 2019 or 2016.");
  return { style: "XLOOKUP", formula: `XLOOKUP(${join(sep, args)})`, impossible: null, notes };
}

export function toIndexMatch(spec: LookupSpec, sep: string): Output {
  const notes: string[] = [];
  if (spec.search === "last") return { style: "INDEX-MATCH", formula: null, impossible: "MATCH always returns the first match; it cannot search from last to first like XLOOKUP's search_mode -1. A workaround is LOOKUP(2, 1/(range=value), result).", notes };
  const type = { exact: "0", wildcard: "0", nextSmaller: "1", nextLarger: "-1" }[spec.match];
  const match = `MATCH(${join(sep, [spec.lookupValue, spec.lookupRange, type])})`;
  let formula: string;
  if (spec.returnCount !== null && spec.returnCount > 1) {
    formula = spec.orientation === "vertical" ? `INDEX(${join(sep, [spec.returnRange, match, "0"])})` : `INDEX(${join(sep, [spec.returnRange, "0", match])})`;
    notes.push("With 0 as the last argument INDEX returns the whole row of the return range. It spills in Excel 365 and Google Sheets; in older Excel, enter it as an array formula over the cells you need.");
  } else {
    formula = `INDEX(${join(sep, [spec.returnRange, match])})`;
  }
  const s = sortNote(spec, "MATCH");
  if (s) notes.push(s);
  if (spec.source === "XLOOKUP" && (spec.match === "nextSmaller" || spec.match === "nextLarger")) notes.push("XLOOKUP did not need sorted data for this match mode; MATCH does.");
  if (spec.match === "wildcard") notes.push("MATCH with type 0 treats * and ? in text as wildcards automatically.");
  if (spec.search === "binaryAsc" || spec.search === "binaryDesc") notes.push("XLOOKUP's binary search mode has no MATCH switch; MATCH's approximate types also use a fast binary search.");
  notes.push("Works in every Excel version, Google Sheets and LibreOffice.");
  return { style: "INDEX-MATCH", formula: wrapNotFound(formula, spec, sep, notes), impossible: null, notes };
}

function toClassic(spec: LookupSpec, sep: string, style: "VLOOKUP" | "HLOOKUP"): Output {
  const notes: string[] = [];
  const vertical = style === "VLOOKUP";
  const dir = vertical ? "column" : "row";
  const fail = (impossible: string): Output => ({ style, formula: null, impossible, notes });
  if ((spec.orientation === "vertical") !== vertical) return fail(`${style} searches ${vertical ? "down the first column" : "across the first row"}, but this lookup runs ${vertical ? "across a row" : "down a column"}. Use ${vertical ? "HLOOKUP" : "VLOOKUP"} instead.`);
  if (spec.search === "last") return fail(`${style} always returns the first match; it cannot search from the last row up.`);
  if (spec.match === "nextLarger") return fail(`${style} can only find the exact value or the next smaller one, not the next larger.`);
  if (spec.dynamicIndex) {
    const look = parseRange(spec.lookupRange);
    const tbl = parseRange(spec.dynamicIndex.table);
    if (!look || !tbl || (vertical ? look.c1 !== tbl.c1 : look.r1 !== tbl.r1)) return fail(`The ${dir} is chosen by a formula and the lookup ${dir} is not the first one of ${spec.dynamicIndex.table}, so ${style} cannot express it.`);
    const out = `${style}(${join(sep, [spec.lookupValue, spec.dynamicIndex.table, spec.dynamicIndex.index, spec.match === "nextSmaller" ? "TRUE" : "FALSE"])})`;
    return { style, formula: wrapNotFound(out, spec, sep, notes), impossible: null, notes };
  }
  const look = parseRange(spec.lookupRange);
  const ret = parseRange(spec.returnRange);
  if (!look || !ret) return fail(`${style} needs one table that starts with the lookup ${dir}. ${!look ? spec.lookupRange : spec.returnRange} is not a plain cell range (it may be a named range, a table column or a formula), so the table and the ${dir} number cannot be worked out.`);
  if (look.sheet !== ret.sheet) return fail(`The lookup and return ranges are on different sheets; ${style} needs them in one table.`);
  if (vertical) {
    if (width(look) !== 1) return fail("The lookup range must be a single column for VLOOKUP.");
    if (ret.c1! < look.c1!) return fail(`Left lookup: the result column (${spec.returnRange}) is to the left of the lookup column (${spec.lookupRange}). VLOOKUP can only return columns to the right of the first column. Use INDEX-MATCH or XLOOKUP.`);
    if (!sameRows(look, ret)) notes.push(`The lookup and return ranges cover different rows; the VLOOKUP table uses the rows of ${spec.lookupRange}.`);
  } else {
    if (height(look) !== 1) return fail("The lookup range must be a single row for HLOOKUP.");
    if (ret.r1! < look.r1!) return fail(`The result row is above the lookup row. HLOOKUP can only return rows below the first row. Use INDEX-MATCH or XLOOKUP.`);
    if (!sameColumns(look, ret)) notes.push(`The lookup and return ranges cover different columns; the HLOOKUP table uses the columns of ${spec.lookupRange}.`);
  }
  const table = vertical ? spanColumns(look, ret) : spanRows(look, ret);
  const first = vertical ? ret.c1! - look.c1! + 1 : ret.r1! - look.r1! + 1;
  const count = vertical ? width(ret)! : height(ret)!;
  const index = count > 1 ? `{${Array.from({ length: count }, (_, i) => first + i).join(",")}}` : String(first);
  if (count > 1) {
    notes.push(`An array of ${dir} numbers (${index}) returns ${count} cells side by side in Excel 365 and Google Sheets.`);
    if (sep === ";") notes.push("The separator inside { } depends on your Excel language (for example . or \\); change the comma if Excel rejects it.");
  }
  const mode = spec.match === "nextSmaller" ? "TRUE" : "FALSE";
  const out = `${style}(${join(sep, [spec.lookupValue, formatRange(table), index, mode])})`;
  const s = sortNote(spec, style);
  if (s) notes.push(s);
  if (spec.match === "wildcard") notes.push(`${style} with FALSE treats * and ? in the lookup value as wildcards.`);
  notes.push(`The ${dir} number ${first} is fixed: inserting a ${dir} inside the table breaks the result silently.`);
  if (spec.notFoundSource === "XLOOKUP") notes.push("XLOOKUP's if_not_found became IFNA (Excel 2013 and later).");
  return { style, formula: wrapNotFound(out, spec, sep, notes), impossible: null, notes };
}

export function toVlookup(spec: LookupSpec, sep: string): Output {
  return toClassic(spec, sep, "VLOOKUP");
}

export function toHlookup(spec: LookupSpec, sep: string): Output {
  return toClassic(spec, sep, "HLOOKUP");
}

export interface ConversionResult {
  spec: LookupSpec;
  outputs: Output[];
  /** True when the lookup was only part of a bigger formula, which the outputs keep around it. */
  embedded: boolean;
}

/** Converts the lookup to every style, keeping the rest of the formula around it unchanged. */
export function convertAll(formula: string): ConversionResult {
  const input = formula.trim();
  if (input === "") throw new ConvertError("Paste a formula that contains VLOOKUP, HLOOKUP, INDEX/MATCH or XLOOKUP.");
  const { spec, node, sep } = extract(input);
  const before = input.slice(0, node.start).replace(/^=/, "");
  const after = input.slice(node.end);
  const embedded = before.trim() !== "" || after.trim() !== "";
  const wrap = (o: Output): Output => (o.formula === null ? o : { ...o, formula: `=${before}${o.formula}${after}` });
  let classic = spec.orientation === "vertical" ? toVlookup(spec, sep) : toHlookup(spec, sep);
  if (classic.style === spec.source) {
    // Rebuilding would only reformat the user's own formula (and some, like {2,4}, cannot be rebuilt), so keep it verbatim.
    const original = input.slice(node.start, node.end);
    const kept = classic.notes.filter((n) => n.includes("is fixed") || n.startsWith("Approximate"));
    classic = { style: classic.style, formula: original, impossible: null, notes: ["Your original formula, unchanged.", ...kept] };
  }
  const outputs = [toXlookup(spec, sep), toIndexMatch(spec, sep), classic];
  if (/^CHOOSE(COLS|ROWS)\(/.test(spec.returnRange)) {
    for (const o of outputs.slice(0, 2)) o.notes.unshift(`${spec.returnRange.split("(")[0]} needs Excel 365, Excel 2024 or Google Sheets.`);
  }
  return { spec, outputs: outputs.map(wrap), embedded };
}

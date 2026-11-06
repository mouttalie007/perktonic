import { FUNCTIONS, type FunctionEntry, type Support } from "./dictionary";
import { MAX_FORMULA_CHARS, syntaxOf, type Lang, type Platform, type Syntax } from "./settings";

export class FormulaError extends Error {
  constructor(
    message: string,
    readonly index: number,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------- dictionary lookups

const BY_EN = new Map<string, FunctionEntry>();
for (const f of FUNCTIONS) BY_EN.set(f.en, f);

/** Localized name → entry, per language (English names are always accepted too). */
const BY_LOCAL: Record<Lang, Map<string, FunctionEntry>> = { en: new Map(), fr: new Map(), de: new Map(), es: new Map() };
for (const f of FUNCTIONS) {
  for (const lang of ["fr", "de", "es"] as const) {
    const n = f.names?.[lang];
    if (n) BY_LOCAL[lang].set(n.toUpperCase(), f);
  }
}

export function lookup(name: string, lang: Lang): FunctionEntry | undefined {
  const up = name.toUpperCase().replace(/^_XLFN\.|^COM\.MICROSOFT\./, "");
  return (lang !== "en" ? BY_LOCAL[lang].get(up) : undefined) ?? BY_EN.get(up);
}

export function localName(en: string, lang: Lang): string {
  if (lang === "en") return en;
  return BY_EN.get(en)?.names?.[lang] ?? en;
}

const BOOL: Record<Lang, [string, string]> = { en: ["TRUE", "FALSE"], fr: ["VRAI", "FAUX"], de: ["WAHR", "FALSCH"], es: ["VERDADERO", "FALSO"] };
const ERRORS: Record<string, Record<Lang, string>> = {
  NA: { en: "#N/A", fr: "#N/A", de: "#NV", es: "#N/A" },
  VALUE: { en: "#VALUE!", fr: "#VALEUR!", de: "#WERT!", es: "#¡VALOR!" },
  REF: { en: "#REF!", fr: "#REF!", de: "#BEZUG!", es: "#¡REF!" },
  DIV0: { en: "#DIV/0!", fr: "#DIV/0!", de: "#DIV/0!", es: "#¡DIV/0!" },
  NAME: { en: "#NAME?", fr: "#NOM?", de: "#NAME?", es: "#¿NOMBRE?" },
  NUM: { en: "#NUM!", fr: "#NOMBRE!", de: "#ZAHL!", es: "#¡NUM!" },
  NULL: { en: "#NULL!", fr: "#NUL!", de: "#NULL!", es: "#¡NULO!" },
};

// ---------------------------------------------------------------- tokens and tree

type Tok =
  | { k: "str"; v: string }
  | { k: "num"; v: string }
  | { k: "bool"; v: boolean }
  | { k: "err"; id: string; raw: string }
  | { k: "ref"; sheet: string | null; a: string; b: string | null; spill: boolean }
  | { k: "name"; v: string }
  | { k: "op"; v: string }
  | { k: "ws"; v: string };

export type Node =
  | Tok
  | { k: "call"; name: string; entry: FunctionEntry | undefined; args: Node[][] }
  | { k: "group"; body: Node[] }
  | { k: "array"; rows: Node[][][] };

const CELL = String.raw`\$?[A-Za-z]{1,3}\$?\d{1,7}`;
const COLREF = String.raw`\$?[A-Za-z]{1,3}`;
const ROWREF = String.raw`\$?\d{1,7}`;
const REF_PART = new RegExp(String.raw`^(?:${CELL}(?::(?:${CELL}|${COLREF}(?![\w(])|${ROWREF}))?|${COLREF}:${COLREF}|${ROWREF}:${ROWREF})(?![\w.(])`);

function sheetName(raw: string): string {
  return raw.startsWith("'") ? raw.slice(1, -1).replace(/''/g, "'") : raw;
}

class Parser {
  i = 0;
  constructor(
    readonly src: string,
    readonly syn: Syntax,
    readonly lang: Lang,
  ) {}

  private peek(s: string): boolean {
    return this.src.startsWith(s, this.i);
  }

  private ws(): Node | null {
    const m = /^\s+/.exec(this.src.slice(this.i));
    if (!m) return null;
    this.i += m[0].length;
    return { k: "ws", v: m[0] };
  }

  /** Sheet prefix: 'My Sheet'! / Sheet1! / [Book.xlsx]Sheet1! (or LibreOffice $'My Sheet'. / $Sheet1.). */
  private sheetPrefix(): string | null {
    const rest = this.src.slice(this.i);
    const sep = this.syn.sheetSep === "!" ? "!" : ".";
    const re = sep === "!" ? /^((?:\[[^\]]+\])?(?:'(?:[^']|'')+'|[A-Za-z_À-￿][\w.À-￿]*))!/ : /^\$?('(?:[^']|'')+'|[A-Za-z_À-￿][\wÀ-￿]*)\./;
    const m = re.exec(rest);
    if (!m) return null;
    if (sep === "." && !REF_PART.test(rest.slice(m[0].length).replace(/^\$/, "$"))) return null;
    if (sep === "!" && !REF_PART.test(rest.slice(m[0].length))) return null;
    this.i += m[0].length;
    return sheetName(m[1].replace(/^\[[^\]]+\]/, (b) => b));
  }

  private ref(): Node | null {
    const start = this.i;
    const sheet = this.sheetPrefix();
    let rest = this.src.slice(this.i);
    // LibreOffice may repeat the sheet after the colon: Sheet1.A1:Sheet1.B5 or $Sheet1.A1:.B5.
    if (this.syn.sheetSep === ".") rest = rest.replace(/^(\$?[A-Za-z]{1,3}\$?\d+):(?:\$?(?:'(?:[^']|'')+'|[A-Za-z_][\w]*))?\./, "$1:");
    const m = REF_PART.exec(rest);
    if (!m) {
      this.i = start;
      return null;
    }
    const consumed = this.src.slice(this.i).length - rest.length + m[0].length;
    this.i += consumed;
    const [a, b] = m[0].split(":");
    let spill = false;
    if (this.src[this.i] === "#" && !/^#[A-Za-z/]/.test(this.src.slice(this.i))) {
      spill = true;
      this.i++;
    }
    return { k: "ref", sheet, a, b: b ?? null, spill };
  }

  private atom(): Node {
    const c = this.src[this.i];
    if (c === "\"") {
      let j = this.i + 1;
      let v = "";
      for (;;) {
        const k = this.src.indexOf("\"", j);
        if (k < 0) throw new FormulaError("A text value is missing its closing quote (\").", this.i);
        v += this.src.slice(j, k);
        if (this.src[k + 1] === "\"") {
          v += "\"";
          j = k + 2;
          continue;
        }
        this.i = k + 1;
        return { k: "str", v };
      }
    }
    if (c === "#") {
      const m = /^#(N\/A|VALUE!|VALEUR!|WERT!|¡VALOR!|REF!|BEZUG!|¡REF!|DIV\/0!|¡DIV\/0!|NAME\?|NOM\?|¿NOMBRE\?|NUM!|NOMBRE!|ZAHL!|¡NUM!|NULL!|NUL!|¡NULO!|NV)/i.exec(this.src.slice(this.i));
      if (m) {
        this.i += m[0].length;
        const id = Object.keys(ERRORS).find((key) => Object.values(ERRORS[key]).some((x) => x.toUpperCase() === m[0].toUpperCase())) ?? "NA";
        return { k: "err", id, raw: m[0] };
      }
    }
    if (c === "{") return this.array();
    if (c === "(") {
      this.i++;
      const body = this.expr([")"]);
      if (this.src[this.i] !== ")") throw new FormulaError("A “(” is never closed.", this.i);
      this.i++;
      return { k: "group", body };
    }
    const r = this.ref();
    if (r) return r;
    const dec = this.syn.decimal === "," ? "," : "\\.";
    const num = new RegExp(`^(\\d+(${dec}\\d*)?|${dec}\\d+)([eE][+-]?\\d+)?`).exec(this.src.slice(this.i));
    if (num) {
      this.i += num[0].length;
      return { k: "num", v: num[0].replace(",", ".") };
    }
    const id = /^(?:_xlfn\.|COM\.MICROSOFT\.)?[A-Za-z_À-￿][\w.À-￿]*/i.exec(this.src.slice(this.i));
    if (id) {
      this.i += id[0].length;
      let j = this.i;
      while (/\s/.test(this.src[j] ?? "")) j++;
      if (this.src[j] === "(") {
        this.i = j + 1;
        const args: Node[][] = [];
        for (;;) {
          const arg = this.expr([this.syn.argSep, ")"]);
          args.push(arg);
          if (this.src[this.i] === ")") break;
          if (this.peek(this.syn.argSep)) {
            this.i += this.syn.argSep.length;
            continue;
          }
          throw new FormulaError(`The function ${id[0]} is never closed: add “)”.`, this.i);
        }
        this.i++;
        if (args.length === 1 && args[0].every((n) => n.k === "ws")) args.length = 0;
        return { k: "call", name: id[0], entry: lookup(id[0], this.lang), args };
      }
      const [t, f] = BOOL[this.lang];
      const up = id[0].toUpperCase();
      if (up === t || up === "TRUE") return { k: "bool", v: true };
      if (up === f || up === "FALSE") return { k: "bool", v: false };
      // A table reference such as Sales[Amount] or Sales[@Amount].
      const tbl = /^\[[^\]]*(\][^\]]*)*?\]/.exec(this.src.slice(this.i));
      if (tbl) {
        this.i += tbl[0].length;
        return { k: "name", v: id[0] + tbl[0] };
      }
      return { k: "name", v: id[0] };
    }
    const op = /^(<=|>=|<>|[-+*/^&=<>%@:])/.exec(this.src.slice(this.i));
    if (op) {
      this.i += op[0].length;
      return { k: "op", v: op[0] };
    }
    throw new FormulaError(`Unexpected “${c}”.`, this.i);
  }

  private array(): Node {
    this.i++;
    const rows: Node[][][] = [[[]]];
    for (;;) {
      if (this.i >= this.src.length) throw new FormulaError("An array constant “{” is never closed.", this.i);
      if (this.src[this.i] === "}") {
        this.i++;
        return { k: "array", rows };
      }
      const row = rows[rows.length - 1];
      // Separators: the source's own, plus the common alternatives (users paste arrays from other locales).
      if (this.peek(this.syn.arrayRow) || (this.syn.arrayRow !== ";" && this.peek(";") && this.syn.argSep !== ";")) {
        this.i++;
        rows.push([[]]);
        continue;
      }
      if (this.peek(this.syn.arrayCol) || this.peek(",") || this.peek("\\") || (this.syn.arrayCol === ";" && this.peek(";"))) {
        this.i++;
        row.push([]);
        continue;
      }
      const w = this.ws();
      if (w) {
        row[row.length - 1].push(w);
        continue;
      }
      const neg = this.peek("-") ? (this.i++, "-") : "";
      const a = this.atom();
      if (neg && a.k === "num") row[row.length - 1].push({ k: "num", v: `-${a.v}` });
      else {
        if (neg) row[row.length - 1].push({ k: "op", v: "-" });
        row[row.length - 1].push(a);
      }
    }
  }

  /** A sequence of atoms up to one of `stops` at this level (not consumed). */
  expr(stops: string[]): Node[] {
    const out: Node[] = [];
    while (this.i < this.src.length) {
      if (stops.some((s) => this.peek(s))) return out;
      const w = this.ws();
      if (w) {
        out.push(w);
        continue;
      }
      if (this.src[this.i] === ")") throw new FormulaError("There is a “)” without a matching “(”.", this.i);
      if (this.src[this.i] === ";" && this.syn.argSep === ",") {
        throw new FormulaError("“;” found where “,” was expected. If the formula uses ; between arguments, choose a French, German or Spanish source (or LibreOffice).", this.i);
      }
      if (this.src[this.i] === this.syn.argSep && !stops.includes(this.syn.argSep)) {
        throw new FormulaError(`“${this.syn.argSep}” is only allowed between function arguments. ${this.syn.argSep === ";" ? "Is the source language right?" : "If the formula uses ; between arguments, choose a French, German or Spanish source."}`, this.i);
      }
      out.push(this.atom());
    }
    return out;
  }
}

export interface Parsed {
  body: Node[];
  /** {=…} entered with Ctrl+Shift+Enter in older Excel. */
  cse: boolean;
}

export function parseFormula(text: string, syn: Syntax, lang: Lang): Parsed {
  let src = text.trim();
  if (src.length > MAX_FORMULA_CHARS) throw new FormulaError(`The formula is ${src.length.toLocaleString("en-US")} characters long; spreadsheets allow ${MAX_FORMULA_CHARS.toLocaleString("en-US")}.`, 0);
  let cse = false;
  if (/^\{\s*=/.test(src) && src.endsWith("}")) {
    cse = true;
    src = src.slice(1, -1).trim();
  }
  if (!src.startsWith("=") && !src.startsWith("+")) src = `=${src}`;
  const p = new Parser(src, syn, lang);
  p.i = 1;
  const body = p.expr([]);
  if (p.i < src.length) throw new FormulaError(`Unexpected “${src[p.i]}”.`, p.i);
  return { body, cse };
}

// ---------------------------------------------------------------- translation

export interface Translation {
  formula: string;
  warnings: string[];
  notes: string[];
  /** Functions used, with what happened to them. */
  functions: { name: string; status: "same" | "renamed" | "rewritten" | "unsupported" | "unknown" | "localized" }[];
}

interface Ctx {
  from: Platform;
  to: Platform;
  fromLang: Lang;
  toLang: Lang;
  warnings: Set<string>;
  notes: Set<string>;
  functions: Map<string, Translation["functions"][number]["status"]>;
  openRanges: string[];
}

function supportOf(entry: FunctionEntry, platform: Platform): Support | null {
  return entry[platform] ?? null;
}

const MAX_ROWS = 1048576;
const MAX_COL = "XFD";

function convertRef(r: Extract<Tok, { k: "ref" }>, ctx: Ctx): Extract<Tok, { k: "ref" }> {
  const out = { ...r };
  // Google Sheets' open ranges (A2:A) mean "to the last row"; Excel and LibreOffice need an end row.
  if (ctx.from === "sheets" && ctx.to !== "sheets" && r.b && /^\$?[A-Za-z]{1,3}$/.test(r.b) && /\d/.test(r.a)) {
    out.b = `${r.b}${MAX_ROWS}`;
    ctx.openRanges.push(`${r.a}:${r.b}`);
  }
  if (ctx.from === "sheets" && ctx.to !== "sheets" && r.b && /^\$?\d+$/.test(r.b) && /[A-Za-z]/.test(r.a)) {
    out.b = `${MAX_COL}${r.b}`;
  }
  if (r.spill && ctx.to !== "excel") ctx.warnings.add(`The spill reference ${r.a}# exists only in Excel 365. In ${ctx.to === "sheets" ? "Google Sheets" : "LibreOffice"}, refer to the whole result range instead (for example ${r.a}:${r.a.replace(/\d+/, (n) => String(Number(n) + 99))}).`);
  if (r.sheet && /^\[/.test(r.sheet)) ctx.warnings.add(`The reference to another workbook (${r.sheet}) will not work as it is in ${ctx.to === "sheets" ? "Google Sheets; use IMPORTRANGE(\"spreadsheet URL\", \"Sheet1!A1:B10\")" : "LibreOffice; use an external reference ('file:///…'#$Sheet1.A1)"}.`);
  return out;
}

function substitute(template: string, args: Node[][]): Node[] {
  const tSyn = syntaxOf("excel", "en", true);
  const placeholders: Node[][] = [];
  const marked = template.replace(/\$(\d+)(\*?)/g, (_, n: string, rest: string) => {
    const idx = Number(n) - 1;
    const picked = rest ? args.slice(idx) : [args[idx] ?? []];
    // Several arguments for $2*: join them with commas, which the printer turns into the target separator.
    const id = placeholders.length;
    const trim = (a: Node[]) => {
      let i = 0;
      let j = a.length;
      while (i < j && a[i].k === "ws") i++;
      while (j > i && a[j - 1].k === "ws") j--;
      return a.slice(i, j);
    };
    placeholders.push(picked.map(trim).flatMap((a, k) => (k === 0 ? a : [{ k: "op", v: "\u0000SEP" } as Node, ...a])));
    return `__ARG${id}__`;
  });
  const tree = parseFormula(`=${marked}`, tSyn, "en").body;
  const fill = (nodes: Node[]): Node[] =>
    nodes.flatMap((n): Node[] => {
      if (n.k === "name" && /^__ARG\d+__$/.test(n.v)) return placeholders[Number(n.v.slice(5, -2))];
      if (n.k === "call") return [{ ...n, args: n.args.map(fill) }];
      if (n.k === "group") return [{ ...n, body: fill(n.body) }];
      return [n];
    });
  return fill(tree);
}

function translateNodes(nodes: Node[], ctx: Ctx): Node[] {
  return nodes.flatMap((n): Node[] => {
    if (n.k === "ref") return [convertRef(n, ctx)];
    if (n.k === "group") return [{ ...n, body: translateNodes(n.body, ctx) }];
    if (n.k === "array") return [{ ...n, rows: n.rows.map((r) => r.map((c) => translateNodes(c, ctx))) }];
    if (n.k === "op" && n.v === "@" && ctx.to !== "excel") {
      ctx.notes.add(`The implicit intersection operator @ was removed: ${ctx.to === "sheets" ? "Google Sheets" : "LibreOffice"} does not use it.`);
      return [];
    }
    if (n.k === "name" && /\[/.test(n.v) && ctx.to !== "excel") ctx.warnings.add(`Table references such as ${n.v} only work if a table (Sheets: Format ▸ Convert to table; LibreOffice: a database range) with that name exists. Otherwise replace it with a normal range.`);
    if (n.k !== "call") return [n];
    const args = n.args.map((a) => translateNodes(a, ctx));
    const entry = n.entry;
    if (!entry) {
      ctx.functions.set(n.name.toUpperCase(), "unknown");
      ctx.warnings.add(`${n.name.toUpperCase()} is not in the dictionary, so it was copied unchanged. Check that it exists in ${ctx.to === "sheets" ? "Google Sheets" : ctx.to === "calc" ? "LibreOffice" : "Excel"}${ctx.fromLang !== "en" ? " and that the source language is right" : ""}.`);
      return [{ ...n, args }];
    }
    const sup = supportOf(entry, ctx.to);
    if (sup && "none" in sup) {
      ctx.functions.set(entry.en, "unsupported");
      ctx.warnings.add(`${entry.en} has no equivalent in ${ctx.to === "sheets" ? "Google Sheets" : ctx.to === "calc" ? "LibreOffice Calc" : "Excel"}. ${sup.none}`);
      return [{ ...n, name: entry.en, args }];
    }
    if (sup?.since) ctx.notes.add(`${sup.as ?? entry.en} needs ${sup.since} or newer.`);
    if (sup?.note) ctx.notes.add(`${entry.en}: ${sup.note}`);
    if (sup?.template) {
      ctx.functions.set(entry.en, "rewritten");
      // The arguments were translated already; only the new functions of the template still need the target's checks.
      return translateNodes(substitute(sup.template, args), { ...ctx, from: ctx.to, functions: new Map(), openRanges: [] });
    }
    if (sup?.as) {
      ctx.functions.set(entry.en, "renamed");
      const target = BY_EN.get(sup.as);
      return [{ k: "call", name: sup.as, entry: target ?? entry, args }];
    }
    ctx.functions.set(entry.en, ctx.fromLang !== ctx.toLang && entry.names ? "localized" : "same");
    return [{ ...n, name: entry.en, args }];
  });
}

// ---------------------------------------------------------------- printing

function quoteSheet(name: string, platform: Platform): string {
  const simple = /^[A-Za-z_][\w]*$/.test(name) && !/^[A-Za-z]{1,3}\d+$/.test(name);
  const q = simple ? name : `'${name.replace(/'/g, "''")}'`;
  return platform === "calc" ? `$${q}` : q;
}

function print(nodes: Node[], syn: Syntax, platform: Platform, lang: Lang): string {
  let out = "";
  for (const n of nodes) {
    switch (n.k) {
      case "ws":
        out += n.v;
        break;
      case "str":
        out += `"${n.v.replace(/"/g, "\"\"")}"`;
        break;
      case "num":
        out += syn.decimal === "," ? n.v.replace(".", ",") : n.v;
        break;
      case "bool":
        out += BOOL[platform === "sheets" ? "en" : syn.names][n.v ? 0 : 1];
        break;
      case "err":
        out += ERRORS[n.id][platform === "sheets" ? "en" : syn.names];
        break;
      case "ref": {
        const sheet = n.sheet ? `${quoteSheet(n.sheet, platform)}${syn.sheetSep}` : "";
        out += `${sheet}${n.a}${n.b ? `:${n.b}` : ""}${n.spill && platform === "excel" ? "#" : ""}`;
        break;
      }
      case "name":
        out += n.v;
        break;
      case "op":
        out += n.v === "\u0000SEP" ? `${syn.argSep} ` : n.v;
        break;
      case "group":
        out += `(${print(n.body, syn, platform, lang)})`;
        break;
      case "array":
        out += `{${n.rows.map((r) => r.map((c) => print(c, syn, platform, lang).trim()).join(syn.arrayCol)).join(syn.arrayRow)}}`;
        break;
      case "call": {
        const name = syn.names === "en" ? n.entry?.en ?? n.name : localName(n.entry?.en ?? n.name, syn.names);
        out += `${n.entry ? name : n.name}(${n.args.map((a) => print(a, syn, platform, lang)).join(syn.argSep)})`;
        break;
      }
    }
  }
  return out;
}

function hasArrayWork(nodes: Node[]): boolean {
  return nodes.some((n) => n.k === "array" || (n.k === "ref" && !!n.b) || (n.k === "group" && hasArrayWork(n.body)) || (n.k === "call" && n.args.some(hasArrayWork)));
}

function containsCall(nodes: Node[], name: string): boolean {
  return nodes.some((n) => (n.k === "call" && (n.entry?.en === name || n.args.some((a) => containsCall(a, name)))) || (n.k === "group" && containsCall(n.body, name)));
}

export interface Request {
  formula: string;
  from: Platform;
  to: Platform;
  fromLang: Lang;
  toLang: Lang;
  /** LibreOffice can show English names whatever its UI language. */
  calcEnglishNames: boolean;
}

export function translate(req: Request): Translation {
  const fromSyn = syntaxOf(req.from, req.fromLang, req.calcEnglishNames);
  const toSyn = syntaxOf(req.to, req.toLang, req.calcEnglishNames);
  // Sheets always uses English names, whatever the locale chosen for separators.
  const parsed = parseFormula(req.formula, fromSyn, fromSyn.names);
  const ctx: Ctx = { from: req.from, to: req.to, fromLang: fromSyn.names, toLang: toSyn.names, warnings: new Set(), notes: new Set(), functions: new Map(), openRanges: [] };
  let body = translateNodes(parsed.body, ctx);

  const arrays = body.some((n) => n.k === "array") || JSON.stringify(body).includes('"k":"array"');
  if (arrays && (req.to === "calc" || (req.to === "excel" && req.toLang !== "en") || (req.from !== "sheets" && req.fromLang !== "en"))) {
    ctx.warnings.add(`Array constants were written with “${toSyn.arrayCol}” between columns and “${toSyn.arrayRow}” between rows. These separators depend on the program's language settings; check them if the formula is rejected.`);
  }

  if (parsed.cse) {
    if (req.to === "sheets") {
      if (!containsCall(body, "ARRAYFORMULA")) body = [{ k: "call", name: "ARRAYFORMULA", entry: BY_EN.get("ARRAYFORMULA"), args: [body] }];
      ctx.notes.add("The {=…} array formula (Ctrl+Shift+Enter) became ARRAYFORMULA(…), which is how Google Sheets marks array formulas.");
    } else if (req.to === "calc") {
      ctx.notes.add("This was an {=…} array formula: in LibreOffice, enter it with Ctrl+Shift+Enter. The braces are added by LibreOffice, so do not type them.");
    } else {
      ctx.notes.add("This {=…} array formula works as a normal formula in Excel 365 (dynamic arrays). In Excel 2019 or older, confirm it with Ctrl+Shift+Enter.");
    }
  } else if (req.from === "excel" && req.to === "sheets" && hasArrayWork(body) && containsArrayMath(body)) {
    ctx.notes.add("If this formula returned several values (spilled) in Excel 365, wrap it in ARRAYFORMULA(…) in Google Sheets.");
  }
  if (ctx.openRanges.length) {
    const list = [...new Set(ctx.openRanges)];
    ctx.notes.add(`Open-ended ranges (${list.join(", ")}) run to the last row in Google Sheets but do not exist in ${req.to === "excel" ? "Excel" : "LibreOffice"}; they now end at row ${MAX_ROWS.toLocaleString("en-US")}, which can be slower. A whole column such as B:B or a table also works.`);
  }
  const formula = `=${print(body, toSyn, req.to, toSyn.names).replace(/^\s+/, "")}`;
  return {
    formula,
    warnings: [...ctx.warnings],
    notes: [...ctx.notes],
    functions: [...ctx.functions].map(([name, status]) => ({ name, status })),
  };
}

/** Comparisons or arithmetic directly on ranges, which spill in Excel 365 but need ARRAYFORMULA in Sheets. */
function containsArrayMath(nodes: Node[]): boolean {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.k === "ref" && n.b) {
      const next = nodes.slice(i + 1).find((x) => x.k !== "ws");
      const prev = nodes.slice(0, i).reverse().find((x) => x.k !== "ws");
      if ((next && next.k === "op" && /^[-+*/^&=<>]|<=|>=|<>$/.test(next.v)) || (prev && prev.k === "op" && /^[-+*/^&=<>]|<=|>=|<>$/.test(prev.v))) return true;
    }
    if (n.k === "group" && containsArrayMath(n.body)) return true;
    if (n.k === "call" && !["SUMPRODUCT", "FILTER", "SORT", "UNIQUE", "ARRAYFORMULA", "SUMIFS", "COUNTIFS", "MMULT", "INDEX", "MATCH", "XLOOKUP", "XMATCH", "LET", "BYROW", "MAP"].includes(n.entry?.en ?? "") && n.args.some(containsArrayMath)) return true;
  }
  return false;
}

export function dictionaryStats(): { total: number; perPlatform: Record<Platform, number>; unsupported: Record<Platform, string[]> } {
  const unsupported: Record<Platform, string[]> = { excel: [], sheets: [], calc: [] };
  const perPlatform: Record<Platform, number> = { excel: 0, sheets: 0, calc: 0 };
  for (const f of FUNCTIONS) {
    for (const p of ["excel", "sheets", "calc"] as const) {
      const s = f[p];
      if (s && "none" in s) unsupported[p].push(f.en);
      else perPlatform[p]++;
    }
  }
  return { total: FUNCTIONS.length, perPlatform, unsupported };
}

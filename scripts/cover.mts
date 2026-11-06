/**
 * Cover image (1200x630 WebP) of a guide: colour by category, the category name, the title, an illustration that
 * fits the topic (spreadsheet, code window, file conversion) and the PerkTonic brand.
 *
 *   npx tsx scripts/cover.mts <article.md> [--out cover.webp] [--spec cover.json] [--motif sheet|code|convert]
 *
 * Everything is derived from the article (title, category slug, tools, first code blocks, error code in the title);
 * a `cover.json` next to the article can override any field of the spec (see `Spec`).
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

export interface Spec {
  title: string;
  category: string; // slug
  categoryName?: string;
  motif?: "sheet" | "code" | "convert";
  type?: string; // fix | how-to | comparison | checklist | explainer
  sub?: string;
  /** sheet */
  formula?: string;
  headers?: string[];
  rows?: string[][];
  /** [row, col, kind, text]: kind = error | ok | warn */
  hl?: [number, number, "error" | "ok" | "warn", string][];
  note?: string;
  /** code */
  lines?: string[];
  lang?: string;
  hlLine?: number;
  /** convert */
  from?: { label: string; lines: string[] };
  to?: { label: string; lines: string[] };
  seed?: string;
}

const THEMES: Record<string, { bg1: string; bg2: string; glow: string; ink: string; soft: string; pillBg: string; pillInk: string; logoBg: string; logoFg: string; dots: string; name: string }> = {
  "spreadsheet-studio": { name: "Spreadsheet & Formula Studio", bg1: "#E0A800", bg2: "#B98300", glow: "#F2BE2B", ink: "#1c1405", soft: "rgba(28,20,5,.72)", pillBg: "#1c1405", pillInk: "#F7D36B", logoBg: "#1c1405", logoFg: "#F7D36B", dots: "rgba(28,20,5,.14)" },
  "data-converters": { name: "Data Cleaning & File Converters", bg1: "#7C3AED", bg2: "#4C1D95", glow: "#A78BFA", ink: "#FFFFFF", soft: "rgba(255,255,255,.78)", pillBg: "#FFFFFF", pillInk: "#4C1D95", logoBg: "#FFFFFF", logoFg: "#5B21B6", dots: "rgba(255,255,255,.16)" },
  "document-intelligence": { name: "Document & Text Intelligence", bg1: "#DC2626", bg2: "#991B1B", glow: "#F87171", ink: "#FFFFFF", soft: "rgba(255,255,255,.8)", pillBg: "#FFFFFF", pillInk: "#991B1B", logoBg: "#FFFFFF", logoFg: "#B91C1C", dots: "rgba(255,255,255,.16)" },
  "workflow-automation": { name: "Workflow & Automation Utilities", bg1: "#D9640B", bg2: "#7C2D12", glow: "#FBBF24", ink: "#FFFFFF", soft: "rgba(255,255,255,.8)", pillBg: "#FFFFFF", pillInk: "#7C2D12", logoBg: "#FFFFFF", logoFg: "#9A3412", dots: "rgba(255,255,255,.16)" },
  "web-diagnostics": { name: "Web & Network Diagnostics", bg1: "#2563EB", bg2: "#1E3A8A", glow: "#60A5FA", ink: "#FFFFFF", soft: "rgba(255,255,255,.8)", pillBg: "#FFFFFF", pillInk: "#1E3A8A", logoBg: "#FFFFFF", logoFg: "#1D4ED8", dots: "rgba(255,255,255,.16)" },
};

const SUBS: Record<string, string> = {
  fix: "Quick fix guide · free tool included",
  "how-to": "Step-by-step guide · free tool included",
  comparison: "Side-by-side comparison · free tool included",
  checklist: "Practical checklist · free tool included",
  explainer: "Short technical explainer · free tool included",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// ------------------------------------------------------------------ from the article
export function specFromMd(md: string): Spec {
  const text = md.replace(/\r\n/g, "\n");
  const cut = text.search(/^---\s*$/m);
  const metaText = text.slice(0, cut);
  const body = text.slice(cut).replace(/^---\s*\n/, "");
  const get = (k: string) => (metaText.match(new RegExp(`^${k}: (.*)$`, "mi")) ?? [])[1]?.trim() ?? "";
  const title = get("Title");
  const category = get("Category slug") || "spreadsheet-studio";
  const tools = get("Tools").split(",").map((s) => s.trim());
  const fences = [...body.matchAll(/```(\w*)\n([\s\S]*?)```/g)].map((m) => ({ lang: m[1] || "text", lines: m[2]!.trimEnd().split("\n") }));
  const motif: Spec["motif"] = tools[0]?.match(/apps-script|vba/) ? "code" : category === "data-converters" ? "convert" : "sheet";
  const spec: Spec = { title, category, type: get("Type").toLowerCase(), motif, seed: get("Slug") };
  if (motif === "sheet") {
    const formulaLine = fences.flatMap((f) => f.lines).find((l) => l.trim().startsWith("="));
    spec.formula = (formulaLine ?? body.match(/`(=[^`]+)`/)?.[1] ?? "=SUM(C2:C500)").trim();
  } else if (motif === "code") {
    const f = [...fences].filter((x) => !/^excel$/.test(x.lang)).sort((a, b) => b.lines.length - a.lines.length)[0] ?? fences[0];
    spec.lines = (f?.lines ?? ["function run() {", "  // ...", "}"]).slice(0, 9);
    spec.lang = f?.lang && f.lang !== "text" ? f.lang : "code";
  } else {
    const multi = fences.filter((f) => f.lines.length >= 2);
    const a = multi[0], b = multi[1];
    spec.from = { label: (a?.lang === "text" ? "data" : a?.lang ?? "csv").toUpperCase(), lines: (a?.lines ?? ["id,name", "1,Ana", "2,Liam"]).slice(0, 6) };
    spec.to = { label: (b?.lang === "text" ? "result" : b?.lang ?? "json").toUpperCase(), lines: (b?.lines ?? ["[", '  { "id": 1 },', '  { "id": 2 }', "]"]).slice(0, 7) };
  }
  return spec;
}

// ------------------------------------------------------------------ illustrations
const DATASETS = [
  { h: ["Code", "Name", "Price", "Result"], r: [["A-17", "Cable", "9.90", "9.90"], ["B-02", "Lamp", "24.00", "24.00"], ["C-31", "Stand", "14.50", "14.50"]] },
  { h: ["Order", "Region", "Date", "Total"], r: [["1042", "North", "03/04", "1,180"], ["1043", "South", "03/09", "640"], ["1044", "North", "03/17", "2,310"]] },
  { h: ["ID", "Employee", "Team", "Score"], r: [["101", "Ana S.", "Sales", "87"], ["102", "Liam O.", "Ops", "92"], ["103", "Chen W.", "Sales", "78"]] },
  { h: ["SKU", "Item", "Stock", "Status"], r: [["0417", "Gloves", "120", "OK"], ["0982", "Paper", "64", "OK"], ["1233", "Soap", "105", "OK"]] },
];

function sheetHtml(s: Spec): string {
  const ds = DATASETS[hash(s.seed ?? s.title) % DATASETS.length]!;
  const headers = s.headers ?? ds.h;
  const rows = s.rows ?? ds.r;
  const errCode = s.title.match(/#(?:REF|N\/A|VALUE|NAME\?|DIV\/0|SPILL|NUM|NULL)!?/i)?.[0].toUpperCase();
  const hl = s.hl ?? (errCode ? rows.map((_, i) => [i, 3, "error", errCode.endsWith("!") || errCode.endsWith("?") || errCode === "#N/A" ? errCode : errCode + "!"] as [number, number, "error", string]) : [[0, 3, "ok", rows[0]![3]!], [1, 3, "ok", rows[1]![3]!], [2, 3, "ok", rows[2]![3]!]] as [number, number, "ok", string][]);
  const note = s.note ?? (errCode ? "Where the error comes from, and the fix" : s.type === "checklist" ? "Five checks before you share the file" : s.type === "comparison" ? "Which formula fits which spreadsheet" : "The formula, explained step by step");
  const kind = errCode ? "warn" : "ok";
  const cell = (r: number, c: number, v: string) => {
    const h = hl.find((x) => x[0] === r && x[1] === c);
    return h ? `<td class="${h[2]}">${esc(h[3])}</td>` : `<td>${esc(v)}</td>`;
  };
  const body = [headers, ...rows].map((row, ri) => `<tr><td class="rh">${ri + 1}</td>${row.map((v, ci) => (ri === 0 ? `<td class="hd">${esc(v)}</td>` : cell(ri - 1, ci, v))).join("")}</tr>`).join("");
  return `
  <div class="card sheet">
    <div class="fbar"><span class="fx">fx</span><span class="formula">${esc(clip(s.formula ?? "=SUM(C2:C500)", 36))}</span></div>
    <table><tr><th></th>${headers.map((_, i) => `<th>${String.fromCharCode(65 + i)}</th>`).join("")}</tr>${body}</table>
    <div class="strip ${kind}">${esc(clip(note, 44))}</div>
  </div>
  <div class="badge b1 ${kind}">${kind === "warn" ? `<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4.5M12 17.6v.1"/></svg>` : `<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`}</div>
  <div class="badge b2"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/></svg></div>`;
}

function colorCode(line: string): string {
  const KW = /^(function|const|let|var|return|if|else|for|while|Sub|End|Dim|As|Set|Next|Then|Not|import|def|SELECT|FROM|WHERE|GROUP|BY|ORDER|AND|OR|true|false|null|new)$/;
  const re = /(\/\/.*|'.*$|#.*$)|("[^"]*"|`[^`]*`)|([A-Za-z_]\w*)|(\d+(?:\.\d+)?)|([\s\S])/g;
  let out = "";
  for (const m of line.matchAll(re)) {
    if (m[1]) out += `<i class="c">${esc(m[1])}</i>`;
    else if (m[2]) out += `<i class="s">${esc(m[2])}</i>`;
    else if (m[3]) out += KW.test(m[3]) ? `<i class="k">${m[3]}</i>` : m[3];
    else if (m[4]) out += `<i class="n">${m[4]}</i>`;
    else out += esc(m[5]);
  }
  return out;
}
function codeHtml(s: Spec): string {
  const lines = (s.lines ?? []).slice(0, 9).map((l) => clip(l.replace(/\t/g, "  "), 40));
  const hlLine = s.hlLine ?? Math.min(2, lines.length - 1);
  return `
  <div class="card win">
    <div class="wbar"><span class="d r"></span><span class="d y"></span><span class="d g"></span><span class="tab">${esc(s.lang ?? "code")}</span></div>
    <pre>${lines.map((l, i) => `<div class="ln${i === hlLine ? " on" : ""}"><b>${i + 1}</b>${colorCode(l)}</div>`).join("")}</pre>
  </div>
  <div class="badge b1 ok"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></svg></div>`;
}
function convertHtml(s: Spec): string {
  const card = (c: { label: string; lines: string[] }, cls: string) => `<div class="card mini ${cls}"><div class="mh">${esc(clip(c.label, 12))}</div><pre>${c.lines.slice(0, 7).map((l) => `<div>${colorCode(clip(l, 24))}</div>`).join("")}</pre></div>`;
  return `${card(s.from ?? { label: "CSV", lines: [] }, "l")}${card(s.to ?? { label: "JSON", lines: [] }, "r")}
  <div class="badge b3"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6"/></svg></div>`;
}

export function coverHtml(spec: Spec): string {
  const t = THEMES[spec.category] ?? THEMES["spreadsheet-studio"]!;
  const motif = spec.motif ?? "sheet";
  const len = spec.title.length;
  const longest = Math.max(...spec.title.split(" ").reduce<string[]>((acc, w) => { const last = acc[acc.length - 1]; if (last !== undefined && (last + " " + w).length <= 18) acc[acc.length - 1] = last + " " + w; else acc.push(w); return acc; }, []).map((l) => l.length));
  const fs = len <= 34 ? 68 : len <= 46 ? 60 : 54;
  void longest;
  const ill = motif === "code" ? codeHtml(spec) : motif === "convert" ? convertHtml(spec) : sheetHtml(spec);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;overflow:hidden;position:relative;font-family:"Inter","Segoe UI",Roboto,Arial,sans-serif;color:${t.ink};
    background:radial-gradient(1100px 700px at 85% 10%,${t.glow} 0%,transparent 60%),linear-gradient(135deg,${t.bg1},${t.bg2})}
  .dots{position:absolute;inset:0;background-image:radial-gradient(${t.dots} 1.4px,transparent 1.5px);background-size:26px 26px;-webkit-mask-image:linear-gradient(90deg,transparent 0%,#000 55%)}
  .left{position:absolute;left:64px;top:56px;width:520px;height:518px;display:flex;flex-direction:column}
  .pill{align-self:flex-start;background:${t.pillBg};color:${t.pillInk};font-weight:800;font-size:19px;letter-spacing:.09em;text-transform:uppercase;padding:9px 18px;border-radius:99px}
  h1{margin-top:30px;font-size:${fs}px;line-height:1.07;font-weight:850;letter-spacing:-.025em}
  .sub{margin-top:22px;font-size:24px;font-weight:600;color:${t.soft}}
  .brand{margin-top:auto;display:flex;align-items:center;gap:14px}
  .logo{width:54px;height:54px;border-radius:15px;background:${t.logoBg};display:grid;place-items:center}
  .brand b{font-size:34px;font-weight:850;letter-spacing:-.02em}
  .url{position:absolute;right:64px;bottom:56px;font-size:23px;font-weight:700;opacity:.85}
  .card{position:absolute;background:#fff;border-radius:22px;box-shadow:0 30px 60px rgba(20,10,0,.35),0 0 0 1px rgba(0,0,0,.05);overflow:hidden}
  .sheet{right:62px;top:92px;width:470px;transform:rotate(3deg)}
  .fbar{display:flex;align-items:center;gap:12px;padding:14px 16px;background:#F4F4F5;border-bottom:1px solid #E4E4E7}
  .fx{font:italic 800 18px Georgia,serif;color:#52525B;background:#fff;border:1px solid #D4D4D8;border-radius:8px;padding:3px 10px}
  .formula{font:600 17px "Cascadia Mono",Consolas,monospace;color:#18181B;white-space:nowrap}
  table{border-collapse:collapse;width:100%;font:600 16px "Cascadia Mono",Consolas,monospace;table-layout:fixed}
  th{background:#F4F4F5;color:#71717A;font-weight:700;padding:7px;border:1px solid #E4E4E7}
  td{padding:12px;border:1px solid #E4E4E7;color:#27272A;overflow:hidden;white-space:nowrap}
  td.rh{background:#F4F4F5;color:#71717A;text-align:center;width:44px;font-weight:700}
  td.hd{font-weight:800;background:#FAFAFA}
  td.error{background:#FEE2E2;color:#B91C1C;font-weight:800;outline:3px solid #DC2626;outline-offset:-3px}
  td.ok{background:#DCFCE7;color:#166534;font-weight:800;outline:3px solid #16A34A;outline-offset:-3px}
  td.warn{background:#FEF3C7;color:#92400E;font-weight:800;outline:3px solid #D97706;outline-offset:-3px}
  .strip{padding:16px 18px;font:700 17px Inter,Arial}
  .strip.warn{background:#FFFBEB;border-top:1px solid #FDE68A;color:#92400E}
  .strip.ok{background:#F0FDF4;border-top:1px solid #BBF7D0;color:#166534}
  .badge{position:absolute;width:74px;height:74px;border-radius:50%;display:grid;place-items:center;box-shadow:0 16px 30px rgba(20,10,0,.32)}
  .b1{right:44px;top:50px}.b1.warn{background:#DC2626}.b1.ok{background:#16A34A}
  .b2{left:508px;top:372px;width:68px;height:68px;background:${t.logoBg};color:${t.logoFg}}
  .b3{left:741px;top:246px;width:78px;height:78px;background:${t.pillBg};}
  .b3 svg{stroke:${t.pillInk}}
  /* code window */
  .win{right:58px;top:96px;width:480px;background:#0F172A;transform:rotate(2deg)}
  .wbar{display:flex;align-items:center;gap:8px;padding:14px 16px;background:#1E293B}
  .d{width:13px;height:13px;border-radius:50%}.d.r{background:#F87171}.d.y{background:#FBBF24}.d.g{background:#4ADE80}
  .tab{margin-left:14px;color:#94A3B8;font:600 15px "Cascadia Mono",Consolas,monospace;text-transform:lowercase}
  .win pre{min-height:240px;padding:16px 0 18px;font:500 17px/1.62 "Cascadia Mono",Consolas,monospace;color:#E2E8F0}
  .ln{padding:0 18px;white-space:pre}.ln.on{background:rgba(250,204,21,.16);box-shadow:inset 4px 0 0 #FACC15}
  .ln b{display:inline-block;width:28px;color:#64748B;font-weight:500}
  i{font-style:normal}.k{color:#C4B5FD}.s{color:#86EFAC}.c{color:#64748B}.n{color:#FDBA74}
  /* convert */
  .mini{width:288px;top:150px;background:#0F172A}
  .mini.l{left:604px;transform:rotate(-3deg)}.mini.r{right:44px;top:200px;transform:rotate(3deg)}
  .mh{background:#1E293B;color:#E2E8F0;font:800 16px Inter,Arial;letter-spacing:.1em;padding:12px 16px}
  .mini pre{padding:14px 16px 18px;font:500 16px/1.6 "Cascadia Mono",Consolas,monospace;color:#E2E8F0}
  </style></head><body>
  <div class="dots"></div>
  <div class="left">
    <div class="pill">${esc(spec.categoryName ?? t.name)}</div>
    <h1>${esc(spec.title)}</h1>
    <div class="sub">${esc(spec.sub ?? SUBS[spec.type ?? ""] ?? "Technical guide · free tool included")}</div>
    <div class="brand"><div class="logo"><svg width="30" height="30" viewBox="0 0 24 24" fill="${t.logoFg}"><path d="M13.5 2 4 13.5h6.2L9 22l10-12.2h-6.4L13.5 2Z"/></svg></div><b>PerkTonic</b></div>
  </div>
  ${ill}
  <div class="url">perktonic.com</div>
  </body></html>`;
}

export async function renderCover(spec: Spec, out: string) {
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 })).newPage();
    await page.setContent(coverHtml(spec), { waitUntil: "load" });
    await page.evaluate(() => {
      const h = document.querySelector("h1") as HTMLElement;
      let size = parseFloat(getComputedStyle(h).fontSize);
      while (h.getBoundingClientRect().height > size * 1.07 * 3.2 && size > 40) { size -= 2; h.style.fontSize = size + "px"; }
    });
    await page.waitForTimeout(250);
    const png = await page.screenshot({ type: "png" });
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    await sharp(png).resize(1200, 630).webp({ quality: 90 }).toFile(out);
  } finally {
    await browser.close();
  }
}

// ------------------------------------------------------------------ CLI
if (process.argv[1] && /cover\.mts$/.test(process.argv[1])) {
  const args = process.argv.slice(2);
  const opt = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
  const mdPath = args.find((a) => !a.startsWith("--") && a !== opt("--out") && a !== opt("--spec") && a !== opt("--motif"));
  if (!mdPath) {
    console.error("Usage: npx tsx scripts/cover.mts <article.md> [--out cover.webp] [--spec cover.json] [--motif sheet|code|convert]");
    process.exit(1);
  }
  let spec = specFromMd(fs.readFileSync(mdPath, "utf8"));
  const specFile = opt("--spec") ?? path.join(path.dirname(path.resolve(mdPath)), "cover.json");
  if (fs.existsSync(specFile)) spec = { ...spec, ...JSON.parse(fs.readFileSync(specFile, "utf8")) };
  if (opt("--motif")) spec.motif = opt("--motif") as Spec["motif"];
  const out = opt("--out") ?? path.join(path.dirname(path.resolve(mdPath)), "cover.webp");
  await renderCover(spec, out);
  console.log("cover:", out, `(${spec.motif}, ${spec.category})`);
}

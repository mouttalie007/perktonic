/**
 * Last line of defence after Mermaid's strict mode and DOMPurify: if any of
 * these survive, the SVG is not shown or exported at all.
 */
export function findUnsafeSvg(svg: string): string[] {
  const problems: string[] = [];
  if (/<script\b/i.test(svg)) problems.push("script element");
  if (/\son[a-z]+\s*=/i.test(svg)) problems.push("event handler attribute");
  if (/(?:href|src)\s*=\s*["']?\s*javascript:/i.test(svg)) problems.push("javascript: link");
  if (/<(iframe|object|embed)\b/i.test(svg)) problems.push("embedded document");
  if (/<image\b[^>]*href\s*=\s*["']?https?:/i.test(svg)) problems.push("external image");
  return problems;
}

export interface Size {
  width: number;
  height: number;
}

/** Reads the drawing size from the viewBox (Mermaid always sets one), falling back to width/height. */
export function svgSize(svg: string): Size | null {
  const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i.exec(svg);
  if (vb) return { width: Number(vb[1]), height: Number(vb[2]) };
  const w = /\swidth\s*=\s*["']([\d.]+)(px)?["']/i.exec(svg);
  const h = /\sheight\s*=\s*["']([\d.]+)(px)?["']/i.exec(svg);
  return w && h ? { width: Number(w[1]), height: Number(h[1]) } : null;
}

// Browsers refuse canvases above roughly 16,384 px per side or ~268 million pixels (Safari: ~16.7 million).
const MAX_SIDE = 16_384;
const MAX_AREA = 16_777_216;

/** Canvas size for the PNG export: 2× the drawing, reduced proportionally if a browser limit would be hit. */
export function pngSize(size: Size, scale = 2): Size & { scale: number } {
  let s = scale;
  if (size.width * s > MAX_SIDE) s = MAX_SIDE / size.width;
  if (size.height * s > MAX_SIDE) s = Math.min(s, MAX_SIDE / size.height);
  if (size.width * size.height * s * s > MAX_AREA) s = Math.min(s, Math.sqrt(MAX_AREA / (size.width * size.height)));
  return { width: Math.max(1, Math.round(size.width * s)), height: Math.max(1, Math.round(size.height * s)), scale: s };
}

/**
 * Makes Mermaid's SVG stand alone as a file: fixed pixel width/height
 * (Mermaid uses max-width: 100%), the SVG namespace, and a background
 * rectangle so the diagram is readable in viewers with a different background.
 */
export function standaloneSvg(svg: string, background: string): string {
  const size = svgSize(svg);
  let out = svg.replace(/^\s*<\?xml[^>]*>\s*/, "");
  out = out.replace(/<svg\b([^>]*)>/i, (_m, attrs: string) => {
    let a = attrs.replace(/\sstyle\s*=\s*"[^"]*"/i, "").replace(/\s(width|height)\s*=\s*"[^"]*"/gi, "");
    if (!/xmlns=/.test(a)) a += ' xmlns="http://www.w3.org/2000/svg"';
    if (size) a += ` width="${size.width}" height="${size.height}"`;
    a += ` style="background-color: ${background}"`;
    return `<svg${a}>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n${out}`;
}

export function exportName(kind: string, ext: "svg" | "png" | "pdf" | "mmd"): string {
  return `${kind}-diagram.${ext}`;
}

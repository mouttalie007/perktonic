/** "Try an example" checks a real site whose robots.txt shows Allow/Disallow precedence and lists two sitemaps. */
export const EXAMPLE = {
  domain: "nodejs.org",
  urls: ["https://nodejs.org/dist/latest/", "https://nodejs.org/dist/v18.0.0/", "https://nodejs.org/docs/latest/api/"],
  userAgents: ["Googlebot", "GPTBot"],
};

/** A robots.txt with the cases the tests cover: several groups, wildcards, $ anchors, ties, crawl-delay and mistakes. */
export const SHOP_ROBOTS = `# Shop robots.txt
User-agent: *
Disallow: /cart
Disallow: /checkout/
Disallow: /*?sort=
Disallow: /*.pdf$
Allow: /checkout/help
Disallow: /search
Allow: /search

User-agent: Googlebot
User-agent: Bingbot
Disallow: /private/
Allow: /private/press-kit/
Crawl-delay: 5

User-agent: GPTBot
Disallow: /

User-agent: googlebot
Disallow: /drafts/

Dissallow: /typo-dir/
Noindex: /old/
Sitemap: https://shop.example.com/sitemap_index.xml
Sitemap: /relative-sitemap.xml
`;

export const URLSET = (urls: { loc: string; lastmod?: string; changefreq?: string; priority?: string }[], ns = ' xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"') =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset${ns}>\n${urls
    .map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}${u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : ""}${u.priority ? `<priority>${u.priority}</priority>` : ""}</url>`)
    .join("\n")}\n</urlset>\n`;

export const INDEX = (locs: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locs.map((l) => `  <sitemap><loc>${l}</loc><lastmod>2026-10-01</lastmod></sitemap>`).join("\n")}\n</sitemapindex>\n`;

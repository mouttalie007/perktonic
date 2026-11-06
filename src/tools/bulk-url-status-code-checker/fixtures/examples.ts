/**
 * "Try an example": a small link audit of public documentation pages, with a
 * redirect, a 404, a duplicate and a line that is not a URL. Real sites, so the
 * statuses are whatever those sites answer on the day.
 */
export const EXAMPLE_LIST = `https://nodejs.org/en
http://nodejs.org/
https://nodejs.org/en/download
https://nodejs.org/en/blog
https://nodejs.org/en/about/previous-releases
https://nodejs.org/dist/latest/
https://nodejs.org/en/this-page-does-not-exist
nodejs.org/learn/sitemap.xml
https://pypi.org/
https://pypi.org/project/requests/
https://nodejs.org/en/download#installers
not a url
`;

export const CSV_WITH_HEADER = `Page title,Address,Owner
Home,https://www.example.com/,web team
"Pricing, plans",https://www.example.com/pricing,sales
Old blog,http://example.com/blog/2019/launch,content
Contact,/contact,web team
`;

export const CSV_NO_HEADER = `https://shop.example.org/;keep
https://shop.example.org/cart;keep
https://SHOP.example.org/;duplicate in other case
`;

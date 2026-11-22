// Writes sitemap.xml: the 14 pages, then one entry per perfume page, all with the date the pages were last changed (MODIFIED in guides-build/meta.mjs).
// Run:  node seo-build/sitemap.mjs     (products.mjs and this file are run together by seo-build/build-all.mjs)
import fs from "node:fs";
import path from "node:path";
import { PRODUCTS, SITE_DIR } from "../lib/data.mjs";
import { PAGE_FILES } from "../lib/pages.mjs";
import { SITE_URL, MODIFIED } from "./shared.mjs";
import { productFile } from "./houses.mjs";

const urls = [...PAGE_FILES, ...PRODUCTS.map(productFile)].map((f) => (f === "index.html" ? SITE_URL : SITE_URL + f));
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${MODIFIED}</lastmod></url>`).join("\n")}\n</urlset>\n`;
fs.writeFileSync(path.join(SITE_DIR, "sitemap.xml"), xml);
console.log(`sitemap.xml: ${urls.length} addresses, dated ${MODIFIED}`);

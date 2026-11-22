// Small helpers shared by the guide texts: product tiles taken from the real catalogue, and the guarantee wording that the site fills in.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const SITE_DIR = path.resolve(here, "../../Perfume-website");

const w = {};
new Function("window", fs.readFileSync(path.join(SITE_DIR, "data/products-data.js"), "utf8"))(w);
export const PRODUCTS = w.PRODUCTS;
export const bySlug = new Map(PRODUCTS.map((p) => [p.s, p]));

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** the wording the site fills in from site-config.js (the static text is what shows if scripts are off) */
export const MULT = `<span data-mult-word>three times</span>`;
export const STORES = `<span data-audit-stores>Sephora, Nykaa, Shoppers Stop or Parcos</span>`;

/** a product tile: the catalogue photo, house and name; opens the catalogue searched for that perfume */
export function pick(slug) {
  const p = bySlug.get(slug);
  if (!p) throw new Error(`no product ${slug}`);
  for (const f of [`assets/images/thumbs/${slug}.jpg`]) if (!fs.existsSync(path.join(SITE_DIR, f))) throw new Error(`missing photo ${f}`);
  return `<li><a class="pick" href="perfume-${p.s}.html"><span class="pick-img"><img src="assets/images/thumbs/${slug}.jpg" alt="" width="240" height="240" loading="lazy" decoding="async"></span><span class="pick-text"><span class="pick-house">${esc(p.b)}</span><span class="pick-name">${esc(p.n)}</span><span class="pick-go">See sizes and details</span></span></a></li>`;
}
export const picks = (slugs) => `<ul class="picks" aria-label="Examples from the catalogue">${slugs.map(pick).join("")}</ul>`;

/** a real mini photo with a caption */
export function mini(key, title, text) {
  if (!fs.existsSync(path.join(SITE_DIR, `assets/images/minis/${key}.jpg`))) throw new Error(`missing mini photo ${key}`);
  return `<li><figure><img src="assets/images/minis/${key}.jpg" alt="${esc(title)}: ${esc(text)}" width="800" height="800" loading="lazy" decoding="async"><figcaption><b>${esc(title)}</b>${esc(text)}</figcaption></figure></li>`;
}

export const fam = (name) => `catalogue.html?fm=${encodeURIComponent(name)}`;

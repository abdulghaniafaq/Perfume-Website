// Builds perfumes.html: every perfume in plain HTML, A to Z by house, straight from data/products-data.js.
// Why: the catalogue page is drawn by JavaScript, and the crawlers behind ChatGPT, Claude and Perplexity do not run JavaScript, so they
// see an empty grid there. This page gives them (and people with scripts off) the full list, with sizes and prices, as ordinary text.
// Run:  node seo-build/perfumes.mjs      (run it again whenever products or prices change; aeo.test.mjs fails if the page is out of date)
import fs from "node:fs";
import path from "node:path";
import { PRODUCTS, SITE, SITE_DIR } from "../lib/data.mjs";
import { fmtPrice } from "../lib/oracle.mjs";
import { shell, abs, esc, orgMin, website, breadcrumb, webpage, graph } from "./shared.mjs";

import { HOUSES, productLine } from "./houses.mjs";

const houses = HOUSES;
const prices = PRODUCTS.flatMap((p) => p.v.map((v) => v.pr));
const minis = PRODUCTS.flatMap((p) => p.v).filter((v) => v.g === "Minis");
const fromVial = fmtPrice(Math.min(...minis.map((v) => v.pr)));
const gaps = [];
for (const p of PRODUCTS) for (const t of p.v.filter((v) => v.g === "Tester")) { const r = p.v.find((v) => v.g === "Retail" && v.mln === t.mln && v.pr > 0); if (r) gaps.push((1 - t.pr / r.pr) * 100); }
gaps.sort((a, b) => a - b);

const n = PRODUCTS.length, h = houses.length;
const file = "perfumes.html";
const title = "All perfumes, A–Z by house";
const desc = `Every perfume we sell, A to Z by house: ${n} fragrances from ${h} designer, luxury and Middle-Eastern houses, with sizes, packaging and prices in INR.`;

const main = `
    <section class="page-head">
      <div class="wrap">
        <p class="eyebrow">The full list</p>
        <h1>All perfumes, A–Z by house</h1>
        <p class="section-sub">Every fragrance we sell, as plain text: ${n} perfumes from ${h} houses, with the sizes we have and their prices in INR. Select a perfume's name to see its own page: sizes, prices, when to wear it and how to order. Or <a href="catalogue.html">open the catalogue</a> for pictures and filters.</p>
      </div>
    </section>

    <section class="section section-tight">
      <div class="wrap">
        <div class="glance">
          <h2 class="glance-title">At a glance</h2>
          <ul>
            <li><b>${n}</b> fragrances from <b>${h}</b> houses: designer, luxury and niche, and Middle Eastern.</li>
            <li>Sizes and packaging: <b>Retail</b> (boxed full-size bottle), <b>Tester</b> (the same fragrance in plain packaging), and <b>minis, vials and sets</b>. Vials start at <b>${fromVial}</b>.</li>
            <li>Prices are in INR and were last updated <span data-updated>${esc(SITE.pricesUpdated)}</span>. Stock changes, so we confirm availability and the final total with you on WhatsApp before you pay.</li>
            <li>Where a tester and the retail bottle of the same size are both listed, the tester is typically <b>10–30% cheaper</b> (about 20% in the middle).</li>
            <li>Where a perfume reads “Inspired by”, it is an original creation of the house named, which shares a scent profile with the designer fragrance named, listed for reference only. It is not a copy or repackaging of that fragrance.</li>
          </ul>
        </div>

        <nav class="house-jump" aria-label="Jump to a house">
          <ul>${houses.map((x) => `<li><a href="#${x.id}">${esc(x.name)}</a></li>`).join("")}</ul>
        </nav>

        <div class="houses">
${houses.map((x) => `          <section class="house" id="${x.id}" aria-labelledby="${x.id}-h">
            <h2 id="${x.id}-h">${esc(x.name)}</h2>
            <p class="house-meta">${x.style ? `${esc(x.style)} · ` : ""}${x.products.length} ${x.products.length === 1 ? "perfume" : "perfumes"} · <a class="house-link" href="catalogue.html?q=${encodeURIComponent(x.name)}">See ${esc(x.name)} in the catalogue</a></p>
            <ul class="plist">
${x.products.map((p) => `              <li>${productLine(p)}</li>`).join("\n")}
            </ul>
          </section>`).join("\n")}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="cta-band">
          <h2>Found something you like?</h2>
          <p>Open the catalogue to see pictures and add it to your cart, or message us and we'll help you choose.</p>
          <div class="cta-row"><a class="btn btn-gold" href="catalogue.html">Browse the catalogue</a><a class="btn btn-ghost" data-wa="Hi! I have a question about your perfumes." href="contact.html">Message us on WhatsApp</a></div>
        </div>
      </div>
    </section>`;

const jsonld = graph([
  orgMin(), website(),
  webpage({ file, type: "CollectionPage", name: `${title} — Perfume X Collections`, description: desc, extra: { mainEntity: { "@id": `${abs(file)}#houses` } } }),
  breadcrumb(file, [["Home", abs("")], ["All perfumes", abs(file)]]),
  { "@type": "ItemList", "@id": `${abs(file)}#houses`, name: "Perfume houses sold by Perfume X Collections", numberOfItems: houses.length, itemListOrder: "https://schema.org/ItemListOrderAscending", itemListElement: houses.map((x, i) => ({ "@type": "ListItem", position: i + 1, name: x.name, url: `${abs(file)}#${x.id}` })) },
]);

fs.writeFileSync(path.join(SITE_DIR, file), shell({ file, title, desc, jsonld, css: ["perfumes.css"], main }));
console.log(`${file}: ${n} perfumes, ${h} houses, ${(fs.statSync(path.join(SITE_DIR, file)).size / 1024).toFixed(0)} KB; tester gap median ${gaps[Math.floor(gaps.length / 2)].toFixed(1)}% from ${gaps.length} pairs; price range ${fmtPrice(Math.min(...prices))} to ${fmtPrice(Math.max(...prices))}`);

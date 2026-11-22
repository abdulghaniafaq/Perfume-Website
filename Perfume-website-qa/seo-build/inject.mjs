// For the pages that are written by hand (home, catalogue, how to order, guarantee, FAQ, contact, privacy, terms):
//   - adds (or refreshes) the structured data (JSON-LD) that tells search engines and AI assistants who the shop is and what each page is,
//   - adds the robots tag that allows long snippets and large pictures,
//   - makes sure the footer links to "All perfumes".
// The FAQ questions in the structured data are read FROM the page's own boxes, so the markup and the visible text cannot differ.
// Safe to run again at any time.   Run:  node seo-build/inject.mjs
import fs from "node:fs";
import path from "node:path";
import { PRODUCTS, SITE_DIR } from "../lib/data.mjs";
import { fmtPrice } from "../lib/oracle.mjs";
import { abs, SITE_URL, ORG_ID, orgMin, website, breadcrumb, webpage, faqNode, graph, jsonScript, plain, ROBOTS_META } from "./shared.mjs";

const PAGES = {
  "index.html": { home: true },
  "catalogue.html": { type: "CollectionPage", trail: ["Catalogue"], extra: { significantLink: [abs("perfumes.html")] } },
  "how-to-order.html": { trail: ["How to order"] },
  "guarantee.html": { trail: ["Authenticity guarantee"] },
  "faq.html": { trail: ["FAQ"], faq: true },
  "contact.html": { type: "ContactPage", trail: ["Contact"] },
  "privacy.html": { trail: ["Privacy Policy"] },
  "terms.html": { trail: ["Terms of Service"] },
};

const houses = [...new Set(PRODUCTS.map((p) => p.b))].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
const prices = PRODUCTS.flatMap((p) => p.v.map((v) => v.pr));
const shopNode = () => ({
  ...orgMin(),
  description: "Designer, luxury and Middle-Eastern perfumes sold at insider prices, ordered on WhatsApp across India.",
  slogan: "The scent you love, at the price it should be.",
  areaServed: "IN", currenciesAccepted: "INR",
  priceRange: `${fmtPrice(Math.min(...prices))} - ${fmtPrice(Math.max(...prices))}`,
  knowsAbout: ["Designer perfumes", "Luxury and niche perfumes", "Middle-Eastern perfumes", "Perfume testers, minis, vials and decants", "Spotting counterfeit perfume"],
  brand: houses.map((name) => ({ "@type": "Brand", name })),
  hasOfferCatalog: { "@type": "OfferCatalog", name: "Perfumes", url: abs("catalogue.html"), numberOfItems: PRODUCTS.length },
});

for (const [file, cfg] of Object.entries(PAGES)) {
  const f = path.join(SITE_DIR, file);
  let html = fs.readFileSync(f, "utf8");
  const name = html.match(/<title>([^<]*)<\/title>/)[1].replace(/&amp;/g, "&");
  const desc = html.match(/<meta name="description" content="([^"]*)"/)[1].replace(/&amp;/g, "&");
  const nodes = [];
  if (cfg.home) {
    nodes.push(shopNode(), website(), webpage({ file, name, description: desc, extra: { primaryImageOfPage: { "@type": "ImageObject", url: abs("assets/images/og-image.jpg") }, mainEntity: { "@id": ORG_ID } } }));
  } else {
    nodes.push(orgMin(), website(), webpage({ file, type: cfg.type || "WebPage", name, description: desc, extra: cfg.extra || {} }), breadcrumb(file, [["Home", abs("")], [cfg.trail[0], abs(file)]]));
  }
  if (cfg.faq) {
    const qa = [...html.matchAll(/<details>\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>\s*<\/details>/g)].map((m) => [m[1], m[2]]);
    if (qa.length < 10) throw new Error(`only ${qa.length} questions found in ${file}`);
    nodes.push(faqNode(file, qa));
  }
  // 1. structured data: drop any earlier block (this script's, or the old hand-written one on the home page), then put the new one before the theme script
  html = html.replace(/\n?[ \t]*<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g, "");
  html = html.replace(/(\n  <script>\(function\(\)\{var d=document\.documentElement)/, `\n  ${jsonScript(graph(nodes))}$1`);
  // 2. robots tag (after the description)
  if (!/name="robots"/.test(html)) html = html.replace(/(<meta name="description" content="[^"]*">)/, `$1\n  <meta name="robots" content="${ROBOTS_META}">`);
  // 3. footer link
  if (!/<nav class="foot-nav"[\s\S]*?href="perfumes\.html"/.test(html)) html = html.replace(/(<nav class="foot-nav"[\s\S]*?<a href="guides\.html">Guides<\/a>)/, `$1\n        <a href="perfumes.html">All perfumes</a>`);
  fs.writeFileSync(f, html);
}
console.log("updated:", Object.keys(PAGES).join(", "));

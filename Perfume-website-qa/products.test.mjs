// The 627 perfume pages (perfume-<name>.html).
//   A  every page, straight from the files and compared with data/products-data.js: name, house, every size, exact price, price per ml, the tester saving,
//      the cart key of each size, the structured data (Product + offers, FAQ, breadcrumb), the FAQ markup = the visible text, links, headings, head tags
//   B  the "when to wear it" guidance against an independent copy of the rules (scent family + strength), and the notes against the verified notes file
//   C  in a browser, on a sample that covers every kind of page: loads clean; Add puts the right bottle in the cart (and survives a reload); Order on
//      WhatsApp sends the same message as the catalogue; how a visitor lands on a perfume page (catalogue card, A-Z list, breadcrumbs, neighbours);
//      keyboard; phone layout and tap sizes; with scripts off; on paper
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SITE, PRODUCTS, SITE_DIR } from "./lib/data.mjs";
import { launch, openPage } from "./lib/browser.mjs";
import { serve } from "./lib/server.mjs";
import { PRODUCT_FILES, PRODUCT_SAMPLE, productFile } from "./lib/pages.mjs";
import { fmtPrice, segmentOf } from "./lib/oracle.mjs";

const BASE = "https://perfume-x-collections.netlify.app/";
const read = (f) => fs.readFileSync(path.join(SITE_DIR, f), "utf8");
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
const textOf = (html) => decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
const words = (s) => s.split(/\s+/).filter(Boolean).length;
const keyOf = (p, v) => [p.s, v.m, v.p, v.r].join("|");
const bySize = (p) => [...p.v].sort((a, b) => a.pr - b.pr);   // the page lists sizes cheapest first, like the catalogue card
const label = (v) => `${[v.m, v.p].filter(Boolean).join(" ")}${v.r && !/^\d{4}-\d{2}-\d{2}/.test(v.r) ? ` (${v.r})` : ""}`;
const idsOf = (html) => [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const NOTES = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "seo-build/details/notes.json"), "utf8"));
const PUBLISHED = Object.fromEntries(Object.entries(NOTES).filter(([, v]) => v.confidence === "high"));
const PHONE = SITE.contact.whatsapp.slice(-10);
const SEASONS = ["Spring", "Summer", "Monsoon", "Autumn", "Winter"];

const PAGES = PRODUCTS.map((p) => ({ p, f: productFile(p), html: read(productFile(p)) }));
const section = (html, id) => (html.match(new RegExp(`<section class="p-sec" id="${id}"[\\s\\S]*?</section>`)) || [""])[0];
const ldOf = (html) => { const m = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]; assert.equal(m.length, 1); return JSON.parse(m[0][1])["@graph"]; };
const node = (g, t) => g.find((n) => [].concat(n["@type"]).includes(t));
const first = (arr, n = 5) => arr.slice(0, n);

describe("the perfume pages", () => {
  /* ======================================================================== A */
  describe("A. every one of the 627 pages is exactly what the data says", () => {
    test("there is one page per perfume and no other perfume page", () => {
      assert.equal(PAGES.length, 627); assert.equal(new Set(PRODUCT_FILES).size, 627);
      assert.deepEqual(fs.readdirSync(SITE_DIR).filter((f) => /^perfume-[a-z0-9-]+\.html$/.test(f)).sort(), [...PRODUCT_FILES].sort());
    });

    test("name, house and every size: the heading, each size's cart key, label, exact price, price per ml, tester saving and what you get", () => {
      const bad = [];
      for (const { p, f, html } of PAGES) {
        const h1 = textOf(html.match(/<h1>([\s\S]*?)<\/h1>/)[1]);
        if (h1 !== `${p.b} ${p.n}`) bad.push(`${f}: h1 "${h1}"`);
        if ((html.match(/<h1>/g) || []).length !== 1) bad.push(`${f}: h1 count`);
        const rows = [...section(html, "sizes").matchAll(/<li class="size" data-key="([^"]*)">([\s\S]*?)<\/li>/g)];
        if (rows.length !== p.v.length) { bad.push(`${f}: ${rows.length} sizes, data has ${p.v.length}`); continue; }
        bySize(p).forEach((v, i) => {
          const [, key, body] = rows[i], t = textOf(body);
          if (decode(key) !== keyOf(p, v)) bad.push(`${f}: key ${key}`);
          if (!t.startsWith(label(v))) bad.push(`${f}: label "${t.slice(0, 40)}" vs "${label(v)}"`);
          if (!t.includes(`Our price ${fmtPrice(v.pr)}`)) bad.push(`${f}: price of ${label(v)}`);
          if (v.mp > v.pr && !t.includes(`Market price ${fmtPrice(v.mp)}`)) bad.push(`${f}: market price`);
          if (v.mln > 0 ? !t.includes(`${fmtPrice(Math.round(v.pr / v.mln))} per ml`) : /per ml/.test(t)) bad.push(`${f}: per ml of ${label(v)}`);
          const r = v.g === "Tester" && p.v.find((x) => x.g === "Retail" && x.mln === v.mln && x.pr > 0);
          if (r ? !t.includes(`${fmtPrice(r.pr - v.pr)} (${Math.round((1 - v.pr / r.pr) * 100)}%) less than the retail`) : /less than the retail/.test(t)) bad.push(`${f}: tester saving of ${label(v)}`);
          if ((v.g === "Tester") !== /A tester: the same fragrance/.test(t)) bad.push(`${f}: tester explanation`);
          if ((v.g === "Minis") !== /not the full-size bottle shown in the photo|travel spray|dab-on|sample vial|roller-ball|small-size pack/.test(t)) bad.push(`${f}: mini explanation of ${label(v)}`);
          if (!/<button type="button" class="p-add" aria-label="Add [^"]+, to cart">Add<\/button>/.test(body)) bad.push(`${f}: Add button`);
          if (!/Order on WhatsApp<span class="sr-only"> for /.test(body)) bad.push(`${f}: Order link`);
        });
      }
      assert.deepEqual(first(bad), []);
    });

    test("the structured data: a Product with the right brand, picture and sku, an AggregateOffer with every size at its exact price in INR, breadcrumbs, and an ItemPage that matches the page", () => {
      const bad = [];
      for (const { p, f, html } of PAGES) {
        const g = ldOf(html), url = BASE + f;
        const pr = node(g, "Product"), page = node(g, "ItemPage"), bc = node(g, "BreadcrumbList"), org = node(g, "OnlineStore");
        const title = decode(html.match(/<title>([^<]*)<\/title>/)[1]), desc = decode(html.match(/<meta name="description" content="([^"]*)"/)[1]);
        if (!pr || !page || !bc || !org) { bad.push(`${f}: missing nodes`); continue; }
        if (pr.name !== `${p.b} ${p.n}` || pr.brand.name !== p.b || pr.sku !== p.s || pr.url !== url) bad.push(`${f}: product fields`);
        if (!fs.existsSync(path.join(SITE_DIR, pr.image[0].replace(BASE, "")))) bad.push(`${f}: picture`);
        const o = pr.offers, prices = p.v.map((v) => v.pr), sorted = bySize(p);
        if (o["@type"] !== "AggregateOffer" || o.priceCurrency !== "INR" || o.lowPrice !== Math.min(...prices) || o.highPrice !== Math.max(...prices) || o.offerCount !== p.v.length) bad.push(`${f}: aggregate offer`);
        if (o.offers.length !== p.v.length || o.offers.some((x, i) => x.price !== sorted[i].pr || x.priceCurrency !== "INR" || x.name !== label(sorted[i]))) bad.push(`${f}: offers`);
        if (JSON.stringify(pr).includes("availability") || JSON.stringify(pr).includes("aggregateRating") || JSON.stringify(pr).includes("review")) bad.push(`${f}: claims stock or reviews it does not have`);
        if (p.fm && pr.category !== p.fm) bad.push(`${f}: category`);
        if (page.url !== url || page.name !== title || page.description !== desc || page.mainEntity["@id"] !== `${url}#product`) bad.push(`${f}: page node`);
        const items = bc.itemListElement;
        if (items.length !== 4 || items[0].item !== BASE || items[1].item !== `${BASE}perfumes.html` || items[2].name !== p.b || items[3].item !== url) bad.push(`${f}: breadcrumb`);
        if (org["@id"] !== `${BASE}#organization`) bad.push(`${f}: shop id`);
        const raw = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)[1];
        if (raw.includes(PHONE) || /localhost|undefined|NaN/.test(raw)) bad.push(`${f}: stray text in the data`);
      }
      assert.deepEqual(first(bad), []);
    });

    test("the FAQ in the markup is word for word the questions and answers on the page (three each), and the answers' facts are the data's", () => {
      const bad = [];
      for (const { p, f, html } of PAGES) {
        const marked = node(ldOf(html), "FAQPage").mainEntity.map((q) => [q.name, q.acceptedAnswer.text]);
        const seen = [...section(html, "questions").matchAll(/<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)].map((m) => [textOf(m[1]), textOf(m[2])]);
        if (JSON.stringify(seen) !== JSON.stringify(marked)) bad.push(`${f}: markup differs from the page`);
        if (marked.length !== 3 || !marked.every(([q]) => q.endsWith("?"))) bad.push(`${f}: questions`);
        const lo = p.v.reduce((a, b) => (b.pr < a.pr ? b : a));
        if (!marked[0][1].includes(`from ${fmtPrice(lo.pr)} (${[lo.m, lo.p].filter(Boolean).join(" ")})`) || !p.v.every((v) => marked[0][1].includes(`${label(v)} ${fmtPrice(v.pr)}`))) bad.push(`${f}: price answer`);
        if (!marked[1][1].includes("100% authentic") || !marked[1][1].includes(`within ${SITE.guarantee.claimDays} days`) || !marked[1][1].includes("three times")) bad.push(`${f}: genuine answer`);
      }
      assert.deepEqual(first(bad), []);
    });

    test("the Quick answer: 15 to 70 words, names the perfume and states the guarantee (and no longer carries the 'In India it costs from' sentence anywhere on the page, in the text or the structured data), and is the first thing after the heading", () => {
      const bad = [];
      for (const { p, f, html } of PAGES) {
        const m = html.match(/<div class="quick"><p class="quick-title">Quick answer<\/p><p>([\s\S]*?)<\/p><\/div>/);
        if (!m) { bad.push(`${f}: no quick answer`); continue; }
        const q = textOf(m[1]);
        if (words(q) < 15 || words(q) > 70) bad.push(`${f}: ${words(q)} words`);
        if (!q.startsWith(`${p.b} ${p.n} is a`) || !q.includes("genuine") || !q.includes("three times")) bad.push(`${f}: content`);
        if (/In India it costs from/i.test(html)) bad.push(`${f}: still says "In India it costs from"`);
        if (html.indexOf('class="quick"') < html.indexOf("</h1>")) bad.push(`${f}: before the heading`);
      }
      assert.deepEqual(first(bad), []);
    });

    test("head tags: a clear unique title and description, canonical, share picture (the perfume's own 800×800 photo), snippet permissions", () => {
      const titles = new Set(), descs = new Set(), bad = [];
      for (const { p, f, html } of PAGES) {
        const title = decode(html.match(/<title>([^<]*)<\/title>/)[1]), desc = decode(html.match(/<meta name="description" content="([^"]*)"/)[1]);
        if (!title.endsWith(" — Perfume X Collections") || !title.includes(`${p.b} ${p.n}`) || title.length > 100) bad.push(`${f}: title (${title.length})`);
        if (desc.length < 60 || desc.length > 165 || !desc.includes(`${p.b} ${p.n}`)) bad.push(`${f}: description (${desc.length})`);
        if (titles.has(title) || descs.has(desc)) bad.push(`${f}: duplicate`); titles.add(title); descs.add(desc);
        if (html.match(/<link rel="canonical" href="([^"]*)"/)[1] !== BASE + f || html.match(/property="og:url" content="([^"]*)"/)[1] !== BASE + f) bad.push(`${f}: canonical`);
        if (html.match(/property="og:image" content="([^"]*)"/)[1] !== `${BASE}assets/images/${p.s}.jpg` || !/property="og:image:width" content="800"/.test(html) || !/name="twitter:card" content="summary"/.test(html)) bad.push(`${f}: share picture`);
        if (!/name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"/.test(html)) bad.push(`${f}: robots`);
        if (!/<html lang="en">/.test(html)) bad.push(`${f}: lang`);
      }
      assert.deepEqual(first(bad), []);
    });

    test("structure: headings never skip a level, ids are unique, every picture has a size, the photo has a description, the sections are all there", () => {
      const bad = [];
      for (const { p, f, html } of PAGES) {
        const lv = [...html.replace(/<script[\s\S]*?<\/script>|<svg[\s\S]*?<\/svg>/g, "").matchAll(/<h([1-6])[\s>]/g)].map((m) => +m[1]);
        if (lv.some((h, i) => i && h > lv[i - 1] + 1) || lv[0] !== 1) bad.push(`${f}: heading levels ${lv.join("")}`);
        const ids = idsOf(html); if (new Set(ids).size !== ids.length) bad.push(`${f}: duplicate ids`);
        for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/ width="\d+"/.test(m[0]) || !/ height="\d+"/.test(m[0]) || !/ alt="/.test(m[0])) bad.push(`${f}: picture without size or alt`);
        if (!new RegExp(`<img src="assets/images/${p.s}\\.jpg" alt="[^"]*${p.n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/&/g, "(?:&|&amp;)").replace(/'/g, "(?:'|&#39;)")}[^"]*bottle"`).test(html)) bad.push(`${f}: photo description`);
        const hasHouseMates = PRODUCTS.some((x) => x.b === p.b && x !== p);   // a one-perfume house has no "More from" block
        for (const id of ["sizes", "about", "glance", "wear", "notes", "questions", "similar-h", ...(hasHouseMates ? ["more-h"] : [])]) if (!ids.includes(id)) bad.push(`${f}: no #${id}`);
      }
      assert.deepEqual(first(bad), []);
    });

    test("links: every internal link resolves (page and #section), no link leaves the site, no phone number, no stray text", () => {
      const bad = [], cache = {};
      const idsFor = (f) => (cache[f] ||= new Set(idsOf(read(f))));
      for (const { p, f, html } of PAGES) {
        const body = html.slice(html.indexOf("<body")).replace(/<script[\s\S]*?<\/script>/g, "");   // (the head holds the canonical address and the font links)
        for (const m of body.matchAll(/\shref="([^"]+)"/g)) {
          const h = decode(m[1]);
          if (/^(https?:|mailto:|tel:|data:)/.test(h)) { if (!/^data:/.test(h)) bad.push(`${f}: leaves the site: ${h}`); continue; }
          const [file0, hash] = h.split("#"), file = (file0 || f).split("?")[0] || f;
          if (!fs.existsSync(path.join(SITE_DIR, file))) bad.push(`${f}: ${h} is not a file`);
          else if (hash && !idsFor(file).has(hash)) bad.push(`${f}: ${h} has no such section`);
        }
        for (const m of body.matchAll(/\ssrc="([^"]+)"/g)) if (!/^(https?:|data:)/.test(m[1]) && !fs.existsSync(path.join(SITE_DIR, m[1]))) bad.push(`${f}: missing ${m[1]}`);
        if (html.includes(PHONE) || /localhost|127\.0\.0\.1/.test(html)) bad.push(`${f}: phone number or local address`);
        if (/\b(undefined|NaN|TODO|\[object)\b|\{\{|&amp;amp;/.test(textOf(html))) bad.push(`${f}: stray text`);
        if ((body.match(/\shref="perfume-[^"]+"/g) || []).length < 6) bad.push(`${f}: fewer than 6 links to other perfumes`);
      }
      assert.deepEqual(first(bad), []);
    });

    test("neighbours: 'More from the house' lists only that house's perfumes (and is left out when the house has no other), 'Similar perfumes' always offers six from other houses, the closest matches first, never the page itself, every tile with its real lowest price", () => {
      const bad = [];
      const low = (q) => fmtPrice(Math.min(...q.v.map((v) => v.pr)));
      const bySlug = (s) => PRODUCTS.find((x) => x.s === s);
      const seg = (q) => segmentOf(q.b);
      // the strength named in a perfume's name, written out independently of the generator ("" when the name states none)
      const strengthLabel = (n) => /\b(Pure Parfum|Parfum|Extrait)\b/i.test(n) ? "Parfum" : /\bElixir\b/i.test(n) ? "Elixir" : /\b(EDC|Cologne)\b/i.test(n) ? "EDC" : /\bEDP\b/i.test(n) ? (/\b(Intense|Extreme|Extra)\b/i.test(n) ? "EDP+" : "EDP") : /\bEDT\b/i.test(n) ? (/\b(Intense|Extreme)\b/i.test(n) ? "EDT+" : "EDT") : "";
      for (const { p, f, html } of PAGES) {
        const more = html.match(/<section class="section section-alt"[\s\S]*?<\/section>/)[0];
        const tiles = (ul) => (ul ? [...ul[1].matchAll(/<a class="rel-tile" href="perfume-([^"]+)\.html">[\s\S]*?From ([^<]+)<\/span>/g)].map((x) => [x[1], decode(x[2])]) : null);
        const houseUl = more.match(/<h2 id="more-h"[\s\S]*?<ul class="rel">([\s\S]*?)<\/ul>/);
        const simUl = more.match(/<h2 id="similar-h"[\s\S]*?<ul class="rel">([\s\S]*?)<\/ul>/);
        const house = tiles(houseUl), sim = tiles(simUl);
        const inHouse = PRODUCTS.filter((x) => x.b === p.b).length - 1;
        // the house list: only this house, never itself, the right count; no list at all (and no empty heading) when the house has no other perfume
        if (inHouse === 0) { if (house || /id="more-h"/.test(more)) bad.push(`${f}: a house block for a one-perfume house`); }
        else {
          if (!house || house.length !== Math.min(6, inHouse)) bad.push(`${f}: ${house && house.length} house tiles, expected ${Math.min(6, inHouse)}`);
          for (const [s, price] of house || []) { const q = bySlug(s); if (!q || q.b !== p.b || s === p.s || price !== low(q)) bad.push(`${f}: house tile ${s}`); }
        }
        // the similar list: six, other houses, no repeats, real prices
        if (!sim || sim.length !== 6) { bad.push(`${f}: ${sim && sim.length} similar tiles, expected 6`); continue; }
        if (new Set(sim.map(([s]) => s)).size !== 6) bad.push(`${f}: a perfume listed twice`);
        for (const [s, price] of sim) { const q = bySlug(s); if (!q || q.b === p.b || s === p.s || price !== low(q)) bad.push(`${f}: similar tile ${s}`); }
        // closest first: with a family, every family perfume of another house comes before any other kind (all six are family when there are six or more)
        const famPool = p.fm ? PRODUCTS.filter((x) => x.fm === p.fm && x.b !== p.b) : [];
        const tier1 = p.fm ? famPool : PRODUCTS.filter((x) => !x.fm && x.b !== p.b && seg(x) === seg(p) && strengthLabel(x.n) === strengthLabel(p.n));
        const inTier1 = sim.filter(([s]) => tier1.includes(bySlug(s))).length;
        if (inTier1 !== Math.min(6, tier1.length)) bad.push(`${f}: ${inTier1} closest matches, expected ${Math.min(6, tier1.length)}`);
        sim.slice(0, inTier1).forEach(([s]) => { if (!tier1.includes(bySlug(s))) bad.push(`${f}: closest matches are not first`); });
        // when the wider groups are used, a perfume of the same style is chosen over one of another style while the style has any left
        const sameStyleLeft = PRODUCTS.filter((x) => x.b !== p.b && seg(x) === seg(p)).length;
        if (sameStyleLeft >= 6 && sim.some(([s]) => seg(bySlug(s)) !== seg(p)) && !(p.fm && tier1.length >= inTier1 && sim.every(([s]) => bySlug(s).fm === p.fm))) bad.push(`${f}: a perfume of another style while the style has enough`);
        // the heading tells the truth: "More <family> perfumes" only when every tile is of that family
        const head = more.match(/<h2 id="similar-h"[^>]*>([^<]*)</)[1];
        const allFam = !!p.fm && sim.every(([s]) => bySlug(s).fm === p.fm);
        if (head !== (allFam ? `More ${decode(p.fm)} perfumes` : "Similar perfumes") && head !== (allFam ? `More ${p.fm} perfumes`.replace(/&/g, "&amp;") : "Similar perfumes")) bad.push(`${f}: heading "${head}"`);
        // the section is named by its first heading
        const named = more.match(/aria-labelledby="([^"]+)"/)[1];
        if (named !== (inHouse ? "more-h" : "similar-h")) bad.push(`${f}: section named by ${named}`);
      }
      assert.deepEqual(first(bad), []);
    });

    test("'Where it sits in our range': every figure is recomputed from the catalogue (lowest full-size price, its rank and the middle price in the house and in the style, the other versions of the line, the perfumes inspired by the same one); a perfume with no full-size bottle is never ranked", () => {
      const bad = [];
      const low = (q) => { const xs = q.v.filter((v) => parseFloat(v.m) >= 30).map((v) => v.pr); return xs.length ? Math.min(...xs) : null; };
      const mid = (xs) => { const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
      const lineOf = (q) => (q.n.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").match(/[\p{L}\p{N}]+/gu) || []).find((w) => !["the", "eau", "le", "la", "l", "d", "pour", "de", "du", "for", "by", "of", "and", "new", "un", "une", "des"].includes(w)) || "";
      const STYLE_NAME = { designer: "Designer", luxury: "Luxury & niche", arabian: "Middle Eastern" };
      let withHouse = 0, withSeg = 0, withLine = 0, withInsp = 0, none = 0;
      for (const { p, f, html } of PAGES) {
        const sec = html.match(/<section class="p-sec" id="range"[\s\S]*?<\/section>/);
        const mates = PRODUCTS.filter((q) => q.b === p.b && low(q) != null), seg = PRODUCTS.filter((q) => segmentOf(q.b) === segmentOf(p.b) && low(q) != null);
        const line = PRODUCTS.filter((q) => q.b === p.b && q !== p && lineOf(q) && lineOf(q) === lineOf(p)).sort((a, b) => a.n.localeCompare(b.n));
        const insp = p.i ? PRODUCTS.filter((q) => q !== p && q.i && q.i.trim().toLowerCase() === p.i.trim().toLowerCase() && !line.includes(q)).sort((a, b) => a.s.localeCompare(b.s)) : [];
        const wantHouse = low(p) != null && mates.length >= 3, wantSeg = low(p) != null && !!STYLE_NAME[segmentOf(p.b)] && seg.length >= 10;
        const expectSection = wantHouse || wantSeg || line.length || insp.length;
        if (!expectSection) { none++; if (sec) bad.push(`${f}: a range section with nothing to say`); continue; }
        if (!sec) { bad.push(`${f}: no range section`); continue; }
        const s = sec[0], text = textOf(s);
        if (!/<h2 id="range-h">Where it sits in our range<\/h2>/.test(s)) bad.push(`${f}: heading`);
        const rowOf = (label) => { for (const m of s.matchAll(/<dt>([^<]*)<\/dt><dd>([\s\S]*?)<\/dd>/g)) if (decode(m[1]) === label) return m[2]; return null; };
        // the house row
        const hr = rowOf(`In the ${p.b} range`);
        if (wantHouse) {
          withHouse++;
          const prices = mates.map(low), rank = 1 + prices.filter((x) => x < low(p)).length;
          const want = `The lowest full-size price of ${p.n} (a bottle of 30ml or more, testers included) is ${fmtPrice(low(p))}. That is number ${rank} of the ${mates.length} ${p.b} perfumes we list in full size, counting from the cheapest. The house runs from ${fmtPrice(Math.min(...prices))} to ${fmtPrice(Math.max(...prices))}, with a middle price of ${fmtPrice(mid(prices))}.`;
          if (!hr || textOf(hr) !== want) bad.push(`${f}: house row is "${hr && textOf(hr)}", expected "${want}"`);
        } else if (hr) bad.push(`${f}: a house ranking where there is nothing to rank`);
        // the style row
        const sr = rowOf(`Among ${STYLE_NAME[segmentOf(p.b)] || "-"} perfumes`);
        if (wantSeg) {
          withSeg++;
          const prices = seg.map(low), n = seg.length - 1;
          const below = Math.round((100 * prices.filter((x) => x < low(p)).length) / n), above = Math.round((100 * prices.filter((x) => x > low(p)).length) / n);
          const want = `Among the ${seg.length} ${STYLE_NAME[segmentOf(p.b)]} perfumes we list in full size, that price is higher than ${below}% of them and lower than ${above}% (the middle full-size price is ${fmtPrice(mid(prices))}).`;
          if (!sr || textOf(sr) !== want) bad.push(`${f}: style row is "${sr && textOf(sr)}", expected "${want}"`);
        } else if (sr) bad.push(`${f}: a style ranking where there is nothing to rank`);
        // the lists of other perfumes
        const peers = (row, expected, cap, withHouseName) => {
          const hrefs = row ? [...row.matchAll(/<li><a href="(perfume-[^"]+)\.html">([^<]*)<\/a><span>([^<]*)<\/span><\/li>/g)] : [];
          if (!expected.length) { if (row) bad.push(`${f}: a list with nobody in it`); return; }
          if (!row) { bad.push(`${f}: missing list`); return; }
          const shown = expected.slice(0, cap);
          if (JSON.stringify(hrefs.map((m) => m[1])) !== JSON.stringify(shown.map((q) => `perfume-${q.s}`))) { bad.push(`${f}: list is ${hrefs.map((m) => m[1]).join(",")}, expected ${shown.map((q) => `perfume-${q.s}`).join(",")}`); return; }
          shown.forEach((q, i) => {
            const name = decode(hrefs[i][2]), what = decode(hrefs[i][3]);
            if (name !== (withHouseName ? `${q.b} ${q.n}` : q.n)) bad.push(`${f}: link text "${name}"`);
            const a = low(q), b = low(p);
            const c = q.v.reduce((x, y) => (y.pr < x.pr ? y : x));
            const want = a != null && b != null ? `full size from ${fmtPrice(a)} (${a === b ? `the same price as ${p.n}` : `${fmtPrice(Math.abs(a - b))} ${a > b ? "more" : "less"} than ${p.n}`})` : `from ${[c.m, c.p].filter(Boolean).join(" ")} ${fmtPrice(c.pr)}`;
            if (what !== want) bad.push(`${f}: ${q.s}: "${what}", expected "${want}"`);
          });
          if (expected.length > cap && !new RegExp(`and ${expected.length - cap} more`).test(textOf(row))) bad.push(`${f}: no "and ${expected.length - cap} more"`);
          if (expected.length <= cap && /and \d+ more/.test(textOf(row))) bad.push(`${f}: "and more" with nothing more`);
        };
        const lr = rowOf("Other versions in this line");
        peers(lr, line, 6, false); if (line.length) withLine++;
        const ir = p.i ? rowOf(`Also inspired by ${p.i}`) : null;
        peers(ir, insp, 5, true); if (insp.length) withInsp++;
        // it is a section with its own id, in the page's outline, and no link in it leaves the site or points at the page itself
        for (const m of s.matchAll(/href="([^"]+)"/g)) if (m[1] === productFile(p)) bad.push(`${f}: links to itself`);
      }
      assert.deepEqual(first(bad), []);
      assert.ok(withHouse > 450 && withSeg > 450 && withLine > 250 && withInsp > 50, `coverage: house ${withHouse}, style ${withSeg}, line ${withLine}, inspired ${withInsp}, none ${none}`);
    });

    test("pages stay distinct: no more than 125 pages (a fifth of the site, today 115: sibling versions of one line) share 70% or more of their wording with another page, and a typical pair shares under 30%", () => {
      const words = (html) => { const main = html.match(/<main[\s\S]*?<\/main>/)[0].replace(/<script[\s\S]*?<\/script>|<svg[\s\S]*?<\/svg>/g, " ").replace(/<section class="section section-alt"[\s\S]*?<\/section>/, " ").replace(/<nav class="crumbs"[\s\S]*?<\/nav>/, " "); return decode(main.replace(/<[^>]+>/g, " ")).toLowerCase().replace(/[^a-z0-9₹ ]/g, "").split(/\s+/).filter(Boolean); };
      const sets = PAGES.map(({ html }) => { const w = words(html), s = new Set(); for (let i = 0; i + 5 <= w.length; i++) s.add(w.slice(i, i + 5).join(" ")); return s; });
      const involved = new Set(); let total = 0, n = 0;
      for (let a = 0; a < sets.length; a++) for (let b = a + 1; b < sets.length; b++) {
        const [s, l] = sets[a].size < sets[b].size ? [sets[a], sets[b]] : [sets[b], sets[a]];
        let inter = 0; for (const t of s) if (l.has(t)) inter++;
        const j = inter / (sets[a].size + sets[b].size - inter);
        if (j >= 0.7) { involved.add(a); involved.add(b); }
        if ((a * 7 + b) % 41 === 0) { total += j; n++; }
      }
      assert.ok(involved.size <= 125, `${involved.size} pages share 70% or more of their wording with another page`);
      assert.ok(total / n < 0.3, `a typical pair shares ${(100 * total / n).toFixed(0)}%`);
    });

    test("the A-Z list links every perfume to its own page exactly once, and the catalogue cards are built to link there too", () => {
      const list = read("perfumes.html");
      const hrefs = [...list.matchAll(/<a class="pl" href="(perfume-[^"]+\.html)" aria-label="([^"]*)">/g)].map((m) => m[1]);
      // every link says its house too, so two perfumes of the same name (Pour Homme EDT ...) are told apart when links are read out as a list
      const spoken = [...list.matchAll(/<a class="pl" href="perfume-[^"]+\.html" aria-label="([^"]*)">([^<]*)<\/a>/g)].map((m) => [decode(m[1]), decode(m[2])]);
      assert.equal(spoken.length, 627);
      assert.equal(new Set(spoken.map(([s]) => s)).size, 627, "no two links are spoken alike");
      PRODUCTS.forEach((p, i) => { assert.ok(spoken.some(([s, t]) => s === `${p.n} by ${p.b}` && t === p.n), `${p.b} ${p.n}: spoken as "name by house"`); });
      assert.deepEqual(hrefs.sort(), [...PRODUCT_FILES].sort());
      assert.match(read("assets/js/catalogue.js"), /<h2 class="name"><a href="perfume-\$\{esc\(p\.s\)\}\.html" aria-label="\$\{esc\(p\.n\)\} by \$\{esc\(p\.b\)\}/);
    });
  });

  /* ======================================================================== B */
  describe("B. the guidance and the notes only say what the data supports", () => {
    // an independent copy of the rules (scent family + strength), written out again here on purpose
    const BEST = { "Fresh & Citrus": ["Spring", "Summer", "Monsoon"], Floral: ["Spring", "Summer"], "Amber & Spicy": ["Autumn", "Winter"], "Oud & Woody": ["Autumn", "Winter"], "Leather & Smoky": ["Autumn", "Winter"], Gourmand: ["Autumn", "Winter"], Musk: SEASONS };
    const LESS = { "Fresh & Citrus": ["Winter"], Floral: [], "Amber & Spicy": ["Summer", "Monsoon"], "Oud & Woody": ["Summer"], "Leather & Smoky": ["Summer", "Monsoon"], Gourmand: ["Summer", "Monsoon"], Musk: [] };
    const tier = (n) => (/\b(Pure Parfum|Parfum|Extrait|Elixir)\b/i.test(n) ? "rich" : /\b(EDC|Cologne)\b/i.test(n) ? "light" : /\bEDP\b/i.test(n) ? (/\b(Intense|Extreme|Extra)\b/i.test(n) ? "rich" : "mid") : /\bEDT\b/i.test(n) ? (/\b(Intense|Extreme)\b/i.test(n) ? "mid" : "light") : null);

    test("the season strip: the 'Best' seasons are the scent family's (a rich strength drops summer from them), a strength alone gives light = warm seasons and rich = cool ones, and no family and no strength gives no strip at all", () => {
      const bad = [];
      for (const { p, f, html } of PAGES) {
        const wear = section(html, "wear"), t = tier(p.n);
        const strip = [...wear.matchAll(/<li class="s-(best|ok|less|neutral)">[\s\S]*?<span class="s-name">(\w+)<\/span><span class="s-fit">([^<]+)<\/span>/g)].map((m) => [m[2], m[1], m[3]]);
        let best = null;
        if (BEST[p.fm]) { best = BEST[p.fm].filter((s) => !(t === "rich" && s === "Summer")); }
        else if (t === "light") best = ["Spring", "Summer", "Monsoon"]; else if (t === "rich") best = ["Autumn", "Winter"];
        if (best === null) {
          if (strip.length) bad.push(`${f}: a season strip with no basis for one`);
          if (t === "mid" ? !/versatile middle strength/.test(wear) : !/haven't tagged .* scent family yet, and its name doesn't state a strength/.test(textOf(wear))) bad.push(`${f}: wording for "${t}"`);
          continue;
        }
        if (strip.map((s) => s[0]).join() !== SEASONS.join()) { bad.push(`${f}: strip seasons`); continue; }
        const got = strip.filter((s) => s[1] === "best").map((s) => s[0]);
        if (got.join() !== SEASONS.filter((s) => best.includes(s)).join()) bad.push(`${f}: best ${got} expected ${best}`);
        for (const [s, cls, txt] of strip) if (txt !== { best: "Best", ok: "Good", less: "Less ideal", neutral: "Fine" }[cls]) bad.push(`${f}: ${s} label "${txt}" for ${cls}`);
        if (p.fm) for (const s of LESS[p.fm].filter((x) => !(t === "light" && x === "Summer"))) if (strip.find((x) => x[0] === s)[1] !== "less") bad.push(`${f}: ${s} should be 'less ideal'`);
        if (t === "rich" && strip.find((x) => x[0] === "Summer")[1] === "best") bad.push(`${f}: a rich strength rated best for summer`);
        const text = textOf(wear);
        if (!text.includes("based on") || !text.includes("not a test of this exact bottle")) bad.push(`${f}: no statement of what the advice rests on`);
        if (p.fm && !text.includes(`its scent family (${p.fm})`)) bad.push(`${f}: basis family`);
      }
      assert.deepEqual(first(bad), []);
    });

    test("time of day follows the family: fresh, floral and musk are daytime; amber, oud, leather and gourmand are evening and night; nothing is claimed without a family or a strength", () => {
      const bad = [];
      const DAY = ["Fresh & Citrus", "Floral", "Musk"], NIGHT = ["Amber & Spicy", "Oud & Woody", "Leather & Smoky", "Gourmand"];
      for (const { p, f, html } of PAGES) {
        const times = [...((section(html, "wear").match(/<dt>Best times<\/dt><dd>([\s\S]*?)<\/dd>/) || [, ""])[1]).matchAll(/<li>([^<]+)<\/li>/g)].map((m) => m[1]);
        if (DAY.includes(p.fm) && !(times.includes("Daytime") || times.includes("Morning"))) bad.push(`${f}: ${p.fm} not given daytime`);
        if (NIGHT.includes(p.fm) && !(times.includes("Evening") && times.includes("Night"))) bad.push(`${f}: ${p.fm} not given evening`);
        if (!p.fm && !tier(p.n) && times.length) bad.push(`${f}: times with no basis`);
      }
      assert.deepEqual(first(bad), []);
    });

    test("notes: the 20 perfumes whose sources fully agree show exactly their notes (and name where they come from); every other page shows no notes pyramid and says so honestly", () => {
      const bad = [];
      for (const { p, f, html } of PAGES) {
        const sec = section(html, "notes"), n = PUBLISHED[p.s];
        const shown = [...sec.matchAll(/<dt>(Top|Heart|Base)<\/dt><dd>([^<]*)<\/dd>/g)].map((m) => [m[1], decode(m[2])]);
        const flat = (sec.match(/<p class="notes-all">([^<]*)\.<\/p>/) || [])[1];
        if (n) {
          const want = n.notes.all ? [n.notes.all.join(", ")] : [["top", "Top"], ["heart", "Heart"], ["base", "Base"]].filter(([k]) => n.notes[k]?.length).map(([k, L]) => `${L}:${n.notes[k].join(", ")}`);
          const got = n.notes.all ? [decode(flat || "")] : shown.map(([L, v]) => `${L}:${v}`);
          if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${f}: notes differ from the verified file`);
          const t = textOf(sec);
          if (!t.includes("not a full ingredient list") || !t.includes("checked against more than one source")) bad.push(`${f}: caution`);
          for (const h of new Set(n.sources.map((u) => new URL(u).hostname.replace(/^www\./, "")))) if (!t.includes(h)) bad.push(`${f}: source ${h} not named`);
        } else {
          if (shown.length || flat) bad.push(`${f}: notes shown without verification`);
          const t = textOf(sec);
          if (!/We haven't listed (the |the exact )?notes of/.test(t)) bad.push(`${f}: no honest fallback`);
          if (p.fm ? !t.includes(`Perfumes in the ${p.fm} family typically feature`) : /typically feature/.test(t)) bad.push(`${f}: family description`);
          if (!t.includes("allergy")) bad.push(`${f}: allergy line`);
        }
      }
      assert.deepEqual(first(bad), []);
      assert.equal(Object.keys(PUBLISHED).length, 20);
      for (const [s, v] of Object.entries(NOTES)) { assert.ok(PRODUCTS.some((p) => p.s === s), `${s} is a real perfume`); assert.ok(v.sources.length >= 2, `${s}: at least two sources`); }
    });

    test("every note shown also appears in the structured data of its page, and no page's data carries notes the page does not show", () => {
      for (const { p, html } of PAGES) {
        const prop = (node(ldOf(html), "Product").additionalProperty || []).find((x) => x.name === "Notes");
        assert.equal(!!prop, !!PUBLISHED[p.s], p.s);
      }
    });
  });

  /* ======================================================================== C */
  describe("C. in a browser (a sample covering every kind of page)", () => {
    let browser, srv;
    const opened = [];
    const open = async (file, opts = {}) => { const c = await openPage(browser, file, { base: srv.base, ...opts }); opened.push(c); await c.page.waitForTimeout(250); return c; };
    const PHONE_OPTS = { viewport: { width: 390, height: 844 }, contextOptions: { hasTouch: true, isMobile: true, reducedMotion: "reduce" } };
    const LAPTOP = { contextOptions: { reducedMotion: "reduce" } };
    const slugOf = (f) => f.replace(/^perfume-/, "").replace(/\.html$/, "");
    before(async () => { browser = await launch(); srv = await serve(); });
    after(async () => { for (const c of opened) await c.context.close().catch(() => {}); await browser.close(); await srv.close(); });
    const closeAll = async () => { while (opened.length) await opened.pop().context.close().catch(() => {}); };

    test("each of the sample pages loads over HTTP with no console error and no failed request, its photo loads at 800×800, nothing spills sideways on a laptop or a phone", async () => {
      for (const f of PRODUCT_SAMPLE) for (const [label, opts] of [["laptop", LAPTOP], ["phone", PHONE_OPTS]]) {
        const { page, errors } = await open(f, opts);
        await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); } scrollTo(0, 0); });
        await page.waitForTimeout(400);
        const r = await page.evaluate(() => { const i = document.querySelector(".p-photo img"), b = i.getBoundingClientRect(); return { ok: i.complete && i.naturalWidth === 800 && i.naturalHeight === 800, ratio: b.width / b.height, over: document.documentElement.scrollWidth > innerWidth + 1, broken: [...document.images].filter((x) => !(x.complete && x.naturalWidth > 0)).length }; });
        assert.deepEqual([r.ok, Math.round(r.ratio * 100) / 100, r.over, r.broken], [true, 1, false, 0], `${f} on a ${label}`);
        assert.deepEqual(errors, [], `${f} on a ${label}`);
      }
      assert.deepEqual(srv.missing, []);
    });

    test("Add: each size's button puts exactly that bottle in the cart (name, size, price), turns into 'In cart · n', counts up, survives a reload, and the cart's own live message announces it", async () => {
      for (const f of ["perfume-lattafa-khamrah.html", PRODUCT_SAMPLE.find((x) => PRODUCTS.find((p) => productFile(p) === x).v.length >= 3)]) {
        const p = PRODUCTS.find((x) => productFile(x) === f);
        const { page } = await open(f, LAPTOP);
        const rows = page.locator(".size");
        for (let i = 0; i < p.v.length; i++) {
          await rows.nth(i).locator(".p-add").click();
          await page.waitForTimeout(150);
          assert.equal((await rows.nth(i).locator(".p-add").textContent()).trim(), "In cart · 1", `${f} size ${i}`);
          assert.match(await rows.nth(i).locator(".p-add").getAttribute("aria-label"), /^In cart · 1\. Add another /);
        }
        assert.equal(await page.locator("#cart-count").textContent(), String(p.v.length));
        assert.match(await page.evaluate(() => document.querySelector('[role="status"], [aria-live]').textContent), /added to cart/i, "the live region announces it");
        await rows.nth(0).locator(".p-add").click(); await page.waitForTimeout(150);
        assert.equal((await rows.nth(0).locator(".p-add").textContent()).trim(), "In cart · 2");
        await page.reload(); await page.waitForTimeout(300);
        assert.equal((await page.locator(".size").nth(0).locator(".p-add").textContent()).trim(), "In cart · 2", "kept after a reload");
        await page.click("#cart-open"); await page.waitForSelector("#cart.open");
        const lines = await page.$$eval("#cart-items .line", (ls) => ls.map((l) => l.textContent.replace(/\s+/g, " ")));
        assert.equal(lines.length, p.v.length);
        bySize(p).forEach((v, i) => { const want = fmtPrice(v.pr * (i === 0 ? 2 : 1)); assert.ok(lines.some((l) => l.includes(p.n) && l.includes(`${[v.m, v.p].filter(Boolean).join(" · ")}`) && l.includes(want)), `cart has ${label(v)} at ${want}`); });
        const total = +(await page.locator("#cart-total").textContent()).replace(/[^\d]/g, "");
        assert.equal(total, bySize(p).reduce((s, v, i) => s + v.pr * (i === 0 ? 2 : 1), 0), "the total adds up");
      }
    });

    test("Order on WhatsApp: opens wa.me with the right number and exactly the message the catalogue's own Order button sends for the same size", async () => {
      for (const slug of ["lattafa-khamrah", "hermes-terre-dhermes-edt"]) {
        const p = PRODUCTS.find((x) => x.s === slug);
        for (let i = 0; i < p.v.length; i++) {
          const v = bySize(p)[i];
          const { page } = await open(`perfume-${slug}.html`, LAPTOP);
          await page.locator(".size").nth(i).locator(".p-order").click();
          const wa = await page.evaluate(() => window.__wa);
          assert.equal(wa.length, 1);
          const m = wa[0].match(/^https:\/\/wa\.me\/(\d+)\?text=(.+)$/);
          assert.equal(m[1], SITE.contact.whatsapp);
          const fromPage = decodeURIComponent(m[2]);
          // the catalogue card for the same size
          const cat = await open("catalogue.html", { ...LAPTOP, query: `?q=${encodeURIComponent(p.n)}` });
          await cat.page.waitForSelector(`#grid .card[data-slug="${slug}"]`);
          if (p.v.length > 1) { const want = [v.m, v.p].filter(Boolean).join(" · "); const chips = await cat.page.locator(`#grid .card[data-slug="${slug}"] .vchip`).allTextContents(); const k = chips.findIndex((c) => c.trim().startsWith(want)); assert.ok(k >= 0, `a catalogue chip for ${want}`); await cat.page.locator(`#grid .card[data-slug="${slug}"] .vchip`).nth(k).click(); }
          const fromCatalogue = await cat.page.locator(`#grid .card[data-slug="${slug}"] .order`).getAttribute("data-wa-open");
          assert.equal(fromPage, fromCatalogue, `${slug} size ${i}: the same message from the page and from the catalogue`);
          assert.ok(fromPage.includes(p.n) && fromPage.includes(fmtPrice(v.pr)));
          await closeAll();
        }
      }
    });

    test("landing: the catalogue card's name opens the perfume's page (a 44px target with a spoken name that says house and perfume), the A-Z list and the breadcrumbs lead there and back, and a neighbour tile opens the next perfume", async () => {
      const p = PRODUCTS.find((x) => x.s === "lattafa-khamrah");
      const cat = await open("catalogue.html", { ...LAPTOP, query: `?q=${encodeURIComponent(p.n)}` });
      await cat.page.waitForSelector(`#grid .card[data-slug="${p.s}"]`);
      const link = cat.page.locator(`#grid .card[data-slug="${p.s}"] .name a`);
      assert.equal(await link.getAttribute("href"), `perfume-${p.s}.html`);
      assert.match(await link.getAttribute("aria-label"), new RegExp(`^${p.n} by ${p.b}`));
      assert.ok((await link.boundingBox()).height >= 40, "a generous target");
      await Promise.all([cat.page.waitForURL((u) => u.pathname.endsWith(`/perfume-${p.s}.html`)), link.click()]);
      assert.equal((await cat.page.locator("h1").innerText()).trim(), `${p.b} ${p.n}`);
      // breadcrumbs: All perfumes
      await Promise.all([cat.page.waitForURL((u) => u.pathname.endsWith("/perfumes.html")), cat.page.locator('.crumbs a[href="perfumes.html"]').click()]);
      assert.ok((await cat.page.locator(`a.pl[href="perfume-${p.s}.html"]`).count()) === 1);
      // the A-Z list leads to the page
      await Promise.all([cat.page.waitForURL((u) => u.pathname.endsWith(`/perfume-${p.s}.html`)), cat.page.locator(`a.pl[href="perfume-${p.s}.html"]`).click()]);
      // the house breadcrumb: the house's section of the list, at the top of the screen
      await Promise.all([cat.page.waitForURL(/perfumes\.html#house-lattafa/), cat.page.locator('.crumbs a[href^="perfumes.html#"]').click()]);
      await cat.page.waitForTimeout(700);
      const top = await cat.page.evaluate(() => { const h = document.getElementById("house-lattafa"); return h ? Math.round(h.getBoundingClientRect().top) : null; });
      assert.ok(top !== null && top >= 0 && top < 300, `the Lattafa section is at the top (${top}px)`);
      // a neighbour tile
      const pg = await open(`perfume-${p.s}.html`, LAPTOP);
      const tile = pg.page.locator(".rel-tile").first();
      const href = await tile.getAttribute("href"), q = PRODUCTS.find((x) => productFile(x) === href);
      await Promise.all([pg.page.waitForURL((u) => u.pathname.endsWith(`/${href}`)), tile.click()]);
      assert.equal((await pg.page.locator("h1").innerText()).trim(), `${q.b} ${q.n}`);
    });

    test("keyboard: Tab reaches each size's Add and Order controls in order, each with a visible focus mark, and Enter on Add adds it", async () => {
      const p = PRODUCTS.find((x) => x.s === "hermes-terre-dhermes-edt");
      const { page } = await open(`perfume-${p.s}.html`, LAPTOP);
      const seen = [];
      for (let i = 0; i < 60 && seen.length < p.v.length * 2; i++) {
        await page.keyboard.press("Tab");
        const s = await page.evaluate(() => { const a = document.activeElement, cs = getComputedStyle(a); return a.matches(".size .p-add, .size .p-order") ? { cls: a.className.includes("p-add") ? "add" : "order", mark: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2 } : null; });
        if (s) seen.push(s);
      }
      assert.deepEqual(seen.map((s) => s.cls), p.v.flatMap(() => ["add", "order"]), "Add then Order, for each size, in order");
      assert.ok(seen.every((s) => s.mark), "a visible focus outline on each");
      await page.focus(".size .p-add"); await page.keyboard.press("Enter"); await page.waitForTimeout(200);
      assert.equal((await page.locator(".size .p-add").first().textContent()).trim(), "In cart · 1");
    });

    test("phone: sizes stack in one column, every control is at least 44px, the season strip fits, and nothing is cut off", async () => {
      for (const f of ["perfume-lattafa-khamrah.html", "perfume-hermes-terre-dhermes-edt.html", "perfume-afnan-highness-v.html"]) {
        const { page } = await open(f, PHONE_OPTS);
        await page.waitForTimeout(300);
        const r = await page.evaluate(() => {
          const small = [...document.querySelectorAll(".p-add, .p-order, .rel-tile, .crumbs a, .more-link a, .pf dd a, .btn")].filter((e) => e.offsetParent !== null).map((e) => { const b = e.getBoundingClientRect(); return [Math.min(b.width, b.height), e.className, (e.textContent || "").trim().slice(0, 20)]; }).filter(([m]) => m < 43.5);
          const cols = getComputedStyle(document.querySelector(".size")).gridTemplateColumns.split(" ").length;
          const s = document.querySelector(".seasons");
          return { small, cols, seasonsFit: !s || s.scrollWidth <= s.clientWidth + 1, over: document.documentElement.scrollWidth > innerWidth + 1 };
        });
        assert.deepEqual(r.small, [], `${f}: controls under 44px`); assert.equal(r.cols, 1); assert.equal(r.seasonsFit, true); assert.equal(r.over, false);
      }
    });

    test("with scripts off the page still reads in full (heading, quick answer, sizes with prices, wear guide, notes, questions) and the order link falls back to the Contact page", async () => {
      for (const f of ["perfume-lattafa-khamrah.html", "perfume-afnan-highness-v.html"]) {
        const p = PRODUCTS.find((x) => productFile(x) === f);
        const { page } = await open(f, { contextOptions: { javaScriptEnabled: false } });
        const t = await page.locator("main").textContent();   // (textContent: the style sheet draws "Quick answer" in capitals)
        for (const must of [`${p.b} ${p.n}`, "Quick answer", "Sizes and prices", ...p.v.map((v) => fmtPrice(v.pr)), "When to wear it", "Notes", "Common questions", "100% authentic"]) assert.ok(t.includes(must), `${f}: "${must}"`);
        assert.equal(await page.locator(".p-order").first().getAttribute("href"), "contact.html");
      }
    });

    test("on paper: no buttons, no header, dark text on white, and the photo, prices, wear guide and notes are kept", async () => {
      const { page } = await open("perfume-lattafa-khamrah.html", { ...LAPTOP, contextOptions: { reducedMotion: "reduce", colorScheme: "dark" } });
      await page.emulateMedia({ media: "print" }); await page.waitForTimeout(1000);
      const r = await page.evaluate(() => ({ acts: [...document.querySelectorAll(".size-acts, .site-header, .wa-float, .cta-row")].filter((e) => getComputedStyle(e).display !== "none").length, text: getComputedStyle(document.querySelector(".size-name")).color, photo: document.querySelector(".p-photo img").getBoundingClientRect().width > 100, price: getComputedStyle(document.querySelector(".size-price")).color, wear: getComputedStyle(document.querySelector("#wear")).display, cols: getComputedStyle(document.querySelector(".p-grid")).gridTemplateColumns.split(" ").length }));
      assert.equal(r.acts, 0); assert.equal(r.photo, true); assert.notEqual(r.wear, "none"); assert.equal(r.cols, 1, "one column on paper");
      const lum = (c) => { const [a, b, d] = c.match(/[\d.]+/g).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * a + 0.7152 * b + 0.0722 * d; };
      assert.ok(1.05 / (lum(r.text) + 0.05) >= 7 && 1.05 / (lum(r.price) + 0.05) >= 4.5, `text ${r.text}, price ${r.price} on white`);
    });
  });
});

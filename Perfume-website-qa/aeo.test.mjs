// Answer-engine and generative-engine readiness (AEO / GEO). What is checked, and why:
//   A  structured data (JSON-LD) on every page: parses, names the one shop consistently, describes the page truthfully (url, title, description,
//      dates, breadcrumbs), and every address in it is a real page of this site
//   B  what is marked up is what is visible: the FAQ markup equals the questions and answers a visitor sees (Google's rule, and the only safe one)
//   C  crawlers that do NOT run JavaScript (the ones behind ChatGPT, Claude and Perplexity): every page is served the same to them as to a browser,
//      and the facts, the FAQ, the guides and all 627 perfumes are in the plain HTML they download
//   D  perfumes.html (the plain-text catalogue) is exactly the product data: every perfume, size, price, note, in order
//   E  robots.txt (AI crawlers named and allowed), llms.txt (facts and links true), sitemap (every page, dates agree with the pages)
//   F  the head of every page (snippet controls, titles, descriptions) and what still stands between the site and being listed
//   G  answer-first writing: the Quick answer boxes, the question-form headings, short direct answers
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SITE, PRODUCTS, SITE_DIR } from "./lib/data.mjs";
import { launch, openPage } from "./lib/browser.mjs";
import { serve } from "./lib/server.mjs";
import { PAGE_FILES, GUIDE_FILES, PRODUCT_FILES } from "./lib/pages.mjs";
import { fmtPrice, expected } from "./lib/oracle.mjs";

const BASE = "https://perfume-x-collections.netlify.app/";
const ORG_ID = `${BASE}#organization`, SITE_ID = `${BASE}#website`;
const read = (f) => fs.readFileSync(path.join(SITE_DIR, f), "utf8");
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
const textOf = (html) => decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
const mainOf = (html) => (html.match(/<main[\s\S]*?<\/main>/) || [""])[0];
const words = (s) => s.split(/\s+/).filter(Boolean).length;
/** words in a piece of HTML as a reader counts them (a tag ends a word, so "<b>a</b><b>b</b>" is two) */
const htmlWords = (h) => words(decode(h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]+>/g, " ")));
const ldOf = (f) => { const m = [...read(f).matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]; assert.equal(m.length, 1, `${f}: exactly one structured-data block`); return JSON.parse(m[0][1]); };
const nodes = (f) => ldOf(f)["@graph"];
const ofType = (ns, t) => ns.filter((n) => [].concat(n["@type"]).includes(t));
const fileOf = (url) => (url.startsWith(BASE) ? url.slice(BASE.length).split("#")[0].split("?")[0] || "index.html" : null);
const idsIn = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const titleOf = (f) => decode(read(f).match(/<title>([^<]*)<\/title>/)[1]);
const descOf = (f) => decode(read(f).match(/<meta name="description" content="([^"]*)"/)[1]);
const canonicalOf = (f) => read(f).match(/<link rel="canonical" href="([^"]*)"/)[1];
const sitemap = () => Object.fromEntries([...read("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)].map((m) => [fileOf(m[1]), m[2]]));
const houses = [...new Set(PRODUCTS.map((p) => p.b))];
const allPrices = PRODUCTS.flatMap((p) => p.v.map((v) => v.pr));
const minis = PRODUCTS.flatMap((p) => p.v).filter((v) => v.g === "Minis");
const fromVial = fmtPrice(Math.min(...minis.map((v) => v.pr)));
const PHONE = SITE.contact.whatsapp.slice(-10);

describe("AEO / GEO readiness", () => {
  let browser, srv;
  const opened = [];
  before(async () => { browser = await launch(); srv = await serve(); });
  after(async () => { for (const c of opened) await c.context.close().catch(() => {}); await browser.close(); await srv.close(); });

  /* ======================================================================== A */
  describe("A. structured data", () => {
    test("every page has one structured-data block that parses, and no address or number it should not have", () => {
      for (const f of PAGE_FILES) {
        const raw = read(f).match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)[1];
        const g = ldOf(f);
        assert.equal(g["@context"], "https://schema.org", f); assert.ok(Array.isArray(g["@graph"]) && g["@graph"].length >= 3, f);
        assert.ok(!raw.includes(PHONE), `${f}: phone number in the data`); assert.doesNotMatch(raw, /localhost|127\.0\.0\.1|undefined|NaN|\[object/, f);
        assert.doesNotMatch(raw, /</, `${f}: a raw "<" would end the script early`);
      }
    });

    test("every page names the same one shop (OnlineStore) and one website, and its own page: address, title, description and date agree with the page itself", () => {
      const lastmod = sitemap();
      for (const f of PAGE_FILES) {
        const ns = nodes(f);
        const org = ofType(ns, "OnlineStore"), site = ofType(ns, "WebSite"), page = ns.filter((n) => ["WebPage", "CollectionPage", "ContactPage"].some((t) => [].concat(n["@type"]).includes(t)));
        assert.equal(org.length, 1, `${f}: one shop`); assert.equal(org[0]["@id"], ORG_ID); assert.equal(org[0].name, "Perfume X Collections"); assert.equal(org[0].url, BASE);
        assert.equal(site.length, 1); assert.equal(site[0]["@id"], SITE_ID); assert.equal(site[0].publisher["@id"], ORG_ID);
        assert.equal(site[0].potentialAction.target.urlTemplate, `${BASE}catalogue.html?q={search_term_string}`, "the site search the catalogue really supports");
        assert.equal(page.length, 1, `${f}: one page node`);
        const p = page[0];
        assert.equal(p.url, canonicalOf(f), `${f}: url = canonical`); assert.equal(p.name, titleOf(f), `${f}: name = title`); assert.equal(p.description, descOf(f), `${f}: description = meta description`);
        assert.equal(p.inLanguage, "en-IN"); assert.equal(p.isPartOf["@id"], SITE_ID);
        assert.match(p.dateModified, /^\d{4}-\d{2}-\d{2}$/); assert.equal(p.dateModified, lastmod[f], `${f}: dateModified = sitemap lastmod`);
      }
    });

    test("the breadcrumbs: every page but the home page has one, starting at the home page and ending at itself, in order", () => {
      for (const f of PAGE_FILES) {
        const bc = ofType(nodes(f), "BreadcrumbList");
        if (f === "index.html") { assert.equal(bc.length, 0); continue; }
        assert.equal(bc.length, 1, f);
        const items = bc[0].itemListElement;
        assert.deepEqual(items.map((i) => i.position), items.map((_, i) => i + 1));
        assert.equal(items[0].item, BASE, `${f}: starts at home`); assert.equal(items.at(-1).item, canonicalOf(f), `${f}: ends at itself`);
        const expectLen = GUIDE_FILES.includes(f) ? 3 : 2; assert.equal(items.length, expectLen, f);
        if (GUIDE_FILES.includes(f)) assert.equal(items[1].item, `${BASE}guides.html`);
      }
    });

    test("home page: the shop's description lists all 89 houses, the real number of perfumes and the real price range, and names where it sells and in what money", () => {
      const org = ofType(nodes("index.html"), "OnlineStore")[0];
      assert.deepEqual(new Set(org.brand.map((b) => b.name)), new Set(houses)); assert.equal(org.brand.length, 89);
      assert.equal(org.hasOfferCatalog.numberOfItems, PRODUCTS.length); assert.equal(org.hasOfferCatalog.url, `${BASE}catalogue.html`);
      assert.equal(org.priceRange, `${fmtPrice(Math.min(...allPrices))} - ${fmtPrice(Math.max(...allPrices))}`);
      assert.equal(org.areaServed, "IN"); assert.equal(org.currenciesAccepted, "INR");
      assert.ok(org.slogan && org.description.includes("WhatsApp") && org.knowsAbout.length >= 4);
      assert.equal(org.logo.url, `${BASE}assets/images/apple-touch-icon.png`); assert.equal(org.image, `${BASE}assets/images/og-image.jpg`);
    });

    test("each guide: an Article that matches the page (headline, dates, reading time, length, picture, sources) and a FAQPage", () => {
      const lastmod = sitemap();
      for (const f of GUIDE_FILES) {
        const ns = nodes(f), html = read(f), a = ofType(ns, "Article")[0];
        const h1 = decode(html.match(/<h1>([\s\S]*?)<\/h1>/)[1]);
        assert.equal(a.headline, h1); assert.equal(a.datePublished, "2026-11-13"); assert.equal(a.dateModified, html.match(/<time datetime="([^"]+)"/)[1]); assert.equal(a.dateModified, lastmod[f]);
        assert.ok(a.dateModified >= a.datePublished);
        assert.equal(a.timeRequired, `PT${html.match(/<span>(\d+) min read<\/span>/)[1]}M`);
        const nWords = htmlWords(html.match(/<p class="guide-lead">[\s\S]*?<\/p>/)[0] + html.match(/<div class="guide-body prose">[\s\S]*?<\/article>/)[0]);
        assert.ok(Math.abs(a.wordCount - nWords) / nWords < 0.03, `${f}: wordCount ${a.wordCount} vs ${nWords}`);
        assert.ok(fs.existsSync(path.join(SITE_DIR, fileOf(a.image[0]))), "its picture is a real file");
        assert.equal(a.mainEntityOfPage["@id"], `${canonicalOf(f)}#webpage`); assert.equal(a.author["@id"], ORG_ID); assert.equal(a.publisher["@id"], ORG_ID);
        assert.ok(a.abstract.split(" ").length >= 35 && a.keywords.split(",").length >= 4 && a.articleSection);
        assert.equal(ofType(ns, "FAQPage").length, 1);
        if (f.includes("testers")) assert.deepEqual(a.citation.sort(), [...read(f).matchAll(/<a href="(https:[^"]+)" target="_blank"/g)].map((m) => m[1]).sort(), "the cited sources are exactly the links shown");
      }
    });

    test("every address in any structured data is a real page of this site (and every #section exists)", () => {
      const bad = [];
      for (const f of PAGE_FILES) {
        const strings = []; const walk = (v, k) => { if (typeof v === "string") strings.push([k, v]); else if (v && typeof v === "object") Object.entries(v).forEach(([kk, x]) => walk(x, kk)); };
        walk(ldOf(f));
        for (const [k, v] of strings) {
          if (!v.startsWith(BASE) || ["urlTemplate"].includes(k)) continue;
          const file = fileOf(v), hash = v.split("#")[1];
          if (!fs.existsSync(path.join(SITE_DIR, file))) { bad.push(`${f}: ${v}`); continue; }
          if (hash && !/^(organization|website|webpage|breadcrumb|faq|article|houses|guides)$/.test(hash) && !idsIn(read(file)).has(hash)) bad.push(`${f}: ${v} (no such section)`);
        }
      }
      assert.deepEqual(bad, []);
    });

    test("catalogue, contact and the guides pages are described as what they are (collection / contact / article)", () => {
      assert.ok(ofType(nodes("catalogue.html"), "CollectionPage").length === 1 && ofType(nodes("contact.html"), "ContactPage").length === 1 && ofType(nodes("guides.html"), "CollectionPage").length === 1 && ofType(nodes("perfumes.html"), "CollectionPage").length === 1);
      assert.equal(ofType(nodes("guides.html"), "ItemList")[0].numberOfItems, 4);
      assert.deepEqual(ofType(nodes("guides.html"), "ItemList")[0].itemListElement.map((i) => fileOf(i.url)), GUIDE_FILES);
      assert.deepEqual(ofType(nodes("catalogue.html"), "CollectionPage")[0].significantLink, [`${BASE}perfumes.html`]);
    });
  });

  /* ======================================================================== B */
  describe("B. what is marked up is what is visible", () => {
    const visibleQA = (page, file) => page.evaluate((isFaq) => {
      const norm = (s) => s.replace(/\s+/g, " ").trim();
      if (isFaq) return [...document.querySelectorAll(".faq details")].map((d) => [norm(d.querySelector("summary").textContent), norm(d.querySelector("p").textContent)]);
      const sec = document.getElementById("faq").closest("section");
      return [...sec.querySelectorAll("h3")].map((h) => [norm(h.textContent), norm(h.nextElementSibling.textContent)]);
    }, file === "faq.html");
    for (const f of ["faq.html", ...GUIDE_FILES]) {
      test(`${f}: the FAQ in the structured data is exactly the questions and answers on the page, in order, after the page's scripts have run too`, async () => {
        const c = await openPage(browser, f, { base: srv.base }); opened.push(c);
        await c.page.waitForTimeout(500);
        const marked = ofType(nodes(f), "FAQPage")[0].mainEntity.map((q) => [q.name, q.acceptedAnswer.text]);
        assert.deepEqual(await visibleQA(c.page, f), marked);
        assert.ok(marked.length >= (f === "faq.html" ? 14 : 5), `${marked.length} questions`);
        // and with no scripts at all (what a crawler downloads) the same text is in the page
        const rawText = textOf(read(f));
        for (const [q, a] of marked) { assert.ok(rawText.includes(q), `question missing from the plain HTML: ${q}`); assert.ok(rawText.includes(a), `answer missing from the plain HTML: ${q}`); }
      });
    }
  });

  /* ======================================================================== C */
  describe("C. crawlers that do not run JavaScript", () => {
    const BOTS = ["GPTBot/1.2", "OAI-SearchBot/1.0", "ChatGPT-User/1.0", "ClaudeBot/1.0", "Claude-SearchBot/1.0", "PerplexityBot/1.0", "Googlebot/2.1", "bingbot/2.0", "CCBot/2.0"];
    test("every page is served to each AI and search crawler exactly as it is to a browser: same status, same bytes, no blocking", async () => {
      for (const f of PAGE_FILES) {
        const ref = await (await fetch(srv.base + f)).text();
        for (const bot of BOTS) {
          const r = await fetch(srv.base + f, { headers: { "user-agent": `Mozilla/5.0 (compatible; ${bot}; +https://example.com/bot)` } });
          assert.equal(r.status, 200, `${bot} ${f}`); assert.match(r.headers.get("content-type"), /text\/html/); assert.equal(await r.text(), ref, `${bot} gets different content on ${f}`);
        }
      }
    });

    test("what a crawler downloads for the home page already says who we are, what we sell, the guarantee, how to order, delivery and the price of a vial (no script needed)", () => {
      const t = textOf(mainOf(read("index.html")));
      for (const must of ["independent online perfume retailer in India", "genuine designer, luxury and Middle-Eastern fragrances", `${PRODUCTS.length} fragrances from ${houses.length} houses`, `Vials from ${fromVial}`, "100% authentic and genuine", `within ${SITE.guarantee.claimDays} days of delivery`, "three times", ...SITE.guarantee.auditStores, "no checkout and no account", "WhatsApp", "within 48 hours", "3–4 days"]) assert.ok(t.includes(must), `home page text lacks "${must}"`);
      // the numbers the page fills in with scripts are already right in the plain HTML
      assert.equal(SITE.guarantee.multiple, 3, "the plain text says 'three times': change it when the guarantee changes"); assert.equal(SITE.guarantee.claimDays, 7);
    });

    test("the guides, the FAQ and the policies are complete in the plain HTML: quick answer, every section heading, every question", () => {
      for (const f of GUIDE_FILES) {
        const html = read(f), t = textOf(html);
        assert.ok(t.includes(textOf(html.match(/<div class="quick">[\s\S]*?<\/div>/)[0].replace("Quick answer", ""))));
        for (const h of [...html.matchAll(/<h2 id="[^"]+">([^<]+)<\/h2>/g)].map((m) => decode(m[1]))) assert.ok(t.includes(h), `${f}: heading "${h}"`);
        assert.ok(words(t) > 1100, `${f}: ${words(t)} words in the plain HTML`);
      }
      assert.ok(words(textOf(mainOf(read("faq.html")))) > 500);
    });

    test("a crawler that never runs scripts finds all 627 perfumes by name and price on perfumes.html, and the catalogue page tells it where that list is", () => {
      const t = textOf(mainOf(read("perfumes.html")));
      let missing = 0; for (const p of PRODUCTS) if (!t.includes(p.n) || !t.includes(fmtPrice(p.v[0].pr))) missing++;
      assert.equal(missing, 0);
      assert.match(read("catalogue.html"), /<noscript>[\s\S]*href="perfumes\.html"[\s\S]*<\/noscript>/);
      for (const f of PAGE_FILES) assert.match(read(f), /<nav class="foot-nav"[\s\S]*href="perfumes\.html">All perfumes<\/a>/, `${f}: footer link`);
    });
  });

  /* ======================================================================== D */
  describe("D. perfumes.html is exactly the product data", () => {
    const html = read("perfumes.html");
    const sections = [...html.matchAll(/<section class="house" id="([^"]+)" aria-labelledby="[^"]+">\s*<h2[^>]*>([\s\S]*?)<\/h2>\s*<p class="house-meta">([\s\S]*?)<\/p>\s*<ul class="plist">([\s\S]*?)<\/ul>/g)].map((m) => ({ id: m[1], house: decode(m[2]), meta: textOf(m[3]), items: [...m[4].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((x) => x[1]) }));
    const num = (s) => s.replace(/ /g, " ");

    test("89 houses, A to Z, each once; 627 perfumes in all; every perfume under its own house, in the catalogue's order", () => {
      assert.equal(sections.length, 89);
      const names = sections.map((s) => s.house);
      assert.deepEqual(names, [...houses].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })));
      assert.equal(new Set(sections.map((s) => s.id)).size, 89, "unique section ids");
      const readable = (n) => n.toLowerCase().replace(/&/g, " and ").normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
      for (const s of sections) assert.equal(s.id, `house-${readable(s.house)}`, `${s.house}: a readable address for its section`);
      assert.equal(sections.reduce((n, s) => n + s.items.length, 0), 627);
      for (const s of sections) {
        const want = PRODUCTS.filter((p) => p.b === s.house).map((p) => p.n);
        assert.deepEqual(s.items.map((i) => decode(i.match(/<a class="pl" href="[^"]+" aria-label="[^"]*">([\s\S]*?)<\/a>/)[1])), want, `${s.house}`);
        assert.match(s.meta, new RegExp(`${want.length} ${want.length === 1 ? "perfume" : "perfumes"}`));
      }
    });

    test("every line tells the truth about its perfume: scent family, who it is for, every size and packaging in order with its exact price, notes, and the 'inspired by' reference", () => {
      const bad = [];
      for (const s of sections) {
        const prods = PRODUCTS.filter((p) => p.b === s.house);
        s.items.forEach((li, i) => {
          const p = prods[i], t = num(textOf(li)), name = textOf(li.match(/<a class="pl"[\s\S]*?<\/a>/)[0]);
          if (!li.includes(`href="perfume-${p.s}.html"`)) bad.push(`${p.n}: does not link to its own page`);
          if (name !== p.n) return bad.push(`${s.house}/${p.n}: name`);
          if (p.fm && !t.includes(p.fm)) bad.push(`${p.n}: family ${p.fm}`);
          if (p.gd && !t.includes({ Men: "for men", Women: "for women", Unisex: "unisex" }[p.gd])) bad.push(`${p.n}: for ${p.gd}`);
          let at = 0;
          for (const v of p.v) {
            const piece = `${[v.m, v.p].filter(Boolean).join(" ")} ${fmtPrice(v.pr)}`, k = t.indexOf(piece, at);
            if (k < 0) { bad.push(`${p.n}: "${piece}" missing or out of order`); break; }
            at = k + piece.length;
            if (v.r && !/^\d{4}-\d{2}-\d{2}/.test(v.r) && !t.includes(`(${v.r})`)) bad.push(`${p.n}: note "${v.r}"`);
          }
          if (p.i ? !t.includes(`Inspired by ${p.i}.`) : /Inspired by/.test(t)) bad.push(`${p.n}: inspired-by`);
          if (/\b20\d\d-\d\d-\d\d/.test(t)) bad.push(`${p.n}: a stray date`);
        });
      }
      assert.deepEqual(bad.slice(0, 5), []);
    });

    test("the facts at the top are the data's: number of perfumes and houses, vial price, update date, the tester discount, and the 'inspired by' explanation", () => {
      const t = textOf(mainOf(html));
      assert.ok(t.includes(`${PRODUCTS.length} fragrances from ${houses.length} houses`) && t.includes(`Vials start at ${fromVial}`) && t.includes(`last updated ${SITE.pricesUpdated}`) && t.includes("10–30% cheaper"));
      assert.ok(t.includes("an original creation of the house named") && t.includes("not a copy or repackaging"));
      assert.match(html, /<title>All perfumes, A–Z by house — Perfume X Collections<\/title>/);
    });

    test("the jump list has one working chip per house, and each house's 'See … in the catalogue' link finds that house's perfumes", () => {
      const ids = idsIn(html), chips = [...html.matchAll(/<li><a href="#([^"]+)">([^<]*)<\/a><\/li>/g)];
      assert.equal(chips.length, 89); for (const [, id] of chips) assert.ok(ids.has(id), `chip #${id}`);
      assert.deepEqual(chips.map((c) => c[1]), sections.map((s) => s.id));
      for (const s of sections) {
        const link = html.match(new RegExp(`id="${s.id}-h"[\\s\\S]*?href="catalogue\\.html\\?q=([^"]+)"`))[1];
        assert.equal(decodeURIComponent(link), s.house);
        const found = expected({ q: s.house }); assert.ok(found.length >= PRODUCTS.filter((p) => p.b === s.house).length, `${s.house}: catalogue finds ${found.length}`);
      }
    });

    test("the list stays within a sensible size for a page of 627 perfumes (under 250 KB of HTML, no pictures)", () => {
      assert.ok(Buffer.byteLength(html) < 250_000, `${Buffer.byteLength(html)} bytes`); assert.equal((html.match(/<img\b/g) || []).length, 0);
    });
  });

  /* ======================================================================== E */
  describe("E. robots.txt, llms.txt and the sitemap", () => {
    test("robots.txt welcomes the search and answer crawlers and the training crawlers by name, blocks nothing, and points at the sitemap", () => {
      const txt = read("robots.txt");
      const groups = txt.split(/\n\s*\n/).map((g) => g.split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split(":").map((x) => x.trim()))).filter((g) => g.length);
      const agents = groups.filter((g) => g[0][0].toLowerCase() === "user-agent");
      const want = ["*", "OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Googlebot", "Bingbot", "Applebot", "GPTBot", "ClaudeBot", "Google-Extended", "Applebot-Extended"];
      assert.deepEqual(agents.map((g) => g[0][1]), want);
      for (const g of agents) assert.deepEqual(g.slice(1), [["Allow", "/"]], `${g[0][1]}: only "Allow: /"`);
      assert.doesNotMatch(txt, /^Disallow:\s*\/\s*$/m); assert.match(txt, /^Sitemap: https:\/\/perfume-x-collections\.netlify\.app\/sitemap\.xml$/m);
      assert.ok(!txt.includes(PHONE));
    });

    test("llms.txt: the right shape (title, one-paragraph summary, link lists), every link a real page, every page of the site listed once, and every number in it true", () => {
      const txt = read("llms.txt");
      assert.match(txt, /^# Perfume X Collections\n\n> /); assert.ok(txt.length < 6000);
      const links = [...txt.matchAll(/\]\((https:[^)]+)\)/g)].map((m) => fileOf(m[1]));
      assert.ok(links.every((f) => f && fs.existsSync(path.join(SITE_DIR, f))), "every link is a real page");
      assert.deepEqual([...links].sort(), PAGE_FILES.filter((f) => f !== "index.html").sort(), "every page except the home page, once");
      for (const must of [`${PRODUCTS.length} perfumes from ${houses.length} houses`, `vials from ${fromVial}`, `last updated ${SITE.pricesUpdated}`, `within ${SITE.guarantee.claimDays} days of delivery`, "three times", "within 48 hours", "3–4 days", "10–30%", ...SITE.guarantee.auditStores]) assert.ok(txt.includes(must), `llms.txt lacks "${must}"`);
      assert.ok(!txt.includes(PHONE) && !/localhost/.test(txt));
      assert.equal(SITE.guarantee.multiple, 3);
    });

    test("the sitemap lists every page once, each with the same date as that page's own structured data", () => {
      const lm = sitemap();
      assert.deepEqual(Object.keys(lm).sort(), [...PAGE_FILES, ...PRODUCT_FILES].sort(), "the 14 pages and all 627 perfume pages, once each");
      assert.ok(Object.values(lm).every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)));
      for (const f of PRODUCT_FILES) assert.equal(lm[f], lm["index.html"], `${f}: same date as the rest`);
      for (const f of PAGE_FILES) assert.equal(lm[f], ofType(nodes(f), "WebPage").concat(ofType(nodes(f), "CollectionPage"), ofType(nodes(f), "ContactPage"))[0].dateModified, f);
    });
  });

  /* ======================================================================== F */
  describe("F. the head of every page, and what still stands between the site and being listed", () => {
    test("every page lets search and answer engines show long snippets and large pictures, and has a clear title and description", () => {
      const titles = new Set(), descs = new Set();
      for (const f of PAGE_FILES) {
        const html = read(f), robots = html.match(/<meta name="robots" content="([^"]*)"/)[1];
        assert.equal(robots, "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1", f); assert.doesNotMatch(robots, /noindex|nofollow|nosnippet/);
        const t = titleOf(f), d = descOf(f);
        assert.ok(t.length >= 15 && t.length <= 75, `${f}: title ${t.length}`); assert.ok(d.length >= 60 && d.length <= 170, `${f}: description ${d.length}`);
        assert.ok(!titles.has(t) && !descs.has(d), `${f}: duplicate`); titles.add(t); descs.add(d);
        assert.equal(canonicalOf(f), f === "index.html" ? BASE : BASE + f);
      }
    });

    test("LAUNCH CHECK: nothing blocks this site from being listed by search engines or used in AI answers (no noindex header file, no robots block, no noindex tag, no page left out of the sitemap)", () => {
      const blockers = [];
      if (fs.existsSync(path.join(SITE_DIR, "_headers")) && /noindex|nofollow|x-robots-tag/i.test(read("_headers").replace(/^\s*#.*$/gm, ""))) blockers.push("_headers asks search engines not to list the site");
      if (/^Disallow:\s*\/\s*$/m.test(read("robots.txt"))) blockers.push("robots.txt blocks everything");
      for (const f of PAGE_FILES) if (/<meta name="robots" content="[^"]*noindex/.test(read(f))) blockers.push(`${f}: noindex tag`);
      assert.deepEqual(blockers, [], "something still stops search engines and AI crawlers listing the site");
    });
  });

  /* ======================================================================== G */
  describe("G. answer-first writing", () => {
    const sentence1 = (a) => a.split(/(?<=[.!?])\s+/)[0];
    test("each guide opens with a Quick answer of 35 to 70 words, before its introduction, that is a complete answer in itself", () => {
      for (const f of GUIDE_FILES) {
        const html = read(f), m = html.match(/<div class="quick"><p class="quick-title">Quick answer<\/p><p>([\s\S]*?)<\/p><\/div>/);
        assert.ok(m, f); const q = textOf(m[1]);
        assert.ok(words(q) >= 35 && words(q) <= 70, `${f}: ${words(q)} words`); assert.match(q, /\.$/);
        assert.ok(html.indexOf('class="quick"') < html.indexOf('class="guide-lead"') && html.indexOf('class="quick"') > html.indexOf("</h1>"), "after the title, before the introduction");
        assert.notEqual(q, textOf(html.match(/<p class="guide-lead">([\s\S]*?)<\/p>/)[1]));
      }
    });

    test("every question on the FAQ and in the guides is a real question, and its answer gets to the point: a first sentence under 45 words, the whole answer under 90", () => {
      for (const f of ["faq.html", ...GUIDE_FILES]) for (const q of ofType(nodes(f), "FAQPage")[0].mainEntity) {
        assert.match(q.name, /\?$/, `${f}: "${q.name}"`); assert.ok(q.name.length >= 15 && q.name.length <= 100);
        const a = q.acceptedAnswer.text;
        assert.ok(words(sentence1(a)) <= 45, `${f}: "${q.name}" first sentence ${words(sentence1(a))} words`); assert.ok(words(a) >= 12 && words(a) <= 90, `${f}: "${q.name}" ${words(a)} words`);
      }
    });

    test("the FAQ covers the questions shoppers actually ask: who you are, genuine, guarantee, brands, testers, ordering, payment, safety, delivery, prices, trying small", () => {
      const qs = ofType(nodes("faq.html"), "FAQPage")[0].mainEntity.map((q) => q.name.toLowerCase());
      for (const re of [/what is perfume x collections/, /genuine/, /refund guarantee/, /which brands/, /retail and tester/, /how do i place an order/, /how do i pay/, /card details or otp/, /deliver across india/, /prices in rupees/, /not sure about ordering/]) assert.ok(qs.some((q) => re.test(q)), `no question matching ${re}`);
    });

    test("the home page has a quotable 'at a glance' list whose numbers come from the data, and whose guarantee wording follows site-config.js", async () => {
      const c = await openPage(browser, "index.html", { base: srv.base }); opened.push(c);
      await c.page.waitForTimeout(400);
      const r = await c.page.evaluate(() => ({ items: [...document.querySelectorAll(".glance li")].map((l) => l.textContent.replace(/\s+/g, " ").trim()), stat: [...document.querySelectorAll(".glance [data-stat]")].map((e) => [e.dataset.stat, e.textContent]) }));
      assert.equal(r.items.length, 6);
      assert.deepEqual(Object.fromEntries(r.stat), { products: String(PRODUCTS.length), houses: String(houses.length), vial: fromVial });
      assert.ok(r.items[2].includes(`within ${SITE.guarantee.claimDays} days`) && SITE.guarantee.auditStores.every((s) => r.items[2].includes(s)));
    });
  });
});

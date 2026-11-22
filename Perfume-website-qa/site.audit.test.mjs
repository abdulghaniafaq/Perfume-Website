// Site audit, served over real HTTP exactly like the live host (case-sensitive file names, real 404s):
// every page loads with no failed request; every file the pages, styles and scripts name exists with that exact spelling;
// all 627 product photos (+ thumbnails), 30 logos and 32 mini pictures are really served as images; and the page markup is clean
// (title, description, one h1, unique ids, alt text, labels, safe links, no stray debug text).
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SITE, PRODUCTS, SITE_DIR } from "./lib/data.mjs";
import { launch, openPage } from "./lib/browser.mjs";
import { serve, exactCase } from "./lib/server.mjs";
import { isGoogleVerification, isProductPage, PRODUCT_FILES } from "./lib/pages.mjs";

const GUIDE_PAGES = ["guide-spot-genuine-perfume", "guide-perfume-for-every-season", "guide-retail-tester-decant-discovery-set", "guide-perfume-testers-explained"].map((n) => `${n}.html`);
const PAGES = ["index", "catalogue", "perfumes", "guides", "how-to-order", "guarantee", "faq", "contact", "privacy", "terms"].map((n) => `${n}.html`).concat(GUIDE_PAGES);   // 9 pages + the 4 guides
// the share picture each page names: the guides have their own, every other page uses the shop one
const SHARE = (f) => (GUIDE_PAGES.includes(f) ? `assets/images/guides/${f.replace(".html", "")}-og.jpg` : f === "guides.html" ? "assets/images/guides/guide-spot-genuine-perfume-og.jpg" : "assets/images/og-image.jpg");
const read = (f) => fs.readFileSync(path.join(SITE_DIR, f), "utf8");

describe("site audit (served over HTTP like the live host)", () => {
  let browser, srv;
  before(async () => { browser = await launch(); srv = await serve(); });
  after(async () => { await browser.close(); await srv.close(); });

  describe("every file that is named exists, spelled exactly (the live host is case-sensitive)", () => {
    test("the site folder holds exactly the expected pages and folders", () => {
      const all = fs.readdirSync(SITE_DIR).filter((f) => !f.startsWith("."));
      const google = all.filter(isGoogleVerification);                             // Search Console's ownership-check file is allowed (at most one), and is checked below
      assert.ok(google.length <= 1, `more than one Google verification file: ${google}`);
      assert.deepEqual(all.filter(isProductPage).sort(), [...PRODUCT_FILES].sort(), "exactly one page for each of the 627 perfumes, and no others");
      assert.deepEqual(all.filter((f) => !isGoogleVerification(f) && !isProductPage(f)).sort(), ["_headers", "assets", "data", "llms.txt", "robots.txt", "sitemap.xml", ...PAGES].sort());   // (_headers: the security headers Netlify reads)
    });

    test("Google Search Console's ownership file (if present) is exactly what Google issues, is served from the site's top level, and is not listed as a page", async () => {
      for (const f of fs.readdirSync(SITE_DIR).filter(isGoogleVerification)) {
        assert.equal(read(f), `google-site-verification: ${f}`, "one line: google-site-verification: <its own file name>");
        const r = await fetch(`${srv.base}${f}`);
        assert.equal(r.status, 200); assert.equal(await r.text(), `google-site-verification: ${f}`);
        assert.ok(!read("sitemap.xml").includes(f) && !read("llms.txt").includes(f), "it is not a page to list");
      }
    });

    test("every href / src / url() in every page, stylesheet and script that points into the site resolves to a real file with the same capitals", () => {
      const refs = [];
      const files = [...PAGES, ...fs.readdirSync(path.join(SITE_DIR, "assets/css")).map((f) => `assets/css/${f}`), ...fs.readdirSync(path.join(SITE_DIR, "assets/js")).map((f) => `assets/js/${f}`), "data/site-config.js"];
      for (const f of files) {
        const text = read(f), dir = f.startsWith("assets/js/") || f.startsWith("data/") ? "." : path.posix.dirname(f);   // a link written inside a script is relative to the PAGE, not to the script
        for (const m of text.matchAll(/(?:href|src)="([^"#?]+)(?:[?#][^"]*)?"/g)) refs.push([f, m[1], dir]);
        for (const m of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) refs.push([f, m[1], dir]);
        for (const m of text.matchAll(/["'`]((?:assets|data)\/[A-Za-z0-9_\-./]+\.(?:js|css|jpg|jpeg|png|svg|webp|json))["'`]/g)) refs.push([f, m[1], "."]);
      }
      const bad = [];
      for (const [f, ref, dir] of refs) {
        if (/^(https?:|data:|mailto:|tel:|javascript:|\/\/)/.test(ref) || ref.includes("${")) continue;
        const rel = path.posix.normalize(ref.startsWith("/") ? ref.slice(1) : path.posix.join(dir, ref));
        if (rel.startsWith("..") ) { bad.push(`${f}: ${ref} (outside the site)`); continue; }
        if (!exactCase(SITE_DIR, rel) || !fs.existsSync(path.join(SITE_DIR, rel))) bad.push(`${f}: ${ref}`);
      }
      assert.deepEqual([...new Set(bad)], []);
      assert.ok(refs.length > 100, `looked at ${refs.length} references`);
    });

    test("all 627 product photos (800px) and thumbnails (240px), the 30 logos and the 32 mini pictures exist with exact spelling, and nothing else is in those folders", () => {
      const dir = (d) => fs.readdirSync(path.join(SITE_DIR, SITE.imageDir, d)).filter((f) => !f.startsWith("."));
      const slugs = PRODUCTS.map((p) => p.s);
      assert.equal(new Set(slugs).size, 627);
      const top = fs.readdirSync(path.join(SITE_DIR, SITE.imageDir)).filter((f) => !f.startsWith(".") && fs.statSync(path.join(SITE_DIR, SITE.imageDir, f)).isFile());
      assert.deepEqual(top.filter((f) => !/\.jpg$/.test(f) || f === "og-image.jpg").sort(), ["apple-touch-icon.png", "og-image.jpg"], "besides the product photos, only the share image and the home-screen icon");
      const full = new Set(top.filter((f) => /\.jpg$/.test(f) && f !== "og-image.jpg"));
      const thumbs = new Set(dir("thumbs"));
      const missing = slugs.filter((s) => !full.has(`${s}.jpg`) || !thumbs.has(`${s}.jpg`));
      assert.deepEqual(missing, []);
      assert.equal(full.size, 627, "no stray full-size file");
      assert.equal(thumbs.size, 627, "no stray thumbnail");
      assert.equal(dir("brands").length, 30);
      assert.equal(dir("minis").filter((f) => f.endsWith(".jpg")).length, 32);
      assert.equal(dir("minis/thumbs").length, 32);
      // the guides' pictures: for each guide a top picture, a card picture and a share picture, and nothing else
      const want = GUIDE_PAGES.flatMap((f) => { const n = f.replace(".html", ""); return [`${n}.jpg`, `${n}-card.jpg`, `${n}-og.jpg`]; }).sort();
      assert.deepEqual(dir("guides").sort(), want);
    });
  });

  describe("every page loads over HTTP", () => {
    for (const file of PAGES) {
      test(`${file}: 200, no failed request, no console error, nothing 404, scripts and styles served with the right type`, async () => {
        srv.hits.length = 0;
        const c = await openPage(browser, file, { base: srv.base });
        try {
          await c.page.waitForTimeout(600);
          if (file === "catalogue.html") { await c.page.evaluate(() => window.scrollTo(0, 1500)); await c.page.waitForTimeout(300); }
          assert.deepEqual(c.errors, []);
          assert.deepEqual(srv.hits.filter(([s]) => s !== 200), [], "every request the page made succeeded");
          assert.ok(srv.hits.some(([, u]) => u.endsWith(".js")) && srv.hits.some(([, u]) => u.endsWith(".css")));
        } finally { await c.context.close(); }
      });
    }

    test("an address that does not exist is a 404 (so a broken link would be noticed), and a differently-capitalised one is too", async () => {
      const r1 = await fetch(`${srv.base}nope.html`), r2 = await fetch(`${srv.base}Catalogue.html`), r3 = await fetch(`${srv.base}catalogue.html`);
      assert.deepEqual([r1.status, r2.status, r3.status], [404, 404, 200]);
    });

    test("catalogue: scrolling the whole first page of cards asks for only existing images (no 404), each a real JPEG", async () => {
      srv.hits.length = 0;
      const c = await openPage(browser, "catalogue.html", { base: srv.base });
      try {
        await c.page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } });
        await c.page.waitForTimeout(800);
        const bad = await c.page.evaluate(() => [...document.querySelectorAll("#grid .card .thumb img")].filter((i) => !(i.complete && i.naturalWidth === 240)).map((i) => i.getAttribute("src")));
        assert.deepEqual(bad, []);
        assert.deepEqual(srv.hits.filter(([s]) => s !== 200), []);
      } finally { await c.context.close(); }
    });
  });

  describe("markup is clean on every page", () => {
    for (const file of PAGES) {
      test(`${file}: title, description, language, one h1, unique ids, alt text, labels, button and link names, safe links`, async () => {
        const c = await openPage(browser, file, { base: srv.base });
        try {
          await c.page.waitForTimeout(500);
          const r = await c.page.evaluate(() => {
            const $$ = (s) => [...document.querySelectorAll(s)];
            const name = (e) => (e.getAttribute("aria-label") || e.textContent || e.getAttribute("title") || (e.querySelector("img[alt]") || {}).alt || "").replace(/\s+/g, " ").trim();
            const labelled = (e) => !!(e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") || e.title || (e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)) || e.closest("label"));
            const ids = $$("[id]").map((e) => e.id), dup = ids.filter((x, i) => ids.indexOf(x) !== i);
            const heads = $$("h1,h2,h3,h4,h5,h6").map((h) => +h.tagName[1]);
            const skips = heads.filter((h, i) => i && h > heads[i - 1] + 1);
            const visibleText = document.body.innerText;
            return {
              title: document.title, desc: (document.querySelector('meta[name="description"]') || {}).content || "", lang: document.documentElement.lang,
              viewport: !!document.querySelector('meta[name="viewport"][content*="width=device-width"]'),
              h1: $$("h1").length, dup,
              headingSkips: skips.length,
              imgNoAlt: $$("img").filter((i) => !i.hasAttribute("alt")).map((i) => i.getAttribute("src")),
              // (a picture link hidden from the keyboard and screen readers is fine when a named link goes to the same place)
              unnamedLinks: $$("a[href]").filter((a) => !name(a) && !(a.getAttribute("aria-hidden") === "true" && a.getAttribute("tabindex") === "-1" && $$("a[href]").some((o) => o !== a && o.getAttribute("href") === a.getAttribute("href") && name(o)))).map((a) => a.outerHTML.slice(0, 80)),
              unnamedButtons: $$("button").filter((b) => !name(b)).map((b) => b.outerHTML.slice(0, 80)),
              unlabelledFields: $$("input:not([type=hidden]):not([type=submit]), select, textarea").filter((e) => !labelled(e)).map((e) => e.outerHTML.slice(0, 80)),
              deadLinks: $$("a:not([data-wa]):not([data-wa-open]):not(#request-open)").filter((a) => !a.getAttribute("href") || a.getAttribute("href") === "#" || /^javascript:/i.test(a.getAttribute("href"))).map((a) => a.outerHTML.slice(0, 80)),
              blankNoRel: $$('a[target="_blank"]').filter((a) => !/noopener/.test(a.rel)).map((a) => a.href),
              insecure: $$("[src],[href]").map((e) => e.getAttribute("src") || e.getAttribute("href")).filter((u) => /^http:\/\//i.test(u || "")),
              stray: (visibleText.match(/\b(undefined|NaN|\[object Object\]|lorem ipsum|TODO|FIXME|null)\b|\{\{|\}\}|\bnull\b/gi) || []),
              doubleSpaceInTitle: /\s{2,}/.test(document.title),
              emptyHeadings: $$("h1,h2,h3,h4").filter((h) => !h.textContent.trim()).length,
              tinyTap: 0,
            };
          });
          assert.ok(r.title.length >= 15 && r.title.length <= 100, `title length ${r.title.length}`);
          assert.ok(r.desc.length >= 50 && r.desc.length <= 200, `description length ${r.desc.length}`);
          assert.equal(r.lang, "en"); assert.equal(r.viewport, true);
          assert.equal(r.h1, 1, "exactly one h1");
          assert.deepEqual(r.dup, [], "ids are unique");
          assert.deepEqual(r.imgNoAlt, [], "every image has an alt attribute");
          assert.deepEqual(r.unnamedLinks, [], "every link has a name a screen reader can say");
          assert.deepEqual(r.unnamedButtons, [], "every button has a name");
          assert.deepEqual(r.unlabelledFields, [], "every form field has a label");
          assert.deepEqual(r.deadLinks, [], "no empty, '#' or javascript: links");
          assert.deepEqual(r.blankNoRel, [], "links that open a new tab carry rel=noopener");
          assert.deepEqual(r.insecure, [], "nothing loads over plain http");
          assert.deepEqual(r.stray, [], "no stray debug words on the page");
          assert.equal(r.doubleSpaceInTitle, false); assert.equal(r.emptyHeadings, 0);
          assert.equal(r.headingSkips, 0, "headings do not jump a level (h1 → h3)");
        } finally { await c.context.close(); }
      });
    }

    test("page titles and descriptions are all different from each other", async () => {
      const seen = { t: new Set(), d: new Set() };
      for (const f of PAGES) {
        const html = read(f);
        const t = (html.match(/<title>([^<]*)<\/title>/) || [])[1], d = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1];
        assert.ok(t && d, f); assert.ok(!seen.t.has(t), `duplicate title: ${t}`); assert.ok(!seen.d.has(d), `duplicate description in ${f}`);
        seen.t.add(t); seen.d.add(d);
      }
    });

    test("no debugging left in the scripts (console.log, debugger, alert is only the cart-limit message), and no real phone number in any page or style", () => {
      for (const f of ["assets/js/common.js", "assets/js/catalogue.js", "assets/js/quiz.js", "assets/js/contact.js"]) {
        const t = read(f);
        assert.doesNotMatch(t, /console\.log|debugger/, f);
      }
      const digits = SITE.contact.whatsapp;
      for (const f of [...PAGES, ...fs.readdirSync(path.join(SITE_DIR, "assets/css")).map((x) => `assets/css/${x}`), ...fs.readdirSync(path.join(SITE_DIR, "assets/js")).map((x) => `assets/js/${x}`)]) {
        assert.ok(!read(f).includes(digits) && !read(f).includes(digits.slice(-10)), `${f} contains the number`);
      }
    });

    test("prices are consistent site-wide: every page that shows 'prices updated' shows the same month, and the date is November 2026", () => {
      for (const f of PAGES) {
        const t = read(f);
        // the months that follow the word "updated" (a guide may also quote a past court ruling's month, which is not a price date)
        const months = [...t.matchAll(/updated(?:\s|<[^>]*>|&[a-z]+;|[:·-]){0,14}((?:January|February|March|April|May|June|July|August|September|October|November|December) 20\d\d)/gi)].map((m) => m[1]);
        assert.ok(months.length >= 1, `${f}: shows when it was last updated`);
        for (const m of months) assert.equal(m, "November 2026", `${f}: ${m}`);
      }
      assert.equal(SITE.pricesUpdated, "November 2026");
    });
  });

  describe("launch details: share preview, canonical addresses, sitemap, robots (address: perfume-x-collections.netlify.app)", () => {
    const BASE = "https://perfume-x-collections.netlify.app/";
    const urlOf = (f) => (f === "index.html" ? BASE : BASE + f);
    const meta = (html, attr, name) => (html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`)) || [])[1];
    const sizeOf = (file) => {                                 // JPEG / PNG pixel size, read from the file itself
      const b = fs.readFileSync(path.join(SITE_DIR, file));
      if (b[0] === 0x89) return [b.readUInt32BE(16), b.readUInt32BE(20)];
      for (let i = 2; i < b.length;) { const m = b[i + 1], len = b.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + len; }
    };

    for (const f of PAGES) {
      test(`${f}: canonical + og:url are its own address, the share image is the real 1200×630 file, the card is the large-image kind`, () => {
        const html = read(f);
        assert.equal((html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1], urlOf(f), "canonical");
        assert.equal(meta(html, "property", "og:url"), urlOf(f), "og:url");
        assert.equal(meta(html, "property", "og:image"), BASE + SHARE(f));
        assert.equal(meta(html, "name", "twitter:image"), BASE + SHARE(f));
        assert.deepEqual(sizeOf(SHARE(f)), [1200, 630], "the share picture is really 1200×630");
        assert.equal(meta(html, "name", "twitter:card"), "summary_large_image");
        assert.equal(meta(html, "property", "og:image:width"), "1200"); assert.equal(meta(html, "property", "og:image:height"), "630");
        assert.ok((meta(html, "property", "og:image:alt") || "").length > 20, "image description");
        assert.equal(meta(html, "property", "og:locale"), "en_IN");
        assert.ok(meta(html, "property", "og:title") && meta(html, "property", "og:description") && meta(html, "property", "og:site_name"));
        assert.match(html, /<link rel="apple-touch-icon" href="assets\/images\/apple-touch-icon\.png">/);
      });
    }
    test("the share image is a real 1200×630 JPEG under 300 KB (the size chat apps and social sites like), and the home-screen icon is a real 180×180 PNG", () => {
      assert.deepEqual(sizeOf("assets/images/og-image.jpg"), [1200, 630]);
      assert.ok(fs.statSync(path.join(SITE_DIR, "assets/images/og-image.jpg")).size < 300_000);
      assert.deepEqual(sizeOf("assets/images/apple-touch-icon.png"), [180, 180]);
    });
    test("sitemap.xml lists exactly the 641 pages (the 14 pages and the 627 perfume pages), at the same addresses the pages give for themselves; robots.txt allows crawling and points to it", () => {
      const sm = read("sitemap.xml");
      const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      assert.deepEqual(locs.sort(), [...PAGES, ...PRODUCT_FILES].map(urlOf).sort());
      assert.match(sm, /^<\?xml version="1.0" encoding="UTF-8"\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
      assert.equal([...sm.matchAll(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g)].length, PAGES.length + PRODUCT_FILES.length);
      const robots = read("robots.txt");
      assert.match(robots, /User-agent: \*/); assert.match(robots, /Allow: \//); assert.doesNotMatch(robots, /Disallow: \/\s*$/m);
      assert.match(robots, new RegExp(`Sitemap: ${BASE.replace(/\./g, "\\.")}sitemap\\.xml`));
    });
    test("the home page's structured data parses, names the store and its address, and carries no phone number", () => {
      const m = read("index.html").match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
      assert.ok(m);
      const g = JSON.parse(m[1]);
      assert.equal(g["@context"], "https://schema.org");
      const ld = g["@graph"].find((n) => n["@type"] === "OnlineStore");              // (the page's data is a graph: shop, website, page; aeo.test.mjs checks it in full)
      assert.ok(ld);
      assert.equal(ld.name, "Perfume X Collections"); assert.equal(ld.url, BASE);
      assert.ok(!m[1].includes(SITE.contact.whatsapp.slice(-10)));
      assert.equal(ld.image, `${BASE}assets/images/og-image.jpg`);
    });
    test("the page addresses all really are what is served: every canonical path exists in the site folder", () => {
      for (const f of PAGES) assert.ok(fs.existsSync(path.join(SITE_DIR, f)), f);
    });
  });

  describe("with scripts switched off (old phones, strict browsers, some in-app browsers)", () => {
    for (const file of PAGES) {
      test(`${file}: the page still reads - heading, text and links are there; nothing broken`, async () => {
        const c = await openPage(browser, file, { base: srv.base, contextOptions: { javaScriptEnabled: false } });
        try {
          const { page } = c;
          assert.equal(await page.locator("h1").count(), 1);
          assert.ok(await page.locator("h1").isVisible());
          assert.ok((await page.locator("main").innerText()).trim().length > 150, "there is real text on the page");
          assert.ok((await page.locator("footer a[href='privacy.html']").count()) === 1 && (await page.locator("footer a[href='terms.html']").count()) === 1, "footer links still there");
          assert.ok(await page.locator("#nav a[href='catalogue.html']").count() >= 1, "navigation links are in the page source");
        } finally { await c.context.close(); }
      });
    }
    test("catalogue: the 'please enable JavaScript … or message us on WhatsApp' note is on the first screen, not hidden far down the page", async () => {
      const c = await openPage(browser, "catalogue.html", { base: srv.base, contextOptions: { javaScriptEnabled: false } });
      try {
        const note = c.page.locator("noscript p.empty, .empty").filter({ hasText: "enable JavaScript" });
        assert.ok(await note.isVisible(), "the note is shown");
        const box = await note.boundingBox();
        assert.ok(box.y < 1400, `the note sits at ${Math.round(box.y)}px from the top`);
      } finally { await c.context.close(); }
    });
    test("FAQ answers still open and close without scripts (they are native disclosure boxes)", async () => {
      const c = await openPage(browser, "faq.html", { base: srv.base, contextOptions: { javaScriptEnabled: false } });
      try {
        const first = c.page.locator("details").first();
        await first.locator("summary").click();
        assert.ok(await first.locator("p").first().isVisible());
      } finally { await c.context.close(); }
    });
  });

  test("launch: no file asks search engines to stay away (the old noindex header file is gone; the _headers file that is there now only carries security headers), so the site can be listed once it is uploaded", () => {
    const headers = fs.readFileSync(path.join(SITE_DIR, "_headers"), "utf8").replace(/^\s*#.*$/gm, "");
    assert.doesNotMatch(headers, /noindex|nofollow|nosnippet|x-robots-tag/i, "the _headers file asks search engines to stay away");
  });
});

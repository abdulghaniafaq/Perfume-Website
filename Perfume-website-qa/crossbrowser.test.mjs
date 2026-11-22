// The same core visits in the other two browser engines: Firefox, and WebKit (the engine inside Safari, so this is the closest check
// of iPhone / iPad / Mac Safari that can be done here). Real clicks and typing, over HTTP.
//   (Chrome / Edge / Samsung Internet / Brave are the Chrome engine and are covered by every other suite.)
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { SITE } from "./lib/data.mjs";
import { launch, openPage } from "./lib/browser.mjs";
import { serve } from "./lib/server.mjs";
import { expected, countLabel, fmtPrice, pageSizeFor } from "./lib/oracle.mjs";
import { PAGE_FILES_PLUS } from "./lib/pages.mjs";

const PAGES = PAGE_FILES_PLUS;                                // the 14 pages and a sample of the perfume pages (every kind of perfume page is in the sample)
const ENGINES = [
  ["Firefox (laptop)", "firefox", {}],
  ["Firefox (phone-sized)", "firefox", { viewport: { width: 390, height: 844 }, contextOptions: { hasTouch: true, isMobile: false } }],
  ["Safari engine (Mac laptop)", "webkit", {}],
  ["Safari engine (iPhone-sized)", "webkit", { viewport: { width: 390, height: 844 }, contextOptions: { hasTouch: true, isMobile: true } }],
  ["Safari engine (iPad-sized)", "webkit", { viewport: { width: 820, height: 1180 }, contextOptions: { hasTouch: true, isMobile: true } }],
];

// Firefox needs permissions that the sandboxed environment these tests run in does not give it ("Can't find profile directory"); when it
// cannot start it is reported as SKIPPED, never as passed.
const canLaunch = async (engine) => { try { const { firefox, webkit } = await import("playwright-core"); const b = await (engine === "firefox" ? firefox : webkit).launch({ timeout: 20000 }); await b.close(); return true; } catch { return false; } };
const AVAILABLE = { firefox: await canLaunch("firefox"), webkit: await canLaunch("webkit") };

describe("other browsers", () => {
  let srv;
  before(async () => { srv = await serve(); });
  after(async () => { await srv.close(); });

  for (const [label, engine, opts] of ENGINES) describe(label, { skip: !AVAILABLE[engine] && `${engine} cannot start in this environment` }, () => {
    let browser;
    const opened = [];
    const open = async (file, extra = {}, query = "") => { const c = await openPage(browser, file, { base: srv.base, query, ...opts, ...extra }); opened.push(c); return c; };
    const WIDTH = opts.viewport?.width ?? 1360;
    const phone = WIDTH <= 1000;                                       // the header links live behind the menu button at 1000px and below
    const PAGE_SIZE = pageSizeFor(WIDTH);                              // 24 a page on a phone, 48 otherwise
    const menu = async (page) => { if (phone) { await page.click("#menu-btn"); await page.waitForTimeout(250); } };
    before(async () => { browser = await launch(engine); });
    after(async () => { await browser.close(); });

    test("every page loads: no console error, no failed request, no sideways scroll, one h1", async () => {
      const problems = [];
      for (const file of PAGES) {
        const c = await open(file);
        await c.page.waitForTimeout(500);
        const m = await c.page.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth + 1, h1: document.querySelectorAll("h1").length }));
        if (m.over) problems.push(`${file}: scrolls sideways`);
        if (m.h1 !== 1) problems.push(`${file}: ${m.h1} h1`);
        if (c.errors.length) problems.push(`${file}: ${c.errors.join("; ")}`);
        await c.context.close();
      }
      assert.deepEqual(problems, []);
    });

    test("catalogue: first page full (48 on a laptop, 24 on a phone), then typing a search gives exactly the right perfumes; the × clears it", async () => {
      const { page } = await open("catalogue.html");
      await page.waitForSelector("#grid .card");
      assert.equal(await page.locator("#grid .card").count(), PAGE_SIZE);
      await page.click("#q"); await page.keyboard.type("oud wood", { delay: 40 });
      await page.waitForTimeout(500);
      const want = expected({ q: "oud wood" });
      assert.deepEqual(await page.$$eval("#grid .card", (cs) => cs.map((c) => c.dataset.slug)), want.slice(0, PAGE_SIZE).map((r) => r.slug));
      assert.ok((await page.locator("#count").textContent()).replace(/\s+/g, " ").includes(countLabel(want.length)));
      await page.click("#q-clear"); await page.waitForTimeout(400);
      assert.equal(await page.locator("#grid .card").count(), PAGE_SIZE);
    });

    test("catalogue: a house name offers the house and its perfumes; choosing a suggestion searches for it", async () => {
      const { page } = await open("catalogue.html");
      await page.waitForSelector("#grid .card");
      await page.click("#q"); await page.keyboard.type("lattafa", { delay: 40 });
      await page.waitForSelector("#suggest:not([hidden]) li");
      assert.match(await page.locator("#suggest-list li").first().textContent(), /House · \d+ fragrances/);
      await page.locator("#suggest-list li").first().click();
      await page.waitForTimeout(400);
      assert.deepEqual(await page.$$eval("#grid .card", (cs) => cs.map((c) => c.dataset.slug)), expected({ q: "Lattafa" }).slice(0, PAGE_SIZE).map((r) => r.slug));
    });

    test("catalogue: style tab + Filters panel (price) + sort give exactly the right results", async () => {
      const { page } = await open("catalogue.html");
      await page.waitForSelector("#grid .card");
      await page.click('#segChips [data-seg="arabian"]');
      await page.click("#filters-open"); await page.waitForSelector("#filters:not([hidden])");
      await page.click('#price [data-v="0-1000"]'); await page.click("#pn-done");
      await page.selectOption("#sort", "hi"); await page.waitForTimeout(400);
      const want = expected({ seg: "arabian", price: "0-1000", sort: "hi" });
      assert.deepEqual(await page.$$eval("#grid .card", (cs) => cs.map((c) => c.dataset.slug)), want.slice(0, PAGE_SIZE).map((r) => r.slug));
      assert.ok((await page.locator("#count").textContent()).replace(/\s+/g, " ").includes(countLabel(want.length)));
      await page.click("#reset"); await page.waitForTimeout(400);
      assert.equal(await page.locator("#grid .card").count(), PAGE_SIZE);
    });

    test("catalogue: pagination by page number (2, 3, the last, the one before it) walks the results in order", async () => {
      const { page } = await open("catalogue.html");
      await page.waitForSelector("#grid .card");
      const all = expected({}).map((r) => r.slug);
      const slugs = () => page.$$eval("#grid .card", (cs) => cs.map((c) => c.dataset.slug));
      const last = Math.ceil(all.length / PAGE_SIZE);
      for (const n of [2, 3, last, last - 1]) {
        await page.locator(`#pager .pg:not(.nav)[data-p="${n}"]`).click(); await page.waitForTimeout(300);
        assert.deepEqual(await slugs(), all.slice((n - 1) * PAGE_SIZE, n * PAGE_SIZE), `page ${n}`);
        assert.equal(await page.locator("#pager .pg.on").textContent(), String(n));
      }
    });

    test("cart: add two sizes, change quantity, the total adds up, the order opens WhatsApp with the right number and message; it survives a reload", async () => {
      const { page } = await open("catalogue.html");
      await page.waitForSelector("#grid .card");
      const cards = page.locator("#grid .card");
      await cards.nth(0).locator(".add").click(); await cards.nth(1).locator(".add").click();
      assert.equal(await page.locator("#cart-count").textContent(), "2");
      await page.reload(); await page.waitForSelector("#grid .card");
      assert.equal(await page.locator("#cart-count").textContent(), "2", "cart kept across a reload");
      await page.click("#cart-open"); await page.waitForSelector("#cart.open");
      await page.locator("#cart-items .line").first().locator("[data-inc]").click();
      const lines = await page.$$eval("#cart-items .line .line-price", (els) => els.map((e) => +e.textContent.replace(/[^\d]/g, "")));
      const total = +(await page.locator("#cart-total").textContent()).replace(/[^\d]/g, "");
      assert.equal(lines.reduce((a, b) => a + b, 0), total);
      await page.click("#checkout");
      const wa = await page.evaluate(() => window.__wa);
      assert.equal(wa.length, 1);
      const m = wa[0].match(/^https:\/\/wa\.me\/(\d+)\?text=(.+)$/);
      assert.equal(m[1], SITE.contact.whatsapp);
      assert.ok(decodeURIComponent(m[2]).includes(`Total: ${fmtPrice(total)}`));
    });

    test("quiz: opens, every question can be answered, results show pictures and prices; 'See all sizes' lands in the catalogue", async () => {
      const { page } = await open("catalogue.html", {}, "?quiz=1");
      await page.waitForSelector("#quiz:not([hidden]) .quiz-opt");
      for (let i = 0; i < 12 && !(await page.locator(".qr").count()); i++) { await page.locator(".quiz-opt").first().click(); await page.waitForTimeout(400); }
      await page.waitForSelector(".qr");
      await page.waitForTimeout(600);
      const n = await page.locator(".qr").count();
      assert.ok(n >= 1);
      assert.equal(await page.locator(".qr .qr-art img.ok").count(), n);
      await page.locator(".qr .qr-view").first().click();
      await page.waitForSelector("#quiz", { state: "hidden" });
      assert.ok((await page.locator("#grid .card").count()) >= 1);
    });

    test("photo viewer opens on a click and closes with Esc and with the × / backdrop", async () => {
      const { page } = await open("catalogue.html");
      await page.waitForSelector("#grid .card .thumb img.ok");
      await page.locator("#grid .card .thumb").first().click();
      await page.waitForSelector("#lightbox:not([hidden])");
      await page.keyboard.press("Escape");
      await page.waitForSelector("#lightbox", { state: "hidden" });
    });

    test("FAQ: all closed at first; opening a second answer closes the first", async () => {
      const { page } = await open("faq.html");
      assert.equal(await page.locator("details[open]").count(), 0);
      await page.locator("details summary").nth(0).click(); await page.locator("details summary").nth(1).click();
      await page.waitForTimeout(200);
      assert.equal(await page.locator("details[open]").count(), 1);
    });

    test("contact: both required fields are checked, then the request opens WhatsApp with what was typed", async () => {
      const { page } = await open("contact.html");
      await page.click('form button[type="submit"]'); await page.waitForTimeout(250);
      assert.ok((await page.locator("#rq-perfume-msg").textContent()).length > 0);
      await page.fill("#rq-perfume", "Layton"); await page.fill("#rq-name", "Ravi");
      await page.click('form button[type="submit"]'); await page.waitForSelector("#request-done:not([hidden])");
      const wa = await page.evaluate(() => window.__wa);
      assert.equal(wa.length, 1);
      assert.ok(decodeURIComponent(wa[0].split("text=")[1]).includes("Layton"));
    });

    test("menu and theme: header links go to the right pages; the light/dark choice sticks across pages", async () => {
      const { page } = await open("index.html");
      await page.click("#theme-toggle"); await page.waitForTimeout(250);
      const theme = await page.evaluate(() => document.documentElement.dataset.theme || (document.documentElement.classList.contains("light") ? "light" : "dark"));
      for (const [name, url] of [["Catalogue", /catalogue/], ["Guides", /guides/], ["How to order", /how-to-order/], ["Guarantee", /guarantee/], ["FAQ", /faq/], ["Contact", /contact/]]) {
        await menu(page);
        await page.locator("#nav a", { hasText: name }).click();
        await page.waitForURL(url);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme || (document.documentElement.classList.contains("light") ? "light" : "dark")), theme);
      }
    });

    test("home: hero button, hero photos, brand logos all load; the logo rows move (animation runs)", async () => {
      const { page } = await open("index.html");
      await page.waitForTimeout(1200);
      assert.equal(await page.evaluate(() => [...document.querySelectorAll(".hero-art img, .brand-logo img")].filter((i) => !(i.complete && i.naturalWidth > 0)).length), 0);
      const x1 = await page.evaluate(() => document.querySelector(".marquee ul").getBoundingClientRect().left);
      await page.waitForTimeout(1000);
      const x2 = await page.evaluate(() => document.querySelector(".marquee ul").getBoundingClientRect().left);
      assert.notEqual(Math.round(x1), Math.round(x2), "the brand row is moving");
    });

    test("guides: the header Guides button opens the Guides page; its four cards and pictures show, and each Read more opens its guide", async () => {
      const { page } = await open("index.html");
      await menu(page);
      await Promise.all([page.waitForURL(/guides\.html/), page.locator('#nav a[href="guides.html"]').click()]);
      assert.equal((await page.locator("h1").innerText()).trim(), "Perfume, explained");
      await page.waitForTimeout(500);
      assert.equal(await page.locator(".g-card").count(), 4);
      await page.evaluate(async () => { for (let y = 0; y <= document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); });   // (pictures below the screen load as you scroll to them)
      await page.waitForTimeout(800);
      assert.equal(await page.evaluate(() => [...document.images].filter((i) => !(i.complete && i.naturalWidth > 0)).length), 0, "every card picture loads");
      const files = await page.$$eval(".g-card .g-more", (as) => as.map((a) => a.getAttribute("href")));
      assert.equal(files.length, 4);
      for (const f of files) {
        await page.locator(`.g-card .g-more[href="${f}"]`).click();
        await page.waitForURL(new RegExp(f.replace(/\./g, "\\.")));
        assert.equal(await page.locator("h1").count(), 1);
        await page.goBack(); await page.waitForURL(/guides\.html/);
      }
    });

    test("guides: an article shows its top picture in the right shape, its drawings take the theme colours (and repaint on the theme switch), the contents list jumps under the header, and the table fits", async () => {
      const { page } = await open("guide-retail-tester-decant-discovery-set.html");
      await page.waitForTimeout(600);
      const read = () => page.evaluate(() => {
        const probe = document.createElement("i"); probe.style.color = "var(--gold)"; document.body.appendChild(probe);
        const gold = getComputedStyle(probe).color; probe.remove();
        const hero = document.querySelector(".guide-hero img"), hb = hero.getBoundingClientRect(), svg = document.querySelector(".fig-svg").getBoundingClientRect();
        return { heroOk: hero.complete && hero.naturalWidth === 1200, ratio: hb.width / hb.height, stroke: getComputedStyle(document.querySelector(".fig-svg .ln, .fig-svg .fl")).stroke, gold, svgW: Math.round(svg.width), svgH: Math.round(svg.height), row: getComputedStyle(document.querySelector(".rtable tbody tr")).display, over: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      const a = await read();
      assert.equal(a.heroOk, true); assert.ok(Math.abs(a.ratio - 1200 / 630) < 0.03, `top picture shape ${a.ratio.toFixed(3)}`);
      assert.equal(a.stroke, a.gold, "the drawing's line colour comes from the theme"); assert.ok(a.svgW > 150 && a.svgH > 80, `drawing ${a.svgW}×${a.svgH}`);
      assert.equal(a.row, WIDTH <= 640 ? "block" : "table-row"); assert.equal(a.over, false);
      const id = await page.locator(".toc a").nth(3).getAttribute("href");
      await page.locator(`.toc a[href="${id}"]`).click(); await page.waitForTimeout(1000);
      const top = await page.evaluate((i) => ({ top: Math.round(document.querySelector(i).getBoundingClientRect().top), head: Math.round(document.querySelector(".site-header").getBoundingClientRect().bottom) }), id);
      assert.ok(top.top >= top.head - 2 && top.top < 320, `heading at ${top.top}px under a header ending at ${top.head}px`);
      assert.ok(page.url().endsWith(id));
      await page.click("#theme-toggle"); await page.waitForTimeout(300);
      const b = await read();
      assert.equal(b.stroke, b.gold, "after the switch too"); assert.notEqual(b.gold, a.gold, "the colour really changed");
    });

    test("guides: ?fm= and ?g= links filter the catalogue, a season pick opens its perfume page, a guide's WhatsApp button opens the right chat, and the quiz link opens the quiz", async () => {
      const f = await open("catalogue.html", {}, "?fm=Floral&g=Retail");
      await f.page.waitForSelector("#grid .card");
      const want = expected({ fm: "Floral", g: "Retail" });
      assert.ok((await f.page.locator("#count").textContent()).replace(/\s+/g, " ").includes(countLabel(want.length, 1, PAGE_SIZE)));
      assert.equal(await f.page.locator("#ftags .ftag").count(), 2);
      const s = await open("guide-perfume-for-every-season.html");
      await s.page.evaluate(async () => { for (let y = 0; y <= document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); });   // let every picture finish before leaving the page (leaving cancels pictures still loading)
      await s.page.waitForTimeout(1200);
      const first = s.page.locator(".pick").first();
      const name = (await first.locator(".pick-name").textContent()).trim();
      await Promise.all([s.page.waitForURL(/perfume-[a-z0-9-]+\.html/), first.click()]);   // a pick opens that perfume's own page
      await s.page.waitForSelector("h1");
      assert.ok((await s.page.locator("h1").textContent()).includes(name), `the perfume's page is headed ${name}`);
      const g = await open("guide-spot-genuine-perfume.html");
      const btn = g.page.locator(".cta-band [data-wa]"); await btn.scrollIntoViewIfNeeded(); await btn.click();
      const wa = await g.page.evaluate(() => window.__wa);
      assert.equal(wa.length, 1); assert.match(wa[0], new RegExp(`^https://wa\\.me/${SITE.contact.whatsapp}\\?text=`));
      const q = await open("catalogue.html", {}, "?quiz=1");
      await q.page.waitForSelector("#quiz:not([hidden]) .quiz-opt");
    });

    test("printing: dark text on white, no header, cart, round button or buttons, in both themes (checked on a guide and the privacy page)", async () => {
      for (const file of ["guide-perfume-testers-explained.html", "privacy.html"]) for (const scheme of ["dark", "light"]) {
        const { page } = await open(file, { contextOptions: { ...(opts.contextOptions || {}), colorScheme: scheme } });
        await page.waitForTimeout(300);
        await page.emulateMedia({ media: "print" }); await page.waitForTimeout(1000);
        const r = await page.evaluate(() => {
          const p = document.querySelector("main p, main li"), rgb = (c) => c.match(/[\d.]+/g).map(Number), lum = (c) => { const [r, g, b] = rgb(c).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
          return { contrast: 1.05 / (lum(getComputedStyle(p).color) + 0.05), shown: [...document.querySelectorAll(".site-header, #wa-float, .cart-bar, #cart, .to-top, .cta-row")].filter((e) => getComputedStyle(e).display !== "none").length };
        });
        assert.ok(r.contrast >= 7, `${file} (${scheme}): text contrast on white ${r.contrast.toFixed(1)}`); assert.equal(r.shown, 0, `${file} (${scheme}): interface left on paper`);
      }
    });

    test("when a pop-up blocker refuses the WhatsApp window the button opens WhatsApp in the same tab instead", async () => {
      const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1360, height: 900 }, ...(opts.contextOptions || {}) });
      await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
      await ctx.route("https://wa.me/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>WhatsApp</title>ok" }));
      await ctx.addInitScript(() => { window.open = () => null; });
      const page = await ctx.newPage();
      await page.goto(`${srv.base}guide-spot-genuine-perfume.html`, { waitUntil: "load" });
      const btn = page.locator(".cta-band [data-wa]"); await btn.scrollIntoViewIfNeeded(); await btn.click();
      await page.waitForURL(new RegExp(`^https://wa\\.me/${SITE.contact.whatsapp}\\?text=`), { timeout: 10000 });
      assert.ok(decodeURIComponent(page.url().split("text=")[1]).includes("question about a perfume"));
      await ctx.close();
    });

    test("nothing in this browser logged an error", () => assert.deepEqual(opened.flatMap((o) => o.errors), []));
  });
});

// Responsive layout: every page and key state on 26 screen sizes (phones → ultrawide), plus the breakpoint rules.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { launch, openPage } from "./lib/browser.mjs";
import { DEVICES, auditDevice, contextFor } from "./lib/responsive.mjs";

describe("responsive layout", () => {
  let browser;
  const opened = [];
  const open = async (file, w, h, extra = {}) => {
    const c = await openPage(browser, file, { viewport: { width: w, height: h }, contextOptions: contextFor(w), ...extra });
    opened.push(c);
    await c.page.evaluate(() => document.querySelectorAll(".reveal").forEach((e) => e.classList.add("in")));
    return c.page;
  };
  before(async () => { browser = await launch(); });
  after(async () => { await browser.close(); });

  // The same audit in LIGHT mode. Layout doesn't depend on colour, so a spread of screens is enough: the smallest
  // phone (header now has three buttons), common phones, a phone sideways, tablets, laptops, desktop and ultrawide.
  describe("light mode: the same audit on representative screens", () => {
    for (const [w, h, label] of DEVICES.filter(([w, h]) => [[320, 568], [360, 640], [390, 844], [412, 915], [430, 932], [568, 320], [844, 390], [768, 1024], [1024, 768], [1366, 768], [1920, 1080], [3440, 1440]].some(([a, b]) => a === w && b === h))) {
      test(`${w}×${h}  ${label}  (light)`, async () => {
        const { findings } = await auditDevice(browser, [w, h], { scheme: "light" });
        assert.deepEqual([...new Set(findings)].slice(0, 12), []);
      });
    }
  });

  describe("every page + menu, cart, quiz and contact form on each screen size", () => {
    // Checks: nothing sticks out sideways, no clipped text, header parts never collide, links don't wrap,
    // tap targets ≥ 44px (chips ≥ 40px), no text under 11px, nothing covered by something else,
    // and the cart / quiz / menu stay usable (also with the phone held sideways).
    for (const [w, h, label] of DEVICES) {
      test(`${w}×${h}  ${label}`, async () => {
        const { findings } = await auditDevice(browser, [w, h]);
        assert.deepEqual([...new Set(findings)].slice(0, 12), []);
      });
    }
  });

  describe("breakpoints and scaling", () => {
    test("catalogue columns grow with the screen: 1 on phones → 5 on big monitors", async () => {
      const want = { 320: 1, 390: 1, 540: 1, 568: 2, 768: 2, 1024: 3, 1280: 4, 1440: 4, 1920: 5, 2560: 5 };
      const got = {};
      for (const w of Object.keys(want)) {
        const p = await open("catalogue.html", +w, 900);
        got[w] = await p.evaluate(() => { const cards = [...document.querySelectorAll("#grid .card")], t = Math.round(cards[0].getBoundingClientRect().top); return cards.filter((c) => Math.abs(Math.round(c.getBoundingClientRect().top) - t) < 3).length; });
      }
      assert.deepEqual(got, want);
    });

    test("the header collapses into a menu button at 1000px and below, and shows all six links above, each on one line and with the logo unsqueezed", async () => {
      const at1000 = await open("index.html", 1000, 800), at1001 = await open("index.html", 1001, 800);
      assert.equal(await at1000.locator("#menu-btn").isVisible(), true);
      assert.equal(await at1000.locator("#nav a").first().isVisible(), false, "links should be tucked into the menu at 1000px");
      assert.equal(await at1001.locator("#menu-btn").isVisible(), false);
      assert.equal(await at1001.locator("#nav a").count(), 6);
      const r = await at1001.evaluate(() => {
        const lines = (a) => { const rg = document.createRange(); rg.selectNodeContents(a); return new Set([...rg.getClientRects()].map((x) => Math.round(x.top))).size; };
        const brand = document.querySelector(".brand"), links = [...document.querySelectorAll("#nav a")];
        return { rows: new Set(links.map((a) => Math.round(a.getBoundingClientRect().top))).size, wrapped: links.filter((a) => lines(a) > 1).map((a) => a.textContent), brandSqueezed: brand.scrollWidth > Math.ceil(brand.getBoundingClientRect().width) };
      });
      assert.equal(r.rows, 1, "the six links should sit on one row"); assert.deepEqual(r.wrapped, [], "no link wraps onto two lines"); assert.equal(r.brandSqueezed, false, "the shop name keeps its full width");
    });

    test("header height is 68px, and slimmer (56px) when a phone is held sideways", async () => {
      const h = async (w, ht) => Math.round((await (await open("index.html", w, ht)).locator(".site-header").boundingBox()).height);
      assert.equal(await h(1440, 900), 68);
      assert.equal(await h(390, 844), 68);
      assert.equal(await h(667, 375), 56);
    });

    test("the open menu never leaves a link out of reach: it fits a sideways phone, and scrolls on a very short screen", async () => {
      const probe = async (h) => {
        const p = await open("index.html", 568, h);
        await p.click("#menu-btn");
        await p.waitForTimeout(300);
        return p.evaluate(() => { const n = document.querySelector("#nav"); const scrolls = n.scrollHeight > n.clientHeight + 1; n.scrollTop = n.scrollHeight; const last = n.querySelector("a:last-child").getBoundingClientRect(); return { scrolls, overflowY: getComputedStyle(n).overflowY, lastBottom: Math.round(last.bottom), vh: innerHeight }; });
      };
      const sideways = await probe(375), small = await probe(320), tiny = await probe(240);
      assert.equal(sideways.scrolls, false, "all six links should fit a 375px-tall screen (a phone held sideways) without scrolling");
      assert.ok(sideways.lastBottom <= sideways.vh, `last link ends at ${sideways.lastBottom}px on a ${sideways.vh}px screen`);
      for (const s of [small, tiny]) { assert.equal(s.scrolls, true); assert.equal(s.overflowY, "auto"); assert.ok(s.lastBottom <= s.vh, `after scrolling, the last link ends at ${s.lastBottom}px on a ${s.vh}px screen`); }
      assert.equal(tiny.scrolls, true);
      assert.equal(tiny.overflowY, "auto");
      assert.ok(tiny.lastBottom <= tiny.vh, `after scrolling, the last link ends at ${tiny.lastBottom}px on a ${tiny.vh}px screen`);
    });

    test("the quiz close button stays in view while long results scroll", async () => {
      const p = await open("catalogue.html", 390, 844, { query: "?quiz=1" });
      await p.waitForTimeout(150);
      await p.locator(".quiz-opt").first().click();
      while (await p.locator(".quiz-opts").count()) await p.click(".quiz-skip");
      for (let i = 0; i < 4; i++) await p.click(".quiz-more");
      await p.evaluate(() => { const c = document.querySelector(".modal-card"); c.scrollTop = c.scrollHeight; });
      await p.waitForTimeout(150);
      const r = await p.evaluate(() => { const b = document.querySelector("#quiz-close").getBoundingClientRect(); return { top: Math.round(b.top), onTop: document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)?.closest("#quiz-close") !== null }; });
      assert.ok(r.top >= 0 && r.top < 90, `close button at ${r.top}px from the top`);
      assert.equal(r.onTop, true, "close button is covered by something");
    });

    test("form text is 16px+ on phones, so iPhones don't zoom the page when you tap a field", async () => {
      const cat = await open("catalogue.html", 390, 844), con = await open("contact.html", 390, 844);
      const size = (p, sel) => p.evaluate((s) => parseFloat(getComputedStyle(document.querySelector(s)).fontSize), sel);
      for (const sel of ["#q", "#brand", "#sort"]) assert.ok((await size(cat, sel)) >= 16, `${sel} is ${await size(cat, sel)}px`);
      for (const sel of ["#rq-perfume", "#rq-brand", "#rq-size", "#rq-budget", "#rq-name", "#rq-notes"]) assert.ok((await size(con, sel)) >= 16, `${sel} is ${await size(con, sel)}px`);
    });

    test("the notes box uses the site font, not the browser's monospace default", async () => {
      const p = await open("contact.html", 1360, 900);
      const f = await p.evaluate(() => ({ area: getComputedStyle(document.querySelector("#rq-notes")).fontFamily, input: getComputedStyle(document.querySelector("#rq-name")).fontFamily }));
      assert.equal(f.area, f.input);
    });

    test("big screens get a wider page and slightly larger type", async () => {
      const want = { 1366: [16, 1180], 1600: [16, 1320], 1920: [18, 1440], 2560: [20, 1600] };
      const got = {};
      for (const w of Object.keys(want)) {
        const p = await open("index.html", +w, 1000);
        got[w] = await p.evaluate(() => [parseFloat(getComputedStyle(document.documentElement).fontSize), Math.round(document.querySelector(".wrap").getBoundingClientRect().width)]);
      }
      assert.deepEqual(got, want);
    });

    test("product cards don't stay 'lifted' after a tap (no hover on touch screens)", async (t) => {
      const p = await open("catalogue.html", 390, 844);
      const touchOnly = await p.evaluate(() => matchMedia("(hover: none)").matches);
      if (!touchOnly) return t.diagnostic("browser doesn't report hover:none under touch emulation — skipped");
      await p.locator(".card").nth(1).hover();
      assert.equal(await p.locator(".card").nth(1).evaluate((c) => getComputedStyle(c).transform), "none");
    });
  });

  test("no console errors or failed requests while resizing around", () => assert.deepEqual(opened.flatMap((o) => o.errors), []));
});

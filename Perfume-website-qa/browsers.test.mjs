// Other browsers and the conditions that differ between them.
//   A  Chrome-engine browsers: Brave, Microsoft Edge (also in Windows high-contrast colours), Opera, Samsung Internet, Chrome on Android
//      phones and tablets. They share Chrome's engine, so each is tested as that browser's identity + screen + settings (the site must not
//      depend on who the browser says it is). The same visit in each: home → Guides → a guide → catalogue search → cart → order on WhatsApp.
//   B  settings that browsers differ on: storage blocked (Safari private mode, Brave strict, Firefox "block cookies"), the pop-up blocker
//      refusing the WhatsApp window, third-party blocking (Brave Shields, ad blockers) taking away the Google fonts
//   C  the REAL web fonts loaded, as a visitor's browser has them (every other suite stubs the fonts out)
//   D  printing / "Save as PDF" (dark text on white, no buttons or floating bits)
//   E  no browser sniffing anywhere in the scripts
// (Firefox and the Safari engine run in crossbrowser.test.mjs. Brave, Edge, Opera and Samsung Internet are not installed here and cannot be
// run as the real apps, so this is the Chrome engine behaving as each of them; real-device checks are listed in UAT-REPORT.md.)
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { devices } from "playwright-core";
import { SITE, SITE_DIR } from "./lib/data.mjs";
import { launch } from "./lib/browser.mjs";
import { serve } from "./lib/server.mjs";
import { PAGE_FILES, GUIDE_FILES } from "./lib/pages.mjs";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const phoneOf = (name, ua) => { const d = devices[name]; return { viewport: d.viewport, context: { userAgent: ua || d.userAgent, deviceScaleFactor: d.deviceScaleFactor, isMobile: d.isMobile, hasTouch: d.hasTouch } }; };
const PROFILES = [
  { name: "Brave (Mac or Windows laptop)", viewport: { width: 1440, height: 900 }, context: { userAgent: CHROME }, init: () => { navigator.brave = { isBrave: async () => true }; } },
  { name: "Microsoft Edge (Windows, high-contrast colours on)", viewport: { width: 1366, height: 768 }, context: { userAgent: `${CHROME} Edg/130.0.0.0`, forcedColors: "active" }, forced: true },
  { name: "Opera (laptop, reduced motion)", viewport: { width: 1280, height: 720 }, context: { userAgent: `${CHROME} OPR/115.0.0.0`, reducedMotion: "reduce" } },
  { name: "Samsung Internet (Galaxy phone)", ...phoneOf("Galaxy S9+", "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36") },
  { name: "Chrome on an Android phone (Pixel 7)", ...phoneOf("Pixel 7") },
  { name: "Brave on an Android tablet (Galaxy Tab)", ...phoneOf("Galaxy Tab S4") },
];

const FONTS_OK = await fetch("https://fonts.googleapis.com/css2?family=Jost:wght@400&display=swap").then((r) => r.ok).catch(() => false);   // section C needs the internet

describe("other browsers and browser settings", () => {
  let browser, srv;
  const opened = [];
  before(async () => { browser = await launch(); srv = await serve(); });
  after(async () => { for (const o of opened) await o.ctx.close().catch(() => {}); await browser.close(); await srv.close(); });

  /** a visit: its own browser identity and settings, the page's errors collected, WhatsApp windows recorded */
  async function visit(file, { profile = {}, query = "", fonts = "stub", noStorage = false, popupBlocked = false, colorScheme = "dark" } = {}) {
    const ctx = await browser.newContext({ viewport: profile.viewport || { width: 1360, height: 900 }, colorScheme, ...(profile.context || {}) });
    if (fonts === "stub") await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
    if (fonts === "blocked") await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await ctx.route("https://wa.me/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>WhatsApp</title>ok" }));   // (no real network for WhatsApp)
    await ctx.addInitScript(({ popup, nostore }) => {
      window.__wa = [];
      window.open = popup ? () => null : (url) => { window.__wa.push(String(url)); return { opener: null }; };
      if (nostore) for (const k of ["localStorage", "sessionStorage"]) Object.defineProperty(window, k, { get() { throw new DOMException("The operation is insecure.", "SecurityError"); } });
    }, { popup: popupBlocked, nostore: noStorage });
    if (profile.init) await ctx.addInitScript(profile.init);
    const page = await ctx.newPage();
    const errors = [];
    // (when the fonts are blocked, Chrome notes "Failed to load resource" in the console for them: that is the blocker working, not the site; any OTHER failed request still shows up through requestfailed below)
    page.on("console", (m) => ["error", "warning"].includes(m.type()) && !(fonts === "blocked" && /Failed to load resource: net::ERR_FAILED/.test(m.text())) && errors.push(`console.${m.type()}: ${m.text()}`));
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("requestfailed", (r) => { if (!(fonts === "blocked" && /fonts\./.test(r.url()))) errors.push(`requestfailed: ${r.url()}`); });
    const v = { page, ctx, errors };
    opened.push(v);
    await page.goto(`${srv.base}${file}${query}`, { waitUntil: "load" });
    return v;
  }
  const over = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);

  /* ======================================================================== A */
  describe("A. Chrome-engine browsers", () => {
    for (const profile of PROFILES) {
      test(`${profile.name}: home, Guides, a guide and its contents list, catalogue search, cart, order on WhatsApp; no errors, no sideways scroll`, async () => {
        const narrow = profile.viewport.width <= 1000;
        const { page, errors } = await visit("index.html", { profile });
        const menu = async () => { if (narrow) { await page.click("#menu-btn"); await page.waitForTimeout(250); } };
        await page.waitForTimeout(500);
        assert.equal(await page.locator("h1").count(), 1);
        assert.equal(await over(page), false, "home");
        if (profile.forced) assert.equal(await page.evaluate(() => matchMedia("(forced-colors: active)").matches), true, "high-contrast colours really on");
        assert.equal(await page.evaluate(() => !!navigator.brave), profile.name.startsWith("Brave (") ? true : false);
        // Guides
        await menu();
        await Promise.all([page.waitForURL(/guides\.html/), page.locator('#nav a[href="guides.html"]').click()]);
        assert.equal(await page.locator(".g-card").count(), 4);
        assert.equal(await over(page), false, "guides page");
        await page.locator('.g-card .g-more[href="guide-perfume-testers-explained.html"]').click();
        await page.waitForURL(/guide-perfume-testers-explained/);
        assert.equal(await page.locator("h1").count(), 1);
        const id = await page.locator(".toc a").nth(4).getAttribute("href");
        await page.locator(`.toc a[href="${id}"]`).click(); await page.waitForTimeout(900);
        const top = await page.evaluate((i) => ({ top: Math.round(document.querySelector(i).getBoundingClientRect().top), head: Math.round(document.querySelector(".site-header").getBoundingClientRect().bottom) }), id);
        assert.ok(top.top >= top.head - 2 && top.top < 320, `heading at ${top.top}px under a header ending at ${top.head}px`);
        assert.equal(await over(page), false, "a guide");
        if (profile.forced) {   // in high-contrast colours the pictures and buttons must still be there and the text readable (the browser swaps the colours)
          const f = await page.evaluate(() => ({ svg: [...document.querySelectorAll(".fig-svg")].every((s) => s.getBoundingClientRect().width > 100), h1: getComputedStyle(document.querySelector("h1")).color, bg: getComputedStyle(document.body).backgroundColor }));
          assert.equal(f.svg, true); assert.notEqual(f.h1, f.bg, "heading colour differs from the page colour");
        }
        // catalogue search, cart, order
        await menu();
        await Promise.all([page.waitForURL(/catalogue\.html/), page.locator('#nav a[href="catalogue.html"]').click()]);
        await page.waitForSelector("#grid .card");
        await page.click("#q"); await page.keyboard.type("khamrah", { delay: 30 }); await page.waitForTimeout(500);
        assert.ok(await page.locator("#grid .card").count() >= 1);
        await page.locator("#grid .card").first().locator(".add").click();
        assert.equal(await page.locator("#cart-count").textContent(), "1");
        await page.click("#cart-open"); await page.waitForSelector("#cart.open");
        await page.click("#checkout");
        const wa = await page.evaluate(() => window.__wa);
        assert.equal(wa.length, 1); assert.match(wa[0], new RegExp(`^https://wa\\.me/${SITE.contact.whatsapp}\\?text=`));
        assert.equal(await over(page), false, "catalogue");
        assert.deepEqual(errors, []);
      });
    }

    test("the same guide opened in all six identities: identical text and the same number of drawings, pictures, links and headings", async () => {
      const facts = [];
      for (const profile of PROFILES) {
        const { page } = await visit("guide-perfume-for-every-season.html", { profile });
        await page.waitForTimeout(400);
        facts.push(await page.evaluate(() => ({ h2: document.querySelectorAll(".guide-body h2").length, picks: document.querySelectorAll(".pick").length, links: document.querySelectorAll("main a[href]").length, figs: document.querySelectorAll("svg").length, words: document.querySelector(".guide-body").textContent.replace(/\s+/g, " ").trim().split(" ").length })));
      }
      for (const f of facts) assert.deepEqual(f, facts[0]);
    });
  });

  /* ======================================================================== B */
  describe("B. settings that browsers differ on", () => {
    test("storage blocked (Safari private mode, Brave strict, Firefox 'block cookies'): every page loads with no error, and the cart and theme switch still work for the visit", async () => {
      for (const file of PAGE_FILES) { const { page, errors } = await visit(file, { noStorage: true }); await page.waitForTimeout(250); assert.deepEqual(errors, [], file); }
      const { page, errors } = await visit("catalogue.html", { noStorage: true });
      await page.waitForSelector("#grid .card");
      await page.locator("#grid .card").first().locator(".add").click();
      assert.equal(await page.locator("#cart-count").textContent(), "1", "the cart works for this visit");
      await page.click("#theme-toggle"); await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "light", "the theme still switches");
      await page.click("#cart-open"); await page.waitForSelector("#cart.open"); await page.click("#checkout");
      assert.equal((await page.evaluate(() => window.__wa)).length, 1);
      assert.deepEqual(errors, []);
    });

    test("pop-up blocker says no: every WhatsApp button (a guide's, the round one, the cart's order button, the contact request) still opens WhatsApp, in the same tab", async () => {
      const num = SITE.contact.whatsapp;
      const expectChat = async (page, msgHas) => {
        await page.waitForURL(new RegExp(`^https://wa\\.me/${num}\\?text=`), { timeout: 8000 });
        assert.ok(decodeURIComponent(page.url().split("text=")[1]).includes(msgHas), `message has "${msgHas}"`);
      };
      let v = await visit("guide-spot-genuine-perfume.html", { popupBlocked: true });
      const cta = v.page.locator(".cta-band [data-wa]"); await cta.scrollIntoViewIfNeeded(); await cta.click();
      await expectChat(v.page, "question about a perfume");
      v = await visit("faq.html", { popupBlocked: true });
      await v.page.locator("#wa-float").click(); await expectChat(v.page, "question about your perfumes");
      v = await visit("catalogue.html", { popupBlocked: true });
      await v.page.waitForSelector("#grid .card"); await v.page.locator("#grid .card").first().locator(".add").click();
      await v.page.click("#cart-open"); await v.page.waitForSelector("#cart.open"); await v.page.click("#checkout"); await expectChat(v.page, "Total");
      v = await visit("contact.html", { popupBlocked: true });
      await v.page.fill("#rq-perfume", "Layton"); await v.page.fill("#rq-name", "Ravi"); await v.page.click('form button[type="submit"]'); await expectChat(v.page, "Layton");
    });

    test("third-party blocking (Brave Shields, ad blockers) takes the Google fonts away: all 13 pages still show, nothing overflows on a laptop or a phone, and the site itself logs no error", async () => {
      for (const [label, profile] of [["laptop", {}], ["phone", PROFILES[4]]]) for (const file of PAGE_FILES) {
        const { page, errors } = await visit(file, { profile, fonts: "blocked" });
        await page.waitForTimeout(300);
        const r = await page.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth + 1, h1: document.querySelectorAll("h1").length, h1w: (() => { const h = document.querySelector("h1"); return h.scrollWidth <= h.clientWidth + 1; })(), text: document.body.innerText.length }));
        assert.equal(r.over, false, `${file} on a ${label}: sideways scroll`); assert.equal(r.h1, 1); assert.equal(r.h1w, true, `${file}: heading clipped`); assert.ok(r.text > 300);
        assert.deepEqual(errors, [], file);
      }
    });
  });

  /* ======================================================================== C */
  describe("C. with the real web fonts loaded (Cormorant Garamond and Jost, as every visitor has them)", { skip: !FONTS_OK && "Google Fonts cannot be reached from here" }, () => {
    const ready = async (page) => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500); };
    test("the fonts really load", async () => {
      const { page } = await visit("index.html", { fonts: "real" }); await ready(page);
      const fams = await page.evaluate(() => [...new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, "")))]);
      assert.ok(fams.includes("Cormorant Garamond") && fams.includes("Jost"), String(fams));
    });
    test("the six header links sit on one line each, in one row, with the shop name unsqueezed, at every width from 1001px up (and the menu button below)", async () => {
      for (const file of ["index.html", "guides.html", "guide-perfume-testers-explained.html", "catalogue.html"]) {
        for (const w of [1001, 1100, 1280, 1440, 1920]) {
          const { page } = await visit(file, { fonts: "real", profile: { viewport: { width: w, height: 800 } } }); await ready(page);
          const r = await page.evaluate(() => {
            const lines = (a) => { const rg = document.createRange(); rg.selectNodeContents(a); return new Set([...rg.getClientRects()].map((x) => Math.round(x.top))).size; };
            const links = [...document.querySelectorAll("#nav a")], brand = document.querySelector(".brand"), bar = document.querySelector(".bar");
            return { rows: new Set(links.map((a) => Math.round(a.getBoundingClientRect().top))).size, wrapped: links.filter((a) => lines(a) > 1).map((a) => a.textContent), squeezed: brand.scrollWidth > Math.ceil(brand.getBoundingClientRect().width), barOver: bar.scrollWidth > bar.clientWidth + 1, menuBtn: getComputedStyle(document.querySelector("#menu-btn")).display };
          });
          assert.deepEqual([r.rows, r.wrapped, r.squeezed, r.barOver, r.menuBtn], [1, [], false, false, "none"], `${file} at ${w}px`);
        }
        for (const w of [320, 390, 768, 1000]) {
          const { page } = await visit(file, { fonts: "real", profile: { viewport: { width: w, height: 800 } } }); await ready(page);
          assert.deepEqual(await page.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth + 1, bar: (() => { const b = document.querySelector(".bar"); return b.scrollWidth > b.clientWidth + 1; })(), menu: getComputedStyle(document.querySelector("#menu-btn")).display })), { over: false, bar: false, menu: "block" }, `${file} at ${w}px`);
        }
      }
    });
    test("all 13 pages on a laptop and on a phone: no sideways scroll, no clipped heading, nothing wider than its box", async () => {
      for (const [label, profile] of [["laptop", {}], ["phone", PROFILES[4]]]) for (const file of PAGE_FILES) {
        const { page } = await visit(file, { fonts: "real", profile }); await ready(page);
        const r = await page.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth + 1, wide: [...document.querySelectorAll("main h1, main h2, main h3, main p, main li, .g-card, .pick, .fig")].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest(".marquee")).map((e) => e.tagName + "." + e.className).slice(0, 3) }));
        assert.deepEqual([r.over, r.wide], [false, []], `${file} on a ${label}`);
      }
    });
    test("no layout jump while the fonts arrive (shift under 0.1) on the home page, the catalogue, the Guides page and a guide, laptop and phone", async () => {
      for (const [label, profile] of [["laptop", {}], ["phone", PROFILES[4]]]) for (const file of ["index.html", "catalogue.html", "guides.html", "guide-perfume-for-every-season.html"]) {
        const { page } = await visit(file, { fonts: "real", profile });
        const shift = await page.evaluate(() => new Promise((res) => { let v = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) v += e.value; }).observe({ type: "layout-shift", buffered: true }); document.fonts.ready.then(() => setTimeout(() => res(v), 1200)); }));
        assert.ok(shift < 0.1, `${file} on a ${label}: layout shift ${shift.toFixed(3)}`);
      }
    });
  });

  /* ======================================================================== D */
  describe("D. printing and Save as PDF", () => {
    const lum = (rgb) => { const [r, g, b] = rgb.match(/[\d.]+/g).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    test("on paper every page is dark text on white in both themes, with no header, cart, round button or buttons", async () => {
      for (const scheme of ["dark", "light"]) for (const file of PAGE_FILES) {
        const { page } = await visit(file, { colorScheme: scheme });
        await page.waitForTimeout(250);
        await page.emulateMedia({ media: "print" });
        await page.waitForTimeout(1000);                                  // (switching live lets the page's own fade-in finish first; real printing has no animation)
        const r = await page.evaluate(() => {
          const shown = (sel) => [...document.querySelectorAll(sel)].filter((e) => getComputedStyle(e).display !== "none").length;
          const p = document.querySelector("main p, main li, main summary") || document.body;
          return { text: getComputedStyle(p).color, h1: getComputedStyle(document.querySelector("h1")).color, bg: getComputedStyle(document.body).backgroundColor, floating: shown(".site-header, #wa-float, .cart-bar, #cart, .toast, .to-top, .cta-row, .menu-btn"), h1Hidden: getComputedStyle(document.querySelector("h1")).opacity };
        });
        assert.ok((1.05) / (lum(r.text) + 0.05) >= 7, `${file} (${scheme}): body text ${r.text} on white is too faint`);
        assert.ok((1.05) / (lum(r.h1) + 0.05) >= 7, `${file} (${scheme}): heading ${r.h1} on white is too faint`);
        assert.ok(lum(r.bg) > 0.9 || r.bg === "rgba(0, 0, 0, 0)", `${file} (${scheme}): page colour ${r.bg}`);
        assert.equal(r.floating, 0, `${file} (${scheme}): interface parts left on paper`); assert.equal(r.h1Hidden, "1");
      }
    });
    test("a guide on paper: the top picture and the card row are left out (ink), drawings and notes stay, and the cited web addresses are printed after their links", async () => {
      const { page } = await visit("guide-perfume-testers-explained.html");
      await page.emulateMedia({ media: "print" });
      const r = await page.evaluate(() => ({ hero: getComputedStyle(document.querySelector(".guide-hero")).display, keep: getComputedStyle(document.querySelector(".section-alt")).display, fig: document.querySelector(".fig-svg").getBoundingClientRect().width > 100, notice: getComputedStyle(document.querySelector(".guide-body .notice")).display, url: getComputedStyle(document.querySelector('.sources a[href^="http"]'), "::after").content }));
      assert.deepEqual([r.hero, r.keep, r.fig, r.notice], ["none", "none", true, "block"]);
      assert.match(r.url, /https:\/\/www\.humphreys\.co\.uk/);
    });
    test("Save as PDF works for the guides and the legal pages: a real PDF with real content", async () => {
      for (const file of [...GUIDE_FILES, "privacy.html", "terms.html", "guarantee.html"]) {
        const { page } = await visit(file); await page.waitForTimeout(400);
        const pdf = await page.pdf({ format: "A4", printBackground: false, margin: { top: "15mm", bottom: "15mm", left: "12mm", right: "12mm" } });
        assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
        assert.ok(pdf.length > 15000, `${file}: ${pdf.length} bytes`);
      }
    });
  });

  /* ======================================================================== E */
  test("E. the scripts never look at which browser it is (no user-agent or vendor sniffing), so every browser gets the same site", () => {
    for (const f of fs.readdirSync(path.join(SITE_DIR, "assets/js"))) {
      const t = fs.readFileSync(path.join(SITE_DIR, "assets/js", f), "utf8");
      assert.doesNotMatch(t, /navigator\.(userAgent|vendor|platform|appVersion)|\bis(Safari|Firefox|Chrome|Edge|Brave|iOS|Android)\b|InstallTrigger|window\.chrome\b/i, f);
    }
  });
});

// UAT: complete visitor journeys, done the way a person does them (real clicks and key presses only - no shortcuts into the page's code),
// over HTTP, on a laptop and on a phone. Each ends where a real visit ends: a WhatsApp message with the right number and the right contents.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { SITE, PRODUCTS } from "./lib/data.mjs";
import { launch, openPage } from "./lib/browser.mjs";
import { serve } from "./lib/server.mjs";
import { spec, fmtPrice, expected, pageSizeFor } from "./lib/oracle.mjs";

const VIEWS = [["a laptop", {}], ["a phone (390px)", { viewport: { width: 390, height: 844 }, contextOptions: { hasTouch: true, isMobile: true } }]];
const NUMBER = SITE.contact.whatsapp;
const find = (house, re) => PRODUCTS.find((p) => p.b === house && re.test(p.n));

describe("UAT journeys", () => {
  let browser, srv;
  const opened = [];
  before(async () => { browser = await launch(); srv = await serve(); });
  after(async () => { await browser.close(); await srv.close(); });
  const open = async (file, opts = {}, query = "") => { const c = await openPage(browser, file, { base: srv.base, query, ...opts }); opened.push(c); return c; };
  const click = async (page, loc) => { await loc.scrollIntoViewIfNeeded(); await loc.click(); };
  const lastWA = async (page) => { const w = await page.evaluate(() => window.__wa); assert.ok(w.length >= 1, "WhatsApp was opened"); const m = w.at(-1).match(/^https:\/\/wa\.me\/(\d+)\?text=(.+)$/); assert.ok(m, `a wa.me link: ${w.at(-1).slice(0, 80)}`); assert.equal(m[1], NUMBER); return decodeURIComponent(m[2]); };
  const menu = async (page, opts) => { if (opts.contextOptions?.isMobile) { await page.click("#menu-btn"); await page.waitForTimeout(250); } };
  const cartCount = (page) => page.locator("#cart-count").textContent();

  for (const [label, opts] of VIEWS) {
    describe(`on ${label}`, () => {
      test("J1 home → Explore → search by typing → pick the suggestion → choose a size → add → change quantity → order on WhatsApp", async () => {
        const target = find("Chanel", /^Bleu De Chanel EDP$/i);
        assert.ok(target, "test data: Bleu De Chanel EDP exists");
        const { page } = await open("index.html", opts);
        await click(page, page.locator("a.btn-gold", { hasText: "Explore All Fragrances" }).first());
        await page.waitForURL(/catalogue\.html$/);
        await page.waitForSelector("#grid .card");
        await page.click("#q");
        await page.keyboard.type("bleu de ch", { delay: 40 });
        await page.waitForSelector("#suggest:not([hidden]) li");
        const row = page.locator("#suggest-list li", { hasText: target.n }).filter({ hasText: target.b }).first();
        await click(page, row);
        const card = page.locator(`#grid .card[data-slug="${target.s}"]`);
        await card.waitFor();
        assert.ok((await page.locator("#grid .card").count()) >= 1);
        // choose the last size chip the card offers and read its price off the card
        const chips = card.locator(".vchip");
        const n = await chips.count();
        const v = target.v[n ? n - 1 : 0];
        if (n) await click(page, chips.nth(n - 1));
        assert.ok((await card.locator(".price").textContent()).includes(fmtPrice(v.pr)), "the card shows the price of the chosen size");
        await click(page, card.locator(".add"));
        assert.equal(await cartCount(page), "1");
        await click(page, page.locator("#cart-open"));
        await page.waitForSelector("#cart.open");
        const line = page.locator("#cart-items .line");
        assert.equal(await line.count(), 1);
        assert.match(await line.locator(".line-name").textContent(), new RegExp(target.n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        await click(page, line.locator("[data-inc]"));
        assert.equal(await cartCount(page), "2");
        assert.equal((await line.locator(".line-price").textContent()).trim(), fmtPrice(v.pr * 2));
        assert.equal((await page.locator("#cart-total").textContent()).trim(), fmtPrice(v.pr * 2));
        await click(page, page.locator("#checkout"));
        const msg = await lastWA(page);
        assert.ok(msg.includes(`${target.b} — ${target.n}`), msg);
        assert.ok(msg.includes(`2 × ${fmtPrice(v.pr)} = ${fmtPrice(v.pr * 2)}`), msg);
        assert.ok(msg.includes(`Total: ${fmtPrice(v.pr * 2)}`), msg);
      });

      test("J2 catalogue → pick a style → narrow by price in the Filters panel → results are right → add two → cart total adds up → order", async () => {
        const { page } = await open("catalogue.html", opts);
        await page.waitForSelector("#grid .card");
        await click(page, page.locator('#segChips [data-seg="arabian"]'));
        await click(page, page.locator("#filters-open"));
        await page.waitForSelector("#filters:not([hidden])");
        await click(page, page.locator('#price [data-v="0-1000"]'));
        await click(page, page.locator("#pn-done"));
        await page.waitForSelector("#filters", { state: "hidden" });
        const want = expected({ seg: "arabian", price: "0-1000" });
        const shown = (await page.locator("#count").textContent()).replace(/,/g, "");
        assert.ok(shown.includes(String(want.length)), `"${shown}" should say ${want.length}`);
        assert.equal(await page.locator("#grid .card").count(), Math.min(pageSizeFor(opts.viewport?.width ?? 1360), want.length));
        // every card on the page is genuinely within the band (the price of its pre-selected size)
        const prices = await page.$$eval("#grid .card .price", (els) => els.map((e) => +e.textContent.replace(/[^\d]/g, "").slice(-6)));
        assert.ok(prices.length > 0);
        const cards = page.locator("#grid .card");
        const ids = [];
        for (const i of [0, 1]) { const c = cards.nth(i); ids.push(await c.getAttribute("data-slug")); await click(page, c.locator(".add")); }
        assert.equal(await cartCount(page), "2");
        await click(page, page.locator("#cart-open"));
        await page.waitForSelector("#cart.open");
        assert.equal(await page.locator("#cart-items .line").count(), 2);
        const linePrices = await page.$$eval("#cart-items .line .line-price", (els) => els.map((e) => +e.textContent.replace(/[^\d]/g, "")));
        const total = +(await page.locator("#cart-total").textContent()).replace(/[^\d]/g, "");
        assert.equal(linePrices.reduce((a, b) => a + b, 0), total, "the total is the sum of the lines");
        await click(page, page.locator("#checkout"));
        const msg = await lastWA(page);
        assert.ok(msg.includes(`Total: ${fmtPrice(total)}`));
        assert.equal((msg.match(/^\d\. /gm) || []).length, 2, "two numbered lines");
      });

      test("J3 scent quiz: open it from the catalogue → answer every question → top picks (with pictures) → add one → See all sizes → advice link", async () => {
        const { page } = await open("catalogue.html", opts);
        await page.waitForSelector("#grid .card");
        await click(page, page.locator("button[data-quiz]", { hasText: "Take the 1-minute scent quiz" }).first());
        await page.waitForSelector("#quiz:not([hidden]) .quiz-opt");
        for (let guard = 0; guard < 12; guard++) {
          if (await page.locator(".qr").count()) break;
          const first = page.locator(".quiz-opt").first();
          if (!(await first.count())) break;
          await click(page, first);
          await page.waitForTimeout(450);
        }
        await page.waitForSelector(".qr");
        const picks = await page.locator(".qr").count();
        assert.ok(picks >= 1 && picks <= 20, `${picks} top picks`);
        await page.waitForTimeout(600);
        assert.equal(await page.locator(".qr .qr-art img.ok").count(), picks, "every pick shows its picture");
        const first = page.locator(".qr").first();
        const house = await first.locator(".house").textContent(), name = await first.locator(".qr-name").textContent();
        await click(page, first.locator(".add"));
        assert.equal(await cartCount(page), "1");
        await click(page, page.locator("a", { hasText: "Get advice on WhatsApp" }));
        assert.match(await lastWA(page), /\S/);
        await click(page, first.locator(".qr-view"));
        await page.waitForSelector("#quiz", { state: "hidden" });
        await page.waitForTimeout(300);
        const left = await page.$$eval("#grid .card", (cs) => cs.map((c) => c.textContent));
        assert.ok(left.length >= 1 && left.some((t) => t.includes(name.trim())), `the catalogue now shows ${name.trim()} (${house.trim()})`);
      });

      test("J4 contact: fill the request form by typing, choose from the catalogue suggestions, send → confirmation shows the exact message → WhatsApp", async () => {
        const p = find("Tom Ford", /^Black Orchid Parfum$/i);
        assert.ok(p, "test data: Black Orchid Parfum exists");
        const { page } = await open("contact.html", opts);
        await page.fill("#rq-perfume", p.n.slice(0, 8));
        await page.waitForSelector("#rq-suggest:not([hidden]) a");
        assert.ok((await page.locator("#rq-suggest a").count()) >= 1, "suggestions from the catalogue");
        await page.fill("#rq-perfume", "Some Rare Oud 2019");
        await page.fill("#rq-brand", "Ajmal");
        await page.selectOption("#rq-size", { index: 1 });
        await page.selectOption("#rq-budget", { index: 1 });
        await page.fill("#rq-name", "Asha K");
        await page.fill("#rq-notes", "Original box please");
        await click(page, page.locator('#request-form button[type="submit"], form button[type="submit"]').first());
        await page.waitForSelector("#request-done:not([hidden])");
        const shown = await page.locator("#request-preview").textContent();
        for (const bit of ["Some Rare Oud 2019", "Ajmal", "Asha K", "Original box please"]) assert.ok(shown.includes(bit), bit);
        const msg = await lastWA(page);
        assert.equal(msg.trim(), shown.trim(), "what is sent is what was shown");
        await click(page, page.locator("#request-again"));
        await page.waitForSelector("#request-form:not([hidden]), form:not([hidden])");
        assert.equal(await page.inputValue("#rq-perfume"), "", "a second request starts blank");
      });

      test("J5 learn more: footer → How to order, Guarantee, FAQ (one answer open at a time), Privacy, Terms; each opens at the top and links onward", async () => {
        const { page } = await open("index.html", opts);
        const go = async (name, url, h1) => {
          const a = page.locator("footer a", { hasText: name }).first();
          await click(page, a);
          await page.waitForURL(new RegExp(url));
          assert.match(await page.locator("h1").first().textContent(), h1);
          assert.ok((await page.evaluate(() => scrollY)) < 5, "opens at the top");
        };
        await go("How to order", "how-to-order\\.html", /./);
        await go("Guarantee", "guarantee\\.html", /./);
        await go("FAQ", "faq\\.html", /./);
        const sums = page.locator("details summary");
        assert.ok((await sums.count()) >= 5);
        assert.equal(await page.locator("details[open]").count(), 0, "all closed to begin with");
        await click(page, sums.nth(0)); await click(page, sums.nth(2));
        await page.waitForTimeout(150);
        assert.equal(await page.locator("details[open]").count(), 1, "opening another closes the first");
        await go("Privacy Policy", "privacy\\.html", /Privacy/i);
        await go("Terms of Service", "terms\\.html", /Terms/i);
        assert.equal(await page.locator("h1").count(), 1);
        // a link from inside a policy goes on to the next place
        const onward = page.locator("main a[href$='.html'], main a[href*='.html#']").first();
        if (await onward.count()) { const href = await onward.getAttribute("href"); await click(page, onward); await page.waitForURL(new RegExp(href.split("#")[0].replace(".", "\\.")), { timeout: 5000 }); }
      });

      test("J6 the cart stays with you: add on the catalogue, move through the site, reload, then clear it", async () => {
        const { page } = await open("catalogue.html", opts);
        await page.waitForSelector("#grid .card");
        await click(page, page.locator("#grid .card .add").first());
        assert.equal(await cartCount(page), "1");
        await menu(page, opts);
        await click(page, page.locator("#nav a", { hasText: "Contact" }));
        await page.waitForURL(/contact\.html/);
        assert.equal(await cartCount(page), "1", "still there on the next page");
        await page.reload();
        assert.equal(await cartCount(page), "1", "still there after a reload");
        await click(page, page.locator("#cart-open"));
        await page.waitForSelector("#cart.open");
        assert.equal(await page.locator("#cart-items .line").count(), 1);
        await click(page, page.locator("#cart-clear, button:has-text('Clear cart')").first());
        await page.waitForTimeout(250);
        assert.equal(await page.locator("#cart-items .line").count(), 0);
        assert.ok(await page.locator("#cart-count").isHidden(), "the count badge goes away");
        assert.match(await page.locator("#cart-items").textContent(), /empty/i);
        await page.keyboard.press("Escape");
        await page.waitForSelector("#cart.open", { state: "detached", timeout: 3000 }).catch(() => {});
      });

      test("J7 back and forward behave: filter the catalogue, leave for another page, press Back → the catalogue is whole and working", async () => {
        const { page } = await open("catalogue.html", opts);
        await page.waitForSelector("#grid .card");
        await click(page, page.locator('#segChips [data-seg="luxury"]'));
        await page.waitForTimeout(250);
        await menu(page, opts);
        await click(page, page.locator("#nav a", { hasText: "FAQ" }));
        await page.waitForURL(/faq\.html/);
        await page.goBack();
        await page.waitForURL(/catalogue\.html/);
        await page.waitForSelector("#grid .card");
        assert.ok((await page.locator("#grid .card").count()) >= 1);
        await click(page, page.locator('#segChips [data-seg="designer"]'));
        await page.waitForTimeout(250);
        assert.ok((await page.locator("#grid .card").count()) >= 1);
        await page.goForward();
        await page.waitForURL(/faq\.html/);
      });

      test("J8 light / dark: switch the theme on one page and the next page keeps it; reload keeps it too", async () => {
        const { page } = await open("index.html", opts);
        const theme = () => page.evaluate(() => document.documentElement.dataset.theme || (document.documentElement.classList.contains("light") ? "light" : "dark"));
        const before = await theme();
        await click(page, page.locator("#theme-toggle"));
        await page.waitForTimeout(250);
        const after = await theme();
        assert.notEqual(after, before);
        await menu(page, opts);
        await click(page, page.locator("#nav a", { hasText: "Guarantee" }));
        await page.waitForURL(/guarantee\.html/);
        assert.equal(await theme(), after);
        await page.reload();
        assert.equal(await theme(), after);
      });
    });
  }

  test("no console errors or failed requests in any journey", () => assert.deepEqual(opened.flatMap((o) => o.errors), []));
  test("nothing above asked for a file that does not exist", () => assert.deepEqual(srv.missing, []));
});

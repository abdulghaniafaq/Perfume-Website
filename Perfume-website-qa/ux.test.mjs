// The final UX round: phone cart bar + "Added · View cart" message, floating WhatsApp button on every page, 24 cards a page on phones +
// back to top, the scent-quiz button beside Filters, "Name: A to Z" (its order is also checked in the filter suites), the "Mini" badge on
// pictures, tighter home spacing and a shorter catalogue heading on phones. Real taps / clicks, over HTTP.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { SITE, PRODUCTS } from "./lib/data.mjs";
import { launch, openPage } from "./lib/browser.mjs";
import { serve } from "./lib/server.mjs";
import { expected, spec, fmtPrice, pageSizeFor, PAGE_SIZE, PHONE_PAGE_SIZE } from "./lib/oracle.mjs";

const PAGES = ["index", "catalogue", "how-to-order", "guarantee", "faq", "contact", "privacy", "terms"].map((n) => `${n}.html`);
const PHONE = { viewport: { width: 390, height: 844 }, contextOptions: { hasTouch: true, isMobile: true } };
const LAPTOP = {};
const NUMBER = SITE.contact.whatsapp;

// the picture a mini has of its own (listed in the config), worked out here
const form = (v) => (v.g !== "Minis" ? "" : /dab/i.test(v.p) ? "dab" : /spray/i.test(v.p) ? "spray" : /vial/i.test(v.p) ? "vial" : "");
const ownPicture = (p, v) => !!form(v) && SITE.miniPhotos.includes(`${p.s}--${form(v)}`);
const wantBadge = (p, v) => v.g === "Minis" && !ownPicture(p, v);

describe("final UX round", () => {
  let browser, srv;
  const opened = [];
  before(async () => { browser = await launch(); srv = await serve(); });
  after(async () => { await browser.close(); await srv.close(); });
  const open = async (file, opts = {}, query = "") => { const c = await openPage(browser, file, { base: srv.base, query, ...opts }); opened.push(c); return c; };
  const tap = async (loc) => { await loc.scrollIntoViewIfNeeded(); await loc.click(); };
  const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom, vis: r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden" && getComputedStyle(e).display !== "none" }; }, sel);
  const hit = (a, b, gap = 0) => a && b && a.x < b.r + gap && a.r > b.x - gap && a.y < b.b + gap && a.b > b.y - gap;
  const lastWA = async (page) => { const w = await page.evaluate(() => window.__wa); assert.ok(w.length >= 1, "WhatsApp was opened"); const m = w.at(-1).match(/^https:\/\/wa\.me\/(\d+)\?text=(.+)$/); assert.ok(m, w.at(-1)); assert.equal(m[1], NUMBER); return decodeURIComponent(m[2]); };

  describe("the scent quiz is a visible button next to Filters", () => {
    test("laptop: sits on the same row as the search box and Filters, to the right of Filters, same height, reads 'Find my scent'; the old text link is gone", async () => {
      const { page } = await open("catalogue.html", LAPTOP);
      const [s, f, q] = await Promise.all(["#q", "#filters-open", ".quiz-btn"].map((x) => rect(page, x)));
      assert.ok(q.vis, "visible");
      assert.ok(Math.abs((q.y + q.h / 2) - (f.y + f.h / 2)) < 2, "centred on the Filters button's line");
      assert.ok(q.x >= f.r, "right of Filters");
      assert.ok(Math.abs(q.h - f.h) < 3, `same height (${q.h} vs ${f.h})`);
      assert.equal((await page.locator(".quiz-btn .q-short").innerText()).trim(), "Find my scent");
      assert.equal(await page.locator(".quiz-btn .q-long").isHidden(), true);
      assert.equal(await page.locator(".page-head .section-sub button, .page-head .section-sub a").count(), 0, "no text link in the heading any more");
      assert.equal(await page.locator("[data-quiz]").count(), 1, "one quiz button on the page");
    });
    test("phone: its own full-width row under the search box and Filters, with the longer wording, fits the screen and is a 44px+ target", async () => {
      const { page } = await open("catalogue.html", PHONE);
      const [s, f, q] = await Promise.all(["#q", "#filters-open", ".quiz-btn"].map((x) => rect(page, x)));
      assert.ok(q.vis && q.y >= Math.max(s.b, f.b) - 1, "below the search row");
      assert.ok(Math.abs(q.x - 16) < 2 && Math.abs(q.r - (390 - 16)) < 2, `spans the content width (${q.x}–${q.r})`);
      assert.ok(q.h >= 44, `${q.h}px tall`);
      const t = (await page.locator(".quiz-btn .q-long").innerText()).replace(/\s+/g, " ");
      assert.match(t, /Not sure where to start\? Take the 1-minute scent quiz/);
      assert.equal(await page.locator(".quiz-btn .q-short").isHidden(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.ok(!/1-\s*$/m.test(await page.locator(".quiz-btn .q-long").innerText()), "'1-minute' is never split across lines");
    });
    for (const [label, opts] of [["laptop", LAPTOP], ["phone", PHONE]]) {
      test(`${label}: tapping it opens the quiz, Esc closes it, and focus comes back to the button`, async () => {
        const { page } = await open("catalogue.html", opts);
        await tap(page.locator(".quiz-btn"));
        await page.waitForSelector("#quiz:not([hidden]) .quiz-opt");
        await page.keyboard.press("Escape");
        await page.waitForSelector("#quiz", { state: "hidden" });
        assert.equal(await page.evaluate(() => document.activeElement.classList.contains("quiz-btn")), true);
      });
    }
  });

  describe("24 cards a page on phones, 48 on bigger screens", () => {
    for (const [w, size] of [[320, 24], [390, 24], [760, 24], [761, 48], [820, 48], [1360, 48]]) {
      test(`${w}px wide: ${size} cards on the first page, the count line and the number of pages agree`, async () => {
        const { page } = await open("catalogue.html", { viewport: { width: w, height: 900 } });
        await page.waitForSelector("#grid .card");
        assert.equal(pageSizeFor(w), size, "the test's own rule");
        assert.equal(await page.locator("#grid .card").count(), size);
        assert.equal((await page.locator("#count").textContent()).trim(), `1–${size} of 627`);
        const pages = Math.ceil(627 / size);
        const nums = await page.$$eval("#pager .pg:not(.nav)", (bs) => bs.map((b) => +b.dataset.p));
        assert.equal(Math.max(...nums), pages);
        await page.click(`#pager .pg:not(.nav)[data-p="${pages}"]`);
        assert.equal(await page.locator("#grid .card").count(), 627 - (pages - 1) * size);
      });
    }
    test("turning the screen from laptop to phone and back keeps the cards you were looking at (the page that holds the first card)", async () => {
      const { page } = await open("catalogue.html", { viewport: { width: 1360, height: 900 } });
      await page.waitForSelector("#grid .card");
      const all = expected({}).map((r) => r.slug);
      await page.click('#pager .pg:not(.nav)[data-p="3"]');
      const first = async () => (await page.$$eval("#grid .card", (cs) => cs.map((c) => c.dataset.slug)));
      assert.equal((await first())[0], all[96]);
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
      let got = await first();
      assert.equal(got.length, 24);
      assert.ok(got.includes(all[96]), "the card that was first is still on screen");
      assert.equal((await page.locator("#count").textContent()).trim(), "97–120 of 627");
      assert.equal(await page.locator("#pager .pg.on").textContent(), "5");
      await page.setViewportSize({ width: 1360, height: 900 }); await page.waitForTimeout(300);
      got = await first();
      assert.equal(got.length, 48);
      assert.equal(got[0], all[96]);
      assert.equal(await page.locator("#pager .pg.on").textContent(), "3");
    });
    test("on a phone, the last page and a filtered list are right too (24 per page, remainder on the last)", async () => {
      const { page } = await open("catalogue.html", PHONE);
      await page.waitForSelector("#grid .card");
      await tap(page.locator("#segChips [data-seg='arabian']"));
      const n = expected({ seg: "arabian" }).length;
      assert.equal(await page.locator("#grid .card").count(), 24);
      assert.equal((await page.locator("#count").textContent()).trim(), `1–24 of ${n}`);
      const last = Math.ceil(n / 24);
      await tap(page.locator(`#pager .pg:not(.nav)[data-p="${last}"]`));
      assert.equal(await page.locator("#grid .card").count(), n - (last - 1) * 24);
    });
  });

  describe("back to top", () => {
    for (const [label, opts] of [["laptop", LAPTOP], ["phone", PHONE]]) {
      test(`${label}: hidden at the top, appears after scrolling, takes you back to the top, then disappears; focus goes to the heading`, async () => {
        const { page } = await open("catalogue.html", opts);
        await page.waitForSelector("#grid .card");
        assert.equal(await page.locator("#to-top").isHidden(), true, "not there at the top");
        await page.evaluate(() => scrollTo(0, innerHeight * 1.2)); await page.waitForTimeout(250);
        assert.equal(await page.locator("#to-top").isHidden(), true, "still not a screen and a half down");
        await page.evaluate(() => scrollTo(0, innerHeight * 3)); await page.waitForTimeout(250);
        assert.equal(await page.locator("#to-top").isVisible(), true);
        const b = await rect(page, "#to-top");
        assert.ok(b.w >= 44 && b.h >= 44, `${b.w}×${b.h}`);
        assert.ok(b.x >= 0 && b.r <= (opts.viewport?.width ?? 1360) && b.b <= (opts.viewport?.height ?? 900), "inside the screen");
        await page.click("#to-top");
        await page.waitForFunction(() => scrollY < 5, null, { timeout: 4000 });
        await page.waitForTimeout(300);
        assert.equal(await page.locator("#to-top").isHidden(), true, "gone again at the top");
        assert.equal(await page.evaluate(() => document.activeElement.tagName), "H1");
      });
    }
    test("with 'reduce motion' set it jumps straight up", async () => {
      const { page } = await open("catalogue.html", { contextOptions: { reducedMotion: "reduce" } });
      await page.waitForSelector("#grid .card");
      await page.evaluate(() => scrollTo(0, 4000)); await page.waitForTimeout(250);
      await page.click("#to-top"); await page.waitForTimeout(120);
      assert.ok((await page.evaluate(() => scrollY)) < 5);
    });
    test("it never sits on the WhatsApp button or the cart bar", async () => {
      for (const [label, opts] of [["laptop", LAPTOP], ["phone", PHONE]]) {
        const { page } = await open("catalogue.html", opts);
        await page.waitForSelector("#grid .card");
        await tap(page.locator("#grid .card .add").first());
        await page.evaluate(() => scrollTo(0, innerHeight * 3)); await page.waitForTimeout(300);
        const [t, w, bar] = await Promise.all(["#to-top", "#wa-float", "#cart-bar"].map((x) => rect(page, x)));
        assert.equal(hit(t, w, 4), false, `${label}: back-to-top overlaps the WhatsApp button`);
        if (bar && bar.vis) assert.equal(hit(t, bar), false, `${label}: overlaps the cart bar`);
      }
    });
  });

  describe("floating WhatsApp button", () => {
    for (const [label, opts] of [["laptop", LAPTOP], ["phone", PHONE]]) for (const file of PAGES) {
      test(`${file} on ${label}: one round button, 44px+, fully on screen, opens WhatsApp with the right number; the number is not in the page`, async () => {
        const { page } = await open(file, opts);
        await page.waitForTimeout(300);
        assert.equal(await page.locator("#wa-float").count(), 1);
        const b = await rect(page, "#wa-float");
        const vw = opts.viewport?.width ?? 1360, vh = opts.viewport?.height ?? 900;
        assert.ok(b.vis && b.w >= 44 && b.h >= 44 && Math.abs(b.w - b.h) < 1, `${b.w}×${b.h}`);
        assert.ok(b.x >= 0 && b.r <= vw && b.y >= 0 && b.b <= vh, "inside the screen");
        assert.ok(b.r >= vw - 40 && b.b >= vh - 40, "in the bottom-right corner");
        assert.equal(await page.getAttribute("#wa-float", "aria-label"), "Chat with us on WhatsApp");
        const html = await page.content();
        assert.ok(!html.includes(NUMBER) && !html.includes(NUMBER.slice(-10)), "no phone number in the page");
        await page.click("#wa-float");
        assert.match(await lastWA(page), /question about your perfumes/);
      });
    }
    test("it never covers text: scrolled to the bottom of every page, no footer text sits under it (laptop and phone, with a cart bar showing too)", async () => {
      const problems = [];
      for (const [label, opts] of [["laptop", LAPTOP], ["phone", PHONE]]) for (const file of PAGES) {
        const { page } = await open(file, opts);
        await page.evaluate(() => PX.addToCart(PX.keyOf(PRODUCTS[0], PRODUCTS[0].v[0])));
        await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(400);
        const bad = await page.evaluate(() => {
          const boxes = ["#wa-float", "#cart-bar", "#to-top"].map((s) => document.querySelector(s)).filter((e) => e && e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== "none").map((e) => e.getBoundingClientRect());
          const out = [], w = document.createTreeWalker(document.querySelector("footer"), NodeFilter.SHOW_TEXT);
          for (let n; (n = w.nextNode());) {
            if (!n.textContent.trim()) continue;
            const r = document.createRange(); r.selectNodeContents(n);
            for (const t of r.getClientRects()) for (const b of boxes) if (t.right > b.left && t.left < b.right && t.bottom > b.top && t.top < b.bottom) out.push(n.textContent.trim().slice(0, 30));
          }
          return out;
        });
        if (bad.length) problems.push(`${file} on ${label}: ${bad.join(" | ")}`);
      }
      assert.deepEqual(problems, []);
    });
    test("under the cart drawer, the quiz and the Filters sheet: the button is covered, not floating over them", async () => {
      const { page } = await open("catalogue.html", PHONE);
      await page.waitForSelector("#grid .card");
      const covered = () => page.evaluate(() => { const r = document.querySelector("#wa-float").getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !top.closest("#wa-float"); });
      assert.equal(await covered(), false, "free at first");
      await tap(page.locator("#cart-open")); await page.waitForSelector("#cart.open"); await page.waitForTimeout(450);
      assert.equal(await covered(), true, "the cart is above it");
      await page.keyboard.press("Escape"); await page.waitForTimeout(450);
      await tap(page.locator(".quiz-btn")); await page.waitForSelector("#quiz:not([hidden])");
      assert.equal(await covered(), true, "the quiz is above it");
      await page.keyboard.press("Escape");
      await tap(page.locator("#filters-open")); await page.waitForSelector("#filters:not([hidden])"); await page.waitForTimeout(450);
      assert.equal(await covered(), true, "the Filters sheet is above it");
    });
    test("with the phone's cart bar showing, the button rides above the bar (never behind it)", async () => {
      const { page } = await open("catalogue.html", PHONE);
      await page.waitForSelector("#grid .card");
      const before = await rect(page, "#wa-float");
      await tap(page.locator("#grid .card .add").first()); await page.waitForTimeout(300);
      const [w, bar] = await Promise.all([rect(page, "#wa-float"), rect(page, "#cart-bar")]);
      assert.ok(bar.vis);
      assert.ok(w.b <= bar.y - 8 + 0.5, `button bottom ${w.b} vs bar top ${bar.y}`);
      assert.ok(w.y < before.y, "moved up to make room");
    });
  });

  describe("phone cart bar and the 'Added · View cart' message", () => {
    test("nothing shows while the cart is empty; after the first add the bar shows 'Cart (1) · ₹price' and the toast says Added with a View cart button", async () => {
      const { page } = await open("catalogue.html", PHONE);
      await page.waitForSelector("#grid .card");
      assert.equal(await page.locator("#cart-bar").isVisible(), false);
      assert.equal(await page.locator("#toast").isVisible(), false);
      const top = expected({}).slice(0, 2);
      await tap(page.locator("#grid .card .add").first());
      await page.waitForSelector("#toast.show");
      assert.equal((await page.locator("#toast").innerText()).replace(/\s+/g, " ").trim(), "✓ Added View cart");
      const price = top[0].variants[0].price;
      assert.equal((await page.locator("#cart-bar .cb-main").innerText()).replace(/\s+/g, " ").trim(), `Cart (1) · ${fmtPrice(price)}`);
      await tap(page.locator("#grid .card .add").nth(1));
      const total = price + top[1].variants[0].price;
      assert.equal((await page.locator("#cart-bar .cb-main").innerText()).replace(/\s+/g, " ").trim(), `Cart (2) · ${fmtPrice(total)}`);
    });
    test("the message sits clear of the buttons, the card and the bar, is fully on screen on a 320px phone, and is a 44px target", async () => {
      for (const w of [320, 390]) {
        const { page } = await open("catalogue.html", { viewport: { width: w, height: 700 }, contextOptions: { hasTouch: true, isMobile: true } });
        await page.waitForSelector("#grid .card");
        await tap(page.locator("#grid .card .add").first());
        await page.waitForSelector("#toast.show"); await page.waitForTimeout(300);
        const [t, wa, bar, btn] = await Promise.all(["#toast", "#wa-float", "#cart-bar", "#toast-view"].map((x) => rect(page, x)));
        assert.ok(t.x >= 8 && t.r <= w - 8, `${w}px: toast ${t.x}–${t.r}`);
        assert.equal(hit(t, wa), false, `${w}px: toast over the WhatsApp button`);
        assert.equal(hit(t, bar), false, `${w}px: toast over the cart bar`);
        assert.ok(btn.h >= 44, `${w}px: View cart is ${btn.h}px tall`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
    });
    test("'View cart' opens the cart and puts the message away; the bar's label opens it too; the cart's own Order button still works", async () => {
      const { page } = await open("catalogue.html", PHONE);
      await page.waitForSelector("#grid .card");
      await tap(page.locator("#grid .card .add").first());
      await page.waitForSelector("#toast.show");
      await tap(page.locator("#toast-view"));
      await page.waitForSelector("#cart.open");
      await page.waitForSelector("#toast", { state: "hidden" });
      assert.equal(await page.locator("#cart-items .line").count(), 1);
      await page.keyboard.press("Escape"); await page.waitForTimeout(400);
      await tap(page.locator("#cb-open"));
      await page.waitForSelector("#cart.open");
      await tap(page.locator("#checkout"));
      assert.match(await lastWA(page), /^Hi! I'd like to order:/);
    });
    test("the bar's Order button sends the same message as the cart's: every line, quantities and the total", async () => {
      const { page } = await open("catalogue.html", PHONE);
      await page.waitForSelector("#grid .card");
      await tap(page.locator("#grid .card .add").nth(0)); await tap(page.locator("#grid .card .add").nth(1)); await tap(page.locator("#grid .card .add").nth(1));
      const barMsg = await page.getAttribute("#cb-order", "data-wa-open"), cartMsg = await page.evaluate(() => { document.querySelector("#cart-open").click(); return document.querySelector("#checkout").dataset.waOpen; });
      assert.equal(barMsg, cartMsg);
      await page.keyboard.press("Escape"); await page.waitForTimeout(400);
      await tap(page.locator("#cb-order"));
      const sent = await lastWA(page);
      assert.equal(sent, barMsg);
      assert.match(sent, /2 × /, "the doubled line shows its quantity");
      assert.equal(await page.url().endsWith("#"), false, "the page did not move");
    });
    test("the message goes by itself after a few seconds, comes back for the next add, and waits while its button has keyboard focus", async () => {
      const { page } = await open("catalogue.html", PHONE);
      await page.waitForSelector("#grid .card");
      await tap(page.locator("#grid .card .add").first());
      await page.waitForSelector("#toast.show");
      await page.waitForSelector("#toast", { state: "hidden", timeout: 6500 });
      await tap(page.locator("#grid .card .add").nth(1));
      await page.waitForSelector("#toast.show");
      assert.equal(await page.locator("#toast").isVisible(), true);
      await page.focus("#toast-view");
      await page.waitForTimeout(4500);
      assert.equal(await page.locator("#toast").isVisible(), true, "still there while focused");
      await page.evaluate(() => document.activeElement.blur());
      await page.waitForSelector("#toast", { state: "hidden", timeout: 4000 });
    });
    test("opening the cart from the header while the message is up puts the message away (it never floats over the cart)", async () => {
      const { page } = await open("catalogue.html", PHONE);
      await page.waitForSelector("#grid .card");
      await tap(page.locator("#grid .card .add").first());
      await page.waitForSelector("#toast.show");
      await tap(page.locator("#cart-open"));
      await page.waitForSelector("#cart.open");
      await page.waitForSelector("#toast", { state: "hidden" });
    });
    test("the bar tracks the cart: quantity and total change with + / − in the cart, and it goes away when the cart is emptied; it follows you to other pages", async () => {
      const { page } = await open("catalogue.html", PHONE);
      await page.waitForSelector("#grid .card");
      await tap(page.locator("#grid .card .add").first());
      const price = expected({})[0].variants[0].price;
      await tap(page.locator("#cart-open")); await page.waitForSelector("#cart.open");
      await tap(page.locator("[data-inc]").first());
      assert.equal((await page.locator("#cart-bar .cb-main").innerText()).replace(/\s+/g, " ").trim(), `Cart (2) · ${fmtPrice(price * 2)}`);
      await page.keyboard.press("Escape"); await page.waitForTimeout(400);
      await page.click("#menu-btn"); await page.click("#nav a >> text=Contact"); await page.waitForURL(/contact\.html/);
      assert.equal(await page.locator("#cart-bar").isVisible(), true, "still there on the next page");
      await tap(page.locator("#cb-open")); await page.waitForSelector("#cart.open");
      await tap(page.locator("#cart-clear")); await page.waitForTimeout(300);
      assert.equal(await page.locator("#cart-bar").isVisible(), false, "gone when the cart is empty");
      assert.equal(await page.evaluate(() => document.body.classList.contains("has-cart-bar")), false);
    });
    test("it is a phone thing: on a laptop neither the bar nor the message appears, however many items are in the cart", async () => {
      const { page } = await open("catalogue.html", LAPTOP);
      await page.waitForSelector("#grid .card");
      await tap(page.locator("#grid .card .add").first());
      await page.waitForTimeout(400);
      assert.equal(await page.locator("#cart-bar").isVisible(), false);
      assert.equal(await page.locator("#toast").isVisible(), false);
      assert.equal(await page.locator("#cart-count").textContent(), "1", "the header count still shows");
    });
    test("while you type in the search box the bar and message step aside (the keyboard is up), and return afterwards", async () => {
      const { page } = await open("catalogue.html", PHONE);
      await page.waitForSelector("#grid .card");
      await tap(page.locator("#grid .card .add").first());
      await page.waitForSelector("#toast.show");
      await page.evaluate(() => scrollTo(0, 0));
      await tap(page.locator("#q"));
      assert.equal(await page.locator("#cart-bar").isVisible(), false, "hidden while typing");
      await page.evaluate(() => document.activeElement.blur());
      await page.waitForTimeout(200);
      assert.equal(await page.locator("#cart-bar").isVisible(), true, "back when done");
    });
    test("quiz: adding a pick shows the message above the quiz; View cart closes the quiz and opens the cart", async () => {
      const { page } = await open("catalogue.html", PHONE, "?quiz=1");
      await page.waitForSelector("#quiz:not([hidden]) .quiz-opt");
      while (!(await page.locator(".qr").count())) { await page.locator(".quiz-skip").click(); await page.waitForTimeout(150); }
      await tap(page.locator(".qr .add").first());
      await page.waitForSelector("#toast.show");
      const onTop = await page.evaluate(() => { const r = document.querySelector("#toast").getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!e.closest("#toast"); });
      assert.equal(onTop, true, "the message is above the quiz");
      await tap(page.locator("#toast-view"));
      await page.waitForSelector("#cart.open");
      assert.equal(await page.locator("#quiz").isHidden(), true, "the quiz was put away");
      assert.equal(await page.locator("#cart-items .line").count(), 1);
    });
    test("keyboard: tabbing down the contact form with the bar showing, every field that gets focus is fully visible (never under the bar or the round button)", async () => {
      const { page } = await open("contact.html", PHONE);
      await page.evaluate(() => PX.addToCart(PX.keyOf(PRODUCTS[0], PRODUCTS[0].v[0])));
      await page.waitForSelector("#toast", { state: "hidden", timeout: 6000 });               // (the "Added" message passes by itself first)
      await page.focus("#rq-perfume");
      const bad = [];
      for (let i = 0; i < 9; i++) {
        await page.waitForTimeout(250);
        const r = await page.evaluate(() => {
          const e = document.activeElement, b = e.getBoundingClientRect();
          const pts = [[b.left + b.width / 2, b.top + 3], [b.left + b.width / 2, b.bottom - 3]];
          const hdr = document.querySelector(".site-header").getBoundingClientRect().bottom;
          return { id: e.id || e.tagName, hidden: pts.some(([x, y]) => { const t = document.elementFromPoint(x, y); return !t || (t !== e && !e.contains(t) && !t.contains(e)); }), underHeader: b.top < hdr - 1 };
        });
        if (r.hidden || r.underHeader) bad.push(r);
        await page.keyboard.press("Tab");
      }
      assert.deepEqual(bad, []);
    });
    test("room for it: scrolled to the bottom, the last line of the page ends above the bar", async () => {
      const { page } = await open("how-to-order.html", PHONE);
      await page.evaluate(() => PX.addToCart(PX.keyOf(PRODUCTS[0], PRODUCTS[0].v[0])));
      await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(300);
      const m = await page.evaluate(() => ({ foot: document.querySelector("footer").getBoundingClientRect().bottom, bar: document.querySelector("#cart-bar").getBoundingClientRect().top, vh: innerHeight }));
      assert.ok(m.foot <= m.bar + 1, `page ends at ${m.foot}, bar starts at ${m.bar}`);
    });
  });

  describe("'Mini' badge on pictures that are not the mini", () => {
    test("every one of the 627 cards (all pages, laptop): the badge is there exactly when the pre-selected size is a mini that has no picture of its own", async () => {
      const { page } = await open("catalogue.html", LAPTOP);
      await page.waitForSelector("#grid .card");
      const rows = expected({});
      const got = await page.evaluate(async () => {
        const out = [];
        for (let i = 0; i < 20; i++) {
          out.push(...[...document.querySelectorAll("#grid .card")].map((c) => [c.dataset.slug, !!c.querySelector(".thumb .mini-badge"), (c.querySelector(".thumb .mini-badge") || {}).textContent || ""]));
          const next = [...document.querySelectorAll("#pager .pg.nav")].at(-1);
          if (!next || next.disabled) break;
          next.click();
        }
        return out;
      });
      assert.equal(got.length, 627);
      const bad = [];
      got.forEach(([slug, has, text], i) => {
        const p = PRODUCTS.find((x) => x.s === slug), r = rows[i];
        assert.equal(slug, r.slug);
        const v = p.v.find((x) => spec(x) === r.variants[0].spec && x.pr === r.variants[0].price);
        if (has !== wantBadge(p, v)) bad.push(`${p.b} ${p.n} / ${spec(v)}: badge ${has ? "shown" : "missing"}`);
        if (has && text !== "Mini") bad.push(`${slug}: says "${text}"`);
      });
      assert.deepEqual(bad.slice(0, 8), []);
      const shown = got.filter((g) => g[1]).length;
      assert.ok(shown > 0 && shown === rows.filter((r, i) => { const p = PRODUCTS.find((x) => x.s === r.slug); return wantBadge(p, p.v.find((x) => spec(x) === r.variants[0].spec && x.pr === r.variants[0].price)); }).length, `${shown} cards carry the badge, as worked out`);
    });
    test("choosing another size on a card adds or removes the badge to match (a mini with a picture of its own: none; a full bottle: none; a mini without: yes), and it keeps up with quick taps", async () => {
      const { page } = await open("catalogue.html", LAPTOP);
      await page.waitForSelector("#grid .card");
      const samples = PRODUCTS.filter((p) => p.v.length >= 2 && p.v.some((v) => wantBadge(p, v)) && p.v.some((v) => !wantBadge(p, v))).slice(0, 12);
      assert.ok(samples.length >= 6);
      const bad = [];
      for (const p of samples) {
        await page.fill("#q", `${p.b} ${p.n}`); await page.waitForTimeout(250);
        const card = page.locator(`#grid .card[data-slug="${p.s}"]`);
        const rows = expected({ q: `${p.b} ${p.n}` }).find((r) => r.slug === p.s);
        const chips = card.locator(".vchip");
        for (let i = 0; i < rows.variants.length; i++) {
          await chips.nth(i).click(); await page.waitForTimeout(60);
          const v = p.v.find((x) => spec(x) === rows.variants[i].spec && x.pr === rows.variants[i].price);
          const has = (await card.locator(".thumb .mini-badge").count()) === 1;
          if (has !== wantBadge(p, v)) bad.push(`${p.n} / ${spec(v)}: badge ${has ? "shown" : "missing"}`);
        }
      }
      assert.deepEqual(bad.slice(0, 6), []);
    });
    test("the badge is not announced (it repeats the size chip) and does not block tapping the picture to enlarge it", async () => {
      const { page } = await open("catalogue.html", LAPTOP);
      await page.waitForSelector("#grid .card .thumb .mini-badge");
      assert.equal(await page.getAttribute("#grid .card .thumb .mini-badge", "aria-hidden"), "true");
      await page.locator("#grid .card .thumb").first().click();
      await page.waitForSelector("#lightbox:not([hidden])");
    });
    test("quiz results follow the same rule", async () => {
      const { page } = await open("catalogue.html", PHONE, "?quiz=1");
      await page.waitForSelector("#quiz:not([hidden]) .quiz-opt");
      while (!(await page.locator(".qr").count())) { await page.locator(".quiz-skip").click(); await page.waitForTimeout(150); }
      const got = await page.$$eval(".qr", (els) => els.map((e) => [e.dataset.slug, e.querySelector(".qr-spec").textContent, !!e.querySelector(".qr-art .mini-badge")]));
      assert.ok(got.length >= 5);
      const bad = [];
      for (const [slug, specText, has] of got) {
        const p = PRODUCTS.find((x) => x.s === slug);
        const cands = p.v.filter((v) => specText.includes(v.m || "§") && specText.includes(v.p));
        const v = cands[0];
        if (v && has !== wantBadge(p, v)) bad.push(`${slug} ${specText}: ${has ? "badge shown" : "badge missing"}`);
      }
      assert.deepEqual(bad, []);
    });
  });

  describe("tighter home page, shorter catalogue heading on phones", () => {
    test("home: the gaps between blocks are smaller than the other pages' (blocks have 80px of padding at most on a laptop, 48px on a phone; other pages keep 112px / 64px)", async () => {
      for (const [label, opts, homeMax, otherMin] of [["laptop", LAPTOP, 80, 112], ["phone", PHONE, 48, 64]]) {
        const h = await open("index.html", opts), g = await open("privacy.html", opts);
        const pad = (page) => page.evaluate(() => { const c = getComputedStyle(document.querySelector("main .section")); return [parseFloat(c.paddingTop), parseFloat(c.paddingBottom)]; });
        const [ht, hb] = await pad(h.page), [gt, gb] = await pad(g.page);
        assert.ok(ht <= homeMax && hb <= homeMax, `${label}: home blocks have ${ht}/${hb}px padding`);
        assert.ok(gb >= otherMin, `${label}: other pages keep their spacing (${gt}/${gb}px)`);
        assert.equal(await h.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
    });
    test("phone: the catalogue heading is short: the search box starts in the first quarter of the screen and the first perfume is visible without scrolling", async () => {
      const { page } = await open("catalogue.html", PHONE);
      await page.waitForSelector("#grid .card");
      const m = await page.evaluate(() => ({ q: document.querySelector("#q").getBoundingClientRect().top, card: document.querySelector("#grid .card").getBoundingClientRect().top, vh: innerHeight, h1: document.querySelector("h1").getBoundingClientRect().height }));
      assert.ok(m.q < 250, `search box at ${m.q}px`);
      assert.ok(m.card < 540, `first perfume at ${m.card}px of ${m.vh}`);
      assert.ok(m.h1 <= 70, `heading is ${m.h1}px tall (one line)`);
    });
    test("laptop: the catalogue heading is unchanged (large, with the eyebrow and the sub-line)", async () => {
      const { page } = await open("catalogue.html", LAPTOP);
      assert.equal(await page.locator(".page-head .eyebrow").isVisible(), true);
      assert.ok((await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("h1")).fontSize))) >= 56);
      assert.match((await page.locator(".page-head .section-sub").innerText()).trim(), /^Search by perfume or brand name\.$/);
    });
  });

  test("no console errors or failed requests in any of the above", () => assert.deepEqual(opened.flatMap((o) => o.errors), []));
  test("nothing asked for a file that does not exist", () => assert.deepEqual(srv.missing, []));
});

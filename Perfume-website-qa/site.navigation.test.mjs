// Whole-site checks: every page loads cleanly, header links go to their own page (no scrolling),
// the cart follows you between pages, and nothing links to a file that doesn't exist.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SITE_DIR, PRODUCTS } from "./lib/data.mjs";
import { launch, openPage } from "./lib/browser.mjs";
import { PAGE_FILES, isSitePage } from "./lib/pages.mjs";

const PAGES = PAGE_FILES.map((f) => f.replace(".html", ""));
const NAV = [["Catalogue", "catalogue.html"], ["Guides", "guides.html"], ["How to order", "how-to-order.html"], ["Guarantee", "guarantee.html"], ["FAQ", "faq.html"], ["Contact", "contact.html"]];

describe("site navigation", () => {
  let browser;
  const opened = [];
  const open = async (file, opts) => { const c = await openPage(browser, file, opts); opened.push(c); return c.page; };
  before(async () => { browser = await launch(); });
  after(async () => { await browser.close(); });

  test("every local link and script in every page points at a file that exists", () => {
    const missing = [];
    for (const f of fs.readdirSync(SITE_DIR).filter(isSitePage)) {
      const html = fs.readFileSync(path.join(SITE_DIR, f), "utf8");
      for (const m of html.matchAll(/(?:href|src)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
        if (/^(https?:|mailto:|data:)/.test(m[1])) continue;
        if (!fs.existsSync(path.join(SITE_DIR, m[1]))) missing.push(`${f} → ${m[1]}`);
      }
    }
    assert.deepEqual(missing, []);
  });

  test("each page: one h1, right nav highlight, brand filled, no sideways scroll (desktop and phone)", async () => {
    const bad = [];
    for (const vp of [{ width: 1360, height: 900 }, { width: 390, height: 844 }]) {
      for (const pg of PAGES) {
        const p = await open(`${pg}.html`, { viewport: vp });
        const info = await p.evaluate(() => ({
          h1: document.querySelectorAll("h1").length, current: document.querySelector("#nav a[aria-current]")?.getAttribute("href") ?? null, currentKind: document.querySelector("#nav a[aria-current]")?.getAttribute("aria-current") ?? null,
          brand: [...document.querySelectorAll("[data-brand]")].every((e) => e.textContent === "Perfume X Collections"),
          overflow: document.documentElement.scrollWidth > innerWidth, links: [...document.querySelectorAll("#nav a")].map((a) => a.getAttribute("href")),
        }));
        const isGuide = pg.startsWith("guide-");                       // a guide article lights up "Guides" (as the section it belongs to, aria-current="true")
        const want = ["index", "privacy", "terms", "perfumes"].includes(pg) ? null : isGuide ? "guides.html" : `${pg}.html`;   // the legal pages are reached from the footer, so no header link is highlighted
        if (want && info.currentKind !== (isGuide ? "true" : "page")) bad.push(`${pg}: aria-current is "${info.currentKind}"`);
        if (info.h1 !== 1) bad.push(`${pg}: ${info.h1} h1`);
        if (info.current !== want) bad.push(`${pg}: nav highlight ${info.current}`);
        if (!info.brand) bad.push(`${pg}: brand name not filled`);
        if (info.overflow) bad.push(`${pg} @${vp.width}: sideways scroll`);
        if (info.links.join() !== NAV.map(([, h]) => h).join()) bad.push(`${pg}: nav links ${info.links}`);
      }
    }
    assert.deepEqual(bad, []);
  });

  test("header links open their own page at the top, with no #hash — from the home page", async () => {
    const bad = [];
    for (const [label, href] of NAV) {
      const p = await open("index.html");
      await Promise.all([p.waitForURL((u) => u.pathname.endsWith(href)), p.locator("#nav a", { hasText: label }).click()]);
      await p.waitForLoadState("load");
      const url = new URL(p.url());
      const y = await p.evaluate(() => scrollY);
      if (url.hash) bad.push(`${label}: landed with ${url.hash}`);
      if (y !== 0) bad.push(`${label}: landed scrolled to ${y}px`);
    }
    assert.deepEqual(bad, []);
  });

  test("the mobile menu opens, navigates, and is closed on the next page", async () => {
    const p = await open("index.html", { viewport: { width: 390, height: 844 } });
    await p.click("#menu-btn");
    assert.equal(await p.getAttribute("#menu-btn", "aria-expanded"), "true");
    await Promise.all([p.waitForURL(/faq\.html/), p.locator("#nav a", { hasText: "FAQ" }).click()]);
    await p.waitForLoadState("load");
    assert.equal(await p.getAttribute("#menu-btn", "aria-expanded"), "false");
    assert.equal(await p.evaluate(() => scrollY), 0);
  });

  test("home page style cards open the catalogue filtered, and 'Find my scent' opens the quiz", async () => {
    for (const [style, n] of [["designer", 309], ["luxury", 90], ["arabian", 222]]) {
      const p = await open("index.html");
      assert.equal(await p.locator(`.style-card[href*="${style}"]`).count(), 1);
      assert.doesNotMatch(await p.locator(`.style-card[href*="${style}"]`).textContent(), /\d/, "the card shows no numbers");
      await Promise.all([p.waitForURL(/catalogue\.html/), p.locator(`.style-card[href*="${style}"]`).click()]);
      await p.waitForLoadState("load");
      assert.match(await p.textContent("#count"), new RegExp(`of ${n}$`));
    }
    const p = await open("index.html");
    await Promise.all([p.waitForURL(/catalogue\.html/), p.locator('.hero a[href*="quiz"]').click()]);
    await p.waitForLoadState("load");
    assert.equal(await p.locator("#quiz").isVisible(), true);
  });

  test("the cart follows you from page to page, with the right total in the drawer", async () => {
    const p = await open("catalogue.html");
    await p.fill("#q", "khamrah"); await p.waitForTimeout(250);
    await p.locator(".card").first().locator(".add").click();
    await p.locator(".card").first().locator(".add").click();
    const khamrah = PRODUCTS.find((x) => x.n === "Khamrah" && x.b === "Lattafa");
    for (const [label, href] of [["FAQ", "faq.html"], ["How to order", "how-to-order.html"], ["Contact", "contact.html"]]) {
      await Promise.all([p.waitForURL((u) => u.pathname.endsWith(href)), p.locator("#nav a", { hasText: label }).click()]);
      await p.waitForLoadState("load");
      assert.equal(await p.textContent("#cart-count"), "2", `${href}: cart badge`);
    }
    await p.click("#cart-open");
    await p.waitForTimeout(400);
    assert.equal((await p.textContent("#cart-total")).replace(/\D/g, ""), String(khamrah.v[0].pr * 2));
    await p.keyboard.press("Escape");
    await p.waitForTimeout(400);
    assert.equal(await p.evaluate(() => document.activeElement.id), "cart-open");
  });

  test("guarantee page: the terms anchor exists and the footer link goes there", async () => {
    const p = await open("guarantee.html");
    assert.equal(await p.locator("#terms").count(), 1);
    await p.locator('.legal a[href*="guarantee"]').click();
    assert.equal(new URL(p.url()).hash, "#terms");
  });

  test("the guarantee multiple on every page follows site-config.js", async () => {
    const p = await open("faq.html", { siteConfig: (t) => t.replace("multiple: 3", "multiple: 2") });
    assert.ok((await p.locator("[data-mult]").first().textContent()).startsWith("2×"));
    assert.match(await p.locator("[data-mult-word]").first().textContent(), /twice/);
  });

  test("no deploy-time 'noindex' header file is left: the site can be listed by search engines once it is uploaded", () => {
    const h = path.join(SITE_DIR, "_headers");
    assert.ok(!fs.existsSync(h) || !/noindex|nofollow/i.test(fs.readFileSync(h, "utf8")), "_headers still asks search engines not to list the site");
  });

  test("no console errors or failed requests on any page", () => assert.deepEqual(opened.flatMap((o) => o.errors), []));
});

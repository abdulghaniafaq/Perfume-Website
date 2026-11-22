// UAT click-through. Every clickable thing on every page is really clicked / tabbed to, on a laptop and on a phone, over HTTP:
//  - every link goes where it says (right page, no 404, no console error, top of the page / the right section in view)
//  - every WhatsApp button opens a wa.me link with the right number and a real message, and the page stays put
//  - no dead buttons: every button does something you can see
//  - keyboard: every control can be reached with Tab, in order, with a visible focus mark; Tab never gets stuck
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { SITE } from "./lib/data.mjs";
import { launch, openPage } from "./lib/browser.mjs";
import { serve } from "./lib/server.mjs";
import { PAGE_FILES_PLUS } from "./lib/pages.mjs";

const PAGES = PAGE_FILES_PLUS;                                // the 14 pages and a sample of the perfume pages (every kind of perfume page is in the sample)
const VIEWS = [["a laptop", {}], ["a phone (390px)", { viewport: { width: 390, height: 844 }, contextOptions: { hasTouch: true, isMobile: true } }]];
const NUMBER = SITE.contact.whatsapp;

describe("UAT click-through", () => {
  let browser, srv;
  before(async () => { browser = await launch(); srv = await serve(); });
  after(async () => { await browser.close(); await srv.close(); });

  const open = (file, opts = {}, query = "") => openPage(browser, file, { base: srv.base, query, ...opts });
  /** one context for a whole page; fresh() reloads the page and forgets earlier errors, so each control starts from a clean page */
  const session = async (file, opts) => {
    const c = await open(file, { ...opts, contextOptions: { ...(opts.contextOptions || {}), reducedMotion: "reduce" } });   // (the hero photos drift gently; a robot cannot click a moving target)
    await c.context.route((u) => !/^(127\.0\.0\.1|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.hostname), (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>other site</title>" }));   // (no real network: other websites get a blank page)
    c.fresh = async () => { c.errors.length = 0; srv.hits.length = 0; await c.page.goto(`${srv.base}${file}`, { waitUntil: "load" }); await c.page.waitForTimeout(150); return c; };
    return c;
  };
  /** wait for smooth scrolling to finish */
  const settle = async (page) => { let last = -1, same = 0; for (let i = 0; i < 30 && same < 3; i++) { const y = await page.evaluate(() => Math.round(scrollY)); same = y === last ? same + 1 : 0; last = y; await page.waitForTimeout(120); } };
  /** make a link clickable the way a visitor would: open the FAQ answer it sits in; false if it is simply not on screen (hidden) */
  const makeClickable = async (page, el) => {
    if (await el.isVisible()) return true;
    const sum = await el.evaluateHandle((e) => { const d = e.closest("details"); return d && d.querySelector("summary"); });
    if (!sum.asElement()) return false;
    await sum.asElement().click(); await page.waitForTimeout(200);
    return el.isVisible();
  };
  const isPhone = (opts) => !!opts.contextOptions?.isMobile;
  // on a phone the navigation links live in the menu: open it first
  const reveal = async (page, opts, inNav) => { if (isPhone(opts) && inNav) { await page.click("#menu-btn"); await page.waitForTimeout(250); } };

  /** every link on the page, described so it can be found again after a reload */
  const linksOf = (page) => page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a, i) => ({
    i, href: a.getAttribute("href"), text: (a.getAttribute("aria-label") || a.textContent).replace(/\s+/g, " ").trim().slice(0, 40),
    wa: a.hasAttribute("data-wa") || a.hasAttribute("data-wa-open"), inNav: !!a.closest("#nav"), inFooter: !!a.closest("footer"),
    inCart: !!a.closest("#cart"), inGrid: !!a.closest("#grid"), inSuggest: !!a.closest("#suggest-list"),
  })));

  describe("every link goes where it says", () => {
    for (const [label, opts] of VIEWS) for (const file of PAGES) {
      test(`${file} on ${label}: every link opens the right page (or section), at the top, with no error`, async () => {
        const probe = await open(file, opts);
        const links = (await linksOf(probe.page)).filter((l) => !l.wa && !l.inCart && !l.inGrid && !l.inSuggest);
        await probe.context.close();
        const seen = new Set(), problems = [], hiddenSkipped = [];
        let tried = 0;
        const c = await session(file, opts);
        try {
          for (const l of links) {
            const key = `${l.href}|${l.inNav}|${l.inFooter}`;
            if (seen.has(key)) continue; seen.add(key);
            await c.fresh();
            const handle = await c.page.evaluateHandle((i) => document.querySelectorAll("a[href]")[i], l.i);
            await reveal(c.page, opts, l.inNav);
            const el = handle.asElement();
            const before = c.page.url();
            if (!(await makeClickable(c.page, el))) { hiddenSkipped.push(l.text); continue; }
            if (/^https?:\/\//.test(l.href)) {                              // a link to another website (the cited court write-ups): it opens in a NEW tab and the shop page stays where it is
              await el.scrollIntoViewIfNeeded();
              const [tab] = await Promise.all([c.context.waitForEvent("page", { timeout: 5000 }), el.click()]);
              await tab.waitForURL((u) => /^https?:/.test(u.href), { timeout: 8000 }).catch(() => {});      // (a new tab starts blank and then goes to the address)
              let host = ""; try { host = new URL(tab.url()).hostname; } catch { /* still blank */ }
              if (host !== new URL(l.href).hostname) problems.push(`${l.text} (${l.href}): opened "${tab.url()}"`);
              if (c.page.url() !== before) problems.push(`${l.text}: the shop page itself moved to ${c.page.url()}`);
              await tab.close(); tried++;
              continue;
            }
            if (await el.evaluate((e) => e.classList.contains("skip"))) { await el.focus(); await c.page.keyboard.press("Enter"); }   // "Skip to content" only shows on keyboard focus
            else { await el.scrollIntoViewIfNeeded(); await el.click(); }
            await c.page.waitForLoadState("load");
            await settle(c.page);
            tried++;
            const url = new URL(c.page.url());
            const want = new URL(l.href, before);
            if (url.pathname !== want.pathname) problems.push(`${l.text} (${l.href}): went to ${url.pathname}`);
            if (want.hash) {
              const ok = await c.page.evaluate((id) => { const t = document.getElementById(id); if (!t) return "no such section"; const r = t.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight ? "ok" : "section not in view"; }, want.hash.slice(1));
              if (ok !== "ok") problems.push(`${l.text} (${l.href}): ${ok}`);
            } else if (url.pathname !== new URL(before).pathname) {
              const top = await c.page.evaluate(() => scrollY);
              if (top > 5) problems.push(`${l.text} (${l.href}): opened scrolled down (${top}px)`);
              if (!(await c.page.title())) problems.push(`${l.text}: new page has no title`);
            }
            if (c.errors.length) problems.push(`${l.text} (${l.href}): ${c.errors.join("; ")}`);
            const bad = srv.hits.filter(([s]) => s !== 200);
            if (bad.length) problems.push(`${l.text} (${l.href}): ${JSON.stringify(bad)}`);
          }
        } finally { await c.context.close(); }
        assert.deepEqual(problems, []);
        assert.ok(tried >= 8, `clicked ${tried} different links`);
      });
    }
  });

  describe("every WhatsApp button opens a real chat link and the page stays where it is", () => {
    for (const [label, opts] of VIEWS) for (const file of PAGES) {
      test(`${file} on ${label}`, async () => {
        const probe = await open(file, opts);
        const was = (await linksOf(probe.page)).filter((l) => l.wa && !l.inCart && !l.inGrid);
        await probe.context.close();
        const problems = [];
        const c = await session(file, opts);
        try {
          for (const l of was) {
            await c.fresh();
            const handle = await c.page.evaluateHandle((i) => document.querySelectorAll("a[href]")[i], l.i);
            await reveal(c.page, opts, l.inNav);
            const el = handle.asElement();
            if (!(await el.isVisible())) continue;                       // (e.g. the contact page's hidden "Open WhatsApp" until a request is made)
            await el.scrollIntoViewIfNeeded();
            const url0 = c.page.url();
            await el.click();
            await c.page.waitForTimeout(250);
            const wa = await c.page.evaluate(() => window.__wa);
            if (wa.length !== 1) { problems.push(`${l.text}: opened ${wa.length} windows`); continue; }
            const m = wa[0].match(/^https:\/\/wa\.me\/(\d+)\?text=(.+)$/);
            if (!m) problems.push(`${l.text}: not a wa.me link: ${wa[0].slice(0, 60)}`);
            else {
              if (m[1] !== NUMBER) problems.push(`${l.text}: wrong number ${m[1]}`);
              if (!decodeURIComponent(m[2]).trim()) problems.push(`${l.text}: empty message`);
            }
            if (c.page.url() !== url0) problems.push(`${l.text}: the page moved to ${c.page.url()}`);
            if (c.errors.length) problems.push(`${l.text}: ${c.errors.join("; ")}`);
          }
        } finally { await c.context.close(); }
        assert.deepEqual(problems, []);
      });
    }
  });

  describe("no dead buttons: every button does something you can see", () => {
    // Buttons that legitimately change nothing on a fresh page (none expected; add here with a reason if one appears)
    const NO_CHANGE_OK = [];
    for (const [label, opts] of VIEWS) for (const file of PAGES) {
      test(`${file} on ${label}`, async () => {
        const probe = await open(file, opts);
        const buttons = await probe.page.evaluate(() => [...document.querySelectorAll("button, summary")].map((b, i) => ({ i, text: (b.getAttribute("aria-label") || b.textContent).replace(/\s+/g, " ").trim().slice(0, 40), id: b.id, inNav: !!b.closest("#nav") })));
        await probe.context.close();
        const problems = [];
        let clicked = 0;
        const c = await session(file, opts);
        try {
          for (const b of buttons) {
            await c.fresh();
            const handle = await c.page.evaluateHandle((i) => document.querySelectorAll("button, summary")[i], b.i);
            const el = handle.asElement();
            await reveal(c.page, opts, b.inNav);
            if (!(await el.isVisible()) || !(await el.isEnabled())) continue;
            await c.page.evaluate(() => { window.__muts = 0; new MutationObserver((r) => (window.__muts += r.length)).observe(document, { attributes: true, childList: true, subtree: true, characterData: true }); });
            await el.scrollIntoViewIfNeeded();
            const snap = () => c.page.evaluate(() => ({ url: location.href, y: Math.round(scrollY), wa: window.__wa.length, mut: window.__muts }));
            const a = await snap();
            await el.click();
            await c.page.waitForTimeout(300);
            const z = await snap();
            clicked++;
            const changed = a.url !== z.url || a.y !== z.y || a.wa !== z.wa || z.mut > a.mut;
            if (!changed && !NO_CHANGE_OK.includes(`${file}|${b.text}`)) problems.push(`"${b.text}" (${b.id || "button " + b.i}) did nothing`);
            if (c.errors.length) problems.push(`"${b.text}": ${c.errors.join("; ")}`);
          }
        } finally { await c.context.close(); }
        assert.deepEqual(problems, []);
        assert.ok(clicked >= 2, `clicked ${clicked} buttons`);
      });
    }
  });

  describe("keyboard: Tab reaches every control, in order, with a visible focus mark", () => {
    for (const file of PAGES) {
      test(`${file}: every visible link, button, field and summary is reachable by Tab and shows where the focus is`, async () => {
        const c = await open(file);
        try {
          const { page } = c;
          await page.addStyleTag({ content: "*{scroll-behavior:auto!important}" });
          const targets = await page.evaluate(() => {
            const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && !e.closest("[hidden], [inert]") && e.checkVisibility(); };
            // (a link deliberately taken out of the Tab order, such as a card's picture link that has a titled link beside it, is not expected to be reached)
            return [...document.querySelectorAll('a[href]:not([tabindex="-1"]), button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')].filter(vis).length;
          });
          const visited = new Set(), marks = [], stuck = [];
          let prev = "";
          for (let n = 0; n < targets + 40; n++) {
            await page.keyboard.press("Tab");
            const info = await page.evaluate(() => {
              const e = document.activeElement; if (!e || e === document.body) return null;
              const r = e.getBoundingClientRect();
              return { id: e.id, tag: e.tagName, name: (e.getAttribute("aria-label") || e.textContent || e.value || "").replace(/\s+/g, " ").trim().slice(0, 30), idx: [...document.querySelectorAll("*")].indexOf(e), rect: [r.x, r.y, r.width, r.height] };
            });
            if (!info) { prev = ""; if (visited.size) { await page.keyboard.press("Tab"); if (visited.size >= targets - 2) break; } continue; }   // focus left the page (browser bar) - it comes back round to the top
            const key = `${info.idx}`;
            if (key === prev) { stuck.push(info.name); break; }                                       // pressing Tab did not move the focus: a trap
            prev = key;
            if (visited.has(key)) break;                                                              // went all the way round
            visited.add(key);
            // a focus mark is anything that makes the area look different from when it is not focused
            const [x, y, w, h] = info.rect;
            const clip = { x: Math.max(0, x - 6), y: Math.max(0, y - 6), width: Math.max(1, w + 12), height: Math.max(1, h + 12) };
            if (y >= 0 && y + h <= 900 && w < 1300) {
              const withFocus = await page.screenshot({ clip });
              await page.evaluate(() => document.activeElement.blur());
              const without = await page.screenshot({ clip });
              if (withFocus.equals(without)) marks.push(`${info.tag} "${info.name}"`);
              await page.evaluate((i) => document.querySelectorAll("*")[i].focus({ focusVisible: true }), info.idx);
            }
          }
          assert.deepEqual(stuck, [], "Tab never gets stuck on one control");
          assert.ok(visited.size >= targets - 2, `Tab reached ${visited.size} of ${targets} controls`);
          assert.deepEqual(marks, [], "every focused control looks different from an unfocused one");
        } finally { await c.context.close(); }
      });
    }
  });

  test("nothing above ever asked for a file that does not exist", () => assert.deepEqual(srv.missing, []));
});

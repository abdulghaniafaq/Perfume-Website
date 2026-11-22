// "Smooth": how heavy and how quick the site is, measured in Chrome over HTTP, including a slow phone (CPU slowed 4×).
//  - weight: how much each page downloads before you scroll
//  - speed: when the first screen and the first cards are there; how fast the search and filters react
//  - steadiness: nothing jumps around while loading (layout shift), nothing freezes the page while you type (long tasks)
//  - images: sharp (never stretched past their real size), dimensions declared so the page doesn't jump
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { PRODUCTS } from "./lib/data.mjs";
import { launch } from "./lib/browser.mjs";
import { serve } from "./lib/server.mjs";
import { PAGE_FILES_PLUS } from "./lib/pages.mjs";

const PAGES = PAGE_FILES_PLUS;
const PHONE = { viewport: { width: 390, height: 844 }, contextOptions: { hasTouch: true, isMobile: true } };

describe("smooth: weight, speed and steadiness", () => {
  let browser, srv;
  before(async () => { browser = await launch(); srv = await serve(); });
  after(async () => { await browser.close(); await srv.close(); });

  const slow = async (page, rate = 4) => { const s = await page.context().newCDPSession(page); await s.send("Emulation.setCPUThrottlingRate", { rate }); return s; };
  const observe = (page) => page.addInitScript(() => {
    window.__cls = 0; window.__long = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(Math.round(e.duration)); }).observe({ type: "longtask", buffered: true });
  });
  const loadStats = async (file, opts = {}, rate = 1) => {
    const context = await browser.newContext({ viewport: opts.viewport || { width: 1360, height: 900 }, ...(opts.contextOptions || {}) });
    await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
    const page = await context.newPage();
    const bytes = { html: 0, css: 0, js: 0, img: 0, other: 0 }, reqs = [];
    page.on("response", async (r) => { const u = r.url(); if (!u.startsWith(srv.base)) return; const b = (await r.body().catch(() => Buffer.alloc(0))).length; reqs.push([u, b]); const t = /\.html$/.test(u) ? "html" : /\.css$/.test(u) ? "css" : /\.js$/.test(u) ? "js" : /\.(jpg|png|svg)$/.test(u) ? "img" : "other"; bytes[t] += b; });
    await observe(page);
    if (rate > 1) await slow(page, rate);
    const t0 = Date.now();
    await page.goto(`${srv.base}${file}`, { waitUntil: "load" });
    return { page, context, bytes, reqs, loadMs: Date.now() - t0 };
  };

  describe("weight (before any scrolling)", () => {
    // budgets are generous guard-rails: they catch an accidental 2 MB image or a duplicated library, not tiny drifts
    const BUDGET = { html: 40_000, css: 80_000, js: 260_000, imgFirst: 1_500_000 };
    // the plain-text list of all 627 perfumes is long by design (about 147 KB of text); as the host sends it, compressed, it is about 19 KB, lighter than one product photo
    const htmlBudget = (file) => (file === "perfumes.html" ? 250_000 : BUDGET.html);
    for (const file of PAGES) {
      test(`${file}: page, styles and scripts stay light; first-screen images stay small`, async () => {
        const s = await loadStats(file);
        try {
          await s.page.waitForTimeout(500);
          assert.ok(s.bytes.html <= htmlBudget(file), `html ${s.bytes.html}`);
          if (file === "perfumes.html") { const zlib = await import("node:zlib"), fs = await import("node:fs"), path = await import("node:path"), { SITE_DIR } = await import("./lib/data.mjs"); const z = zlib.gzipSync(fs.readFileSync(path.join(SITE_DIR, file))).length; assert.ok(z <= 30_000, `compressed ${z} bytes`); }
          assert.ok(s.bytes.css <= BUDGET.css, `css ${s.bytes.css}`);
          assert.ok(s.bytes.js <= BUDGET.js, `js ${s.bytes.js}`);
          assert.ok(s.bytes.img <= BUDGET.imgFirst, `first-screen images ${(s.bytes.img / 1e6).toFixed(2)} MB`);
          const big = s.reqs.filter(([u, b]) => /\.(jpg|png)$/.test(u) && b > (file.startsWith("perfume-") ? 140_000 : 120_000));   // (a perfume page opens with the 800px photo, which may be up to 140 KB)
          assert.deepEqual(big.map(([u, b]) => `${u} ${b}`), [], "no first-screen image over 120 KB");
        } finally { await s.context.close(); }
      });
    }
    test("the catalogue loads photos lazily: the 627-product page asks for only the pictures near the screen", async () => {
      const s = await loadStats("catalogue.html");
      try { await s.page.waitForTimeout(800); const n = s.reqs.filter(([u]) => /\/thumbs\//.test(u)).length; assert.ok(n > 0 && n <= 30, `${n} thumbnails requested on load (of 48 cards, 627 products)`); }
      finally { await s.context.close(); }
    });
    test("every product thumbnail is small (≤ 25 KB) and every full photo ≤ 140 KB, so scrolling the catalogue on mobile data stays light", async () => {
      const fs = await import("node:fs"), path = await import("node:path"), { SITE_DIR } = await import("./lib/data.mjs");
      const big = [];
      for (const p of PRODUCTS) {
        const t = fs.statSync(path.join(SITE_DIR, "assets/images/thumbs", `${p.s}.jpg`)).size, f = fs.statSync(path.join(SITE_DIR, "assets/images", `${p.s}.jpg`)).size;
        if (t > 25_000) big.push(`thumb ${p.s} ${t}`); if (f > 140_000) big.push(`photo ${p.s} ${f}`);
      }
      assert.deepEqual(big.slice(0, 8), []);
    });
  });

  describe("speed", () => {
    for (const [label, opts, rate, budget] of [["a laptop", {}, 1, 2500], ["a mid-range phone (CPU 4× slower)", PHONE, 4, 5000]]) {
      test(`on ${label}: every page is loaded and ready within ${budget / 1000}s`, async () => {
        const slowOnes = [];
        for (const file of PAGES) {
          const s = await loadStats(file, opts, rate);
          try { await s.page.waitForSelector(file === "catalogue.html" ? "#grid .card" : "h1"); if (s.loadMs > budget) slowOnes.push(`${file} ${s.loadMs}ms`); } finally { await s.context.close(); }
        }
        assert.deepEqual(slowOnes, []);
      });
    }

    test("on a slow phone the catalogue shows its first cards within 3s, and a keystroke in the search box updates the results within 400ms", async () => {
      const s = await loadStats("catalogue.html", PHONE, 4);
      try {
        const t = Date.now(); await s.page.waitForSelector("#grid .card"); assert.ok(Date.now() - t < 3000);
        const ms = await s.page.evaluate(async () => {
          const q = document.querySelector("#q"), times = [];
          for (const text of ["o", "ou", "oud", "oud w", "oud wo", "oud woo", "oud wood"]) {
            const t0 = performance.now();
            await new Promise((resolve) => { const mo = new MutationObserver(() => { mo.disconnect(); resolve(); }); mo.observe(document.querySelector("#grid"), { childList: true, subtree: true }); q.value = text; q.dispatchEvent(new Event("input", { bubbles: true })); setTimeout(resolve, 1500); });
            times.push(Math.round(performance.now() - t0));
          }
          return times;
        });
        assert.ok(Math.max(...ms) < 400, `slowest keystroke ${Math.max(...ms)}ms (${ms})`);
      } finally { await s.context.close(); }
    });

    test("on a slow phone every filter choice redraws the results within 400ms", async () => {
      const s = await loadStats("catalogue.html", PHONE, 4);
      try {
        await s.page.waitForSelector("#grid .card");
        const times = await s.page.evaluate(async () => {
          const out = [], redraw = (fn) => new Promise((resolve) => { const t0 = performance.now(), mo = new MutationObserver(() => { mo.disconnect(); resolve(Math.round(performance.now() - t0)); }); mo.observe(document.querySelector("#grid"), { childList: true, subtree: true }); fn(); setTimeout(() => resolve(-1), 1500); });
          for (const seg of ["arabian", "luxury", "designer", "all"]) out.push(await redraw(() => document.querySelector(`#segChips [data-seg="${seg}"]`).click()));
          out.push(await redraw(() => { const s = document.querySelector("#sort"); s.value = "hi"; s.dispatchEvent(new Event("change", { bubbles: true })); }));
          out.push(await redraw(() => document.querySelector("#pager .pg.nav:last-child").click()));
          return out;
        });
        assert.ok(times.every((t) => t >= 0 && t < 400), `redraw times ${times}`);
      } finally { await s.context.close(); }
    });
  });

  describe("steadiness", () => {
    for (const [label, opts] of [["a laptop", {}], ["a phone", PHONE]]) {
      test(`on ${label}: nothing jumps while each page loads and is scrolled to the bottom (layout shift under 0.1)`, async () => {
        const bad = [];
        for (const file of PAGES) {
          const s = await loadStats(file, opts);
          try {
            await s.page.waitForTimeout(600);
            await s.page.evaluate(async () => { for (let y = 0; y <= document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 70)); } });
            await s.page.waitForTimeout(500);
            const cls = await s.page.evaluate(() => window.__cls);
            if (cls > 0.1) bad.push(`${file} ${cls.toFixed(3)}`);
          } finally { await s.context.close(); }
        }
        assert.deepEqual(bad, []);
      });
    }

    test("typing 20 characters on a slow phone never freezes the page for more than 250ms, and scrolling the filtered list doesn't either", async () => {
      const s = await loadStats("catalogue.html", PHONE, 4);
      try {
        await s.page.waitForSelector("#grid .card"); await s.page.waitForTimeout(500);
        await s.page.evaluate(() => { window.__long.length = 0; });
        await s.page.click("#q"); await s.page.keyboard.type("christian dior sauvage elixir", { delay: 35 });
        await s.page.waitForTimeout(500);
        await s.page.evaluate(async () => { for (let y = 0; y < 3000; y += 300) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } });
        const long = await s.page.evaluate(() => window.__long);
        assert.ok(long.every((d) => d < 250), `long tasks while typing and scrolling: ${long}`);
      } finally { await s.context.close(); }
    });

    test("every image on the page is declared (width/height or a sized box), is never shown larger than its real size, and loads", async () => {
      const bad = [];
      for (const file of ["index.html", "catalogue.html", "faq.html"]) {
        const s = await loadStats(file);
        try {
          await s.page.evaluate(async () => { for (let y = 0; y <= document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } });
          await s.page.waitForTimeout(900);
          const r = await s.page.evaluate(() => [...document.images].filter((i) => i.getBoundingClientRect().width > 0).map((i) => { const b = i.getBoundingClientRect(); return { src: i.getAttribute("src"), declared: i.hasAttribute("width") && i.hasAttribute("height") || getComputedStyle(i).aspectRatio !== "auto" || (i.parentElement && i.parentElement.getBoundingClientRect().height > 0 && getComputedStyle(i.parentElement).position !== "static"), ok: i.complete && i.naturalWidth > 0, up: b.width > i.naturalWidth * 1.05 }; }));
          r.forEach((x) => { if (!x.ok) bad.push(`${file}: not loaded ${x.src}`); if (x.up) bad.push(`${file}: stretched past its real size ${x.src}`); if (!x.declared) bad.push(`${file}: no size declared ${x.src}`); });
        } finally { await s.context.close(); }
      }
      assert.deepEqual(bad.slice(0, 8), []);
    });
  });
});

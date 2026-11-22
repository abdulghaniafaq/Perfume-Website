// Light / dark mode: a switch on every page, sensible defaults, a remembered choice, no flash of the wrong theme,
// and readable text everywhere in BOTH themes.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { launch, openPage } from "./lib/browser.mjs";
import { auditContrast } from "./lib/theme.mjs";
import { SITE_DIR } from "./lib/data.mjs";
import { PAGE_FILES_PLUS } from "./lib/pages.mjs";

const PAGES = PAGE_FILES_PLUS;                                // the 14 pages and a sample of the perfume pages (every kind of perfume page is in the sample)
const KEY = "perfume-x-theme";
const DARK_BG = "rgb(11, 10, 9)", LIGHT_BG = "rgb(251, 247, 239)";
const facts = (page) => page.evaluate(() => ({
  theme: document.documentElement.dataset.theme,
  bg: getComputedStyle(document.body).backgroundColor,
  scheme: getComputedStyle(document.documentElement).colorScheme,
  label: document.querySelector("#theme-toggle")?.getAttribute("aria-label"),
  meta: document.querySelector('meta[name="theme-color"]')?.content,
  saved: (() => { try { return localStorage.getItem("perfume-x-theme"); } catch { return "n/a"; } })(),
}));

describe("light and dark mode", () => {
  let browser;
  const contexts = [];
  const open = async (file, { scheme = "dark", ...rest } = {}) => { const c = await openPage(browser, file, { contextOptions: { colorScheme: scheme }, ...rest }); contexts.push(c); return c; };
  before(async () => { browser = await launch(); });
  after(async () => { await browser.close(); });

  describe("the switch", () => {
    for (const file of PAGES) {
      test(`${file}: a 44px sun/moon button in the header, before the cart`, async () => {
        const { page } = await open(file);
        const b = await page.locator("#theme-toggle").boundingBox();
        assert.ok(b && b.width >= 44 && b.height >= 44, `button is ${b?.width}×${b?.height}`);
        assert.equal(await page.locator(".bar-actions > :first-child").getAttribute("id"), "theme-toggle");
        assert.equal(await page.locator("#theme-toggle").getAttribute("aria-label"), "Switch to light mode");
        assert.equal(await page.locator("#theme-toggle svg.i-sun").isVisible(), true, "dark mode shows a sun (= switch to light)");
        assert.equal(await page.locator("#theme-toggle svg.i-moon").isVisible(), false);
      });
    }

    test("clicking it switches the whole page, remembers the choice, and the label, icon and browser-bar colour follow", async () => {
      const { page } = await open("index.html");
      assert.deepEqual(await facts(page), { theme: "dark", bg: DARK_BG, scheme: "dark", label: "Switch to light mode", meta: "#0b0a09", saved: null });
      await page.click("#theme-toggle");
      assert.deepEqual(await facts(page), { theme: "light", bg: LIGHT_BG, scheme: "light", label: "Switch to dark mode", meta: "#fbf7ef", saved: "light" });
      assert.equal(await page.locator("#theme-toggle svg.i-moon").isVisible(), true, "light mode shows a moon (= switch to dark)");
      assert.equal(await page.locator("#theme-toggle svg.i-sun").isVisible(), false);
      await page.click("#theme-toggle");
      assert.deepEqual(await facts(page), { theme: "dark", bg: DARK_BG, scheme: "dark", label: "Switch to light mode", meta: "#0b0a09", saved: "dark" });
    });

    test("it works with the keyboard, and the focus ring is visible", async () => {
      const { page } = await open("index.html");
      await page.focus("#theme-toggle");
      await page.keyboard.press("Enter");
      assert.equal((await facts(page)).theme, "light");
      await page.keyboard.press("Space");
      assert.equal((await facts(page)).theme, "dark");
      assert.notEqual(await page.evaluate(() => getComputedStyle(document.querySelector("#theme-toggle")).outlineStyle), "none");
    });
  });

  describe("which theme you start in", () => {
    test("with nothing saved, it follows the device: light device → light, dark device → dark", async () => {
      for (const file of ["index.html", "catalogue.html", "contact.html"]) {
        assert.equal((await facts((await open(file, { scheme: "light" })).page)).theme, "light", `${file} on a light device`);
        assert.equal((await facts((await open(file, { scheme: "dark" })).page)).theme, "dark", `${file} on a dark device`);
      }
      assert.deepEqual(await facts((await open("index.html", { scheme: "light" })).page), { theme: "light", bg: LIGHT_BG, scheme: "light", label: "Switch to dark mode", meta: "#fbf7ef", saved: null });
    });

    test("a saved choice beats the device setting, both ways round", async () => {
      assert.equal((await facts((await open("index.html", { scheme: "light", storage: { [KEY]: "dark" } })).page)).theme, "dark");
      assert.equal((await facts((await open("index.html", { scheme: "dark", storage: { [KEY]: "light" } })).page)).theme, "light");
      assert.equal((await facts((await open("index.html", { scheme: "light", storage: { [KEY]: "nonsense" } })).page)).theme, "light", "an unusable saved value is ignored");
    });

    test("it follows the device while no choice has been made — and stops once you choose", async () => {
      const { page } = await open("index.html", { scheme: "dark" });
      const becomes = (t) => page.waitForFunction((x) => document.documentElement.dataset.theme === x, t, { timeout: 3000 });   // the browser reports a device change a moment later
      await page.emulateMedia({ colorScheme: "light" }); await becomes("light");
      await page.emulateMedia({ colorScheme: "dark" }); await becomes("dark");
      assert.equal((await facts(page)).saved, null, "following the device never saves anything");
      await page.click("#theme-toggle");                                // you choose light
      assert.equal((await facts(page)).saved, "light");
      await page.emulateMedia({ colorScheme: "light" }); await page.emulateMedia({ colorScheme: "dark" });
      await page.waitForTimeout(400);                                   // plenty of time for a (wrong) switch to happen
      assert.equal((await facts(page)).theme, "light", "your choice is kept, whatever the device does");
    });
  });

  describe("the choice sticks", () => {
    test("it follows you to every other page and survives a reload", async () => {
      const { page } = await open("index.html");
      await page.click("#theme-toggle");
      for (const href of ["catalogue.html", "how-to-order.html", "guarantee.html", "faq.html", "contact.html", "index.html"]) {
        await page.evaluate((h) => { location.href = h; }, href);
        await page.waitForURL(new RegExp(href.replace(".", "\\.") + "$"));
        assert.equal((await facts(page)).theme, "light", `${href} should stay light`);
      }
      await page.reload();
      assert.deepEqual(await facts(page), { theme: "light", bg: LIGHT_BG, scheme: "light", label: "Switch to dark mode", meta: "#fbf7ef", saved: "light" });
    });

    test("a change made in another tab shows up here", async () => {
      const a = await open("index.html");
      const b = await a.context.newPage();
      await b.goto(a.page.url());
      await b.click("#theme-toggle");
      await a.page.waitForFunction(() => document.documentElement.dataset.theme === "light", null, { timeout: 3000 });
      assert.equal((await facts(a.page)).label, "Switch to dark mode");
    });
  });

  describe("no flash of the wrong theme", () => {
    test("every page chooses its theme in a script in the <head> (so it is set before the first paint, and before common.js loads)", () => {
      for (const file of PAGES) {
        const html = fs.readFileSync(path.join(SITE_DIR, file), "utf8");
        const head = html.slice(0, html.indexOf("</head>"));
        assert.match(head, /dataset\.theme=t/, `${file}: the head script that sets the theme`);
        assert.equal((html.match(/dataset\.theme=t/g) || []).length, 1, `${file}: exactly one theme script`);
      }
    });

    test("with common.js blocked, the saved theme (or the device's) is already applied", async () => {
      for (const [scheme, storage, want] of [["dark", { [KEY]: "light" }, "light"], ["light", undefined, "light"], ["dark", undefined, "dark"], ["light", { [KEY]: "dark" }, "dark"]]) {
        const ctx = await browser.newContext({ colorScheme: scheme });
        await ctx.route(/common\.js$/, (r) => r.abort());
        if (storage) await ctx.addInitScript((kv) => { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); }, storage);
        const page = await ctx.newPage();
        await page.goto(`file://${path.join(SITE_DIR, "index.html")}`);
        const f = await facts(page);
        assert.equal(f.theme, want, `${scheme} device, saved ${JSON.stringify(storage)}`);
        assert.equal(f.bg, want === "light" ? LIGHT_BG : DARK_BG);
        await ctx.close();
      }
    });
  });

  describe("without JavaScript", () => {
    test("the page stays in the original dark look and the switch is hidden (it could do nothing)", async () => {
      const ctx = await browser.newContext({ javaScriptEnabled: false, colorScheme: "light" });
      const page = await ctx.newPage();
      await page.goto(`file://${path.join(SITE_DIR, "index.html")}`);
      assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), DARK_BG);
      assert.equal(await page.locator("#theme-toggle").isVisible(), false);
      await ctx.close();
    });
  });

  describe("the two palettes", () => {
    test("light has an ivory page with dark text; dark keeps the original black with light text", async () => {
      const read = (page) => page.evaluate(() => { const s = getComputedStyle(document.body); const h = getComputedStyle(document.querySelector("h1")); return { bg: s.backgroundColor, text: s.color, h1: h.color }; });
      assert.deepEqual(await read((await open("index.html", { scheme: "dark" })).page), { bg: DARK_BG, text: "rgb(243, 237, 226)", h1: "rgb(243, 237, 226)" });
      assert.deepEqual(await read((await open("index.html", { scheme: "light" })).page), { bg: LIGHT_BG, text: "rgb(29, 24, 16)", h1: "rgb(29, 24, 16)" });
    });

    test("the gold buttons are the same bright gold with dark text in both themes", async () => {
      const btn = async (scheme) => (await open("index.html", { scheme })).page.evaluate(() => { const b = getComputedStyle(document.querySelector(".hero .btn-gold")); return { image: b.backgroundImage, text: b.color }; });
      const [d, l] = [await btn("dark"), await btn("light")];
      assert.deepEqual(d, l);
      assert.equal(d.text, "rgb(26, 19, 7)");
      assert.match(d.image, /rgb\(212, 175, 106\)/);
    });

    test("gold text is darker in light mode (so it reads on ivory)", async () => {
      const gold = async (scheme) => (await open("index.html", { scheme })).page.evaluate(() => getComputedStyle(document.querySelector(".eyebrow")).color);
      assert.equal(await gold("dark"), "rgb(212, 175, 106)");
      assert.equal(await gold("light"), "rgb(116, 86, 31)");
    });
  });

  describe("readable text in both themes (WCAG contrast: 4.5:1, or 3:1 for large text)", () => {
    for (const scheme of ["dark", "light"]) {
      for (const file of PAGES) {
        test(`${file} — ${scheme}`, async () => {
          const { page } = await open(file, { scheme });
          await page.evaluate(() => document.querySelectorAll(".reveal").forEach((e) => e.classList.add("in")));
          await page.waitForTimeout(1000);
          assert.deepEqual(await auditContrast(page), []);
        });
      }

      test(`catalogue states — ${scheme}: no results with "Remove…" chips, the cart, the quiz (a question and the results)`, async () => {
        const { page } = await open("catalogue.html", { scheme });
        const check = async (label) => { await page.waitForTimeout(700); assert.deepEqual(await auditContrast(page), [], label); };
        await page.fill("#q", "zzzqqq"); await page.waitForTimeout(300); await check("nothing matches");
        await page.fill("#q", ""); await page.click("#filters-open"); await page.selectOption("#brand", "Lattafa"); await page.click('#family [data-v="Fresh & Citrus"]');
        await check("filters panel, with greyed-out choices");
        await page.evaluate(() => { const b = document.querySelector('#gender [data-v="Women"]'); b.disabled = false; b.click(); });
        await page.click("#pn-done");
        assert.ok(await page.locator("#grid .empty-fixes").count(), "the dead end should offer fixes"); await check("dead end with fixes");
        await page.click("#reset");
        await page.locator(".card .add").first().click(); await page.click("#cart-open"); await check("cart drawer"); await page.keyboard.press("Escape");
        await page.evaluate(() => window.PX.quiz.open()); await page.locator(".quiz-opt").nth(1).click(); await check("quiz question");
        while (await page.locator(".quiz-opts").count()) await page.locator(".quiz-skip").click();
        await check("quiz results");
      });

      test(`contact states — ${scheme}: form errors and catalogue suggestions`, async () => {
        const { page } = await open("contact.html", { scheme });
        await page.click('#request-form button[type="submit"]'); await page.waitForTimeout(500);
        assert.deepEqual(await auditContrast(page), [], "errors");
        await page.fill("#rq-perfume", "oud"); await page.waitForTimeout(500);
        assert.deepEqual(await auditContrast(page), [], "suggestions");
      });

      test(`phone menu — ${scheme}`, async () => {
        const { page } = await open("index.html", { scheme, viewport: { width: 390, height: 844 } });
        await page.click("#menu-btn"); await page.waitForTimeout(500);
        assert.deepEqual(await auditContrast(page), []);
      });
    }
  });

  test("no console errors or failed requests", () => assert.deepEqual(contexts.flatMap((c) => c.errors), []));
});

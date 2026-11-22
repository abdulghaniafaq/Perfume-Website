// Accessibility scan with axe-core (the engine behind most accessibility checkers), WCAG 2.0 / 2.1 / 2.2 level A and AA rules,
// on every page, in light and dark, on a laptop and a phone - and in the states people actually reach: search suggestions open,
// the Filters panel, the empty state, the photo viewer, the quiz (question and results), the cart with the "i" note open,
// an open FAQ answer, the contact form with errors and with its confirmation.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { launch, openPage } from "./lib/browser.mjs";
import { serve } from "./lib/server.mjs";
import { setTheme } from "./lib/theme.mjs";
import { PAGE_FILES_PLUS } from "./lib/pages.mjs";

const require = createRequire(import.meta.url);
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const PAGES = PAGE_FILES_PLUS;                                // the 14 pages and a sample of the perfume pages (every kind of perfume page is in the sample)
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const VIEWS = [["laptop", {}], ["phone", { viewport: { width: 390, height: 844 }, contextOptions: { hasTouch: true, isMobile: true } }]];

describe("accessibility (axe-core)", () => {
  let browser, srv;
  const opened = [];
  before(async () => { browser = await launch(); srv = await serve(); });
  after(async () => { await browser.close(); await srv.close(); });

  const calm = (page) => page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important} .reveal,[data-reveal]{opacity:1!important;transform:none!important}" });
  const scan = async (page, include) => {
    await page.addScriptTag({ content: AXE });
    return page.evaluate(async ({ TAGS, include }) => {
      const r = await axe.run(include ? { include: [[include]] } : document, { runOnly: { type: "tag", values: TAGS }, resultTypes: ["violations"] });
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => `${n.target.join(" ")} :: ${(n.failureSummary || "").split("\n").slice(1, 3).join(" ").slice(0, 160)}`) }));
    }, { TAGS, include });
  };
  const verdict = (name, v) => assert.deepEqual(v.map((x) => `${x.id} [${x.impact}] ${x.help}\n      ${x.nodes.join("\n      ")}`), [], `${name}`);
  const open = async (file, opts, theme) => {
    const c = await openPage(browser, file, { base: srv.base, ...opts, contextOptions: { ...(opts.contextOptions || {}), colorScheme: theme } });
    opened.push(c);
    await setTheme(c.page, theme);
    await calm(c.page);
    await c.page.waitForTimeout(500);
    return c;
  };

  describe("every page", () => {
    for (const theme of ["dark", "light"]) for (const [vl, opts] of VIEWS) for (const file of PAGES) {
      test(`${file} · ${theme} · ${vl}: no accessibility violations`, async () => {
        const { page, context } = await open(file, opts, theme);
        try { verdict(file, await scan(page)); } finally { await context.close(); }
      });
    }
  });

  describe("the states people reach", () => {
    for (const theme of ["dark", "light"]) for (const [vl, opts] of VIEWS) {
      const tag = `${theme} · ${vl}`;
      test(`catalogue · ${tag}: search suggestions open; the Filters panel; the empty state; a result with a mini picture`, async () => {
        const { page, context } = await open("catalogue.html", opts, theme);
        try {
          await page.click("#q"); await page.keyboard.type("oud", { delay: 25 }); await page.waitForSelector("#suggest:not([hidden]) li");
          await page.keyboard.press("ArrowDown");
          verdict("suggestions", await scan(page));
          await page.fill("#q", ""); await page.click("body", { position: { x: 5, y: 300 } });
          await page.click("#filters-open"); await page.waitForSelector("#filters:not([hidden])"); await page.waitForTimeout(300);
          verdict("filters panel", await scan(page));
          await page.click("#pn-done");
          await page.fill("#q", "zzqxj"); await page.waitForSelector("#grid .empty");
          verdict("empty state", await scan(page));
          await page.fill("#q", "Terre D'Hermes"); await page.waitForTimeout(400);
          verdict("mini picture result", await scan(page));
        } finally { await context.close(); }
      });

      test(`catalogue · ${tag}: the photo viewer open, then the cart with a mini and a tester and its "i" note open`, async () => {
        const { page, context } = await open("catalogue.html", opts, theme);
        try {
          await page.locator("#grid .card .thumb").first().click(); await page.waitForSelector("#lightbox:not([hidden])");
          verdict("photo viewer", await scan(page));
          await page.keyboard.press("Escape");
          await page.evaluate(() => { const v = []; for (const p of PRODUCTS) for (const x of p.v) if (x.g === "Minis" || x.g === "Tester") { if (!v.some((k) => k.g === x.g)) v.push({ p, x, g: x.g }); } v.forEach(({ p, x }) => PX.addToCart(PX.keyOf(p, x))); });
          await page.click("#cart-open"); await page.waitForSelector("#cart.open"); await page.waitForTimeout(400);
          await page.locator("[data-info]").first().click();
          verdict("cart", await scan(page));
        } finally { await context.close(); }
      });

      test(`catalogue · ${tag}: the cart bar, the "Added · View cart" message, the round WhatsApp button, back to top and the quiz button, all showing together`, async () => {
        const { page, context } = await open("catalogue.html", opts, theme);
        try {
          await page.locator("#grid .card .add").first().click();
          await page.waitForSelector("#toast.show", { state: "attached" }).catch(() => {});
          await page.evaluate(() => scrollTo(0, innerHeight * 3)); await page.waitForTimeout(400);
          assert.equal(await page.locator("#to-top").isVisible(), true);
          verdict("floating controls", await scan(page));
          await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300);
          verdict("quiz button and Mini badges", await scan(page));
        } finally { await context.close(); }
      });

      test(`quiz · ${tag}: a question, and the results`, async () => {
        const { page, context } = await open("catalogue.html", opts, theme);
        try {
          await page.goto(`${srv.base}catalogue.html?quiz=1`); await calm(page);
          await page.waitForSelector("#quiz:not([hidden]) .quiz-opt"); await page.waitForTimeout(400);
          verdict("quiz question", await scan(page));
          while (!(await page.locator(".qr").count())) { await page.locator(".quiz-skip").click(); await page.waitForTimeout(150); }
          await page.waitForTimeout(700);
          verdict("quiz results", await scan(page));
        } finally { await context.close(); }
      });

      test(`faq · ${tag}: an answer open; contact · ${tag}: form errors, then the confirmation`, async () => {
        const f = await open("faq.html", opts, theme);
        try { await f.page.locator("details summary").nth(1).click(); await f.page.waitForTimeout(200); verdict("faq open", await scan(f.page)); } finally { await f.context.close(); }
        const { page, context } = await open("contact.html", opts, theme);
        try {
          await page.click('form button[type="submit"]'); await page.waitForTimeout(250);
          verdict("form errors", await scan(page));
          await page.fill("#rq-perfume", "Aventus"); await page.fill("#rq-name", "Asha");
          await page.click('form button[type="submit"]'); await page.waitForSelector("#request-done:not([hidden])"); await page.waitForTimeout(250);
          verdict("confirmation", await scan(page));
        } finally { await context.close(); }
      });
    }
  });

  // axe tries to fetch the Google Fonts style sheet from its own script (to read its rules for the contrast check); the site's policy refuses that (connect-src 'self'),
  // which is axe's request, not the site's: security.test.mjs proves the pages themselves make no such request and trigger no violation
  const AXE_OWN = /Couldn't load preload assets|^console\.error: Connecting to 'https:\/\/fonts\.googleapis\.com[^']*' violates the following Content Security Policy directive: "connect-src 'self'"|^requestfailed: https:\/\/fonts\.googleapis\.com\//;
  test("the site itself logged no console errors or failed requests while scanning (axe's own notices about stylesheets it cannot fetch are ignored)", () => assert.deepEqual(opened.flatMap((o) => o.errors).filter((e) => !AXE_OWN.test(e)), []));
});

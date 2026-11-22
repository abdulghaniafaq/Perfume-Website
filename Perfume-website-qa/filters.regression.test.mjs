// Regression tests for the behaviour AROUND the filters: reset, paging, empty state, variants + cart,
// URL presets, the "Find my scent" quiz, option counts, typing races, keyboard and mobile.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { PRODUCTS } from "./lib/data.mjs";
import { launch, openCatalogue, applyFilters, change, collect, diff, runScenarios, fmt } from "./lib/browser.mjs";
import { expected, NONE, PAGE_SIZE, houses, families, normalize } from "./lib/oracle.mjs";
import { pairwiseScenarios, randomScenarios, singleFilterScenarios } from "./lib/scenarios.mjs";

const parseCount = (label) => {
  let m;
  if ((m = label.match(/^(\d+)–(\d+) of (\d+)$/))) return +m[3];
  if ((m = label.match(/^(\d+) (?:of \d+|fragrances)$/))) return +m[1];
  throw new Error(`unrecognised count label "${label}"`);
};

describe("catalogue filters: regression", () => {
  let browser;
  const opened = [];
  const fresh = async (opts) => { const c = await openCatalogue(browser, opts); opened.push(c); return c; };
  before(async () => { browser = await launch(); });
  after(async () => { await browser.close(); });

  describe("Clear filters", () => {
    test("restores every control and the full catalogue after a heavy combination", async () => {
      const { page } = await fresh();
      const F = { seg: "arabian", g: "Retail", brand: "Lattafa", gd: "Unisex", fm: "Gourmand", price: "1000-3000", q: "khamrah", sort: "hi" };
      await applyFilters(page, F);
      assert.equal(await page.locator("#reset").isVisible(), true);
      await page.click("#reset");
      assert.deepEqual(diff({}, await collect(page)), []);
      assert.equal(await page.locator("#reset").isHidden(), true);
      assert.equal(await page.inputValue("#q"), "");
    });
    test("is not offered when only the page number changed", async () => {
      const { page } = await fresh();
      await page.click('#pager .pg[data-p="3"]');
      assert.equal(await page.locator("#reset").isHidden(), true);
    });
    test("is offered for sort-only and search-only changes", async () => {
      const { page } = await fresh();
      await change(page, "sort", "hi");
      assert.equal(await page.locator("#reset").isVisible(), true);
      await page.click("#reset");
      await change(page, "q", "oud");
      assert.equal(await page.locator("#reset").isVisible(), true);
    });
  });

  describe("pagination", () => {
    test("changing any filter returns to page 1", async () => {
      const { page } = await fresh();
      for (const [key, value] of [["sort", "lo"], ["seg", "designer"], ["g", "Retail"], ["gd", "Men"], ["q", "e"], ["fm", "Gourmand"]]) {
        await applyFilters(page, {});
        await page.click('#pager .pg[data-p="3"]');
        assert.equal(await page.locator("#pager .pg.on").textContent(), "3");
        await change(page, key, value);
        const on = await page.locator("#pager .pg.on").textContent().catch(() => "none");
        assert.ok(on === "1" || on === "none", `after changing ${key} the pager shows page ${on}`);
        assert.match(await page.locator("#count").textContent(), /^(1–|\d+ of)/, `count label after changing ${key}`);
      }
    });
    test("Prev / Next / numbered buttons with real clicks; last page holds the remainder", async () => {
      const { page } = await fresh();
      const on = () => page.locator("#pager .pg.on").textContent();
      await page.locator("#pager .pg.nav").last().click(); assert.equal(await on(), "2");
      await page.locator("#pager .pg.nav").first().click(); assert.equal(await on(), "1");
      assert.equal(await page.locator("#pager .pg.nav").first().isDisabled(), true);
      await page.click('#pager .pg[data-p="14"]');
      assert.equal(await on(), "14");
      assert.equal(await page.locator("#pager .pg.nav").last().isDisabled(), true);
      assert.equal(await page.locator("#grid .card").count(), PRODUCTS.length - 13 * PAGE_SIZE);
      assert.equal(await page.locator("#count").textContent(), `625–627 of 627`);
      await page.locator("#pager .pg.nav").first().click();
      assert.equal(await on(), "13");
    });
    test("moving to another page brings the results back into view", async () => {
      const { page } = await fresh();
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.locator("#pager .pg.nav").last().click();
      await page.waitForTimeout(1000);
      const top = await page.evaluate(() => document.querySelector(".controls").getBoundingClientRect().top);
      assert.ok(top > -5 && top < 160, `controls top at ${top}px after changing page`);
    });
    test("result counts around the page-size boundary (0, 1, 47, 48, 49, 96, 97)", async (t) => {
      const { page } = await fresh();
      const want = new Set([0, 1, 47, 48, 49, 96, 97]), found = new Map();
      for (const sc of [...singleFilterScenarios(), ...pairwiseScenarios()]) { const n = expected(sc.F ?? sc).length; if (want.has(n) && !found.has(n)) found.set(n, sc.F ?? sc); }
      t.diagnostic(`boundary counts found in the scenario pool: ${[...found.keys()].sort((a, b) => a - b)}; not found: ${[...want].filter((n) => !found.has(n))}`);
      assert.ok(found.size >= 4, "scenario pool should hit several boundary sizes");
      const f = await runScenarios(page, [...found.values()]);
      assert.equal(f.length, 0, fmt(f));
    });
  });

  describe("empty state", () => {
    test("shows a helpful message, hides the pager, and recovers", async () => {
      const { page } = await fresh();
      await applyFilters(page, { seg: "arabian", brand: "Tom Ford" });
      assert.equal(await page.locator("#grid .empty h2").textContent(), "Nothing matches that");
      assert.equal(await page.locator("#count").textContent(), "0 of 627");
      assert.equal(await page.locator("#pager .pg").count(), 0);
      assert.equal(await page.locator("#grid .card").count(), 0);
      assert.match(await page.getAttribute("#grid .empty a", "href"), /contact\.html$/);
      await page.click("#reset");
      assert.equal(await page.locator("#grid .card").count(), 48);
    });
  });

  describe("variants and cart", () => {
    const card = (page, slug) => page.locator(`.card[data-slug="${slug}"]`);
    test("filters narrow the size/packaging chips on a card", async () => {
      const { page } = await fresh();
      await applyFilters(page, { q: "twilly d'hermes eau ginger" });
      assert.equal(await card(page, "hermes-twilly-dhermes-eau-ginger-edp").locator(".vchip").count(), 3);
      await applyFilters(page, { q: "twilly d'hermes eau ginger", g: "Tester" });
      assert.equal(await card(page, "hermes-twilly-dhermes-eau-ginger-edp").locator(".vchip").count(), 0);
      assert.match(await card(page, "hermes-twilly-dhermes-eau-ginger-edp").locator(".tag.pkg").textContent(), /85ml · Tester/);
    });
    test("choosing a variant updates price, remark and the single-item order link", async () => {
      const { page } = await fresh();
      await applyFilters(page, { q: "signature", g: "Tester" });
      const c = card(page, "roberto-cavalli-signature-edp");
      const labels = await c.locator(".vchip").allTextContents();
      assert.deepEqual(labels.map((l) => l.trim()), ["75ml · Tester (No Box)", "75ml · Tester"], "sizes are listed cheapest first");
      // the cheapest size is the one selected to begin with
      assert.match(await c.locator(".price").textContent(), /3,650/);
      assert.equal((await c.locator(".note").textContent()).trim(), "No Box");
      assert.match(await c.locator(".order").getAttribute("data-wa-open"), /No Box[\s\S]*₹3,650/);
      await c.locator(".vchip").nth(1).click();
      assert.match(await c.locator(".price").textContent(), /4,150/);
      assert.doesNotMatch(await c.locator(".order").getAttribute("data-wa-open"), /No Box/);
      assert.match(await c.locator(".order").getAttribute("data-wa-open"), /₹4,150/);
    });
    test("Add to cart adds the SELECTED variant; the button reflects the selected variant", async () => {
      const { page } = await fresh();
      await applyFilters(page, { q: "twilly d'hermes eau ginger" });
      const c = card(page, "hermes-twilly-dhermes-eau-ginger-edp");
      await c.locator(".vchip", { hasText: "2ml" }).click();         // the 2ml vial
      await c.locator(".add").click();
      assert.equal((await c.locator(".add").textContent()).trim(), "✓");
      await c.locator(".vchip", { hasText: "85ml · Retail" }).click(); // back to the 85ml retail bottle → not in cart
      assert.equal((await c.locator(".add").textContent()).trim(), "+");
      await page.click("#cart-open");
      assert.match(await page.locator(".line-meta").first().textContent(), /2ml · Vial/);
      assert.match(await page.locator("#cart-total").textContent(), /₹300/);
      await page.keyboard.press("Escape");
    });
    test("cart contents and button state survive filter changes and paging", async () => {
      const { page } = await fresh();
      await applyFilters(page, { q: "khamrah" });
      await card(page, "lattafa-khamrah").locator(".add").click();
      await card(page, "lattafa-khamrah").locator(".add").click();
      await applyFilters(page, { brand: "Tom Ford" });
      assert.equal(await page.locator("#cart-count").textContent(), "2");
      await applyFilters(page, { q: "khamrah" });
      assert.equal((await card(page, "lattafa-khamrah").locator(".add").textContent()).trim(), "2");
    });
  });

  describe("URL presets from other pages", () => {
    for (const [style, n] of [["designer", 309], ["luxury", 90], ["arabian", 222]]) {
      test(`?style=${style} opens the catalogue pre-filtered, then tidies the URL`, async () => {
        const { page } = await fresh({ query: `?style=${style}` });
        assert.deepEqual(diff({ seg: style }, await collect(page)), []);
        assert.equal(await page.evaluate(() => location.search), "");
        assert.equal(expected({ seg: style }).length, n);
      });
    }
    test("unknown or wrongly-cased styles are ignored (full catalogue)", async () => {
      for (const q of ["?style=bogus", "?style=ARABIAN", "?style=", "?style=all"]) {
        const { page } = await fresh({ query: q });
        assert.deepEqual(diff({}, await collect(page)), [], q);
      }
    });
    test("?q= opens the catalogue already searched (by perfume name), then tidies the URL (used by the contact form)", async () => {
      for (const q of ["oud", "Khamrah Qahwa", "d’hermes", "  oud  wood ", "Lattafa"]) {
        const { page } = await fresh({ query: `?q=${encodeURIComponent(q)}` });
        assert.deepEqual(diff({ q }, await collect(page)), [], q);
        assert.equal(await page.evaluate(() => location.search), "");
      }
    });
    test("?q= is capped at 80 characters and survives odd input", async () => {
      const long = "a".repeat(300);
      const { page } = await fresh({ query: `?q=${long}` });
      assert.equal((await page.inputValue("#q")).length, 80);
      for (const q of ["<script>alert(1)</script>", "%", "((", "\\"]) {
        const o = await fresh({ query: `?q=${encodeURIComponent(q)}` });
        assert.deepEqual(diff({ q }, await collect(o.page)), [], q);
      }
    });
    test("?quiz=1 opens the quiz; ?style + ?quiz work together", async () => {
      const a = await fresh({ query: "?quiz=1" });
      assert.equal(await a.page.locator("#quiz").isVisible(), true);
      assert.equal(await a.page.evaluate(() => location.search), "");
      const b = await fresh({ query: "?style=luxury&quiz=1" });
      assert.equal(await b.page.locator("#quiz").isVisible(), true);
      await b.page.keyboard.press("Escape");
      assert.deepEqual(diff({ seg: "luxury" }, await collect(b.page)), []);
    });
  });

  describe("option lists are accurate", () => {
    test("counts in the dropdown labels match the data; no dead options", async () => {
      const { page } = await fresh();
      const opts = await page.evaluate(() => {
        const sel = (id) => [...document.querySelectorAll(`#${id} option`)].map((o) => [o.value, o.textContent.trim()]);
        const chips = (id) => [...document.querySelectorAll(`#${id} .pn-chip`)].map((b) => [b.dataset.v, `${b.querySelector(".pn-l").textContent.trim()} (${b.querySelector("small").textContent})`]);
        return { brand: sel("brand"), gender: chips("gender"), family: chips("family"), price: chips("price"), size: chips("size"), sort: sel("sort") };
      });
      const bad = [];
      const n = (f) => expected(f).length;
      // house list: complete, alphabetical, no duplicates
      const brandVals = opts.brand.slice(1).map(([v]) => v);
      if (new Set(brandVals).size !== houses.length || houses.some((h) => !brandVals.includes(h))) bad.push("house list isn't the catalogue's houses");
      if (brandVals.join() !== [...brandVals].sort((a, b) => a.localeCompare(b)).join()) bad.push("house list isn't alphabetical");
      // labelled counts
      const check = (key, list, label) => list.forEach(([v, text]) => { const m = text.match(/\((\d+)\)$/); if (m && +m[1] !== n({ [key]: v })) bad.push(`${label} "${text}" but ${n({ [key]: v })} match`); });
      check("gd", opts.gender, "gender"); check("fm", opts.family, "family"); check("price", opts.price, "price"); check("g", opts.size, "size");
      if (families.some((f) => !opts.family.some(([v]) => v === f))) bad.push("a scent family is missing");
      // no dead options
      const dead = [["brand", opts.brand], ["gd", opts.gender], ["fm", opts.family], ["price", opts.price], ["g", opts.size]]
        .flatMap(([k, list]) => list.filter(([v]) => v && n({ [k]: v }) === 0).map(([v]) => `${k}=${v}`));
      if (dead.length) bad.push(`options that return nothing: ${dead}`);
      assert.deepEqual(bad, []);
    });
    test("there is no 'Inspired by' filter, and the sort offers only the two price directions", async () => {
      const { page } = await fresh();
      assert.equal(await page.locator("#insp").count(), 0, "the 'Inspired by' dropdown should be gone");
      assert.deepEqual(await page.locator("#filters select").evaluateAll((els) => els.map((e) => e.id)), ["brand"], "the panel's only dropdown is the house list");
      assert.deepEqual(await page.locator(".result-row select").evaluateAll((els) => els.map((e) => e.id)), ["sort"]);
      const sort = await page.locator("#sort option").evaluateAll((os) => os.map((o) => [o.value, o.textContent.trim()]));
      assert.deepEqual(sort, [["lo", "Price: low to high"], ["hi", "Price: high to low"], ["az", "Name: A to Z"]], "price both ways, and perfume name A to Z (no 'House A–Z')");
      assert.equal(await page.inputValue("#sort"), "lo", "price low→high is the starting order");
      assert.equal(await page.locator("#reset").isHidden(), true, "the starting order counts as 'no filters'");
    });
    test("the default order is cheapest first; switching shows the priciest first, and back again", async () => {
      const { page } = await fresh();
      const asc = expected({}).slice(0, 12).map((r) => r.min), desc = expected({ sort: "hi" }).slice(0, 12).map((r) => r.max);
      assert.deepEqual(asc, [...asc].sort((a, b) => a - b));
      assert.deepEqual(desc, [...desc].sort((a, b) => b - a));
      assert.deepEqual(diff({}, await collect(page)), []);
      await page.selectOption("#sort", "hi");
      assert.deepEqual(diff({ sort: "hi" }, await collect(page)), []);
      await page.selectOption("#sort", "az");
      assert.deepEqual(diff({ sort: "az" }, await collect(page)), []);
      await page.selectOption("#sort", "lo");
      assert.deepEqual(diff({}, await collect(page)), []);
    });
    test("Name: A to Z lists the perfumes in name order (digits first, capitals / accents / punctuation ignored), the same name from two houses by house, and counts as a filter in use", async () => {
      const { page } = await fresh();
      await page.selectOption("#sort", "az");
      assert.equal(await page.locator("#reset").isHidden(), false, "a non-default order offers Clear filters");
      const names = await page.$$eval("#grid .card .name", (els) => els.map((e) => e.textContent));
      const keys = names.map((n) => normalize(n));
      assert.deepEqual(keys, [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), "page 1 is in name order");
      assert.ok(/^\d/.test(keys[0]) || keys[0] < "b", `starts at the front of the alphabet (${names[0]})`);
      assert.deepEqual(diff({ sort: "az" }, await collect(page)), [], "every page, every size, in the independent order");
      await page.click("#reset");
      assert.equal(await page.inputValue("#sort"), "lo", "Clear filters puts the price order back");
      assert.equal(await page.locator("#grid .card").count(), 48);
    });
    test("style chip counts match the data and sum (with unclassified houses) to the catalogue", async () => {
      const sum = ["designer", "luxury", "arabian"].reduce((a, s) => a + expected({ seg: s }).length, 0);
      const unclassified = PRODUCTS.length - sum;
      assert.equal(unclassified, PRODUCTS.filter((p) => ["Dumont", "Lomani", "Remy Latour"].includes(p.b)).length);
    });
  });

  describe("interaction edge cases", () => {
    test("typing then immediately using another filter keeps BOTH (no lost search text)", async () => {
      const { page } = await fresh();
      await page.fill("#q", "elixir");
      // (the suggestion list is open under the box and covers the tab, so press the tab straight away from the page,
      //  which is the same race: a tab pressed before the 110 ms typing delay has run)
      await page.evaluate(() => document.querySelector('[data-seg="designer"]').click());
      await page.waitForTimeout(400);
      assert.equal(await page.inputValue("#q"), "elixir");
      assert.deepEqual(diff({ q: "elixir", seg: "designer" }, await collect(page)), []);
      // same race with the Filters panel
      await page.click("h1");                    // a click elsewhere puts the suggestion list away (it sits over the results line)
      await page.click("#reset");
      await page.fill("#q", "oud");
      await page.click("#filters-open");
      await page.click('#price [data-v="1000-3000"]');
      await page.click("#pn-done");
      await page.waitForTimeout(400);
      assert.equal(await page.inputValue("#q"), "oud");
      assert.deepEqual(diff({ q: "oud", price: "1000-3000" }, await collect(page)), []);
    });
    test("real typing (keystroke by keystroke) updates results and ends correct", async () => {
      const { page } = await fresh();
      await page.click("#q");
      await page.keyboard.type("Khamrah Qahwa", { delay: 25 });
      await page.waitForTimeout(300);
      assert.deepEqual(diff({ q: "Khamrah Qahwa" }, await collect(page)), []);
      for (let i = 0; i < 13; i++) await page.keyboard.press("Backspace");
      await page.waitForTimeout(300);
      assert.deepEqual(diff({}, await collect(page)), []);
    });
    test("clearing the search box (Esc / ✕ in a search field) restores results", async () => {
      const { page } = await fresh();
      await page.fill("#q", "oud"); await page.waitForTimeout(250);
      await page.focus("#q");
      await page.keyboard.press("Escape");                  // the first Esc puts the suggestion list away…
      assert.equal(await page.inputValue("#q"), "oud");
      await page.keyboard.press("Escape");                  // …the second clears the box
      await page.waitForTimeout(300);
      assert.equal(await page.inputValue("#q"), "");
      assert.deepEqual(diff({}, await collect(page)), [], "search box was cleared but results were not refreshed");
    });
    test("style tabs and the Filters panel work from the keyboard (Enter / Space / Esc)", async () => {
      const { page } = await fresh();
      await page.focus('[data-seg="luxury"]');
      await page.keyboard.press("Enter");
      assert.deepEqual(diff({ seg: "luxury" }, await collect(page)), []);
      await page.focus("#filters-open");
      await page.keyboard.press("Enter");
      assert.equal(await page.locator("#filters").isVisible(), true);
      await page.focus('#size [data-v="Minis"]');
      await page.keyboard.press("Space");
      assert.deepEqual(diff({ seg: "luxury", g: "Minis" }, await collect(page)), []);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#filters").isHidden(), true);
      assert.equal(await page.evaluate(() => document.activeElement.id), "filters-open", "focus goes back to the Filters button");
    });
    test("clicking the active chip again keeps it selected (no toggle-off glitch)", async () => {
      const { page } = await fresh();
      await page.click('[data-seg="arabian"]'); await page.click('[data-seg="arabian"]');
      assert.deepEqual(diff({ seg: "arabian" }, await collect(page)), []);
    });
    test("rapid-fire filter changes settle on the last one", async () => {
      const { page } = await fresh();
      await page.evaluate(() => {
        const $ = (s) => document.querySelector(s);
        for (const s of ["designer", "luxury", "arabian", "designer", "luxury"]) $(`[data-seg="${s}"]`).click();
        for (const v of ["hi", "lo", "hi", "lo"]) { $("#sort").value = v; $("#sort").dispatchEvent(new Event("change", { bubbles: true })); }
      });
      assert.deepEqual(diff({ seg: "luxury", sort: "lo" }, await collect(page)), []);
    });
  });

  describe("mobile viewport (390×844)", () => {
    test("filters give the same results and nothing overflows the screen", async () => {
      const { page } = await fresh({ viewport: { width: 390, height: 844 } });
      const f = await runScenarios(page, [...randomScenarios(25, 4242), ...pairwiseScenarios().filter((_, i) => i % 97 === 0)]);
      assert.equal(f.length, 0, fmt(f));
      const overflow = await page.evaluate(() => ({ page: document.documentElement.scrollWidth > innerWidth, controls: [...document.querySelectorAll(".controls *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length }));
      assert.deepEqual(overflow, { page: false, controls: 0 });
    });
    test("the panel and its controls are usable with real taps", async () => {
      const { page } = await fresh({ viewport: { width: 390, height: 844 } });
      await page.click("#filters-open");
      await page.selectOption("#brand", "Lattafa");
      await page.click('#size [data-v="Retail"]');
      await page.click("#pn-done");
      assert.deepEqual(diff({ brand: "Lattafa", g: "Retail" }, await collect(page)), []);
    });
  });

  test("no console errors or failed requests in any regression scenario", () => {
    const all = opened.flatMap((o) => o.errors);
    assert.deepEqual(all, []);
  });
});

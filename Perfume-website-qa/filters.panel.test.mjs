// The catalogue's search + filter layout: a search box with a Filters button beside it, four style tabs, a results line
// (count · chosen filters · clear · sort) — and the Filters panel itself (a card on computers, a bottom sheet on phones).
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { launch, openCatalogue, collect, diff, applyFilters } from "./lib/browser.mjs";
import { expected } from "./lib/oracle.mjs";
import { PRODUCTS } from "./lib/data.mjs";
import { singleFilterScenarios, pairwiseScenarios, DEAD_END } from "./lib/scenarios.mjs";

describe("catalogue search & filters layout", () => {
  let browser;
  const opened = [];
  const fresh = async (opts) => { const c = await openCatalogue(browser, opts); opened.push(c); return c.page; };
  const PHONE = { viewport: { width: 390, height: 844 }, contextOptions: { hasTouch: true, isMobile: true } };
  before(async () => { browser = await launch(); });
  after(async () => { await browser.close(); });

  const box = (page, sel) => page.locator(sel).boundingBox();
  const activeId = (page) => page.evaluate(() => document.activeElement.id || document.activeElement.tagName);
  const insidePanel = (page) => page.evaluate(() => !!document.activeElement.closest("#filters"));

  describe("the controls on the page", () => {
    test("search box and Filters button share one row; style tabs sit below; the results line is below that", async () => {
      const page = await fresh();
      const [s, f, seg, row] = await Promise.all(["#q", "#filters-open", "#segChips", ".result-row"].map((x) => box(page, x)));
      assert.ok(Math.abs((s.y + s.height / 2) - (f.y + f.height / 2)) < 2, "search and Filters are centred on the same line");
      assert.ok(Math.abs(s.height - f.height) < 3, `same height (${s.height} vs ${f.height})`);
      assert.ok(f.x > s.x + s.width - 1, "the button is to the right of the search box");
      assert.ok(seg.y > s.y + s.height && row.y > seg.y + seg.height);
    });
    test("the old controls are gone: no row of dropdowns, no size-chip row, no 'Inspired by'", async () => {
      const page = await fresh();
      for (const sel of [".selects", "#pkgChips", "#insp", ".chips-sub"]) assert.equal(await page.locator(sel).count(), 0, sel);
      assert.deepEqual(await page.locator(".controls select:visible").evaluateAll((e) => e.map((x) => x.id)), ["sort"], "only the sort dropdown is visible until the panel opens");
    });
    test("the Filters button announces itself properly", async () => {
      const page = await fresh();
      const b = page.locator("#filters-open");
      assert.equal(await b.getAttribute("aria-haspopup"), "dialog");
      assert.equal(await b.getAttribute("aria-expanded"), "false");
      assert.equal(await page.locator(`#${await b.getAttribute("aria-controls")}`).count(), 1, "aria-controls points at the panel");
      assert.equal(await b.getAttribute("aria-label"), "Filters");
      assert.equal(await page.locator("#filters-badge").isHidden(), true, "no number until something is chosen");
    });
    test("the sort is one small dropdown on the results line with just the two price directions", async () => {
      const page = await fresh();
      assert.equal(await page.locator(".result-row #sort").count(), 1);
      assert.equal(await page.locator(".sort").innerText().then((t) => t.split("\n")[0].trim()), "Sort");
      const r = await box(page, ".sort"), seg = await box(page, ".result-row");
      assert.ok(r.x + r.width > seg.x + seg.width - 4, "pushed to the right-hand end");
    });
    test("computers: the style tabs have full names; phones get the short ones", async () => {
      const desk = await fresh(), phone = await fresh(PHONE);
      const names = (p) => p.locator("#segChips button").evaluateAll((bs) => bs.map((b) => b.innerText.trim()));
      assert.deepEqual(await names(desk), ["All", "Designer", "Luxury & niche", "Middle Eastern"]);
      assert.deepEqual(await names(phone), ["All", "Designer", "Luxury", "Middle East"]);
      assert.deepEqual(await phone.locator("#segChips button").evaluateAll((bs) => bs.map((b) => b.dataset.label)), ["All", "Designer", "Luxury & niche", "Middle Eastern"], "the full names stay on the buttons");
    });
    test("the search hint is shorter on a phone, so it isn't cut off", async () => {
      const desk = await fresh(), phone = await fresh(PHONE);
      assert.equal(await desk.getAttribute("#q", "placeholder"), "Search perfume or brand name…");
      assert.equal(await phone.getAttribute("#q", "placeholder"), "Perfume or brand…");
      const fits = await phone.evaluate(() => { const i = document.querySelector("#q"), c = document.createElement("canvas").getContext("2d"); c.font = getComputedStyle(i).font; const cs = getComputedStyle(i), edge = ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"].reduce((t, k) => t + parseFloat(cs[k]), 0); return c.measureText(i.placeholder).width <= i.getBoundingClientRect().width - edge; });  // room for text = box width minus padding and border (clientWidth is not used: browsers differ on whether it includes the padding)
      assert.equal(fits, true, "the whole hint fits inside the box");
    });
    test("the small × in the search box appears only when there is text, and clears it", async () => {
      const page = await fresh();
      assert.equal(await page.locator("#q-clear").isHidden(), true);
      await page.fill("#q", "oud"); await page.waitForTimeout(250);
      assert.equal(await page.locator("#q-clear").isVisible(), true);
      assert.deepEqual(diff({ q: "oud" }, await collect(page)), []);
      await page.click("#q-clear");
      assert.equal(await page.inputValue("#q"), "");
      assert.equal(await page.locator("#q-clear").isHidden(), true);
      assert.equal(await activeId(page), "q", "typing can carry on straight away");
      assert.deepEqual(diff({}, await collect(page)), []);
    });
    test("the controls take far less room than before: results start high on a phone", async () => {
      const page = await fresh(PHONE);
      const c = await box(page, ".controls"), g = await box(page, "#grid");
      assert.ok(g.y - c.y < 300, `controls are ${Math.round(g.y - c.y)}px tall (they used to be about 470px; the quiz button row is included)`);   // (where the results start on the whole screen is checked in ux.test.mjs)
    });
  });

  describe("opening and closing the panel", () => {
    test("it holds House, For, Scent, Price and Size, in that order, and starts closed", async () => {
      const page = await fresh();
      assert.equal(await page.locator("#filters").isHidden(), true);
      await page.click("#filters-open");
      assert.equal(await page.locator("#filters").isVisible(), true);
      assert.deepEqual(await page.locator("#filters legend").allTextContents(), ["House", "For", "Scent", "Price", "Size"]);
      assert.equal(await page.locator("#filters-open").getAttribute("aria-expanded"), "true");
      assert.equal(await page.getAttribute("#filters", "role"), "dialog");
      assert.equal(await page.getAttribute("#filters", "aria-modal"), "true");
    });
    test("focus moves into the panel when it opens", async () => {
      const page = await fresh();
      await page.click("#filters-open");
      assert.equal(await insidePanel(page), true);
    });
    for (const [how, close] of [
      ["the × button", (p) => p.click("#filters-x")],
      ["the 'Show … fragrances' button", (p) => p.click("#pn-done")],
      ["the Esc key", (p) => p.keyboard.press("Escape")],
      ["a tap outside the panel", (p) => p.mouse.click(40, 700)],
    ]) {
      test(`closes with ${how}, and focus goes back to the Filters button`, async () => {
        const page = await fresh();
        await page.click("#filters-open");
        await close(page);
        assert.equal(await page.locator("#filters").isHidden(), true);
        assert.equal(await page.locator("#filters-open").getAttribute("aria-expanded"), "false");
        assert.equal(await activeId(page), "filters-open");
      });
    }
    test("a tap outside doesn't also press whatever was underneath", async () => {
      const page = await fresh();
      await page.locator("#grid .card .add").first().scrollIntoViewIfNeeded();
      await page.evaluate(() => document.querySelector("#filters-open").click());
      const before = await page.evaluate(() => document.querySelectorAll("#cart-count:not([hidden])").length);
      const add = await page.locator("#grid .card .add").first().boundingBox();
      await page.mouse.click(add.x + add.width / 2, add.y + add.height / 2);   // only closes the panel
      assert.equal(await page.locator("#filters").isHidden(), true);
      assert.equal(await page.evaluate(() => document.querySelectorAll("#cart-count:not([hidden])").length), before, "nothing was added to the cart");
    });
    test("Tab stays inside the open panel, forwards and backwards", async () => {
      const page = await fresh();
      await page.click("#filters-open");
      for (let i = 0; i < 45; i++) { await page.keyboard.press("Tab"); assert.equal(await insidePanel(page), true, `Tab ${i + 1} left the panel`); }
      for (let i = 0; i < 45; i++) { await page.keyboard.press("Shift+Tab"); assert.equal(await insidePanel(page), true, `Shift+Tab ${i + 1} left the panel`); }
    });
    test("choosing things doesn't close it, so several filters can be set in one visit", async () => {
      const page = await fresh();
      await page.click("#filters-open");
      await page.selectOption("#brand", "Lattafa");
      await page.click('#gender [data-v="Men"]');
      await page.click('#price [data-v="1000-3000"]');
      assert.equal(await page.locator("#filters").isVisible(), true);
      assert.deepEqual(diff({ brand: "Lattafa", gd: "Men", price: "1000-3000" }, await collect(page)), []);
    });
    test("on a computer the panel is fully on screen — also on a short laptop screen — and the Show button is reachable", async () => {
      for (const [w, h] of [[1280, 720], [1366, 768], [1440, 900], [1920, 1080]]) {
        const page = await fresh({ viewport: { width: w, height: h } });
        await page.click("#filters-open");
        const r = await box(page, "#filters"), done = await box(page, "#pn-done"), hdr = await box(page, ".site-header");
        assert.ok(r.x >= 0 && r.x + r.width <= w && r.y >= hdr.y + hdr.height - 1 && r.y + r.height <= h, `${w}×${h}: panel at ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}×${Math.round(r.height)}`);
        assert.ok(done.y >= 0 && done.y + done.height <= h, `${w}×${h}: the Show button is on screen`);
        assert.ok(await page.locator(".sheet-body").evaluate((b) => b.clientHeight) >= 200, `${w}×${h}: room for the choices`);
      }
    });
    test("from further down the page the panel still opens in view", async () => {
      const page = await fresh({ viewport: { width: 1366, height: 768 } });
      await page.evaluate(() => window.scrollTo(0, 1500));
      await page.evaluate(() => document.querySelector("#filters-open").click());
      const r = await box(page, "#filters");
      assert.ok(r.y >= 60 && r.y + r.height <= 768, `panel at ${Math.round(r.y)}–${Math.round(r.y + r.height)}`);
    });
    test("resizing across the phone breakpoint closes it cleanly rather than leaving it half-placed", async () => {
      const page = await fresh({ viewport: { width: 1280, height: 800 } });
      await page.click("#filters-open");
      await page.setViewportSize({ width: 390, height: 800 });
      await page.waitForTimeout(150);
      assert.equal(await page.locator("#filters").isHidden(), true);
      assert.equal(await page.evaluate(() => document.body.classList.contains("locked")), false, "the page isn't left locked");
    });
  });

  describe("the number on the button and the tags", () => {
    test("each filter chosen in the panel adds one tag and one to the number, and says what it is", async () => {
      const page = await fresh();
      await page.click("#filters-open");
      await page.selectOption("#brand", "Lattafa");
      assert.equal(await page.locator("#filters-badge").textContent(), "1");
      await page.click('#gender [data-v="Men"]');
      await page.click('#price [data-v="1000-3000"]');
      assert.equal(await page.locator("#filters-badge").textContent(), "3");
      assert.equal(await page.locator("#filters-open").getAttribute("aria-label"), "Filters, 3 applied");
      await page.click("#pn-done");
      assert.deepEqual(await page.locator("#ftags .ftag").evaluateAll((t) => t.map((x) => x.firstChild.textContent.trim())), ["House: Lattafa", "For: Men", "Price: ₹1,000 – ₹3,000"]);
      assert.equal(await page.textContent("#count"), `${expected({ brand: "Lattafa", gd: "Men", price: "1000-3000" }).length} of 627`);
    });
    test("style tabs and search aren't counted: they are visible where they are", async () => {
      const page = await fresh();
      await page.click('[data-seg="luxury"]'); await page.fill("#q", "oud"); await page.waitForTimeout(250);
      assert.equal(await page.locator("#filters-badge").isHidden(), true);
      assert.equal(await page.locator("#ftags .ftag").count(), 0);
    });
    test("× on a tag removes just that filter, and the results, number and panel follow", async () => {
      const page = await fresh();
      await applyFilters(page, { brand: "Lattafa", gd: "Men", fm: "Amber & Spicy", g: "Retail" });
      assert.equal(await page.locator("#ftags .ftag").count(), 4);
      await page.click('#ftags [data-clear="gd"]');
      assert.deepEqual(diff({ brand: "Lattafa", fm: "Amber & Spicy", g: "Retail" }, await collect(page)), []);
      assert.equal(await page.locator("#filters-badge").textContent(), "3");
      await page.click('#ftags [data-clear="brand"]');
      await page.click('#ftags [data-clear="g"]');
      assert.deepEqual(diff({ fm: "Amber & Spicy" }, await collect(page)), []);
      assert.equal(await page.locator('#family [aria-pressed="true"] .pn-l').textContent(), "Amber & Spicy");
      await page.click('#ftags [data-clear="fm"]');
      assert.equal(await page.locator("#filters-badge").isHidden(), true);
      assert.deepEqual(diff({}, await collect(page)), []);
    });
    test("each tag's × is named for what it removes", async () => {
      const page = await fresh();
      await applyFilters(page, { gd: "Women", price: "3000-6000" });
      assert.deepEqual(await page.locator("#ftags button").evaluateAll((b) => b.map((x) => x.getAttribute("aria-label"))), ["Remove For: Women", "Remove Price: ₹3,000 – ₹6,000"]);
    });
    test("'not yet tagged' reads sensibly on the tag (shown here with one perfume's tags removed from a copy of the data, since every real perfume is tagged)", async () => {
      const page = await fresh({ productsData: (t) => t.replace('"gd":"Men"', '"gd":""').replace('"fm":"Floral"', '"fm":""') });
      await applyFilters(page, { gd: "__none__" });
      assert.deepEqual(await page.locator("#ftags .ftag").evaluateAll((t) => t.map((x) => x.firstChild.textContent.trim())), ["For: Not yet tagged"]);
      await applyFilters(page, { fm: "__none__" });
      assert.deepEqual(await page.locator("#ftags .ftag").evaluateAll((t) => t.map((x) => x.firstChild.textContent.trim())), ["Scent: Not yet tagged"]);
    });
    test("'Not yet tagged' is offered only while some perfume lacks that tag: gone from For now that every perfume has a gender tag, still on Scent, and back on For if a perfume ever loses its tag", async () => {
      const options = (page, id) => page.locator(`#${id} [data-v]`).evaluateAll((els) => els.map((e) => e.dataset.v));
      const page = await fresh();
      const untaggedGender = PRODUCTS.some((p) => !p.gd), untaggedScent = PRODUCTS.some((p) => !p.fm);
      assert.deepEqual(await options(page, "gender"), ["Men", "Women", "Unisex", ...(untaggedGender ? ["__none__"] : [])]);
      assert.equal((await options(page, "family")).includes("__none__"), untaggedScent);
      assert.equal(untaggedGender || untaggedScent, false, "(today every perfume has a gender tag and a scent tag, so neither option may be shown)");
      // one perfume without a gender tag brings the option back, with its count of 1
      const withOne = await fresh({ productsData: (t) => t.replace('"gd":"Men"', '"gd":""') });
      assert.deepEqual(await options(withOne, "gender"), ["Men", "Women", "Unisex", "__none__"]);
      assert.equal(await withOne.locator('#gender [data-v="__none__"] small').textContent(), "1");
      const withOneScent = await fresh({ productsData: (t) => t.replace('"fm":"Floral"', '"fm":""') });
      assert.equal((await options(withOneScent, "family")).at(-1), "__none__", "and the same for the Scent filter");
      assert.equal(await withOneScent.locator('#family [data-v="__none__"] small').textContent(), "1");
    });
    test("the Filters button is highlighted while anything is chosen", async () => {
      const page = await fresh();
      const on = () => page.locator("#filters-open").evaluate((b) => b.classList.contains("on"));
      assert.equal(await on(), false);
      await applyFilters(page, { price: "1000-3000" });
      assert.equal(await on(), true);
    });
  });

  describe("choosing inside the panel", () => {
    test("tap-to-choose buttons: tap to choose, tap again to clear; only one per group", async () => {
      const page = await fresh();
      await page.click("#filters-open");
      const pressed = (g) => page.locator(`${g} [aria-pressed="true"]`).count();
      await page.click('#gender [data-v="Men"]'); assert.equal(await pressed("#gender"), 1);
      await page.click('#gender [data-v="Women"]'); assert.equal(await pressed("#gender"), 1);
      assert.deepEqual(diff({ gd: "Women" }, await collect(page)), []);
      await page.click('#gender [data-v="Women"]'); assert.equal(await pressed("#gender"), 0);
      assert.deepEqual(diff({}, await collect(page)), []);
      await page.click('#size [data-v="Tester"]'); await page.click('#size [data-v="Tester"]');
      assert.deepEqual(diff({}, await collect(page)), [], "size back to 'all sizes'");
    });
    test("options with no results are greyed out and can't be chosen, but the current choice never is", async () => {
      const page = await fresh();
      await applyFilters(page, { brand: "Lattafa", fm: "Fresh & Citrus" });
      await page.click("#filters-open");
      assert.equal(await page.locator('#gender [data-v="Women"]').isDisabled(), true);
      assert.equal(await page.locator('#gender [data-v="Men"]').isDisabled(), false);
      assert.equal(await page.locator('#family [data-v="Fresh & Citrus"]').isDisabled(), false, "the chosen one stays available so it can be cleared");
    });
    test("the 'Show' button says how many you will see", async () => {
      const page = await fresh();
      const label = () => page.locator("#pn-done").textContent();
      assert.equal(await label(), "Show 627 fragrances");
      await applyFilters(page, { brand: "Lattafa", gd: "Men", price: "1000-3000" });
      assert.equal(await label(), `Show ${expected({ brand: "Lattafa", gd: "Men", price: "1000-3000" }).length} fragrances`);
      const one = [...singleFilterScenarios(), ...pairwiseScenarios()].map((sc) => sc.F ?? sc).find((F) => expected(F).length === 1);
      assert.ok(one, "the scenario pool has a one-result case");
      await applyFilters(page, one);
      assert.equal(await label(), "Show 1 fragrance");
      await applyFilters(page, DEAD_END);
      assert.equal(await label(), "Show results", "nothing matches — it doesn't say 'Show 0'");
    });
    test("'Reset filters' in the panel clears what the panel holds — and leaves style, search and sort alone", async () => {
      const page = await fresh();
      await applyFilters(page, { seg: "arabian", q: "oud", sort: "hi", brand: "Lattafa", gd: "Unisex", price: "1000-3000", g: "Retail" });
      await page.click("#filters-open");
      await page.click("#pn-clear");
      assert.deepEqual(diff({ seg: "arabian", q: "oud", sort: "hi" }, await collect(page)), []);
      assert.equal(await page.locator("#filters").isVisible(), true, "the panel stays open");
      assert.equal(await page.locator("#filters-badge").isHidden(), true);
    });
    test("'Clear filters' on the results line clears everything", async () => {
      const page = await fresh();
      await applyFilters(page, { seg: "luxury", q: "oud", brand: "Lattafa", sort: "hi" });
      await page.click("#reset");
      assert.deepEqual(diff({}, await collect(page)), []);
      assert.equal(await page.locator("#ftags .ftag").count(), 0);
    });
    test("typing then opening the panel keeps the typed words", async () => {
      const page = await fresh();
      await page.fill("#q", "creed");
      await page.click("#filters-open");
      await page.click('#gender [data-v="Men"]');
      await page.click("#pn-done");
      await page.waitForTimeout(300);
      assert.deepEqual(diff({ q: "creed", gd: "Men" }, await collect(page)), []);
    });
    test("the panel always shows the real state: after the quiz's 'see all', a link or Clear, nothing is stale", async () => {
      const page = await fresh({ query: "?style=arabian&q=khamrah" });
      assert.deepEqual(diff({ seg: "arabian", q: "khamrah" }, await collect(page)), []);
      await applyFilters(page, { gd: "Women", g: "Retail" });
      await page.evaluate(() => window.PX.catalogue.search("sauvage"));
      assert.deepEqual(diff({ q: "sauvage" }, await collect(page)), []);
      await page.click("#filters-open");
      assert.equal(await page.locator('#filters [aria-pressed="true"]').count(), 0, "no panel choice survives a fresh search");
    });
  });

  describe("on a phone it is a bottom sheet", () => {
    test("it slides up from the bottom, fills the width, leaves room above, and the page behind is locked", async () => {
      const page = await fresh(PHONE);
      await page.click("#filters-open");
      await page.waitForTimeout(400);
      const r = await box(page, "#filters");
      assert.equal(Math.round(r.x), 0); assert.equal(Math.round(r.width), 390);
      assert.equal(Math.round(r.y + r.height), 844, "its bottom edge is the bottom of the screen");
      assert.ok(r.height <= 844 * 0.86 + 1 && r.height > 400, `${Math.round(r.height)}px tall`);
      assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), "hidden", "the page behind can't scroll");
      const back = await box(page, "#filters-back");
      assert.deepEqual([Math.round(back.width), Math.round(back.height)], [390, 844], "a dimmed backdrop covers the page");
      await page.click("#pn-done");
      assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflow), "hidden", "scrolling is back");
    });
    test("tapping the dimmed area above the sheet closes it", async () => {
      const page = await fresh(PHONE);
      await page.click("#filters-open");
      await page.mouse.click(195, 40);
      assert.equal(await page.locator("#filters").isHidden(), true);
    });
    test("the sheet's choices scroll inside it while its header and the Show button stay put", async () => {
      const page = await fresh(PHONE);
      await page.click("#filters-open");
      await page.waitForTimeout(350);
      const before = await box(page, "#pn-done");
      assert.ok(await page.locator(".sheet-body").evaluate((b) => b.scrollHeight > b.clientHeight), "there is more than fits, so it scrolls");
      await page.locator(".sheet-body").evaluate((b) => { b.scrollTop = b.scrollHeight; });
      const after = await box(page, "#pn-done");
      assert.equal(Math.round(after.y), Math.round(before.y));
      const last = await box(page, '#size [data-v="Sets"]'), foot = await box(page, ".sheet-foot");
      assert.ok(last.y + last.height <= foot.y + 1, "the last choice can be scrolled fully into view above the footer");
    });
    test("every button in the sheet is at least 44px tall, and the house dropdown text is 16px+ (no zoom on iPhone)", async () => {
      const page = await fresh(PHONE);
      await page.click("#filters-open");
      const small = await page.evaluate(() => [...document.querySelectorAll("#filters button, #filters select")].filter((e) => Math.min(e.getBoundingClientRect().height) < 43.5).map((e) => `${e.id || e.className} ${Math.round(e.getBoundingClientRect().height)}px`));
      assert.deepEqual(small, []);
      assert.ok(parseFloat(await page.locator("#brand").evaluate((s) => getComputedStyle(s).fontSize)) >= 16);
    });
    test("nothing spills sideways at 320px, with the panel closed or open and with filters chosen", async () => {
      const page = await fresh({ viewport: { width: 320, height: 568 }, contextOptions: { hasTouch: true, isMobile: true } });
      const spill = () => page.evaluate(() => ({ page: document.documentElement.scrollWidth > innerWidth, els: [...document.querySelectorAll(".controls *, .sheet *")].filter((e) => e.getBoundingClientRect().width && e.getBoundingClientRect().right > innerWidth + 1).map((e) => e.className || e.tagName) }));
      assert.deepEqual(await spill(), { page: false, els: [] });
      await applyFilters(page, { brand: "Ahmed Al Maghribi", gd: "Unisex", price: "1000-3000", g: "Retail", fm: "Oud & Woody" });
      assert.deepEqual(await spill(), { page: false, els: [] });
      await page.click("#filters-open");
      assert.deepEqual(await spill(), { page: false, els: [] });
    });
  });

  describe("both light and dark", () => {
    for (const scheme of ["light", "dark"]) {
      test(`the closed layout and the open panel look right in ${scheme} mode (gold stays gold, chosen things are highlighted)`, async () => {
        const page = await fresh({ contextOptions: { colorScheme: scheme } });
        await applyFilters(page, { gd: "Men", price: "1000-3000" });
        const look = () => page.evaluate(() => {
          const c = (s, p) => getComputedStyle(document.querySelector(s))[p];
          return { seg: c('#segChips [aria-pressed="true"]', "backgroundColor"), ftag: c(".ftag", "borderColor"), on: c('#gender [aria-pressed="true"]', "borderColor"), badge: c("#filters-badge", "backgroundColor") };
        });
        const l = await look();
        assert.equal(l.seg, "rgb(212, 175, 106)", "the chosen style tab is the site's gold");
        assert.equal(l.badge, "rgb(212, 175, 106)");
        assert.equal(l.ftag, l.on, "tags and chosen buttons use the same gold edge");
      });
    }
  });

  test("no console errors or failed requests", () => assert.deepEqual(opened.flatMap((o) => o.errors), []));
});

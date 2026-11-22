// The catalogue search: it looks at the HOUSE and the perfume NAME (not the "inspired by" text or the size), and offers matching
// houses and perfumes while you type — best matches first, following the other filters, usable by mouse, keyboard and touch,
// and readable in both themes.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { PRODUCTS } from "./lib/data.mjs";
import { launch, openCatalogue, collect, diff, applyFilters } from "./lib/browser.mjs";
import { expected, expectedSuggestions, normalize, SUGGEST_MAX } from "./lib/oracle.mjs";
import { mulberry32 } from "./lib/scenarios.mjs";
import { auditContrast, setTheme } from "./lib/theme.mjs";

describe("search by house or perfume name, with suggestions while typing", () => {
  let browser;
  const opened = [];
  const fresh = async (opts) => { const c = await openCatalogue(browser, opts); opened.push(c); return c.page; };
  const PHONE = (width = 390) => ({ viewport: { width, height: 844 }, contextOptions: { hasTouch: true, isMobile: true } });
  before(async () => { browser = await launch(); });
  after(async () => { await browser.close(); });

  // what the page is offering right now
  const shown = (page) => page.locator("#suggest-list li").evaluateAll((els) => els.map((e) => ({ kind: e.dataset.kind, name: e.querySelector(".sg-name").textContent, right: e.querySelector(".sg-house").textContent, selected: e.getAttribute("aria-selected") === "true", id: e.id })));
  const isOpen = (page) => page.locator("#suggest").isVisible();
  const active = (page) => page.getAttribute("#q", "aria-activedescendant");
  // a house row reads "Lattafa  House · 33 fragrances"; a perfume row reads "Khamrah  Lattafa"
  const want = (text, filters) => expectedSuggestions(text, filters).map((s) => (s.kind === "house" ? { kind: "house", name: s.text, right: `House · ${s.n} fragrance${s.n === 1 ? "" : "s"}` } : { kind: "perfume", name: s.name, right: s.house }));
  const got = async (page) => (await shown(page)).map(({ kind, name, right }) => ({ kind, name, right }));
  const pickText = (it) => (it.kind === "house" ? it.name : `${it.right} ${it.name}`);   // choosing a house searches for the house; a perfume, for its house + name

  describe("what is offered", () => {
    test("nothing for an empty or blank box; suggestions from the very first letter", async () => {
      const page = await fresh();
      assert.equal(await isOpen(page), false);
      await page.fill("#q", "   ");
      assert.equal(await isOpen(page), false);
      await page.fill("#q", "k");
      assert.equal(await isOpen(page), true);
      assert.deepEqual(await got(page), want("k"));
      await page.fill("#q", "");
      assert.equal(await isOpen(page), false);
    });

    test("matches the independent statement of the rules, in order, for typed text of every kind", async () => {
      const page = await fresh();
      const typed = ["kha", "oud", "oud wood", "wood oud", "d'hermes", "d’hermes", "dhermes", "l'homme", "lhomme", "ÉLIXIR", "elixir", "eau", "tonka", "royal blend", "9", "twilly eau", "edp", "  OUD  ", "a", "e",
        "lat", "lattafa", "tom", "tom ford", "ford tom", "tom ford oud", "dior", "swiss", "paco", "chanel bleu", "maison", "hermes", "  LATTAFA  "];
      for (const t of typed) {
        await page.fill("#q", t);
        assert.deepEqual(await got(page), want(t), `typed ${JSON.stringify(t)}`);
      }
    });

    test("60 seeded random starts of real perfume names are offered correctly, and the perfume itself is among them", async () => {
      const page = await fresh();
      const rnd = mulberry32(2024);
      for (let i = 0; i < 60; i++) {
        const p = PRODUCTS[Math.floor(rnd() * PRODUCTS.length)];
        const src = rnd() < 0.4 ? p.b : p.n;                           // sometimes start typing the house, sometimes the perfume
        const n = 2 + Math.floor(rnd() * Math.max(1, src.length - 2));
        const t = src.slice(0, n);
        await page.fill("#q", t);
        const exp = want(t);
        assert.deepEqual(await got(page), exp, `typed ${JSON.stringify(t)}`);
        if (normalize(t) && expectedSuggestions(t).some((s) => s.slug === p.s)) assert.ok((await got(page)).some((s) => s.kind === "perfume" && s.name === p.n && s.right === p.b));
      }
    });

    test("at most eight, best matches first: names starting with what you typed come before names merely containing it", async () => {
      const page = await fresh();
      await page.fill("#q", "oud");
      const list = (await got(page)).filter((s) => s.kind === "perfume");
      assert.equal(list.length, SUGGEST_MAX);
      const starts = list.map((s) => normalize(s.name).startsWith("oud"));
      assert.deepEqual(starts, [...starts].sort((a, b) => b - a), "names that start with 'oud' are all at the top");
      assert.ok(starts[0], "the first suggestion starts with what was typed");
    });

    test("the same perfume name from two houses is listed twice, each with its house", async () => {
      const page = await fresh();
      const dup = PRODUCTS.find((p, i) => PRODUCTS.some((q, j) => j !== i && q.n === p.n));
      assert.ok(dup, "test assumption: some name exists under two houses");
      await page.fill("#q", dup.n);
      const list = (await got(page)).filter((s) => s.kind === "perfume" && s.name === dup.n);
      assert.ok(list.length >= 2);
      assert.equal(new Set(list.map((s) => s.right)).size, list.length);
    });

    test("a house name offers that house first (with how many fragrances it has), then its perfumes", async () => {
      const page = await fresh();
      await page.fill("#q", "lattafa");
      const list = await got(page);
      assert.deepEqual(list[0], { kind: "house", name: "Lattafa", right: `House · ${PRODUCTS.filter((p) => p.b === "Lattafa").length} fragrances` });
      assert.ok(list.slice(1).length > 0 && list.slice(1).every((s) => s.kind === "perfume" && s.right === "Lattafa"));
      await page.fill("#q", "dior");
      const dior = (await got(page)).filter((s) => s.kind === "house").map((s) => s.name).sort();
      assert.deepEqual(dior, ["Christian Dior", "Dior"], "both houses with Dior in the name");
    });

    test("house + perfume together narrow the offer: 'tom ford oud' offers only Tom Ford's oud perfumes (no house row)", async () => {
      const page = await fresh();
      await page.fill("#q", "tom ford oud");
      const list = await got(page);
      assert.ok(list.length > 0 && list.every((s) => s.kind === "perfume" && s.right === "Tom Ford" && /oud/i.test(s.name)), JSON.stringify(list));
    });

    test("the 'inspired by' text and sizes are not searched: they offer nothing, and a short note says so", async () => {
      const page = await fresh();
      for (const t of ["lost cherry", "tester", "100ml", "zzzqq"]) {
        await page.fill("#q", t);
        assert.deepEqual(await got(page), [], t);
        assert.equal(await page.getAttribute("#q", "aria-expanded"), "false", t);
        assert.equal(await page.locator("#suggest-none").isVisible(), true, `${t}: a short note says why`);
      }
      assert.match(await page.textContent("#suggest-none"), /Nothing matches “zzzqq”\. Try a perfume name or a house name\./);
    });

    test("it follows the other filters: a name they would hide is not offered", async () => {
      const page = await fresh();
      for (const F of [{ brand: "Lattafa" }, { seg: "luxury" }, { price: "0-1000" }, { g: "Tester" }, { gd: "Women", brand: "Chanel" }]) {
        await applyFilters(page, F);
        await page.fill("#q", "o");
        assert.deepEqual(await got(page), want("o", F), JSON.stringify(F));
      }
      await applyFilters(page, { brand: "Lattafa" });
      await page.fill("#q", "kh");
      const lattafa = await got(page);
      assert.ok(lattafa.length > 0 && lattafa.every((s) => s.kind === "perfume" && s.right === "Lattafa"), "only Lattafa names (Khamrah…) are offered, and no other house");
      await applyFilters(page, {});
      await page.fill("#q", "kh");
      assert.ok((await got(page)).some((s) => s.kind === "perfume" && s.right !== "Lattafa"), "with no house chosen, other houses' names are offered too");
    });

    test("the typed letters are picked out in each name, whatever the case, accents or apostrophes", async () => {
      const page = await fresh();
      await page.fill("#q", "kha");
      assert.equal((await page.locator("#suggest-list li").first().locator("mark").first().textContent()).toLowerCase(), "kha");
      await page.fill("#q", "ÓMBRE");
      assert.equal((await page.locator("#suggest-list li mark").first().textContent()).toLowerCase(), "ombre");
      await page.fill("#q", "dhermes");
      const marked = await page.locator("#suggest-list li mark").first().textContent();
      assert.match(marked, /^d.?hermes$/i, `the apostrophe is inside the highlight: ${marked}`);
    });

    test("typed text is never turned into HTML", async () => {
      const page = await fresh();
      await page.fill("#q", '<img src=x onerror="window.__hacked=1">');
      assert.equal(await page.evaluate(() => window.__hacked), undefined);
      assert.equal(await page.locator("#suggest img, #suggest-none img").count(), 0);
    });
  });

  describe("choosing a suggestion", () => {
    test("clicking a perfume searches for its house + name, puts that in the box, and puts the list away", async () => {
      const page = await fresh();
      await page.fill("#q", "khamrah");
      const list = await shown(page);
      const i = list.findIndex((x) => x.kind === "perfume");
      const pick = list[i];
      await page.locator("#suggest-list li").nth(i).click();
      assert.equal(await page.inputValue("#q"), pickText(pick));
      assert.equal(await isOpen(page), false);
      await page.waitForTimeout(250);
      assert.deepEqual(diff({ q: pickText(pick) }, await collect(page)), []);
      assert.equal(await page.evaluate(() => document.activeElement.id), "q", "the cursor stays in the box on a computer");
      const cards = await page.locator("#grid .card .name").allTextContents();
      assert.ok(cards.some((c) => c.trim() === pick.name));
    });

    test("clicking a house searches for that house: all its perfumes", async () => {
      const page = await fresh();
      await page.fill("#q", "lattaf");
      assert.equal((await shown(page))[0].kind, "house");
      await page.locator("#suggest-list li").first().click();
      assert.equal(await page.inputValue("#q"), "Lattafa");
      await page.waitForTimeout(250);
      assert.deepEqual(diff({ q: "Lattafa" }, await collect(page)), []);
      assert.equal(await page.textContent("#count"), `${expected({ q: "Lattafa" }).length} of 627`, "Lattafa's own count");
    });

    test("every suggestion for a sample of typed text really leads to results (a perfume's results include it; a house's are exactly that house's count)", async () => {
      const page = await fresh();
      for (const t of ["kha", "eros", "bleu", "9", "lat", "tom ford"]) {
        const exp = expectedSuggestions(t);
        for (let i = 0; i < exp.length; i++) {
          await page.fill("#q", t);
          const s = (await shown(page))[i];
          await page.locator("#suggest-list li").nth(i).click();
          await page.waitForTimeout(200);
          assert.deepEqual(diff({ q: pickText(s) }, await collect(page)), [], `${t} → ${s.name}`);
          if (exp[i].kind === "perfume") {
            const slugs = (await collect(page)).pages.flatMap((p) => p.cards).map((c) => c.slug);
            assert.ok(slugs.includes(exp[i].slug), `${t} → ${s.name} (${s.right}) is missing from the results`);
          }
        }
      }
    });

    test("typing more after choosing opens the list again", async () => {
      const page = await fresh();
      await page.fill("#q", "kha");
      await page.locator("#suggest-list li").first().click();
      assert.equal(await isOpen(page), false);
      await page.keyboard.type(" q");
      assert.equal(await isOpen(page), true);
    });
  });

  describe("keyboard", () => {
    test("arrows move through the list (and wrap), Enter chooses, aria-activedescendant follows", async () => {
      const page = await fresh();
      await page.fill("#q", "kha");
      const n = (await shown(page)).length;
      assert.equal(await active(page), null);
      await page.keyboard.press("ArrowDown");
      assert.equal((await shown(page)).findIndex((s) => s.selected), 0);
      assert.equal(await active(page), "sg-0");
      await page.keyboard.press("ArrowUp");
      assert.equal((await shown(page)).findIndex((s) => s.selected), n - 1, "up from the first wraps to the last");
      await page.keyboard.press("ArrowDown");
      assert.equal((await shown(page)).findIndex((s) => s.selected), 0, "down from the last wraps to the first");
      await page.keyboard.press("ArrowDown");
      const second = pickText((await shown(page))[1]);
      await page.keyboard.press("Enter");
      assert.equal(await page.inputValue("#q"), second);
      assert.equal(await isOpen(page), false);
      await page.waitForTimeout(250);
      assert.deepEqual(diff({ q: second }, await collect(page)), []);
    });

    test("ArrowUp from nothing goes to the last suggestion; ArrowDown reopens a list that was put away", async () => {
      const page = await fresh();
      await page.fill("#q", "kha");
      const n = (await shown(page)).length;
      await page.keyboard.press("ArrowUp");
      assert.equal((await shown(page)).findIndex((s) => s.selected), n - 1);
      await page.keyboard.press("Escape");
      assert.equal(await isOpen(page), false);
      await page.keyboard.press("ArrowDown");
      assert.equal(await isOpen(page), true);
    });

    test("Esc puts the list away first (the typed text stays); a second Esc clears the box", async () => {
      const page = await fresh();
      await page.fill("#q", "kha");
      await page.keyboard.press("Escape");
      assert.equal(await isOpen(page), false);
      assert.equal(await page.inputValue("#q"), "kha");
      assert.equal(await page.getAttribute("#q", "aria-expanded"), "false");
      await page.keyboard.press("Escape");
      assert.equal(await page.inputValue("#q"), "");
      await page.waitForTimeout(250);
      assert.deepEqual(diff({}, await collect(page)), []);
    });

    test("Enter with nothing highlighted keeps what was typed and just closes the list", async () => {
      const page = await fresh();
      await page.fill("#q", "kha");
      await page.keyboard.press("Enter");
      assert.equal(await isOpen(page), false);
      assert.equal(await page.inputValue("#q"), "kha");
      await page.waitForTimeout(250);
      assert.deepEqual(diff({ q: "kha" }, await collect(page)), []);
    });

    test("Tab leaves the box and closes the list", async () => {
      const page = await fresh();
      await page.fill("#q", "kha");
      await page.keyboard.press("Tab");
      assert.equal(await isOpen(page), false);
    });

    test("typing, an instant arrow and Enter can't leave stale results (real keystrokes)", async () => {
      const page = await fresh();
      await page.click("#q");
      await page.keyboard.type("khamrah q", { delay: 15 });
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      const q = await page.inputValue("#q");
      assert.deepEqual(diff({ q }, await collect(page)), []);
    });

    test("keystroke by keystroke, the list always matches the typed text; backspacing to empty hides it", async () => {
      const page = await fresh();
      await page.click("#q");
      const text = "Twilly";
      for (let i = 1; i <= text.length; i++) {
        await page.keyboard.type(text[i - 1], { delay: 10 });
        assert.deepEqual(await got(page), want(text.slice(0, i)), text.slice(0, i));
      }
      for (let i = text.length - 1; i >= 0; i--) {
        await page.keyboard.press("Backspace");
        if (i === 0) assert.equal(await isOpen(page), false);
        else assert.deepEqual(await got(page), want(text.slice(0, i)), text.slice(0, i));
      }
    });
  });

  describe("mouse and touch: when the list goes away", () => {
    test("clicking elsewhere on the page closes it; the text stays", async () => {
      const page = await fresh();
      await page.fill("#q", "kha");
      await page.click("h1");
      assert.equal(await isOpen(page), false);
      assert.equal(await page.inputValue("#q"), "kha");
    });

    test("opening the Filters panel closes it", async () => {
      const page = await fresh();
      await page.fill("#q", "kha");
      await page.click("#filters-open");
      assert.equal(await isOpen(page), false);
      await page.click("#filters-x");
    });

    test("the × clears the box and closes the list; typing carries on", async () => {
      const page = await fresh();
      await page.fill("#q", "kha");
      await page.click("#q-clear");
      assert.equal(await isOpen(page), false);
      assert.equal(await page.inputValue("#q"), "");
      assert.equal(await page.evaluate(() => document.activeElement.id), "q");
    });

    test("a page opened with ?q= shows its results but not the suggestion list", async () => {
      const page = await fresh({ query: "?q=khamrah" });
      assert.equal(await isOpen(page), false);
      assert.deepEqual(diff({ q: "khamrah" }, await collect(page)), []);
    });

    test("on a phone, tapping a suggestion searches for it and puts the keyboard away", async () => {
      const page = await fresh(PHONE());
      await page.locator("#q").tap();
      await page.fill("#q", "kha");
      assert.equal(await isOpen(page), true);
      const pick = (await shown(page))[0];
      await page.locator("#suggest-list li").first().tap();
      assert.equal(await isOpen(page), false);
      assert.equal(await page.inputValue("#q"), pickText(pick));
      assert.notEqual(await page.evaluate(() => document.activeElement.id), "q", "the box is no longer focused, so the keyboard is gone");
      await page.waitForTimeout(250);
      assert.deepEqual(diff({ q: pickText(pick) }, await collect(page)), []);
    });
  });

  describe("how it looks", () => {
    for (const [label, opts] of [["a laptop", {}], ["a phone (390px)", PHONE(390)], ["a small phone (320px)", PHONE(320)]]) {
      test(`on ${label}: sits right under the box, on top of everything, inside the screen, no sideways scroll`, async () => {
        const page = await fresh(opts);
        await page.fill("#q", "o");
        const m = await page.evaluate(() => {
          const r = (s) => document.querySelector(s).getBoundingClientRect();
          const box = r(".search"), list = r("#suggest"), rows = [...document.querySelectorAll("#suggest-list li")].map((e) => e.getBoundingClientRect());
          const cx = list.left + list.width / 2, cy = list.top + Math.min(list.height, 60) / 2;
          const top = document.elementFromPoint(cx, cy);
          return { box: { l: box.left, r: box.right, b: box.bottom }, list: { l: list.left, r: list.right, t: list.top, h: list.height }, covered: !top.closest("#suggest"), minRow: Math.min(...rows.map((x) => x.height)), vw: innerWidth, vh: innerHeight, doc: document.documentElement.scrollWidth };
        });
        assert.ok(Math.abs(m.list.l - m.box.l) < 1.5 && Math.abs(m.list.r - m.box.r) < 1.5, "as wide as the search box");
        assert.ok(m.list.t >= m.box.b - 1 && m.list.t - m.box.b < 14, "directly under the box");
        assert.equal(m.covered, false, "nothing sits on top of the list");
        assert.ok(m.minRow >= 44, `each suggestion is at least 44px tall (got ${m.minRow})`);
        assert.ok(m.list.r <= m.vw, "doesn't run off the right edge");
        assert.ok(m.list.h <= m.vh * 0.56, "never taller than about half the screen");
        assert.ok(m.doc <= m.vw, "no sideways scrolling");
      });
    }

    test("long names and houses don't spill out of their rows", async () => {
      const page = await fresh(PHONE(320));
      const longest = PRODUCTS.reduce((a, b) => (b.n.length > a.n.length ? b : a));
      await page.fill("#q", longest.n.split(" ")[0]);
      const spill = await page.evaluate(() => [...document.querySelectorAll("#suggest-list li")].filter((li) => [...li.children].some((c) => c.scrollWidth > c.clientWidth + 1 || c.getBoundingClientRect().right > li.getBoundingClientRect().right + 1)).length);
      assert.equal(spill, 0);
    });

    for (const theme of ["dark", "light"]) {
      test(`${theme} mode: every word in the list (and the "nothing found" note) is readable`, async () => {
        const page = await fresh();
        await setTheme(page, theme);
        await page.waitForTimeout(500);                      // let the colour transition finish before measuring
        await page.fill("#q", "kha");
        await page.keyboard.press("ArrowDown");
        assert.deepEqual(await auditContrast(page), [], "with suggestions open");
        await page.fill("#q", "zzzqq");
        assert.deepEqual(await auditContrast(page), [], "with the 'nothing matches' note open");
      });
    }
  });

  describe("accessibility", () => {
    test("combobox + listbox wiring and a spoken summary", async () => {
      const page = await fresh();
      assert.equal(await page.getAttribute("#q", "role"), "combobox");
      assert.equal(await page.getAttribute("#q", "aria-autocomplete"), "list");
      assert.equal(await page.getAttribute("#q", "aria-expanded"), "false");
      assert.equal(await page.getAttribute("#q", "aria-controls"), "suggest-list");
      assert.equal(await page.getAttribute("#suggest-list", "role"), "listbox");
      await page.fill("#q", "kha");
      assert.equal(await page.getAttribute("#q", "aria-expanded"), "true");
      const roles = await page.locator("#suggest-list li").evaluateAll((els) => els.map((e) => e.getAttribute("role")));
      assert.ok(roles.length > 0 && roles.every((r) => r === "option"));
      assert.match(await page.textContent("#suggest-status"), /^\d+ suggestions?\./);
      assert.equal(await page.getAttribute("#suggest-status", "aria-live"), "polite");
      await page.fill("#q", "zzzqq");
      assert.match(await page.textContent("#suggest-status"), /No perfumes or houses match/);
    });

    test("the box says what it searches", async () => {
      const page = await fresh();
      assert.match(await page.textContent(".search .sr-only"), /perfume or brand name/i);
      assert.match(await page.getAttribute("#q", "placeholder"), /perfume or brand/i);
      assert.match(await page.textContent(".section-sub"), /Search by perfume or brand name/);
    });
  });

  test("no console errors or failed requests", () => assert.deepEqual(opened.flatMap((o) => o.errors), []));
});

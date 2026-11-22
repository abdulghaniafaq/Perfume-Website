// Live filter counts: each option in the Filters panel (the house list and the For / Scent / Price / Size buttons)
// shows how many results it would give with the OTHER filters as they are now; options that would give none are
// greyed out; and "no results" offers one-click fixes.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { launch, openCatalogue, applyFilters, change, collect, diff, fmt } from "./lib/browser.mjs";
import { expected, DEFAULT_FILTERS } from "./lib/oracle.mjs";
import { singleFilterScenarios, pairwiseScenarios, randomScenarios, POOL, mulberry32, DEAD_END } from "./lib/scenarios.mjs";

const SELECT_KEY = { brand: "brand", gender: "gd", family: "fm", price: "price", size: "g" };
const FILTER_ORDER = ["q", "seg", "g", "brand", "gd", "fm", "price"];   // the order the page lists them in
const isOn = (F, k) => (k === "q" ? (F.q ?? "").trim() !== "" : (F[k] ?? DEFAULT_FILTERS[k]) !== DEFAULT_FILTERS[k]);

// Every option in the panel as { value, "Label (n)", greyed-out } — the house list is a dropdown, the rest are buttons.
const readFacets = (page) =>
  page.evaluate(() => {
    const out = { brand: [...document.querySelectorAll("#brand option")].map((o) => ({ v: o.value, t: o.textContent.trim(), d: o.disabled })) };
    for (const id of ["gender", "family", "price", "size"]) {
      out[id] = [...document.querySelectorAll(`#${id} .pn-chip`)].map((b) => ({ v: b.dataset.v, t: `${b.querySelector(".pn-l").textContent.trim()} (${b.querySelector("small").textContent.trim()})`, d: b.disabled }));
    }
    return out;
  });

/** Every option's number and greyed-out state, checked against the independent oracle. */
function facetProblems(F, facets) {
  const bad = [];
  for (const [id, opts] of Object.entries(facets)) {
    const key = SELECT_KEY[id], current = F[key] ?? "";
    for (const o of opts) {
      if (o.v === "") { if (/\(\d+\)$/.test(o.t) || o.d) bad.push(`${id}: the default option "${o.t}" should be plain and always available`); continue; }
      const n = expected({ ...F, [key]: o.v }).length;
      const m = o.t.match(/\((\d+)\)$/);
      if (!m || +m[1] !== n) bad.push(`${id} "${o.t}" should read (${n})`);
      const wantDisabled = n === 0 && o.v !== current;
      if (o.d !== wantDisabled) bad.push(`${id} "${o.t}": greyed-out=${o.d}, expected ${wantDisabled}`);
    }
  }
  return bad;
}

const fixesOnPage = (page) =>
  page.evaluate(() => [...document.querySelectorAll("#grid .empty-fixes [data-undo]")].map((b) => ({ key: b.dataset.undo, n: parseInt(b.querySelector("span").textContent, 10), text: b.textContent.replace(/\s+/g, " ").trim() })));

describe("live filter counts and 'no results' help", () => {
  let browser, ctx;
  before(async () => { browser = await launch(); ctx = await openCatalogue(browser); });
  after(async () => { await browser.close(); });
  const page = () => ctx.page;

  const DEAD = DEAD_END;   // a genuine dead end found in the data (lib/scenarios.mjs)
  const HOUSE_FM = expected({ brand: DEAD.brand, fm: DEAD.fm }).length;

  describe(`a dead end: House + Scent family + Who it's for (found in the data: ${DEAD.brand} has ${HOUSE_FM} ${DEAD.fm} and ${expected({ brand: DEAD.brand, gd: DEAD.gd }).length} for ${DEAD.gd.toLowerCase()}, but none of both)`, () => {
    test("the dropdowns narrow as you choose, and the dead end is greyed out", async () => {
      await applyFilters(page(), {});
      const label = (sel, v) => page().locator(`${sel} [data-v="${v}"]`).evaluate((b) => ({ t: `${b.querySelector(".pn-l").textContent.trim()} (${b.querySelector("small").textContent.trim()})`, d: b.disabled }));
      assert.equal((await label("#gender", DEAD.gd)).t, `${DEAD.gd} (${expected({ gd: DEAD.gd }).length})`);
      await change(page(), "brand", DEAD.brand);
      assert.equal((await label("#gender", DEAD.gd)).t, `${DEAD.gd} (${expected({ brand: DEAD.brand, gd: DEAD.gd }).length})`, `only ${DEAD.brand}'s`);
      assert.equal((await label("#family", DEAD.fm)).t, `${DEAD.fm} (${HOUSE_FM})`, "the catalogue-wide figure must not be shown once a house is chosen");
      await change(page(), "fm", DEAD.fm);
      assert.deepEqual(await label("#gender", DEAD.gd), { t: `${DEAD.gd} (0)`, d: true });
      const other = ["Men", "Women", "Unisex"].find((g) => g !== DEAD.gd && expected({ brand: DEAD.brand, fm: DEAD.fm, gd: g }).length > 0);
      assert.ok(other, "some other gender still has results");
      const n = expected({ brand: DEAD.brand, fm: DEAD.fm, gd: other }).length;
      assert.deepEqual(await label("#gender", other), { t: `${other} (${n})`, d: false });
      assert.equal(await page().textContent("#count"), `${HOUSE_FM} of 627`);
    });

    test("forcing the empty combination explains itself and offers the fixes that work", async () => {
      await applyFilters(page(), DEAD);
      assert.equal(await page().textContent("#count"), "0 of 627");
      assert.equal(await page().locator("#grid .empty h2").textContent(), "Nothing matches that");
      assert.match(await page().textContent("#grid .empty"), /Those filters don't overlap/);
      const want = FILTER_ORDER.filter((k) => isOn(DEAD, k))
        .map((k) => ({ key: k, n: expected({ ...DEAD, [k]: DEFAULT_FILTERS[k] }).length })).filter((f) => f.n > 0).sort((a, b) => b.n - a.n);
      const fixes = await fixesOnPage(page());
      assert.deepEqual(fixes.map((f) => ({ key: f.key, n: f.n })), want, "the fixes that would give results, most results first");
      const gender = fixes.find((f) => f.key === "gd");
      assert.equal(gender.n, HOUSE_FM);
      assert.match(gender.text, new RegExp(`Remove “${DEAD.gd}” ${HOUSE_FM} fragrances`));
      await page().click('[data-undo="gd"]');
      assert.deepEqual(diff({ brand: DEAD.brand, fm: DEAD.fm }, await collect(page())), []);
      assert.equal(await page().locator('#gender [aria-pressed="true"]').count(), 0, "'For' should go back to nothing chosen");
      assert.equal(await page().locator("#filters-badge").isHidden(), false, `${DEAD.brand} and ${DEAD.fm} are still on`);
    });
  });

  describe("counts and greyed-out options match the data", () => {
    test("every option in the panel, across single filters and 60 mixed scenarios", async () => {
      const scenarios = [...singleFilterScenarios().filter((_, i) => i % 3 === 0), ...pairwiseScenarios().filter((_, i) => i % 60 === 0), ...randomScenarios(25, 31337).map((s) => s.F)];
      const failures = [];
      for (const F of scenarios) {
        await applyFilters(page(), F);
        const bad = facetProblems(F, await readFacets(page()));
        if (bad.length) failures.push({ filters: F, problems: bad.slice(0, 4) });
        if (failures.length >= 5) break;
      }
      assert.equal(failures.length, 0, fmt(failures));
    });

    test("they follow along as filters are added and removed one at a time", async () => {
      const rnd = mulberry32(2468), keys = Object.keys(POOL).filter((k) => k !== "sort");
      const pick = (a) => a[Math.floor(rnd() * a.length)];
      const failures = [];
      for (let w = 0; w < 12 && failures.length < 3; w++) {
        await applyFilters(page(), {});
        const F = {};
        for (let step = 0; step < 8; step++) {
          const k = pick(keys), clear = Object.hasOwn(F, k) && rnd() < 0.3;
          const v = clear ? DEFAULT_FILTERS[k] : pick(POOL[k]);
          await change(page(), k, v);
          if (clear) delete F[k]; else F[k] = v;
          const bad = facetProblems(F, await readFacets(page()));
          if (bad.length) { failures.push({ filters: { ...F }, order: `walk ${w} step ${step}`, problems: bad.slice(0, 3) }); break; }
        }
      }
      assert.equal(failures.length, 0, fmt(failures));
    });

    test("choosing an option really gives the number shown beside it (selected for real, across 12 starting points)", async () => {
      const starts = [{}, { gd: "Women" }, { fm: "Oud & Woody" }, { brand: "Lattafa" }, { price: "3000-6000" }, ...randomScenarios(7, 4242).map((s) => s.F)];
      const failures = [];
      for (const F of starts) {
        await applyFilters(page(), F);
        const bad = await page().evaluate(() => {
          const out = [];
          const shownCount = () => { const t = document.getElementById("count").textContent; return t.includes("–") ? +t.match(/of (\d+)/)[1] : parseInt(t, 10); };   // "1–48 of 298" · "5 of 627" · "627 fragrances"
          const inPanel = (fn) => { document.getElementById("filters-open").click(); fn(); document.getElementById("pn-done").click(); };
          const sel = document.getElementById("brand"), start = sel.value;
          inPanel(() => {
            [...sel.options].forEach((o, i) => {
              const m = o.textContent.match(/\((\d+)\)$/);
              if (!m || o.disabled || i % 3) return;                       // every third house
              sel.value = o.value; sel.dispatchEvent(new Event("change", { bubbles: true }));
              if (shownCount() !== +m[1]) out.push(`house "${o.textContent.trim()}" is labelled ${m[1]} but gives ${shownCount()}`);
              sel.value = start; sel.dispatchEvent(new Event("change", { bubbles: true }));
            });
            for (const id of ["gender", "family", "price", "size"]) {
              [...document.querySelectorAll(`#${id} .pn-chip`)].forEach((b, i) => {
                const label = b.querySelector(".pn-l").textContent.trim(), n = +b.querySelector("small").textContent;
                if (b.disabled || b.getAttribute("aria-pressed") === "true") return;
                if (i % 2 && label !== "Oud & Woody" && label !== "Women") return;   // every other button, plus the two the visitors asked about
                b.click();
                if (shownCount() !== n) out.push(`${id} "${label}" is labelled ${n} but gives ${shownCount()}`);
                b.click();                                                 // tap again: back to how it was
              });
            }
          });
          return out;
        });
        if (bad.length) failures.push({ filters: F, problems: bad.slice(0, 4) });
        if (failures.length >= 4) break;
      }
      assert.equal(failures.length, 0, fmt(failures));
    });

    test("clearing the filters puts every number back to the full-catalogue figure", async () => {
      await applyFilters(page(), { brand: "Lattafa", gd: "Men", price: "1000-3000", q: "oud" });
      await page().click("#reset");
      assert.deepEqual(facetProblems({}, await readFacets(page())), []);
    });

    test("a change of filters updates the counts within a fraction of a second", async () => {
      await applyFilters(page(), { seg: "arabian", g: "Retail", gd: "Men", fm: "Gourmand", price: "1000-3000", q: "a" });
      const ms = await page().evaluate(() => { const s = document.querySelector("#brand"), t0 = performance.now(); s.value = "Lattafa"; s.dispatchEvent(new Event("change", { bubbles: true })); return performance.now() - t0; });
      assert.ok(ms < 200, `took ${Math.round(ms)}ms`);
    });
  });

  describe("when nothing matches", () => {
    // every scenario from the pools that really has zero results (so the fixes are tested on genuine dead ends)
    const dead = [...singleFilterScenarios(), ...pairwiseScenarios(), ...randomScenarios(150, 99).map((s) => s.F)].filter((F) => expected(F).length === 0);

    test("the suggested fixes are exactly the single removals that would give results, most results first", async () => {
      assert.ok(dead.length > 20, `expected plenty of dead-end scenarios, found ${dead.length}`);
      const failures = [];
      for (const F of dead.filter((_, i) => i % Math.ceil(dead.length / 40) === 0)) {
        await applyFilters(page(), F);
        const want = FILTER_ORDER.filter((k) => isOn(F, k))
          .map((k) => ({ key: k, n: expected({ ...F, [k]: DEFAULT_FILTERS[k] }).length })).filter((f) => f.n > 0)
          .sort((a, b) => b.n - a.n);
        const got = (await fixesOnPage(page())).map(({ key, n }) => ({ key, n }));
        if (JSON.stringify(got) !== JSON.stringify(want)) failures.push({ filters: F, problems: [`fixes ${JSON.stringify(got)} ≠ expected ${JSON.stringify(want)}`] });
        if (failures.length >= 5) break;
      }
      assert.equal(failures.length, 0, fmt(failures));
    });

    test("each fix removes only that one filter, with every control and result in step", async () => {
      const failures = [];
      for (const F of dead.filter((_, i) => i % Math.ceil(dead.length / 12) === 0)) {
        for (const fix of await (async () => { await applyFilters(page(), F); return fixesOnPage(page()); })()) {
          await applyFilters(page(), F);
          await page().click(`[data-undo="${fix.key}"]`);
          const after = { ...F, [fix.key]: DEFAULT_FILTERS[fix.key] };
          const bad = diff(after, await collect(page()));
          if (bad.length) failures.push({ filters: F, order: `after removing ${fix.key}`, problems: bad.slice(0, 3) });
        }
        if (failures.length >= 5) break;
      }
      assert.equal(failures.length, 0, fmt(failures));
    });

    test("a misspelt search says so, and offers to remove the search", async () => {
      await applyFilters(page(), { q: "zzzqqq" });
      assert.match(await page().textContent("#grid .empty"), /Try a different spelling/);
      const fixes = await fixesOnPage(page());
      assert.deepEqual(fixes.map((f) => f.key), ["q"]);
      assert.equal(fixes[0].n, 627);
      await page().click('[data-undo="q"]');
      assert.equal(await page().inputValue("#q"), "");
      assert.deepEqual(diff({}, await collect(page())), []);
    });

    test("with nothing to remove that helps, no empty 'Try removing one' buttons are shown", async () => {
      const F = dead.find((f) => FILTER_ORDER.filter((k) => isOn(f, k)).every((k) => expected({ ...f, [k]: DEFAULT_FILTERS[k] }).length === 0));
      if (!F) return;   // (no such scenario in the pool — nothing to check)
      await applyFilters(page(), F);
      assert.equal(await page().locator("#grid .empty-fixes").count(), 0);
      assert.doesNotMatch(await page().textContent("#grid .empty"), /Try removing one/);
    });

    test("the contact link is still offered", async () => {
      await applyFilters(page(), { brand: "Ahmed Al Maghribi", gd: "Women", fm: "Musk" });
      assert.match(await page().getAttribute("#grid .empty a", "href"), /contact\.html$/);
    });
  });

  test("no console errors", () => assert.deepEqual(ctx.errors, []));
});

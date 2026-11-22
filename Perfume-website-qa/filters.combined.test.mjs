// Combined-filter scenarios: pairwise matrix, seeded random 3–6-way combos, targeted edge cases,
// order-independence and step-by-step user flows. All compared with the independent oracle.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { launch, openCatalogue, applyFilters, change, collect, diff, runScenarios, fmt } from "./lib/browser.mjs";
import { NONE, DEFAULT_FILTERS, expected } from "./lib/oracle.mjs";
import { POOL, pairwiseScenarios, randomScenarios, mulberry32, DEAD_END, FAMILIES } from "./lib/scenarios.mjs";

describe("combined filters", () => {
  let browser, ctx;
  before(async () => { browser = await launch(); ctx = await openCatalogue(browser); });
  after(async () => { await browser.close(); });
  const run = async (scenarios, max = 8) => { const f = await runScenarios(ctx.page, scenarios, { maxFailures: max }); assert.equal(f.length, 0, fmt(f)); };

  const pairs = pairwiseScenarios();
  const chunk = Math.ceil(pairs.length / 4);
  for (let i = 0; i < 4; i++) {
    test(`every pair of filters, part ${i + 1}/4 (${pairs.slice(i * chunk, (i + 1) * chunk).length} combinations)`, () => run(pairs.slice(i * chunk, (i + 1) * chunk)));
  }

  test("300 random 3–6-way combinations, applied in random order", () => run(randomScenarios(300)));

  describe("targeted edge cases", () => {
    const EDGE = [
      { seg: "arabian", brand: "Tom Ford" },                                   // contradictory → empty
      { seg: "luxury", brand: "Tom Ford", price: "6000-10000", g: "Retail", sort: "hi" },
      { gd: "Women", fm: "Floral", price: "1000-3000" },
      { g: "Minis", price: "0-1000", sort: "lo", q: "hermes" },
      { g: "Tester", brand: "Hermes", sort: "hi" },
      { brand: "Lattafa", fm: "Gourmand", gd: "Unisex" },
      { seg: "arabian", g: "Retail", brand: "Lattafa", gd: "Unisex", fm: "Gourmand", price: "1000-3000", q: "khamrah", sort: "lo" },
      DEAD_END,                                                                 // every pair has results, all three together none (found in the data)
      ...(FAMILIES.includes(NONE) ? [{ fm: NONE, brand: "Lattafa" }] : [{ fm: "Musk", gd: "Unisex" }]),   // "not tagged" while some perfume lacks a scent tag (the page offers that choice only then)
      { g: "Sets", price: "3000-6000" }, { g: "Sets", price: "0-1000" },
      { brand: "Kayali", price: "0-1000" }, { brand: "Kayali", price: "1000-3000" },
      { brand: "Roberto Cavalli", q: "signature", g: "Tester", sort: "lo" },    // twin variants (one "No Box")
      { brand: "Roberto Cavalli", q: "signature", g: "Tester", sort: "hi" },
      { q: "tester", g: "Retail" }, { q: "100ml", g: "Minis" }, { q: "2ml", g: "Retail" },
      { seg: "designer", g: "Minis", sort: "lo" }, { seg: "luxury", g: "Minis" },
      { price: "10000-999999", sort: "hi" }, { price: "6000-10000", sort: "lo", g: "Tester" }, { price: "10000-999999", g: "Retail", seg: "luxury" },
      { seg: "all", g: "all", brand: "", gd: "", fm: "", price: "", q: "", sort: "lo" }, // explicit defaults
    ];
    test(`${EDGE.length} hand-picked combinations`, () => run(EDGE));

    test("a filter set gives identical results whatever order it is applied in", async () => {
      const failures = [];
      for (const F of EDGE.slice(0, 8)) {
        const keys = Object.keys(F);
        let reference = null;
        for (const order of [keys, [...keys].reverse(), [...keys.slice(1), keys[0]]]) {
          await applyFilters(ctx.page, F, order);
          const r = await collect(ctx.page);
          const slugs = r.pages.flatMap((p) => p.cards).map((c) => c.slug).join();
          const sig = `${r.count}|${slugs}`;
          if (reference === null) reference = sig; else if (sig !== reference) failures.push({ filters: F, order, problems: ["different result for a different application order"] });
        }
      }
      assert.equal(failures.length, 0, fmt(failures));
    });
  });

  describe("step-by-step flows (users change one thing at a time, nothing is reset between steps)", () => {
    test("40 random walks × 12 steps: every intermediate state is correct", async () => {
      const rnd = mulberry32(777), keys = Object.keys(POOL);
      const pick = (a) => a[Math.floor(rnd() * a.length)];
      const failures = [];
      for (let w = 0; w < 40 && failures.length < 6; w++) {
        await applyFilters(ctx.page, {}); // start clean
        const F = {};
        for (let step = 0; step < 12; step++) {
          const k = pick(keys);
          // 30% of steps clear a filter back to its default, the rest change it
          const clear = Object.hasOwn(F, k) && rnd() < 0.3;
          const v = clear ? DEFAULT_FILTERS[k] : pick(POOL[k]);
          await change(ctx.page, k, v);
          if (clear) delete F[k]; else F[k] = v;
          const problems = diff(F, await collect(ctx.page));
          if (problems.length) { failures.push({ filters: { ...F }, order: `walk ${w}, step ${step}: ${k}=${JSON.stringify(v)}`, problems: problems.slice(0, 3) }); break; }
        }
      }
      assert.equal(failures.length, 0, fmt(failures));
    });

    test("adding a filter never adds results (narrowing is monotonic)", async () => {
      const rnd = mulberry32(99), keys = Object.keys(POOL).filter((k) => k !== "sort");
      const pick = (a) => a[Math.floor(rnd() * a.length)];
      for (let c = 0; c < 25; c++) {
        await applyFilters(ctx.page, {});
        let prev = Infinity;
        const order = [...keys].sort(() => rnd() - 0.5).slice(0, 5);
        for (const k of order) {
          await change(ctx.page, k, pick(POOL[k]));
          const r = await collect(ctx.page);
          const n = r.pages.flatMap((p) => p.cards).length;
          assert.ok(n <= prev, `adding "${k}" grew the results from ${prev} to ${n} (chain ${order})`);
          prev = n;
        }
      }
    });
  });

  test("no console errors during any combined run", () => assert.deepEqual(ctx.errors, []));
});

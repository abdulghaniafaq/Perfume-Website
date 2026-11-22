// Filters, in depth: far wider coverage than the pair / random runs. Every scenario drives the real controls and is compared, card by
// card, price by price, page by page, with the independent working-out (lib/oracle.mjs).
//   A  every house × every style tab × every size / packaging            (all 89 houses)
//   B  every house × every price band × all three sort orders (low to high, high to low, name A to Z)
//   C  every scent family × who it's for × price band × packaging
//   D  500 random 2–7-way mixes drawn from the FULL lists, with search words taken from real house / perfume names
//   E  the same kind of mixes on a phone-sized screen (bottom-sheet Filters panel)
//   F  walking back: add filters one by one, then take them off one by one in a different order - every stop is right
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { PRODUCTS } from "./lib/data.mjs";
import { launch, openCatalogue, applyFilters, change, collect, diff, runScenarios, fmt } from "./lib/browser.mjs";
import { NONE, BANDS, families, houses, expected, normalize } from "./lib/oracle.mjs";
import { SEGS, PKGS, GENDERS, FAMILIES, PRICES, SORTS, mulberry32 } from "./lib/scenarios.mjs";

describe("filters, in depth", () => {
  let browser, ctx;
  before(async () => { browser = await launch(); ctx = await openCatalogue(browser); });
  after(async () => { await browser.close(); });
  const run = async (page, scenarios, max = 6) => { const f = await runScenarios(page, scenarios, { maxFailures: max }); assert.equal(f.length, 0, fmt(f)); };

  test(`A: every one of the ${houses.length} houses × 4 style tabs × 4 sizes/packagings (${houses.length * 16} combinations)`, () =>
    run(ctx.page, houses.flatMap((brand) => ["all", ...SEGS].flatMap((seg) => PKGS.map((g) => ({ brand, seg, g }))))));

  test(`B: every house × 5 price bands × the 3 sort orders (price both ways, name A to Z) (${houses.length * 15} combinations)`, () =>
    run(ctx.page, houses.flatMap((brand) => PRICES.flatMap((price) => SORTS.map((sort) => ({ brand, price, sort }))))));

  test("C: every scent family (and 'not tagged') × who it's for × price band × packaging", () =>
    run(ctx.page, FAMILIES.flatMap((fm) => GENDERS.flatMap((gd) => PRICES.flatMap((price) => PKGS.map((g) => ({ fm, gd, price, g })))))));

  // search words that real visitors would type: whole names, half names, one word, a house, a house + part of a name
  const WORDS = (() => {
    const rnd = mulberry32(777), out = new Set();
    for (const p of PRODUCTS) {
      if (rnd() < 0.12) out.add(p.n);
      if (rnd() < 0.08) out.add(`${p.b} ${p.n.split(" ")[0]}`);
      if (rnd() < 0.08) out.add(p.n.split(" ").slice(-1)[0]);
      if (rnd() < 0.05) out.add(p.n.slice(0, Math.max(3, Math.floor(p.n.length / 2))));
      if (rnd() < 0.04) out.add(p.b);
    }
    return [...out].filter((w) => normalize(w));
  })();
  const FULL = { seg: SEGS, g: PKGS, price: PRICES, sort: SORTS, gd: GENDERS, fm: FAMILIES, brand: houses, q: WORDS };
  const mixes = (count, seed) => {
    const rnd = mulberry32(seed), keys = Object.keys(FULL), out = [];
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    while (out.length < count) {
      const n = 2 + Math.floor(rnd() * 6), ks = shuffle(keys).slice(0, n), F = {};
      ks.forEach((k) => (F[k] = pick(FULL[k])));
      out.push({ F, order: shuffle(ks) });
    }
    return out;
  };

  test(`D: 500 random 2–7-way mixes from the full lists (${WORDS.length} real search words), applied in random order`, () => run(ctx.page, mixes(500, 4242)));

  test("D2: about a fifth of those mixes give no results - and every one of those dead ends explains itself and offers a way out", async () => {
    const dead = mixes(500, 4242).filter(({ F }) => expected(F).length === 0).slice(0, 40);
    assert.ok(dead.length >= 10, `${dead.length} dead-end mixes to check`);
    const problems = [];
    for (const { F, order } of dead) {
      await applyFilters(ctx.page, F, order);
      await ctx.page.waitForTimeout(60);
      const s = await ctx.page.evaluate(() => ({ cards: document.querySelectorAll("#grid .card").length, msg: (document.querySelector("#grid .empty") || {}).textContent || "", pager: !!document.querySelector("#pager .pg"), reset: !document.querySelector("#reset").hidden }));
      if (s.cards || !/Nothing matches/i.test(s.msg) || s.pager || !s.reset) problems.push(`${JSON.stringify(F)}: ${JSON.stringify({ ...s, msg: s.msg.slice(0, 30) })}`);
    }
    assert.deepEqual(problems.slice(0, 5), []);
  });

  test("E: on a phone-sized screen, 150 random mixes through the bottom-sheet Filters give the same results", async () => {
    const m = await openCatalogue(browser, { viewport: { width: 390, height: 844 }, contextOptions: { hasTouch: true, isMobile: true } });
    try { await run(m.page, mixes(150, 99)); assert.deepEqual(m.errors, []); assert.equal(await m.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no sideways scroll"); }
    finally { await m.context.close(); }
  });

  test("F: add six filters one at a time, then remove them one at a time in a different order - every stop matches", async () => {
    const rnd = mulberry32(5150), problems = [];
    for (let run = 0; run < 25; run++) {
      const F = {};
      const keys = Object.keys(FULL).sort(() => rnd() - 0.5).slice(0, 6);
      keys.forEach((k) => (F[k] = FULL[k][Math.floor(rnd() * FULL[k].length)]));
      await applyFilters(ctx.page, {}, []);
      const cur = {};
      for (const k of keys) {                                                 // adding
        cur[k] = F[k]; await change(ctx.page, k, F[k]);
        const d = diff({ ...cur }, await collect(ctx.page)); if (d.length) problems.push(`add ${k}: ${JSON.stringify(cur)} → ${d[0]}`);
      }
      for (const k of [...keys].reverse().sort(() => rnd() - 0.5)) {          // removing, in another order
        delete cur[k]; await change(ctx.page, k, k === "seg" ? "all" : k === "g" ? "all" : k === "sort" ? "lo" : "");
        const d = diff({ ...cur }, await collect(ctx.page)); if (d.length) problems.push(`remove ${k}: ${JSON.stringify(cur)} → ${d[0]}`);
      }
      if (problems.length > 4) break;
    }
    assert.deepEqual(problems.slice(0, 5), []);
  });

  test("no console errors or failed requests during any of the above", () => assert.deepEqual(ctx.errors, []));
});

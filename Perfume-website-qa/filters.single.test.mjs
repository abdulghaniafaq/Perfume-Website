// Single-filter scenarios: each control on its own, every value, compared with the independent oracle.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { PRODUCTS } from "./lib/data.mjs";
import { launch, openCatalogue, applyFilters, collect, runScenarios, fmt } from "./lib/browser.mjs";
import { NONE, normalize } from "./lib/oracle.mjs";
import { SEGS, PKGS, GENDERS, FAMILIES, PRICES, SORTS, QUERIES } from "./lib/scenarios.mjs";

describe("single filters (compared with the independent oracle)", () => {
  let browser, ctx;
  before(async () => { browser = await launch(); ctx = await openCatalogue(browser); });
  after(async () => { await browser.close(); });

  const run = async (scenarios) => { const f = await runScenarios(ctx.page, scenarios, { maxFailures: 8 }); assert.equal(f.length, 0, fmt(f)); };

  test("default state: all 627, first page of 48, 14 pages", async () => {
    await run([{}]);
    await applyFilters(ctx.page, {}); // run() leaves the pager on its last page; go back to page 1
    const r = await collect(ctx.page);
    assert.equal(r.pages.length, 14);
    assert.equal(r.pages[0].cards.length, 48);
    assert.equal(r.count, "1–48 of 627");
  });

  test("style: Designer / Luxury & niche / Middle Eastern", () => run(SEGS.map((v) => ({ seg: v }))));
  test("size & packaging: Retail / Testers / Minis & vials / Sets", () => run(PKGS.map((v) => ({ g: v }))));
  test(`house: every one of the ${new Set(PRODUCTS.map((p) => p.b)).size} houses`, () => run([...new Set(PRODUCTS.map((p) => p.b))].map((v) => ({ brand: v }))));
  test("who it's for: Men / Women / Unisex / not tagged", () => run(GENDERS.map((v) => ({ gd: v }))));
  test("scent family: every family + not tagged", () => run(FAMILIES.map((v) => ({ fm: v }))));
  test("price: all four bands", () => run(PRICES.map((v) => ({ price: v }))));
  test("sort: price low→high (the default) and high→low", () => run(SORTS.map((v) => ({ sort: v }))));
  test("search: the standard query set", () => run(QUERIES.map((v) => ({ q: v }))));

  describe("price bands never overlap or drop a product", () => {
    const vacay = PRODUCTS.find((p) => p.n === "Vacay In A Bottle");
    test("a ₹1,000 item appears in exactly one band (Kayali Vacay set)", async () => {
      assert.equal(vacay.v[0].pr, 1000, "test assumption: this set costs exactly ₹1,000");
      const hits = [];
      for (const price of PRICES) {
        await applyFilters(ctx.page, { price, brand: "Kayali" });
        if ((await collect(ctx.page)).pages.flatMap((p) => p.cards).some((c) => c.slug === vacay.s)) hits.push(price);
      }
      assert.deepEqual(hits, ["1000-3000"], "₹1,000 belongs under '₹1,000 – ₹3,000', not 'Under ₹1,000'");
    });
    test("bands together cover every variant exactly once", async () => {
      let total = 0;
      for (const price of PRICES) {
        await applyFilters(ctx.page, { price });
        total += (await collect(ctx.page)).pages.flatMap((p) => p.cards).reduce((n, c) => n + c.prices.length, 0);
      }
      assert.equal(total, PRODUCTS.reduce((n, p) => n + p.v.length, 0));
    });
  });

  describe("search is by house and perfume name, and behaves the way people type", () => {
    const slugsFor = async (q, extra = {}) => { await applyFilters(ctx.page, { q, ...extra }); return (await collect(ctx.page)).pages.flatMap((p) => p.cards).map((c) => c.slug); };
    const find = (house, name) => PRODUCTS.find((p) => p.b === house && p.n === name).s;
    // the products whose HOUSE + NAME contain every typed word (what the search must return, ignoring other filters)
    const byName = (q) => PRODUCTS.filter((p) => normalize(q).split(" ").filter(Boolean).every((k) => normalize(`${p.b} ${p.n}`).includes(k))).map((p) => p.s);
    const sameSet = (a, b) => assert.deepEqual([...a].sort(), [...b].sort());

    test("curly (iPhone) and straight apostrophes give the same results", async () => {
      const straight = await slugsFor("d'hermes"), curly = await slugsFor("d’hermes");
      assert.ok(straight.length >= 3, "expected several d'Hermes products");
      assert.deepEqual(curly, straight);
    });
    test("apostrophe-free typing still finds names with apostrophes", async () => {
      assert.ok((await slugsFor("dhermes")).length >= 3);
      assert.ok((await slugsFor("laventure")).includes(find("Al Haramain", "L'Aventure")));
    });
    test("a straight or curly apostrophe finds names that have one (L'Homme)", async () => {
      for (const q of ["l'homme", "l’homme"]) {
        const got = await slugsFor(q);
        assert.ok(got.includes(find("Elie Saab", "L'Homme EDP")), q);
        assert.ok(got.includes(find("Prada", "L'Homme Intense EDP")), q);
      }
    });
    test("accents and capitals typed by the visitor match the plain spelling in the name", async () => {
      assert.deepEqual(await slugsFor("ÉLIXIR"), await slugsFor("elixir"));
      assert.ok((await slugsFor("Ómbre D’Or")).includes(find("Armaf", "Ombre D'Or EDP")));
    });
    test("word order doesn't matter", async () => {
      const a = await slugsFor("oud wood"), b = await slugsFor("wood oud");
      assert.ok(a.length >= 1);
      assert.deepEqual(b, a);
      assert.deepEqual(await slugsFor("twilly eau ginger"), await slugsFor("ginger eau twilly"));
    });
    test("case and surrounding spaces don't matter", async () => {
      assert.deepEqual(await slugsFor("  OUD  "), await slugsFor("oud"));
    });
    test("whitespace-only search shows everything", async () => {
      await applyFilters(ctx.page, { q: "   " });
      assert.equal((await collect(ctx.page)).count, "1–48 of 627");
    });

    test("the HOUSE is searched: a house name finds all of that house's perfumes, alone or with a perfume word", async () => {
      for (const [house, n] of [["Lattafa", 33], ["Tom Ford", 23], ["Armaf", 11], ["Swiss Arabian", 15], ["Paco Rabanne", 31]]) {
        const got = await slugsFor(house.toLowerCase());
        sameSet(got, byName(house));
        assert.ok(got.length >= n, `${house}: ${got.length} found`);
        assert.ok(PRODUCTS.filter((p) => p.b === house).every((p) => got.includes(p.s)), `${house}: every one of its perfumes`);
      }
      sameSet(await slugsFor("tom ford oud"), byName("tom ford oud"));
      assert.ok((await slugsFor("tom ford oud")).every((s) => PRODUCTS.find((p) => p.s === s).b === "Tom Ford"));
      sameSet(await slugsFor("ford tom"), await slugsFor("tom ford"));
      sameSet(await slugsFor("lattafa khamrah"), byName("lattafa khamrah"));
      assert.ok((await slugsFor("lattafa khamrah")).includes(find("Lattafa", "Khamrah")));
      sameSet(await slugsFor("oud"), byName("oud"));
    });
    test("the 'inspired by' text is not searched", async () => {
      const cherry = PRODUCTS.find((p) => p.s === "afnan-cherry-bouquet");
      assert.match(cherry.i, /Lost Cherry/, "test assumption: this one is inspired by Tom Ford Lost Cherry");
      assert.deepEqual(await slugsFor("lost cherry"), []);
      const tried = PRODUCTS.filter((p) => p.i).slice(0, 40);
      for (const p of tried) {
        const q = p.i.split(/\s+/).slice(-2).join(" ");
        const got = await slugsFor(q);
        sameSet(got, byName(q));
      }
    });
    test("size and packaging words are not searched", async () => {
      for (const q of ["tester", "100ml", "2ml", "retail", "vial", "minis"]) sameSet(await slugsFor(q), byName(q));
      assert.deepEqual(await slugsFor("tester"), []);
      assert.deepEqual(await slugsFor("100ml"), []);
      assert.deepEqual(await slugsFor("2ml", { g: "Minis" }), []);
    });
    test("a search never narrows the sizes shown on a card (the size filter does that)", async () => {
      const p = PRODUCTS.find((x) => x.s === "hermes-twilly-dhermes-eau-ginger-edp");
      await applyFilters(ctx.page, { q: "twilly d'hermes eau ginger" });
      const card = (await collect(ctx.page)).pages.flatMap((pg) => pg.cards).find((c) => c.slug === p.s);
      assert.equal(card.prices.length, p.v.length, "every size of the product is still listed");
    });
    test("odd characters don't break anything", async () => {
      for (const q of ["(", "[", "\\", "*", "?", "+", "<script>alert(1)</script>", "&", "%", "🙂", "a".repeat(500)]) {
        await applyFilters(ctx.page, { q });
        const r = await collect(ctx.page);
        assert.ok(typeof r.count === "string" && r.count.length > 0, `no count for ${JSON.stringify(q)}`);
        assert.equal(r.pages.flatMap((p) => p.cards).length, byName(q).length, `wrong results for ${JSON.stringify(q.slice(0, 20))}`);
      }
    });
  });

  test("no console errors during any single-filter run", () => assert.deepEqual(ctx.errors, []));
});

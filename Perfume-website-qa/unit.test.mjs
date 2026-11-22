// Unit tests: pure helpers (run in the real page via window.PX) + catalogue data integrity.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { SITE, PRODUCTS } from "./lib/data.mjs";
import { launch, openCatalogue } from "./lib/browser.mjs";
import { BANDS, segmentOf, families } from "./lib/oracle.mjs";

describe("helpers (window.PX)", () => {
  let browser, ctx;
  before(async () => { browser = await launch(); ctx = await openCatalogue(browser); });
  after(async () => { await browser.close(); });
  const px = (fn, arg) => ctx.page.evaluate(fn, arg);

  test("note() hides spreadsheet timestamps but keeps real remarks", async () => {
    const r = await px(() => ["", null, undefined, "No Box", "Box Damage", "2026-11-24 00:00:00", "2026-03-23T00:00:00", "Opened 2026-11-24"].map((x) => PX.note(x)));
    assert.deepEqual(r, ["", "", "", "No Box", "Box Damage", "", "", "Opened 2026-11-24"]);
  });

  test("spec() and detail() join size, packaging and remark", async () => {
    const r = await px(() => [
      PX.spec({ m: "100ml", p: "Retail" }), PX.spec({ m: "", p: "Gift Set" }), PX.spec({ m: "2ml", p: "" }),
      PX.detail({ m: "75ml", p: "Tester", r: "No Box" }), PX.detail({ m: "75ml", p: "Tester", r: "2026-01-01 00:00:00" }), PX.detail({ m: "", p: "", r: "" }),
    ]);
    assert.deepEqual(r, ["100ml · Retail", "Gift Set", "2ml", "75ml · Tester · No Box", "75ml · Tester", ""]);
  });

  test("money() formats INR with Indian digit grouping", async () => {
    assert.deepEqual(await px(() => [0, 150, 999, 1000, 22890, 100000].map(PX.money)), ["₹0", "₹150", "₹999", "₹1,000", "₹22,890", "₹1,00,000"]);
  });

  test("normalize() folds case, accents, apostrophes and punctuation", async () => {
    assert.ok(await px(() => typeof PX.normalize === "function"), "PX.normalize is missing");
    const r = await px(() => ["Matière", "d’Hermes", "D'HERMES", "Dolce & Gabbana", "  A   b ", "Attrape-Rêves", "", "L’Homme", "9PM"].map(PX.normalize));
    assert.deepEqual(r, ["matiere", "dhermes", "dhermes", "dolce gabbana", "a b", "attrape reves", "", "lhomme", "9pm"]);
  });

  test("outline() bottle: never NaN, bounded, grows with volume", async () => {
    const sizes = await px(() => [undefined, 0, 0.8, 1.5, 5, 10, 50, 100, 200, 5000].map((ml) => {
      const m = PX.outline(ml).match(/width="(\d+)" height="(\d+)"/);
      return m ? [+m[1], +m[2]] : null;
    }));
    sizes.forEach((s) => { assert.ok(s, "no svg size"); assert.ok(s[0] >= 9 && s[1] >= 14 && s[1] <= 46, `out of bounds: ${s}`); });
    const heights = sizes.slice(2).map((s) => s[1]);
    heights.forEach((h, i) => i && assert.ok(h >= heights[i - 1], `height shrank at index ${i}: ${heights}`));
  });

  test("keyOf() is unique for every variant (cart identity)", async () => {
    const keys = PRODUCTS.flatMap((p) => p.v.map((v) => [p.s, v.m, v.p, v.r].join("|")));
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(await px(() => PX.INDEX.size), keys.length);
  });

  test("no console errors while loading the catalogue", () => assert.deepEqual(ctx.errors, []));
});

describe("catalogue data integrity (what the filters rely on)", () => {
  test("every product/variant has the fields the filters read", () => {
    const groups = new Set(["Retail", "Tester", "Minis", "Sets", "Partial"]);
    const bad = [];
    for (const p of PRODUCTS) {
      if (!p.b || !p.n || !p.s) bad.push(`${p.s}: missing house/name/slug`);
      if (!/^[a-z0-9-]+$/.test(p.s)) bad.push(`${p.s}: slug not url-safe`);
      if (!Array.isArray(p.v) || !p.v.length) bad.push(`${p.s}: no variants`);
      if (!["", "Men", "Women", "Unisex"].includes(p.gd)) bad.push(`${p.s}: odd gender "${p.gd}"`);
      if (p.fm && !families.includes(p.fm)) bad.push(`${p.s}: odd family`);
      if (p.ib.length && !p.i) bad.push(`${p.s}: has inspired-by houses but no inspired-by text`);
      p.ib.forEach((h) => !h.trim() && bad.push(`${p.s}: blank inspired-by house`));
      for (const v of p.v) {
        if (!Number.isInteger(v.pr) || v.pr <= 0) bad.push(`${p.s}: bad price ${v.pr}`);
        if (!groups.has(v.g)) bad.push(`${p.s}: unknown packaging group "${v.g}"`);
        if (typeof v.mln !== "number" || Number.isNaN(v.mln)) bad.push(`${p.s}: bad volume`);
      }
    }
    assert.deepEqual(bad, []);
  });

  test("slugs are unique", () => assert.equal(new Set(PRODUCTS.map((p) => p.s)).size, PRODUCTS.length));

  test("catalogue order (it breaks ties between equal prices) is by house, then name", () => {
    const sorted = [...PRODUCTS].sort((a, b) => a.b.localeCompare(b.b) || a.n.localeCompare(b.n)).map((p) => p.s);
    assert.deepEqual(PRODUCTS.map((p) => p.s), sorted);
  });

  test("style groups in site-config.js: no typos, no house in two groups", () => {
    const houses = new Set(PRODUCTS.map((p) => p.b));
    const { arabian, luxury, unclassified } = SITE.segments;
    const all = [...arabian, ...luxury, ...unclassified];
    assert.deepEqual(all.filter((h) => !houses.has(h)), [], "listed houses that don't exist in the catalogue (typo?)");
    assert.deepEqual(all.filter((h, i) => all.indexOf(h) !== i), [], "houses listed in more than one group");
  });

  test("every price lands in exactly one price band", () => {
    const bad = PRODUCTS.flatMap((p) => p.v.filter((v) => Object.values(BANDS).filter(([lo, hi]) => v.pr >= lo && v.pr < hi).length !== 1).map(() => p.s));
    assert.deepEqual(bad, []);
  });

  test("style filter partitions the catalogue", () => {
    const n = (s) => PRODUCTS.filter((p) => segmentOf(p.b) === s).length;
    assert.equal(n("designer") + n("luxury") + n("arabian") + n(""), PRODUCTS.length);
  });

  test("data notes (informational)", (t) => {
    const noHouse = PRODUCTS.filter((p) => p.i && !p.ib.length).map((p) => `${p.b} ${p.n} (“${p.i}”)`);
    t.diagnostic(`${noHouse.length} product(s) have inspired-by text but no house mapped, so the house filter can't find them: ${noHouse.join("; ")}`);
    t.diagnostic(`"Christian Dior" (${PRODUCTS.filter((p) => p.b === "Christian Dior").length}) and "Dior" (${PRODUCTS.filter((p) => p.b === "Dior").length}) are separate houses in the House filter`);
    t.diagnostic(`${PRODUCTS.filter((p) => !p.gd).length}/${PRODUCTS.length} products have no gender tag; ${PRODUCTS.filter((p) => !p.fm).length} have no scent family`);
  });
});

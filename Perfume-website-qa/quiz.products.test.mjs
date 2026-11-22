// "Find my scent": the PRODUCTS behind every number.
//   For every option on every screen: pick it, read the number beside it, skip to the results, and read the
//   actual list of products. That list must be exactly the products in the raw data that fit all the earlier
//   answers plus that option — same count as the number, same count as the headline, no product missing, none extra.
//   The expected set is worked out here with plain filters on the raw product data (nothing from the quiz code).
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { launch, openCatalogue } from "./lib/browser.mjs";
import { PRODUCTS } from "./lib/data.mjs";
import { BANDS, segmentOf } from "./lib/oracle.mjs";
import { REST, options as quizOptions, STEPS as QUIZ_STEPS } from "./lib/quiz-oracle.mjs";
import { mulberry32 } from "./lib/scenarios.mjs";

const REVEAL = 120;   // list at most this many products per check (every product when there are fewer)

// ---- the expected products for a set of answers, from the raw data ----
const cheapest = (p) => p.v.reduce((a, b) => (b.pr < a.pr ? b : a));
const inBand = (pr, band) => pr >= BANDS[band][0] && pr < BANDS[band][1];
function expectedSlugs(A) {
  let list = PRODUCTS;
  if (A.gender) list = list.filter((p) => (A.gender === REST ? !p.gd : p.gd === A.gender));
  if (A.style) list = list.filter((p) => (A.style === REST ? segmentOf(p.b) === "" : segmentOf(p.b) === A.style));
  if (A.family) list = list.filter((p) => (A.family === REST ? !p.fm : p.fm === A.family));
  if (A.origin) list = list.filter((p) => !!p.i === (A.origin === "inspired"));
  if (A.insp) {
    const tally = new Map();
    list.forEach((p) => p.ib[0] && tally.set(p.ib[0], (tally.get(p.ib[0]) || 0) + 1));
    const top = [...tally].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(([h]) => h);
    list = list.filter((p) => (A.insp === REST ? !(p.ib[0] && top.includes(p.ib[0])) : p.ib[0] === A.insp));
  }
  if (A.budget) list = list.filter((p) => inBand(cheapest(p).pr, A.budget));
  if (A.size) list = list.filter((p) => (A.size === REST ? !["Retail", "Tester", "Minis"].includes(cheapest(p).g) : cheapest(p).g === A.size));
  return list.map((p) => p.s);
}

/** On one random walk, for every option of every screen: its number, the headline after picking it, and the products listed. */
const productsBehindEveryOption = (page, choices) =>
  page.evaluate(({ choices, REVEAL }) => {
    const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
    const replay = (picks) => {
      if (!$("#quiz").hidden) $("#quiz-close").click();
      $("[data-quiz]").click();
      const A = {};
      for (const k of picks) {
        if (!$(".quiz-opts")) break;
        if (k < 0) { $(".quiz-skip").click(); continue; }
        A[$(".quiz-opts").dataset.q] = $$(".quiz-opt")[k].dataset.v;
        $$(".quiz-opt")[k].click();
      }
      return A;
    };
    const out = [];
    const picks = [];
    for (let depth = 0, ci = 0; depth < 8; depth++) {
      const before = replay(picks);
      if (!$(".quiz-opts")) break;
      const key = $(".quiz-opts").dataset.q, n = $$(".quiz-opt").length;
      for (let i = 0; i < n; i++) {
        replay(picks);
        const o = $$(".quiz-opt")[i], shown = +o.querySelector(".qo-n").textContent, v = o.dataset.v;
        o.click();
        while ($(".quiz-opts")) $(".quiz-skip").click();                       // answer nothing more: go straight to the list
        const headline = $(".quiz-sub b") ? parseInt($(".quiz-sub b").textContent, 10) : 0;
        while ($(".quiz-more") && $$(".qr").length < REVEAL) $(".quiz-more").click();
        out.push({ answers: { ...before, [key]: v }, key, v, shown, headline, slugs: $$(".qr").map((e) => e.dataset.slug), nothing: !!$(".quiz-q")?.textContent.includes("Nothing fits") });
      }
      const k = choices[ci++ % choices.length] % (n + 1);
      picks.push(k === n ? -1 : k);
    }
    if (!$("#quiz").hidden) $("#quiz-close").click();
    return out;
  }, { choices, REVEAL });

/** Problems with one record (empty = the products are exactly right). */
function check(r) {
  const want = expectedSlugs(r.answers), wantSet = new Set(want);
  const bad = [];
  const label = `${JSON.stringify(r.answers)}`;
  if (r.nothing) return [`${label}: the quiz says "Nothing fits" although the option showed ${r.shown}`];
  if (want.length !== r.shown) bad.push(`${label}: the option says ${r.shown} but the data has ${want.length} such products`);
  if (r.headline !== want.length) bad.push(`${label}: headline says ${r.headline}, data has ${want.length}`);
  if (new Set(r.slugs).size !== r.slugs.length) bad.push(`${label}: a product is listed twice`);
  if (r.slugs.length !== Math.min(REVEAL, want.length)) bad.push(`${label}: ${r.slugs.length} listed, expected ${Math.min(REVEAL, want.length)}`);
  const extra = r.slugs.filter((s) => !wantSet.has(s));
  if (extra.length) bad.push(`${label}: ${extra.length} listed that don't fit, e.g. ${extra[0]}`);
  if (want.length <= REVEAL) { const got = new Set(r.slugs), missing = want.filter((s) => !got.has(s)); if (missing.length) bad.push(`${label}: ${missing.length} missing from the list, e.g. ${missing[0]}`); }
  return bad;
}

describe("Find my scent — the products behind every number", () => {
  let browser, ctx;
  before(async () => { browser = await launch(); ctx = await openCatalogue(browser); });
  after(async () => { await browser.close(); });
  const page = () => ctx.page;

  test("your example: For him → Designer → Under ₹1,000: each number is that many real products", async () => {
    // First option (For him), first option (Designer), then SKIP the scent-family question (the last slot of its options is "skip"; and the "own or inspired" question too, if it is asked)
    const before = { gender: "Men", style: "designer" };
    const nFamily = quizOptions(QUIZ_STEPS.indexOf("family"), before).length, nOrigin = quizOptions(QUIZ_STEPS.indexOf("origin"), before).length;
    const records = await productsBehindEveryOption(page(), [0, 0, nFamily, ...(nOrigin >= 2 ? [nOrigin] : []), 0, 0, 0, 0]);
    const only = (r, ...keys) => Object.keys(r.answers).sort().join() === keys.sort().join();   // exactly these answers, nothing else chosen
    const him = records.find((r) => only(r, "gender") && r.v === "Men");
    const designer = records.find((r) => only(r, "gender", "style") && r.answers.gender === "Men" && r.v === "designer");
    const cheap = records.find((r) => only(r, "gender", "style", "budget") && r.answers.gender === "Men" && r.answers.style === "designer" && r.v === "0-1000");
    assert.ok(him && designer && cheap, "the walk should reach all three screens");
    const want = [expectedSlugs({ gender: "Men" }).length, expectedSlugs({ gender: "Men", style: "designer" }).length, expectedSlugs({ gender: "Men", style: "designer", budget: "0-1000" }).length];
    assert.ok(want[2] >= 1, "some men's designer perfume starts under ₹1,000");
    assert.deepEqual([him.shown, designer.shown, cheap.shown], want);
    assert.deepEqual([him, designer, cheap].map((r) => r.slugs.length), want.map((n) => Math.min(n, REVEAL)));
    for (const r of [him, designer, cheap]) assert.deepEqual(check(r), []);
    // and what those products are: tagged for men, from designer houses, none of them costing ₹1,000+ at its cheapest
    cheap.slugs.forEach((s) => { const p = PRODUCTS.find((x) => x.s === s); assert.equal(p.gd, "Men"); assert.equal(segmentOf(p.b), "designer"); assert.ok(cheapest(p).pr < 1000); });
  });

  test("every option on every screen of 60 random walks lists exactly the products behind its number", async () => {
    const rnd = mulberry32(424242), fails = [];
    let checked = 0;
    for (let i = 0; i < 60 && fails.length < 3; i++) {
      const choices = Array.from({ length: 7 }, () => Math.floor(rnd() * 12));
      for (const r of await productsBehindEveryOption(page(), choices)) {
        checked++;
        const bad = check(r);
        if (bad.length) { fails.push({ choices, bad: bad.slice(0, 3) }); break; }
      }
    }
    assert.ok(checked > 800, `only ${checked} options were checked`);
    assert.deepEqual(fails, []);
  });

  test("no console errors", () => assert.deepEqual(ctx.errors, []));
});

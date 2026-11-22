// "Find my scent": the numbers always add up.
//   • On every question, the options add up to the number "in the running".
//   • Picking an option leaves exactly its number — the next question's options add up to it, and the
//     results list is exactly those fragrances.
//   (For him 106 → Designer 52 → its price bands add up to 52 → "Under ₹1,000" 5 → the list of those 5.)
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { launch, openCatalogue } from "./lib/browser.mjs";
import { PRODUCTS } from "./lib/data.mjs";
import { segmentOf } from "./lib/oracle.mjs";
import { simulate, pool, STEPS, REST, blank, answerChooser, randomChooser, options } from "./lib/quiz-oracle.mjs";
import { mulberry32 } from "./lib/scenarios.mjs";

const BY_SLUG = new Map(PRODUCTS.map((p) => [p.s, p]));
const sum = (opts) => opts.reduce((a, o) => a + o.n, 0);

/** Works through the quiz in the page, recording what each screen says. `mode` is { choices } or { answers }. */
const drive = (page, mode) =>
  page.evaluate(({ mode }) => {
    const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
    const txt = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : null);
    $("[data-quiz]").click();
    const screens = [];
    let ci = 0;
    for (let guard = 0; guard < 20 && $(".quiz-opts"); guard++) {
      const key = $(".quiz-opts").dataset.q;
      const opts = $$(".quiz-opt").map((b) => ({ v: b.dataset.v, label: txt(b.querySelector(".qo-label")), n: +b.querySelector(".qo-n").textContent }));
      screens.push({ key, counter: +$(".quiz-count b").textContent, sub: txt($(".quiz-sub")), skip: txt($(".quiz-skip")), opts });
      let pick;
      if (mode.choices) { const k = mode.choices[ci++ % mode.choices.length] % (opts.length + 1); pick = k === opts.length ? -1 : k; }
      else pick = opts.findIndex((o) => o.v === mode.answers[key]);
      if (pick < 0) $(".quiz-skip").click(); else $$(".quiz-opt")[pick].click();
    }
    while ($$(".qr").length < 400 && $(".quiz-more")) $(".quiz-more").click();   // (reveal up to 400: the largest single answer, women, now holds almost 200)
    const out = {
      screens, sub: txt($(".quiz-sub")), onResults: !$(".quiz-opts"), summary: $$(".quiz-summary .tag").map(txt), headings: $$(".qr-list > :not(.qr)").length,
      cards: $$(".qr").map((e) => ({ slug: e.dataset.slug, price: txt(e.querySelector(".price")), spec: txt(e.querySelector(".qr-spec")), chips: e.querySelectorAll(".qr-why").length })),
    };
    $("#quiz-close").click();
    return out;
  }, { mode });

/** Click every option of every screen on a walk, and report the number it showed vs what it really gave. */
const clickEveryOption = (page, choices) =>
  page.evaluate(({ choices }) => {
    const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
    const replay = (picks) => {
      if (!$("#quiz").hidden) $("#quiz-close").click();
      $("[data-quiz]").click();
      for (const k of picks) { if (!$(".quiz-opts")) break; if (k < 0) $(".quiz-skip").click(); else $$(".quiz-opt")[k].click(); }
    };
    const bad = [];
    const picks = [];
    for (let depth = 0, ci = 0; depth < 8; depth++) {
      replay(picks);
      if (!$(".quiz-opts")) break;
      const key = $(".quiz-opts").dataset.q, n = $$(".quiz-opt").length;
      for (let i = 0; i < n; i++) {
        replay(picks);
        const o = $$(".quiz-opt")[i], shown = +o.querySelector(".qo-n").textContent, label = o.dataset.v;
        o.click();
        let got, next = null;
        if ($(".quiz-opts")) {
          got = +$(".quiz-count b").textContent;
          next = $$(".quiz-opt").reduce((s, b) => s + +b.querySelector(".qo-n").textContent, 0);
          if (next !== got) bad.push(`after ${picks.join(",") || "nothing"} then ${key}="${label}": next question's options add up to ${next}, not ${got}`);
        } else {
          got = parseInt($(".quiz-sub b").textContent, 10);
          while ($(".quiz-more") && $$(".qr").length < 400) $(".quiz-more").click();
          const seen = $$(".qr").length;
          if (seen !== got && got <= 400) bad.push(`${picks.join(",")} → ${key}=${label}: headline says ${got} but ${seen} are listed`);
        }
        if (got !== shown) bad.push(`after ${picks.join(",") || "nothing"}: ${key}="${label}" is labelled ${shown} but gives ${got}`);
      }
      const k = choices[ci++ % choices.length] % (n + 1);
      picks.push(k === n ? -1 : k);
    }
    if (!$("#quiz").hidden) $("#quiz-close").click();
    return bad;
  }, { choices });

const answersBefore = (A, key) => Object.fromEntries(STEPS.map((k, j) => [k, j < STEPS.indexOf(key) ? A[k] : ""]));
const SKIP = { gender: "Anyone / not sure", style: "Open to everything", family: "Not sure yet", origin: "Either is fine", insp: "None in particular", budget: "Flexible", size: "Any size" };

/** Everything on every screen of one walk, compared with the rules. Returns problems (empty = fine). */
function problems(got, sim) {
  const bad = [];
  const A = sim.answers;
  if (!got.onResults) return ["did not reach the results"];
  if (got.screens.map((s) => s.key).join() !== sim.asked.map((s) => s.key).join()) return [`asked [${got.screens.map((s) => s.key)}] ≠ [${sim.asked.map((s) => s.key)}]`];
  sim.asked.forEach((e, i) => {
    const g = got.screens[i];
    if (g.counter !== e.counter) bad.push(`${e.key}: "in the running" ${g.counter} ≠ ${e.counter}`);
    if (JSON.stringify(g.opts.map((o) => [o.v, o.n])) !== JSON.stringify(e.opts.map((o) => [o.v, o.n]))) bad.push(`${e.key}: options differ`);
    if (sum(g.opts) !== g.counter) bad.push(`${e.key}: options add up to ${sum(g.opts)}, but ${g.counter} are in the running`);
    if (g.skip !== `${SKIP[e.key]} →`) bad.push(`${e.key}: skip button "${g.skip}"`);
  });
  if (!got.sub.startsWith(`${sim.total} fragrance`)) bad.push(`headline "${got.sub.slice(0, 40)}" ≠ ${sim.total}`);
  if (got.summary.join() !== sim.summary.join()) bad.push(`summary [${got.summary}] ≠ [${sim.summary}]`);
  if (sim.total <= 150 && got.cards.length !== sim.total) bad.push(`${got.cards.length} listed, expected ${sim.total}`);
  if (got.headings) bad.push("headings between the picks");
  got.cards.forEach((c, i) => {
    const e = sim.cards[i];
    if (c.slug !== e.slug) { bad.push(`pick ${i + 1}: ${c.slug} ≠ ${e.slug}`); return; }
    if (c.price !== e.price || c.spec !== e.spec) bad.push(`${c.slug}: shows "${c.price} · ${c.spec}", expected "${e.price} · ${e.spec}"`);
    if (c.chips) bad.push(`${c.slug}: leftover reason chips`);
  });
  return bad.slice(0, 4);
}

describe("Find my scent — the numbers add up", () => {
  let browser, ctx;
  before(async () => { browser = await launch(); ctx = await openCatalogue(browser); });
  after(async () => { await browser.close(); });
  const page = () => ctx.page;

  describe("your example: For him → Designer → a price band", () => {
    let got;
    before(async () => { got = await drive(page(), { answers: { gender: "Men", style: "designer", budget: "0-1000" } }); });
    const screen = (key) => got.screens.find((s) => s.key === key);

    const MEN = PRODUCTS.filter((p) => p.gd === "Men");
    const MEN_DESIGNER = MEN.filter((p) => segmentOf(p.b) === "designer");
    const MEN_DESIGNER_CHEAP = MEN_DESIGNER.filter((p) => Math.min(...p.v.map((v) => v.pr)) < 1000);
    test("For him has as many as the data has for men; the next question's options add up to exactly that", () => {
      assert.equal(screen("gender").opts.find((o) => o.v === "Men").n, MEN.length);
      assert.equal(screen("style").counter, MEN.length);
      assert.equal(sum(screen("style").opts), MEN.length);
    });

    test("Designer has as many of them as the data says; the next question's options add up to that, and so do the price bands", () => {
      assert.equal(screen("style").opts.find((o) => o.v === "designer").n, MEN_DESIGNER.length);
      assert.equal(screen("family").counter, MEN_DESIGNER.length);
      assert.equal(sum(screen("family").opts), MEN_DESIGNER.length);
      const startPrice = (p) => Math.min(...p.v.map((v) => v.pr));
      const band = (lo, hi) => MEN_DESIGNER.filter((p) => startPrice(p) >= lo && startPrice(p) < hi).length;
      assert.deepEqual(screen("budget").opts.map((o) => [o.v, o.n]), [["0-1000", band(0, 1000)], ["1000-3000", band(1000, 3000)], ["3000-6000", band(3000, 6000)], ["6000-10000", band(6000, 10000)], ["10000-999999", band(10000, Infinity)]].filter(([, n]) => n > 0));
      assert.equal(sum(screen("budget").opts), MEN_DESIGNER.length);
    });

    test("Under ₹1,000 has as many as the data says, and the list is exactly those", () => {
      assert.ok(MEN_DESIGNER_CHEAP.length >= 1);
      assert.ok(got.sub.startsWith(`${MEN_DESIGNER_CHEAP.length} ${MEN_DESIGNER_CHEAP.length === 1 ? "fragrance" : "fragrances"}`));
      assert.equal(got.cards.length, MEN_DESIGNER_CHEAP.length);
      got.cards.forEach((c) => { const p = BY_SLUG.get(c.slug); assert.equal(p.gd, "Men"); assert.ok(Math.min(...p.v.map((v) => v.pr)) < 1000, `${c.slug} should start under ₹1,000`); });
    });

    test("it all agrees with the independent rules", () => assert.deepEqual(problems(got, simulate(answerChooser({ gender: "Men", style: "designer", budget: "0-1000" }))), []));
  });

  describe("every question, every step", () => {
    test("each question's options add up to the number in the running (200 random walks, every screen)", async () => {
      const rnd = mulberry32(99), fails = [];
      for (let i = 0; i < 200 && fails.length < 4; i++) {
        const choices = Array.from({ length: 7 }, () => Math.floor(rnd() * 12));
        const got = await drive(page(), { choices });
        const bad = got.screens.filter((s) => sum(s.opts) !== s.counter).map((s) => `${s.key}: ${s.opts.map((o) => o.n).join("+")} = ${sum(s.opts)}, not ${s.counter}`);
        if (bad.length) fails.push({ choices, bad });
      }
      assert.deepEqual(fails, []);
    });

    test("each option's number equals what you get by choosing it (70 random walks, every option on every screen)", async () => {
      const rnd = mulberry32(2718), fails = [];
      for (let i = 0; i < 70 && fails.length < 3; i++) {
        const choices = Array.from({ length: 7 }, () => Math.floor(rnd() * 12));
        const bad = await clickEveryOption(page(), choices);
        if (bad.length) fails.push({ choices, bad: bad.slice(0, 3) });
      }
      assert.deepEqual(fails, []);
    });

    test("the very first question adds up to the whole catalogue", async () => {
      const got = await drive(page(), { answers: {} });
      assert.equal(sum(got.screens[0].opts), PRODUCTS.length);
      // the three tags, each with the number the data has; the "Not specified" row is there only while some perfume has no gender tag (today none lacks one)
      const untagged = PRODUCTS.filter((p) => !p.gd).length;
      assert.deepEqual(got.screens[0].opts.map((o) => [o.v, o.n]), [["Men", PRODUCTS.filter((p) => p.gd === "Men").length], ["Women", PRODUCTS.filter((p) => p.gd === "Women").length], ["Unisex", PRODUCTS.filter((p) => p.gd === "Unisex").length], ...(untagged ? [[REST, untagged]] : [])]);
    });
  });

  describe("compared with the independent rules", () => {
    test("every gender × style × family start, then skipping the rest", async () => {
      const fails = [];
      const all = (step, b) => options(step, b).map((o) => o.v);
      for (const gender of ["", ...all(0, blank())]) for (const style of ["", ...all(1, { ...blank(), gender })]) {
        for (const family of ["", ...all(2, { ...blank(), gender, style })]) {
          const want = { gender, style, family };
          const bad = problems(await drive(page(), { answers: want }), simulate(answerChooser(want)));
          if (bad.length) fails.push({ want, bad });
          if (fails.length >= 4) break;
        }
      }
      assert.deepEqual(fails, []);
    });

    test("inspired-by paths: family × origin × loved scent, with budget and size (120 random combinations)", async () => {
      const fails = [];
      const rnd = mulberry32(777), pickOne = (a) => a[Math.floor(rnd() * a.length)];
      for (let i = 0; i < 120 && fails.length < 4; i++) {
        let b = blank();
        const want = {};
        for (const [step, key] of STEPS.entries()) {
          const opts = options(step, b).map((o) => o.v);
          const v = opts.length && rnd() < 0.7 ? pickOne(opts) : "";
          if (key === "origin" && rnd() < 0.5) want.origin = "inspired";   // make the loved-scent question common
          else want[key] = v;
          b = { ...b, [key]: want[key] };
        }
        const bad = problems(await drive(page(), { answers: want }), simulate(answerChooser(want)));
        if (bad.length) fails.push({ want, bad });
      }
      assert.deepEqual(fails, []);
    });

    test("150 random walks", async () => {
      const rnd = mulberry32(31415), fails = [];
      for (let i = 0; i < 150 && fails.length < 4; i++) {
        const choices = Array.from({ length: 7 }, () => Math.floor(rnd() * 12));
        const bad = problems(await drive(page(), { choices }), simulate(randomChooser(choices)));
        if (bad.length) fails.push({ choices, bad });
      }
      assert.deepEqual(fails, []);
    });
  });

  describe("what each answer means", () => {
    test("gender: For her = only fragrances tagged for women; the other options are Men and Unisex (and Not specified, only while some perfume has no gender tag)", async () => {
      const got = await drive(page(), { answers: { gender: "Women" } });
      assert.equal(got.cards.length, PRODUCTS.filter((p) => p.gd === "Women").length);
      assert.ok(got.cards.every((c) => BY_SLUG.get(c.slug).gd === "Women"));
      assert.deepEqual(got.screens[0].opts.map((o) => o.label), ["For him", "For her", "Unisex — to share", ...(PRODUCTS.some((p) => !p.gd) ? ["Not specified"] : [])]);
    });

    test("scent family: only fragrances tagged with it, and any untagged ones are one honest row (shown only while there are some)", async () => {
      const got = await drive(page(), { answers: { family: "Oud & Woody" } });
      const oud = PRODUCTS.filter((p) => p.fm === "Oud & Woody").length, untagged = PRODUCTS.filter((p) => !p.fm).length;
      assert.equal(got.cards.length, oud);
      assert.ok(got.cards.every((c) => BY_SLUG.get(c.slug).fm === "Oud & Woody"));
      const fam = got.screens.find((s) => s.key === "family");
      assert.equal(fam.opts.find((o) => o.v === "Oud & Woody").n, oud);
      assert.equal(fam.opts.find((o) => o.v === REST)?.n ?? 0, untagged);
      assert.equal(sum(fam.opts), PRODUCTS.length);
    });

    test("style: 6 fragrances from ungrouped houses get their own row, so the three groups plus it make 627", async () => {
      const got = await drive(page(), { answers: {} });
      const style = got.screens.find((s) => s.key === "style");
      assert.deepEqual(style.opts.map((o) => [o.label, o.n]), [["Designer houses", 309], ["Luxury & niche", 90], ["Middle Eastern", 222], ["Other houses", 6]]);
    });

    test("loved scent: only asked after 'inspired by a famous scent'; lists the top houses plus 'Other classics', adding up", async () => {
      const without = await drive(page(), { answers: { style: "arabian" } });
      assert.ok(!without.screens.some((s) => s.key === "insp"));
      const got = await drive(page(), { answers: { style: "arabian", origin: "inspired" } });
      const insp = got.screens.find((s) => s.key === "insp");
      assert.equal(insp.counter, 176);
      assert.equal(sum(insp.opts), 176);
      assert.equal(insp.opts.at(-1).label, "Other classics");
      assert.ok(insp.opts.length <= 9);
    });

    test("price and size: each fragrance counts once, at its cheapest listing — and that is the listing shown", async () => {
      const got = await drive(page(), { answers: { budget: "1000-3000" } });
      for (const c of got.cards) {
        const p = BY_SLUG.get(c.slug), cheapest = Math.min(...p.v.map((v) => v.pr));
        assert.ok(cheapest >= 1000 && cheapest < 3000, `${c.slug}: cheapest is ${cheapest}`);
        assert.equal(c.price.replace(/[^\d]/g, ""), String(cheapest), `${c.slug} should show its cheapest price`);
      }
      const multi = PRODUCTS.filter((p) => new Set(p.v.map((v) => (v.pr < 1000 ? 0 : v.pr < 3000 ? 1 : v.pr < 6000 ? 2 : v.pr < 10000 ? 3 : 4))).size > 1);
      assert.ok(multi.length > 0, "the data has fragrances in more than one band — each is still counted once");
      const bands = (await drive(page(), { answers: {} })).screens.find((s) => s.key === "budget");
      assert.equal(sum(bands.opts), PRODUCTS.length);
    });

    test("skipping every question still shows the whole catalogue", async () => {
      const got = await drive(page(), { answers: {} });
      assert.ok(got.onResults);
      assert.ok(got.sub.startsWith("627 fragrances"));
      assert.equal(pool(blank()).length, 627);
    });
  });

  test("no console errors", () => assert.deepEqual(ctx.errors, []));
});

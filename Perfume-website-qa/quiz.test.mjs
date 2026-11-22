// "Find my scent": what the quiz asks, the live counts, the ranking, and the screens around it.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { SITE, PRODUCTS } from "./lib/data.mjs";
import { launch, openCatalogue } from "./lib/browser.mjs";
import { mulberry32 } from "./lib/scenarios.mjs";
import { expected as expectedRows, spec, segmentOf } from "./lib/oracle.mjs";
import { simulate, randomChooser, answerChooser, STEPS, REST } from "./lib/quiz-oracle.mjs";

/** Drive the real quiz through to its results, then read everything a visitor can see. */
const walk = (page, mode, limit = 150) =>
  page.evaluate(({ mode, limit }) => {
    const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
    const txt = (e) => e.textContent.replace(/\s+/g, " ").trim();
    $("[data-quiz]").click();
    const asked = [];
    let ci = 0;
    for (let guard = 0; guard < 20 && $(".quiz-opts"); guard++) {
      const key = $(".quiz-opts").dataset.q;
      const opts = $$(".quiz-opt").map((b) => ({ v: b.dataset.v, n: +b.querySelector(".qo-n").textContent }));
      asked.push({ key, counter: +$(".quiz-count b").textContent, opts, steps: $$("#quiz-steps span.on").length });
      let pick;
      if (mode.choices) { const k = mode.choices[ci++ % mode.choices.length] % (opts.length + 1); pick = k === opts.length ? -1 : k; }
      else pick = opts.findIndex((o) => o.v === mode.answers[key]);
      if (pick < 0) $(".quiz-skip").click(); else $$(".quiz-opt")[pick].click();
    }
    while ($$(".qr").length < limit && $(".quiz-more")) $(".quiz-more").click();   // reveal up to `limit` picks
    const sequence = $$(".qr-list > *").map((e) => "C:" + e.dataset.slug);   // nothing but result cards — no headings between them
    const cards = $$(".qr").map((e) => ({ slug: e.dataset.slug, price: txt(e.querySelector(".price")), spec: txt(e.querySelector(".qr-spec")) }));
    const out = { asked, sequence, cards, summary: $$(".quiz-summary .tag").map(txt), sub: $(".quiz-sub") ? txt($(".quiz-sub")) : "", title: txt($(".quiz-q")), onResults: !$(".quiz-opts") };
    $("#quiz-close").click();
    return out;
  }, { mode, limit });

// Compares the revealed prefix of the list (and the total in the headline) — `limit` rows unless told otherwise.
const compare = (label, got, exp, limit = 150) => {
  const bad = [];
  const gotAsked = got.asked.map((a) => a.key).join(), expAsked = exp.asked.map((a) => a.key).join();
  if (gotAsked !== expAsked) bad.push(`asked [${gotAsked}] ≠ expected [${expAsked}]`);
  else exp.asked.forEach((e, i) => {
    const g = got.asked[i];
    if (g.counter !== e.counter) bad.push(`${e.key}: "in the running" ${g.counter} ≠ ${e.counter}`);
    if (JSON.stringify(g.opts) !== JSON.stringify(e.opts)) bad.push(`${e.key}: options ${JSON.stringify(g.opts.map((o) => o.v + ":" + o.n))} ≠ ${JSON.stringify(e.opts.map((o) => o.v + ":" + o.n))}`);
    if (g.steps !== STEPS.indexOf(e.key) + 1) bad.push(`${e.key}: progress bar shows ${g.steps} segments, expected ${STEPS.indexOf(e.key) + 1}`);
  });
  if (!got.onResults) bad.push("did not reach the results screen");
  if (got.cards.length < Math.min(limit, exp.total)) bad.push(`only ${got.cards.length} picks revealed, expected at least ${Math.min(limit, exp.total)}`);
  if (got.sequence.join("|") !== exp.sequence.slice(0, got.sequence.length).join("|")) {
    const i = got.sequence.findIndex((x, k) => x !== exp.sequence[k]);
    bad.push(`result list differs at position ${i}: got ${got.sequence[i]}, expected ${exp.sequence[i]}`);
  } else {
    got.cards.forEach((c, i) => {
      const e = exp.cards[i];
      if (c.price !== e.price) bad.push(`${c.slug}: price ${c.price} ≠ ${e.price}`);
      if (c.spec !== e.spec) bad.push(`${c.slug}: size/packaging "${c.spec}" ≠ "${e.spec}"`);
    });
  }
  if (got.summary.join() !== exp.summary.join()) bad.push(`summary [${got.summary}] ≠ [${exp.summary}]`);
  if (exp.total && !got.sub.startsWith(`${exp.total} fragrance`)) bad.push(`headline says "${got.sub.slice(0, 40)}", expected ${exp.total}`);
  return bad.length ? { label, problems: bad.slice(0, 4) } : null;
};
const fmt = (fails) => fails.length ? "\n" + fails.slice(0, 6).map((f) => `  • ${f.label}\n      - ${f.problems.join("\n      - ")}`).join("\n") : "";

describe("Find my scent quiz", () => {
  let browser, ctx;
  const contexts = [];
  before(async () => { browser = await launch(); ctx = await openCatalogue(browser); contexts.push(ctx); });
  after(async () => { await browser.close(); });
  const page = () => ctx.page;

  describe("compared with the independent rules", () => {
    test("200 random walks: questions asked, option counts, live counter, ranking, headings, summary", async () => {
      const rnd = mulberry32(8675309), fails = [];
      for (let i = 0; i < 200 && fails.length < 6; i++) {
        const choices = Array.from({ length: 7 }, () => Math.floor(rnd() * 12));
        const f = compare(`walk ${i} choices=${choices}`, await walk(page(), { choices }), simulate(randomChooser(choices)));
        if (f) fails.push(f);
      }
      assert.equal(fails.length, 0, fmt(fails));
    });

    test("every answer on its own, for every option that is ever offered", async () => {
      const wants = [];
      for (const [key, values] of Object.entries({
        gender: ["Men", "Women", "Unisex", REST], style: ["designer", "luxury", "arabian", REST], origin: ["own", "inspired"],
        family: [...new Set(PRODUCTS.map((p) => p.fm).filter(Boolean)), REST], insp: [...new Set(PRODUCTS.flatMap((p) => p.ib)), REST],
        budget: ["0-1000", "1000-3000", "3000-6000", "6000-10000", "10000-999999"], size: ["Retail", "Tester", "Minis", REST],
      })) values.forEach((v) => wants.push(key === "insp" ? { origin: "inspired", insp: v } : { [key]: v }));   // the loved-scent question is only asked after "inspired"
      const fails = [];
      for (const want of wants) { const f = compare(JSON.stringify(want), await walk(page(), { answers: want }), simulate(answerChooser(want))); if (f) fails.push(f); }
      assert.equal(fails.length, 0, fmt(fails));
    });

    test("every pair of answers (all questions skipped except two)", async () => {
      const vals = { gender: ["Men", "Women", "Unisex", REST], style: ["designer", "luxury", "arabian", REST], family: ["Fresh & Citrus", "Floral", "Gourmand", "Oud & Woody", "Amber & Spicy", "Leather & Smoky", REST], origin: ["own", "inspired"], budget: ["0-1000", "1000-3000", "3000-6000", "6000-10000", "10000-999999"], size: ["Retail", "Tester", "Minis", REST] };
      const keys = Object.keys(vals), fails = [];
      for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++)
        for (const a of vals[keys[i]]) for (const b of vals[keys[j]]) {
          const want = { [keys[i]]: a, [keys[j]]: b };
          const f = compare(JSON.stringify(want), await walk(page(), { answers: want }), simulate(answerChooser(want)));
          if (f) fails.push(f);
          if (fails.length >= 6) break;
        }
      assert.equal(fails.length, 0, fmt(fails));
    });

    test("skipping every question shows the whole catalogue, ranked", async () => {
      const got = await walk(page(), { answers: {} }, Infinity), exp = simulate(answerChooser({}));   // the one full, every-row check
      assert.equal(got.cards.length, PRODUCTS.length);
      assert.equal(compare("all skipped", got, exp, Infinity), null);
    });

    test("a visitor can never end on an empty result (impossible choices are hidden)", () => {
      const rnd = mulberry32(1);
      for (let i = 0; i < 300; i++) assert.ok(simulate(randomChooser(Array.from({ length: 7 }, () => Math.floor(rnd() * 12)))).total >= 1);
    });

    test("questions that can't help are skipped: designer/luxury never ask about inspired-by", async () => {
      for (const style of ["designer", "luxury"]) {
        const r = await walk(page(), { answers: { style } });
        assert.ok(!r.asked.some((a) => a.key === "origin" || a.key === "insp"), `${style}: asked ${r.asked.map((a) => a.key)}`);
      }
      const arab = await walk(page(), { answers: { style: "arabian" } });
      assert.ok(arab.asked.some((a) => a.key === "origin"), "Middle Eastern has both kinds, so it asks");
      assert.ok(!arab.asked.some((a) => a.key === "insp"), "no loved-scent question unless you asked for an inspired-by fragrance");
      const insp = await walk(page(), { answers: { style: "arabian", origin: "inspired" } });
      assert.ok(insp.asked.some((a) => a.key === "insp"));
    });

    test("results show each fragrance's cheapest listing; budgets order the list (cheapest first, top tier priciest first)", async () => {
      simulate(answerChooser({})).ranked.forEach((r) => assert.equal(r.v.pr, Math.min(...r.p.v.map((v) => v.pr)), `${r.p.s} should show its cheapest listing`));
      const cheap = simulate(answerChooser({ budget: "1000-3000" })).ranked.map((r) => r.v.pr);
      const rich = simulate(answerChooser({ budget: "10000-999999" })).ranked.map((r) => r.v.pr);
      assert.deepEqual(cheap, [...cheap].sort((x, y) => x - y), "everyday budgets: cheapest first");
      assert.deepEqual(rich, [...rich].sort((x, y) => y - x), "top-tier budgets: priciest first");
    });
  });

  describe("on screen", () => {
    const open = async (opts) => { const c = await openCatalogue(browser, opts); ctx = c; contexts.push(c); return c.page; };
    const answer = async (p, label) => p.locator(".quiz-opt", { hasText: label }).first().click();
    const skipTo = async (p, key) => { for (let i = 0; i < 8 && (await p.locator(".quiz-opts").getAttribute("data-q").catch(() => null)) !== key; i++) await p.click(".quiz-skip"); };
    const finish = async (p) => { while (await p.locator(".quiz-opts").count()) await p.click(".quiz-skip"); };

    test("Back keeps what you chose; Skip moves on with no preference", async () => {
      const p = await open();
      await p.click("[data-quiz]");
      assert.equal(await p.locator(".quiz-count b").textContent(), "627");
      await answer(p, "For him");
      assert.equal(await p.locator(".quiz-opts").getAttribute("data-q"), "style");
      assert.notEqual(await p.locator(".quiz-count b").textContent(), "627");
      await p.click(".quiz-back");
      assert.equal(await p.locator(".quiz-opts").getAttribute("data-q"), "gender");
      assert.equal(await p.locator('.quiz-opt.on[aria-pressed="true"] .qo-label').textContent(), "For him");
      await p.click(".quiz-skip");
      assert.equal(await p.locator(".quiz-opts").getAttribute("data-q"), "style");
      assert.equal(await p.locator(".quiz-count b").textContent(), "627");
      assert.equal(await p.locator(".quiz-back").count(), 1);
    });

    test("Change my answers keeps them highlighted; Start again clears everything", async () => {
      const p = await open();
      await p.click("[data-quiz]");
      await answer(p, "For her"); await answer(p, "Middle Eastern"); await p.click(".quiz-skip");
      while (!(await p.locator(".quiz-q").first().textContent()).includes("top picks")) await p.locator(".quiz-opt").first().click();
      await p.click(".quiz-change");
      assert.equal(await p.locator(".quiz-opts").getAttribute("data-q"), "gender");
      assert.equal(await p.locator(".quiz-opt.on .qo-label").textContent(), "For her");
      await p.click(".quiz-opt.on");
      assert.equal(await p.locator(".quiz-opt.on .qo-label").textContent(), "Middle Eastern");
      while (!(await p.locator(".quiz-q").first().textContent()).includes("top picks")) await p.locator(".quiz-skip").click();
      await p.click(".quiz-restart");
      assert.equal(await p.locator(".quiz-opts").getAttribute("data-q"), "gender");
      assert.equal(await p.locator(".quiz-opt.on").count(), 0);
      assert.equal(await p.locator(".quiz-count b").textContent(), "627");
    });

    test("closing and reopening starts fresh; Esc, ✕ and the backdrop all close it; focus returns", async () => {
      const p = await open();
      await p.click("[data-quiz]");
      await answer(p, "For him");
      await p.keyboard.press("Escape");
      assert.equal(await p.locator("#quiz").isHidden(), true);
      assert.equal(await p.evaluate(() => document.activeElement.hasAttribute("data-quiz")), true, "focus should return to the button that opened the quiz");
      await p.click("[data-quiz]");
      assert.equal(await p.locator(".quiz-opt.on").count(), 0);
      assert.equal(await p.locator(".quiz-opts").getAttribute("data-q"), "gender");
      await p.click("#quiz-close"); assert.equal(await p.locator("#quiz").isHidden(), true);
      await p.click("[data-quiz]");
      await p.mouse.click(5, 5); assert.equal(await p.locator("#quiz").isHidden(), true);
    });

    test("dialog semantics: aria-modal, focus lands in the quiz, Tab stays inside", async () => {
      const p = await open();
      await p.click("[data-quiz]");
      assert.equal(await p.getAttribute("#quiz", "aria-modal"), "true");
      assert.equal(await p.evaluate(() => !!document.activeElement.closest("#quiz")), true);
      for (let i = 0; i < 12; i++) { await p.keyboard.press("Tab"); assert.equal(await p.evaluate(() => !!document.activeElement.closest("#quiz")), true, `focus escaped after ${i + 1} Tabs`); }
      assert.equal(await p.evaluate(() => document.body.classList.contains("locked")), true, "page behind should not scroll");
    });

    test("results: Show more reveals 6 at a time, with no headings between the picks", async () => {
      const p = await open();
      await p.click("[data-quiz]");
      await answer(p, "For him"); await answer(p, "Middle Eastern"); await answer(p, "Fresh & Citrus");
      while (!(await p.locator(".quiz-q").first().textContent()).includes("top picks")) await p.locator(".quiz-skip").click();
      assert.equal(await p.locator(".qr").count(), 6);
      assert.equal(await p.locator(".qr-list > :not(.qr)").count(), 0, "the list is only result cards");
      const total = parseInt(await p.locator(".quiz-sub b").textContent(), 10);
      assert.equal(total, PRODUCTS.filter((x) => x.gd === "Men" && segmentOf(x.b) === "arabian" && x.fm === "Fresh & Citrus").length);
      assert.ok(total > 12, `${total} results: enough to press Show more twice`);
      let shown = 6;
      while (shown < total) { await p.click(".quiz-more"); shown = Math.min(shown + 6, total); assert.equal(await p.locator(".qr").count(), shown, "six more each time"); }
      assert.equal(await p.locator(".quiz-more").count(), 0, "nothing left to show");
      await p.click(".quiz-restart");
      await answer(p, "Unisex");
      await finish(p);
      assert.equal(parseInt(await p.locator(".quiz-sub b").textContent(), 10), simulate(answerChooser({ gender: "Unisex" })).total);
    });

    test("add to cart from a result; the button counts; the cart gets the right variant", async () => {
      const p = await open();
      await p.click("[data-quiz]");
      await answer(p, "For him"); await answer(p, "Middle Eastern");
      while (!(await p.locator(".quiz-q").first().textContent()).includes("top picks")) await p.locator(".quiz-skip").click();
      const first = p.locator(".qr").first(), key = await first.getAttribute("data-k");
      assert.equal(await p.evaluate((k) => PX.cartQty(k), key), 0);
      await first.locator(".add").click();
      assert.equal((await first.locator(".add").textContent()).trim(), "✓");
      await first.locator(".add").click();
      assert.equal((await first.locator(".add").textContent()).trim(), "2");
      assert.equal(await p.evaluate((k) => PX.cartQty(k), key), 2);
      assert.equal(await p.locator("#cart-count").textContent(), "2");
      await p.click(".quiz-more");                               // re-rendering must keep the state
      assert.equal((await p.locator(".qr").first().locator(".add").textContent()).trim(), "2");
    });

    test("Order button and advice link carry their messages; nothing puts the number in the page", async () => {
      const p = await open();
      await p.click("[data-quiz]");
      await answer(p, "For him"); await answer(p, "Designer"); await skipTo(p, "budget"); await answer(p, "₹3,000 – ₹6,000");
      await finish(p);
      const order = await p.locator(".qr").first().locator(".order").getAttribute("data-wa-open");
      assert.match(order, /I'd like to order[\s\S]*₹[\d,]+[\s\S]*Is this available/);
      const advice = await p.locator('[data-wa-open*="scent quiz"]').getAttribute("data-wa-open");
      assert.match(advice, /For men[\s\S]*Designer houses[\s\S]*₹3,000 – ₹6,000[\s\S]*Top picks:\n1\. /);
      assert.equal((await p.content()).includes("6386609272"), false, "the WhatsApp number must not appear in the page");
    });

    test("'See all sizes' closes the quiz and shows that product with every size in the catalogue", async () => {
      const p = await open();
      await p.click("[data-quiz]");
      await answer(p, "For him"); await answer(p, "Designer");
      while (!(await p.locator(".quiz-q").first().textContent()).includes("top picks")) await p.locator(".quiz-skip").click();
      const slug = await p.locator(".qr").first().getAttribute("data-slug");
      await p.locator(".qr").first().locator(".qr-view").click();
      assert.equal(await p.locator("#quiz").isHidden(), true);
      const card = p.locator(`.card[data-slug="${slug}"]`);
      assert.equal(await card.count(), 1);
      const prod = PRODUCTS.find((x) => x.s === slug);
      assert.equal(await card.locator(".vchip").count() || 1, prod.v.length === 1 ? 1 : prod.v.length);
      // the search is by perfume name only, so the quiz searches the NAME and picks the HOUSE as a filter
      assert.equal(await p.inputValue("#q"), prod.n);
      assert.equal(await p.inputValue("#brand"), prod.b);
      const shown = await p.locator("#grid .card").evaluateAll((els) => els.map((e) => e.dataset.slug));
      const expectedSlugs = expectedRows({ q: prod.n, brand: prod.b }).map((r) => r.slug);   // the catalogue's own rule: every word of the name, in that house
      assert.ok(expectedSlugs.includes(slug));
      assert.deepEqual([...shown].sort(), [...expectedSlugs].sort(), "exactly that house's perfumes whose names contain those words");
    });

    test("opens fresh from the home page link and from ?quiz=1", async () => {
      const p = await open({ query: "?quiz=1" });
      assert.equal(await p.locator("#quiz").isVisible(), true);
      assert.equal(await p.locator(".quiz-opts").getAttribute("data-q"), "gender");
      assert.equal(await p.locator(".quiz-opt.on").count(), 0);
    });

    test("phone screen: results fit, buttons keep their size, 'See all sizes' stays on one line", async () => {
      const p = await open({ viewport: { width: 390, height: 844 } });
      await p.click("[data-quiz]");
      await answer(p, "For him"); await answer(p, "Designer"); await p.locator(".quiz-skip").click();
      while (!(await p.locator(".quiz-q").first().textContent()).includes("top picks")) await p.locator(".quiz-skip").click();
      const m = await p.evaluate(() => {
        const card = document.querySelector(".modal-card"), r = document.querySelector(".qr");
        const icon = r.querySelector(".order svg").getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(r.querySelector(".qr-view"));   // real text lines (the link itself is 44px tall for tapping)
        return { overflowX: card.scrollWidth > card.clientWidth + 1, viewLines: range.getClientRects().length, icon: Math.round(icon.width), cardRight: Math.round(r.getBoundingClientRect().right), screen: innerWidth };
      });
      assert.equal(m.overflowX, false);
      assert.equal(m.viewLines, 1, "'See all sizes' wrapped");
      assert.ok(m.icon >= 14, `WhatsApp icon squeezed to ${m.icon}px`);
      assert.ok(m.cardRight <= m.screen, "result card runs off screen");
    });
  });

  describe("pictures in the results", () => {
    const open = async (opts) => { const c = await openCatalogue(browser, { query: "?quiz=1", ...opts }); contexts.push(c); return c; };
    const VARIANTS = new Map(PRODUCTS.flatMap((p) => p.v.map((v) => [[p.s, v.m, v.p, v.r].join("|"), { p, v }])));
    const formOf = (v) => (v.g !== "Minis" ? "" : /dab/i.test(v.p) ? "dab" : /spray/i.test(v.p) ? "spray" : /vial/i.test(v.p) ? "vial" : "");
    // the picture a result should show: the cheapest size's own mini picture where it has one, else the product's photo
    const wantSrc = ({ p, v }) => { const f = formOf(v), k = f && SITE.miniPhotos.includes(`${p.s}--${f}`) ? `${p.s}--${f}` : ""; return k ? `${SITE.imageDir}minis/thumbs/${k}.jpg` : `${SITE.imageDir}thumbs/${p.s}.${SITE.imageExt}`; };
    const toResults = (page, size) => page.evaluate((size) => {
      const $ = (q) => document.querySelector(q), $$ = (q) => [...document.querySelectorAll(q)];
      for (let g = 0; g < 20 && $(".quiz-opts"); g++) {
        const o = size && $(".quiz-opts").dataset.q === "size" ? $$(".quiz-opt").find((b) => b.dataset.v === size) : null;
        if (o) o.click(); else $(".quiz-skip").click();
      }
    }, size);
    const reveal = (page, limit) => page.evaluate((limit) => { while (document.querySelectorAll(".qr").length < limit && document.querySelector(".quiz-more")) document.querySelector(".quiz-more").click(); }, limit);
    const read = (page) => page.locator(".qr").evaluateAll((els) => els.map((e) => { const th = e.querySelector(".qr-art"), im = th.querySelector("img"); return { k: e.dataset.k, src: im?.getAttribute("src"), ok: !!im?.classList.contains("ok"), alt: th.dataset.alt, imgAlt: im?.alt, box: [Math.round(th.getBoundingClientRect().width), Math.round(th.getBoundingClientRect().height)] }; }));

    test("every result shows the picture for its size: all mini results (a mini's own picture where it has one), captioned, in the usual 68px box", async () => {
      const { page } = await open();
      await toResults(page, "Minis");
      await reveal(page, 200);
      const rows = await read(page);
      assert.equal(rows.length, PRODUCTS.filter((p) => p.v.some((v) => v.g === "Minis")).length, "every product with a mini is listed");
      const bad = []; let minis = 0;
      for (const r of rows) {
        const it = VARIANTS.get(r.k), want = wantSrc(it);
        if (r.src !== want) bad.push(`${r.k}: shows ${r.src}, expected ${want}`);
        if (r.src && r.src.includes("/minis/")) { minis++; if (r.alt !== `${it.p.b} ${it.p.n} — ${spec(it.v)}` || r.imgAlt !== r.alt) bad.push(`${r.k}: caption "${r.alt}"`); }
        else if (r.alt !== `${it.p.b} ${it.p.n}`) bad.push(`${r.k}: caption "${r.alt}"`);
        if (r.box.join() !== "68,68") bad.push(`${r.k}: picture box ${r.box}`);
      }
      assert.ok(minis >= 25, `${minis} results open on a mini picture`);
      assert.deepEqual(bad, []);
    });

    test("skipping every question (everything, cheapest first): the first 150 results show the right pictures too, and the first ones have loaded in place of the bottle outline", async () => {
      const { page } = await open();
      await toResults(page);
      await reveal(page, 150);
      const rows = await read(page);
      assert.ok(rows.length >= 150);
      assert.deepEqual(rows.filter((r) => r.src !== wantSrc(VARIANTS.get(r.k))).map((r) => r.k), []);
      await page.waitForFunction(() => [...document.querySelectorAll(".qr-art img")].slice(0, 4).every((i) => i.classList.contains("ok")));
      const outline = await page.locator(".qr").first().locator(".qr-art .btl").evaluate((e) => getComputedStyle(e).display);
      assert.equal(outline, "none");
    });

    test("a result whose mini picture file is missing quietly shows the normal photo instead", async () => {
      const t = "hermes-terre-dhermes-edt--dab";
      const c = await openCatalogue(browser, { query: "?quiz=1" });          // (not tracked: a deliberate 404 is logged as an error)
      await c.page.route(`**/minis/thumbs/${t}.jpg`, (r) => r.fulfill({ status: 404, body: "" }));
      await toResults(c.page, "Minis");
      await reveal(c.page, 200);
      const row = c.page.locator('.qr[data-slug="hermes-terre-dhermes-edt"]');
      await row.scrollIntoViewIfNeeded();                                   // (pictures load as a row scrolls into view)
      await c.page.waitForFunction(() => { const i = document.querySelector('.qr[data-slug="hermes-terre-dhermes-edt"] .qr-art img'); return i && i.classList.contains("ok") && i.getAttribute("src").includes("/thumbs/hermes-terre-dhermes-edt.jpg"); }, null, { timeout: 8000 });
      assert.doesNotMatch(await row.locator(".qr-art").getAttribute("data-alt"), / — /);
      assert.equal(await row.locator(".qr-art .btl").evaluate((e) => getComputedStyle(e).display), "none");
    });

    test("the picture is not a button here: clicking it does nothing (the photo viewer belongs to the catalogue cards), and Order / See all sizes still work", async () => {
      const { page } = await open();
      await toResults(page);
      await page.locator(".qr-art").first().click();
      assert.equal(await page.locator("#lightbox").isHidden(), true);
      assert.equal(await page.locator(".qr-art").first().evaluate((e) => getComputedStyle(e).cursor), "default");
      assert.equal(await page.locator(".qr").first().locator(".add, .order, .qr-view").count(), 3);
    });

    test("on a 320px phone the picture fits, and the result rows don't spill sideways", async () => {
      const { page } = await open({ viewport: { width: 320, height: 640 }, contextOptions: { hasTouch: true, isMobile: true } });
      await toResults(page, "Minis");
      const m = await page.evaluate(() => { const card = document.querySelector(".modal-card"); return { over: card.scrollWidth > card.clientWidth + 1, boxes: [...document.querySelectorAll(".qr-art")].map((e) => Math.round(e.getBoundingClientRect().width)) }; });
      assert.equal(m.over, false);
      m.boxes.forEach((w) => assert.equal(w, 68));
    });
  });

  test("no console errors or failed requests", () => assert.deepEqual(contexts.flatMap((c) => c.errors), []));
});

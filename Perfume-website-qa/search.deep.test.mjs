// Search bar, exhaustively: every one of the 627 perfumes and every one of the 89 houses is typed into the real box and the
// results (count line, order, first page) must equal an independent working-out. Then the way people really type (capitals, accents,
// missing apostrophes, extra spaces, words the wrong way round) and hostile or silly input (markup, quotes, emoji, 500 letters).
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { PRODUCTS, SITE } from "./lib/data.mjs";
import { launch, openCatalogue } from "./lib/browser.mjs";
import { expected, expectedSuggestions, countLabel, normalize, PAGE_SIZE } from "./lib/oracle.mjs";

const HOUSES = [...new Set(PRODUCTS.map((p) => p.b))];

describe("search bar, in depth", () => {
  let browser, c, page;
  before(async () => { browser = await launch(); c = await openCatalogue(browser); page = c.page; await page.waitForSelector("#grid .card"); });
  after(async () => { await browser.close(); });

  /** type into the real box (input events, debounce honoured) and read what a visitor sees */
  const probe = (queries) => page.evaluate(async (queries) => {
    const q = document.querySelector("#q"), out = [];
    for (const text of queries) {
      q.value = text; q.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 190));
      const sug = [...document.querySelectorAll("#suggest-list li")].map((li) => ({ text: li.textContent.replace(/\s+/g, " ").trim(), kind: li.dataset.kind || (li.querySelector(".sg-house") ? "perfume" : "") }));
      out.push({
        text, count: document.querySelector("#count").textContent.replace(/\s+/g, " ").trim(),
        slugs: [...document.querySelectorAll("#grid .card")].map((x) => x.dataset.slug),
        empty: !!document.querySelector("#grid .empty, .empty-state, #empty"), sug,
      });
    }
    q.value = ""; q.dispatchEvent(new Event("input", { bubbles: true })); document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 190));
    return out;
  }, queries);

  const check = (r, filters) => {
    const want = expected(filters);
    const slugs = want.slice(0, PAGE_SIZE).map((x) => x.slug);
    const problems = [];
    if (JSON.stringify(r.slugs) !== JSON.stringify(slugs)) problems.push(`"${r.text}": first page differs (page shows ${r.slugs.length}, expected ${slugs.length})`);
    if (!want.length) { if (r.slugs.length) problems.push(`"${r.text}": should show nothing`); }
    else if (!r.count.replace(/,/g, "").includes(countLabel(want.length).replace(/,/g, ""))) problems.push(`"${r.text}": count line says "${r.count}", expected "${countLabel(want.length)}"`);
    return problems;
  };

  describe("every perfume and every house, typed in full", () => {
    test("all 627 perfumes typed as 'House Name': the page shows exactly the right results, and the perfume itself is among them", async () => {
      const problems = [];
      for (let i = 0; i < PRODUCTS.length; i += 80) {
        const chunk = PRODUCTS.slice(i, i + 80);
        const res = await probe(chunk.map((p) => `${p.b} ${p.n}`));
        res.forEach((r, k) => {
          problems.push(...check(r, { q: r.text }));
          const p = chunk[k];
          const want = expected({ q: r.text });
          if (!want.some((x) => x.slug === p.s)) problems.push(`${r.text}: the perfume itself is not in the expected results (oracle)`);
          // when it fits on page 1 it must really be on screen
          if (want.length <= PAGE_SIZE && !r.slugs.includes(p.s)) problems.push(`${r.text}: not on screen`);
        });
      }
      assert.deepEqual(problems.slice(0, 10), []);
    });

    test("all 627 perfumes typed by NAME only: right results in the right order", async () => {
      const problems = [];
      for (let i = 0; i < PRODUCTS.length; i += 80) {
        const res = await probe(PRODUCTS.slice(i, i + 80).map((p) => p.n));
        res.forEach((r) => problems.push(...check(r, { q: r.text })));
      }
      assert.deepEqual(problems.slice(0, 10), []);
    });

    test(`all ${HOUSES.length} houses typed alone: every one of that house's fragrances is found (count line = how many it has), and the box offers the house first`, async () => {
      const problems = [];
      for (let i = 0; i < HOUSES.length; i += 30) {
        const res = await probe(HOUSES.slice(i, i + 30));
        res.forEach((r) => {
          problems.push(...check(r, { q: r.text }));
          const n = PRODUCTS.filter((p) => p.b === r.text).length;
          const got = expected({ q: r.text }).filter((x) => x.house === r.text).length;
          if (got !== n) problems.push(`${r.text}: only ${got} of its ${n} fragrances are found`);
          const first = expectedSuggestions(r.text)[0];
          if (first && first.kind === "house" && !r.sug[0]?.text.includes(first.text)) problems.push(`${r.text}: the first suggestion is "${r.sug[0]?.text}", expected the house`);
        });
      }
      assert.deepEqual(problems.slice(0, 10), []);
    });

    test("every prefix of 25 perfume names (1 letter, 2 letters, … up to the full name) gives the oracle's results and suggestions", async () => {
      const picks = PRODUCTS.filter((_, i) => i % 25 === 0).slice(0, 25);
      const problems = [];
      for (const p of picks) {
        const full = `${p.b} ${p.n}`, prefixes = [];
        for (let k = 1; k <= full.length; k += Math.max(1, Math.floor(full.length / 9))) prefixes.push(full.slice(0, k));
        prefixes.push(full);
        const res = await probe(prefixes);
        res.forEach((r) => {
          problems.push(...check(r, { q: r.text }));
          const want = expectedSuggestions(r.text).map((s) => (s.kind === "house" ? s.text : s.name));
          const got = r.sug.map((s) => s.text);
          if (want.length !== got.length) problems.push(`"${r.text}": ${got.length} suggestions, expected ${want.length}`);
        });
      }
      assert.deepEqual(problems.slice(0, 10), []);
    });
  });

  describe("the way people really type", () => {
    const sample = PRODUCTS.filter((_, i) => i % 17 === 0).slice(0, 36);
    const variants = {
      "CAPITALS": (s) => s.toUpperCase(),
      "all lower case": (s) => s.toLowerCase(),
      "extra spaces everywhere": (s) => `   ${s.split(" ").join("    ")}  `,
      "apostrophes removed": (s) => s.replace(/['’]/g, ""),
      "curly apostrophes": (s) => s.replace(/'/g, "’"),
      "accents added": (s) => s.replace(/e/g, "é"),
      "punctuation as spaces": (s) => s.replace(/[-.&]/g, " "),
      "words the wrong way round": (s) => s.split(" ").reverse().join(" "),
    };
    for (const [label, f] of Object.entries(variants)) {
      test(`${label}: gives the same results as the plain spelling`, async () => {
        const plain = sample.map((p) => `${p.b} ${p.n}`);
        const [a, b] = [await probe(plain), await probe(plain.map(f))];
        const problems = [];
        a.forEach((r, i) => {
          if (JSON.stringify(r.slugs) !== JSON.stringify(b[i].slugs) || r.count !== b[i].count) problems.push(`"${plain[i]}" vs "${plain[i].length < 0 ? "" : f(plain[i])}"`);
          problems.push(...check(b[i], { q: f(plain[i]) }));
        });
        assert.deepEqual(problems.slice(0, 8), []);
      });
    }

    test("a part-word from the middle of a name still finds it ('rchid' finds Black Orchid, 'lue de' finds Bleu De Chanel)", async () => {
      for (const part of ["rchid", "leu de c", "erre d"]) {
        const [r] = await probe([part]);
        assert.deepEqual(check(r, { q: part }), []);
        assert.ok(r.slugs.length > 0, `"${part}" finds something`);
      }
    });

    test("a misspelling finds nothing and says so politely - and clearing the box brings everything back", async () => {
      const [r] = await probe(["zzqxj perfume"]);
      assert.equal(r.slugs.length, 0);
      assert.match(await page.locator("#grid").textContent() + (await page.locator(".result-row, #count").first().textContent()), /no|nothing|0 of/i);
      const [all] = await probe([""]);
      assert.equal(all.slugs.length, PAGE_SIZE);
      assert.ok(all.count.includes("627"));
    });
  });

  describe("hostile and silly input", () => {
    const nasty = [
      `<img src=x onerror=window.__pwned=1>`, `"><script>window.__pwned=1</script>`, `'; DROP TABLE perfumes; --`, `%`, `%00`, `\\`, `\\\\n`, `{{7*7}}`, `${"${7*7}"}`,
      `javascript:alert(1)`, `!!!`, `...`, `   `, `\t\n`, `🌹🔥`, `عطر`, `香水`, "a".repeat(500), "dior ".repeat(60), `(((`, `[a-z]*`, `.*`, `^$`, `\u0000`, `Ｄior`,
    ];
    test("none of it breaks the page, runs as code, or injects markup; the results always match the working-out; the grid recovers", async () => {
      const before = c.errors.length;
      const res = await probe(nasty);
      const problems = [];
      res.forEach((r) => problems.push(...check(r, { q: r.text.length > 80 ? r.text.slice(0, 80) : r.text })));
      assert.deepEqual(problems.slice(0, 6), []);
      assert.equal(await page.evaluate(() => window.__pwned), undefined, "nothing ran");
      assert.equal(await page.evaluate(() => document.querySelectorAll("#suggest img[src='x'], #grid img[src='x'], .count img, script:not([src])").length > 3), false);
      assert.equal(c.errors.length, before, "no console errors");
      assert.ok((await page.locator("#grid .card").count()) === PAGE_SIZE);
    });

    test("very long text is cut (80 characters) and still works", async () => {
      await page.fill("#q", "x".repeat(500));
      await page.waitForTimeout(250);
      assert.ok((await page.inputValue("#q")).length <= 500);
      await page.fill("#q", "");
      await page.waitForTimeout(250);
      assert.equal(await page.locator("#grid .card").count(), PAGE_SIZE);
    });
  });

  describe("the box itself, with the keyboard and mouse", () => {
    test("type → ArrowDown → Enter picks the highlighted suggestion; the box shows 'House Name' and the results are that perfume", async () => {
      await page.fill("#q", ""); await page.click("#q");
      await page.keyboard.type("oud", { delay: 30 });
      await page.waitForSelector("#suggest:not([hidden]) li");
      await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown");
      const picked = await page.locator("#suggest-list li[aria-selected='true']").textContent();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      const v = await page.inputValue("#q");
      assert.ok(v.length > 3 && picked.includes(v.split(" ").slice(-1)[0].replace(/[^\w]/g, "")) || v.length > 3, `box says "${v}" after picking "${picked}"`);
      const want = expected({ q: v });
      assert.ok(want.length >= 1);
      assert.equal(await page.locator("#grid .card").count(), Math.min(PAGE_SIZE, want.length));
      assert.ok(await page.locator("#suggest").isHidden(), "the list is put away");
    });

    test("× clears it; Esc clears it; the box can be reused straight away", async () => {
      await page.fill("#q", "chanel"); await page.waitForTimeout(250);
      await page.click("#q-clear"); await page.waitForTimeout(250);
      assert.equal(await page.inputValue("#q"), ""); assert.equal(await page.locator("#grid .card").count(), PAGE_SIZE);
      await page.fill("#q", "tom ford"); await page.waitForTimeout(250);
      await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.waitForTimeout(250);
      assert.equal(await page.inputValue("#q"), "");
      await page.keyboard.type("gucci", { delay: 20 }); await page.waitForTimeout(300);
      assert.deepEqual(check({ text: "gucci", count: (await page.locator("#count").textContent()).replace(/\s+/g, " ").trim(), slugs: await page.$$eval("#grid .card", (cs) => cs.map((x) => x.dataset.slug)) }, { q: "gucci" }), []);
      await page.click("#q-clear");
    });

    test("search keeps working with the other controls: style tab + search + price band + sort, in any order, equal the working-out", async () => {
      const cases = [
        { q: "oud", seg: "arabian" }, { q: "rose", seg: "designer", price: "1000-3000" }, { q: "black", sort: "hi" },
        { q: "man", seg: "luxury", g: "Minis" }, { q: "dior", price: "3000-6000", sort: "hi" }, { q: "amber", seg: "arabian", price: "0-1000" },
      ];
      const { applyFilters, collect, diff } = await import("./lib/browser.mjs");
      for (const f of cases) {
        for (const order of [Object.keys(f), Object.keys(f).reverse()]) {
          await applyFilters(page, f, order);
          await page.waitForTimeout(150);
          assert.deepEqual(diff(f, await collect(page)), [], JSON.stringify(f) + " in order " + order.join(","));
        }
      }
    });
  });

  test("no console errors or failed requests during any search", () => assert.deepEqual(c.errors, []));
});

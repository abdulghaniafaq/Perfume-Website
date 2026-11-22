// Homepage: the three real-photo hero cards, the "Houses we carry" scrolling brand rows, and the cart's "what you'll get"
// info icon on minis and testers.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { SITE, PRODUCTS, SITE_DIR } from "./lib/data.mjs";
import { launch, openPage, openCatalogue, collect, diff } from "./lib/browser.mjs";
import { segmentOf, normalize, spec } from "./lib/oracle.mjs";
import { auditContrast, setTheme } from "./lib/theme.mjs";

describe("homepage", () => {
  let browser;
  const opened = [];
  const home = async (opts) => { const c = await openPage(browser, "index.html", opts); opened.push(c); return c.page; };
  const PHONE = (width = 390) => ({ viewport: { width, height: 844 }, contextOptions: { hasTouch: true, isMobile: true } });
  before(async () => { browser = await launch(); });
  after(async () => { await browser.close(); });

  describe("hero: three real perfume photos", () => {
    const WANT = [
      { house: "Chanel", name: "Bleu De Chanel EDP" },
      { house: "Tom Ford", name: "Black Orchid Parfum" },
      { house: "Hermes", name: "Elixir Des Merveilles EDP" },
    ];
    const product = (w) => PRODUCTS.find((p) => p.b === w.house && p.n === w.name);

    test("exactly one Chanel, one Tom Ford and one Hermes photo, no drawn bottles left", async () => {
      const page = await home();
      const cards = await page.locator(".hero-art .hb").evaluateAll((els) => els.map((e) => ({ house: e.querySelector(".hb-cap b").textContent, name: e.querySelector(".hb-cap").textContent.replace(e.querySelector(".hb-cap b").textContent, "").trim(), src: e.querySelector("img").getAttribute("src"), svg: e.querySelectorAll("svg").length })));
      assert.equal(cards.length, 3);
      assert.deepEqual(cards.map((c) => c.house), WANT.map((w) => w.house));
      assert.deepEqual(cards.map((c) => c.name), WANT.map((w) => w.name));
      cards.forEach((c, i) => { assert.equal(c.src, `${SITE.imageDir}${product(WANT[i]).s}.jpg`); assert.equal(c.svg, 0); });
      assert.equal(await page.locator(".hero-art svg").count(), 0);
    });

    test("each card shows the photo of that exact product (the same file the catalogue uses), and the photos load", async () => {
      const page = await home();
      await page.waitForFunction(() => [...document.querySelectorAll(".hero-art img")].every((i) => i.complete && i.naturalWidth > 0));
      for (const w of WANT) {
        const p = product(w);
        assert.ok(p, `${w.house} ${w.name} exists in the catalogue`);
        assert.equal(await page.locator(`.hero-art img[src$="/${p.s}.jpg"], .hero-art img[src="${SITE.imageDir}${p.s}.jpg"]`).count(), 1, p.s);
      }
    });

    test("tapping a card opens that perfume's own page, with its name as the heading and its sizes and prices on it", async () => {
      for (const w of WANT) {
        const page = await home();
        const p = product(w);
        await page.addStyleTag({ content: ".hero-art .hb { animation: none !important; }" });   // a card that never holds still can't be "stable" for the test's click (people can tap it fine)
        await Promise.all([page.waitForURL((u) => u.pathname.endsWith(`/perfume-${p.s}.html`)), page.locator(".hero-art .hb", { hasText: w.name }).click()]);
        await page.waitForLoadState("load");
        assert.equal((await page.locator("h1").innerText()).trim(), `${p.b} ${p.n}`);
        assert.equal(await page.locator(".size").count(), p.v.length, `${w.name}: every size is listed`);
      }
    });

    test("cards are links with a readable name (house + perfume) and are reachable by keyboard", async () => {
      const page = await home();
      const links = await page.locator(".hero-art a.hb").evaluateAll((els) => els.map((e) => ({ house: e.querySelector(".hb-cap b").textContent.trim(), caption: e.querySelector(".hb-cap").textContent.replace(/\s+/g, " ").trim(), alt: e.querySelector("img").getAttribute("alt"), href: e.getAttribute("href") })));
      links.forEach((l, i) => {
        assert.ok(l.caption.includes(WANT[i].house) && l.caption.includes(WANT[i].name), `link ${i} has a readable name: "${l.caption}"`);
        assert.equal(l.alt, "", "the picture itself is decorative; the caption names it");
        assert.equal(l.href, `perfume-${product(WANT[i]).s}.html`, "opens the perfume's own page");
      });
      await page.focus(".hero-art .hb-1");
      assert.equal(await page.evaluate(() => document.activeElement.classList.contains("hb-1")), true);
    });

    for (const [label, opts] of [["a laptop", {}], ["a phone (390px)", PHONE(390)], ["a small phone (320px)", PHONE(320)]]) {
      test(`on ${label}: all three cards sit inside the screen, none cut off, no sideways scroll`, async () => {
        const page = await home(opts);
        await page.addStyleTag({ content: ".hero-art .hb { animation: none !important; }" });
        const m = await page.evaluate(() => ({ vw: innerWidth, doc: document.documentElement.scrollWidth, boxes: [...document.querySelectorAll(".hero-art .hb")].map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, w: e.offsetWidth, imgOK: e.querySelector("img").getBoundingClientRect().height > 0 }; }) }));   // (offsetWidth: the layout width, not the tilted box)
        assert.ok(m.doc <= m.vw, "no sideways scrolling");
        m.boxes.forEach((b, i) => { assert.ok(b.l >= -1 && b.r <= m.vw + 1, `card ${i} is inside the screen (${b.l}..${b.r} of ${m.vw})`); assert.ok(b.imgOK); });
        const [a, b, c] = m.boxes;
        assert.ok(Math.abs(a.w - c.w) <= 1, "side cards are the same width");
        assert.ok(b.w > a.w, "the middle card is the biggest");
      });
    }

    test("the photo cards stay readable in light mode (captions on white)", async () => {
      const page = await home({ contextOptions: { colorScheme: "light" } });
      await setTheme(page, "light");
      await page.waitForTimeout(500);
      assert.deepEqual(await auditContrast(page), []);
    });
  });

  describe("no counts on the homepage buttons and cards", () => {
    test("the main button says exactly 'Explore All Fragrances' (no number) and still opens the catalogue", async () => {
      const page = await home();
      const btn = page.locator(".hero .cta-row .btn-gold");
      assert.equal((await btn.textContent()).trim(), "Explore All Fragrances");
      assert.equal(await btn.getAttribute("href"), "catalogue.html");
      assert.doesNotMatch(await btn.textContent(), /\d/);
      await Promise.all([page.waitForURL(/catalogue\.html/), btn.click()]);
      await page.waitForLoadState("load");
      assert.match(await page.textContent("#count"), /of 627$|^1–48 of 627$|^627 fragrances$/);
    });

    test("the three style cards (Designer, Luxury & niche, Middle Eastern) show their name, a line of houses and a link - no numbers", async () => {
      const page = await home();
      const cards = await page.locator(".style-card").evaluateAll((els) => els.map((e) => ({ h: e.querySelector("h3").textContent.trim(), text: e.textContent.replace(/\s+/g, " ").trim(), count: e.querySelectorAll(".style-count, [data-seg-count]").length, href: e.getAttribute("href") })));
      assert.deepEqual(cards.map((c) => c.h), ["Designer", "Luxury & niche", "Middle Eastern"]);
      assert.deepEqual(cards.map((c) => c.href), ["catalogue.html?style=designer", "catalogue.html?style=luxury", "catalogue.html?style=arabian"]);
      cards.forEach((c) => { assert.doesNotMatch(c.text, /\d/, `${c.h}: "${c.text}"`); assert.equal(c.count, 0); });
    });

    test("the number of fragrances is not announced anywhere in the hero's buttons or the style cards", async () => {
      const page = await home();
      const text = await page.evaluate(() => [...document.querySelectorAll(".hero .cta-row, .style-grid")].map((e) => e.textContent).join(" "));
      assert.doesNotMatch(text, /627|309|222|\b90\b/);
    });
  });

  describe("Houses we carry: scrolling brand names by style", () => {
    // independent statement of what each row must contain: the 10 houses with the most fragrances in that style
    const counts = new Map();
    for (const p of PRODUCTS) counts.set(p.b, (counts.get(p.b) || 0) + 1);
    const top10 = (seg) => [...counts.keys()].filter((h) => segmentOf(h) === seg).sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b)).slice(0, 10);
    const ROWS = [["arabian", "Middle Eastern"], ["designer", "Designer"], ["luxury", "Luxury & niche"]];

    const readRows = (page) => page.locator(".brand-row").evaluateAll((rows) => rows.map((r) => ({
      style: r.dataset.style,
      label: r.querySelector(".brand-cat span").textContent.trim(),
      href: r.querySelector(".brand-cat").getAttribute("href"),
      lists: [...r.querySelectorAll(".marquee ul")].map((u) => [...u.children].map((li) => li.querySelector("img").alt)),   // each house is shown by its logo; the logo's alt text is the house name
      spoken: r.querySelector(".sr-only").textContent,
    })));

    test("three rows - Middle Eastern, Designer, Luxury & niche - each with exactly 10 houses from your product list", async () => {
      const page = await home();
      const rows = await readRows(page);
      assert.deepEqual(rows.map((r) => [r.style, r.label]), ROWS);
      for (const r of rows) {
        const want = top10(r.style);
        assert.equal(want.length, 10, `${r.style}: the data has at least 10 houses`);
        assert.deepEqual(r.lists[0], want, `${r.style}: names and order`);
        assert.equal(new Set(r.lists[0]).size, 10, `${r.style}: no repeats`);
        r.lists[0].forEach((h) => assert.equal(segmentOf(h), r.style, `${h} belongs in ${r.style}`));
        r.lists[0].forEach((h) => assert.ok(counts.has(h), `${h} is a real house in the catalogue`));
      }
      const all = rows.flatMap((r) => r.lists[0]);
      assert.equal(new Set(all).size, 30, "no house appears in two rows");
    });

    test("each row's names are written twice side by side (so the loop is seamless) and the repeat is hidden from screen readers", async () => {
      const page = await home();
      for (const r of await readRows(page)) {
        assert.equal(r.lists.length, 2);
        assert.deepEqual(r.lists[1], r.lists[0]);
      }
      assert.equal(await page.locator(".marquee").evaluateAll((els) => els.every((e) => e.getAttribute("aria-hidden") === "true")), true);
      const spoken = (await readRows(page)).map((r) => r.spoken);
      ROWS.forEach(([, label], i) => { assert.ok(spoken[i].includes(label.replace("&", "&")), spoken[i]); top10(ROWS[i][0]).forEach((h) => assert.ok(spoken[i].includes(h))); });
    });

    describe("logos", () => {
      const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const dir = path.join(SITE_DIR, SITE.imageDir, "brands");
      const shownHouses = ROWS.flatMap(([k]) => top10(k));
      const md5 = (f) => crypto.createHash("md5").update(fs.readFileSync(f)).digest("hex");

      test("one logo file per shown house (30), none left over, and each is the checked one (fingerprint)", () => {
        const manifest = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "logo-manifest.json"), "utf8"));
        const files = fs.readdirSync(dir).sort();
        assert.deepEqual(files, shownHouses.map((h) => slug(h) + ".jpg").sort());
        assert.deepEqual(Object.keys(manifest).sort(), shownHouses.map(slug).sort());
        const changed = shownHouses.filter((h) => md5(path.join(dir, slug(h) + ".jpg")) !== manifest[slug(h)]);
        assert.deepEqual(changed, [], "these logos differ from the checked set — if you changed them on purpose, run: node lib/make-logo-manifest.mjs");
      });

      test("every logo on the page is that house's file, loads, is sharp (2× its on-screen size) and sits on a white tile", async () => {
        const page = await home();
        await page.waitForFunction(() => [...document.querySelectorAll(".brand-logo img")].every((i) => i.complete && i.naturalWidth > 0));
        const imgs = await page.locator(".brand-logo img").evaluateAll((els) => els.map((i) => ({ alt: i.alt, src: i.getAttribute("src"), nw: i.naturalWidth, nh: i.naturalHeight, w: +i.getAttribute("width"), h: +i.getAttribute("height"), bg: getComputedStyle(i.parentElement).backgroundColor, drawn: [Math.round(i.getBoundingClientRect().width), Math.round(i.getBoundingClientRect().height)], exact: i.getBoundingClientRect().width / i.getBoundingClientRect().height })));
        assert.equal(imgs.length, 60, "30 logos, each written twice for the seamless loop");
        for (const i of imgs) {
          assert.equal(i.src, `${SITE.imageDir}brands/${slug(i.alt)}.jpg`, `${i.alt}: the file belongs to that house`);
          assert.ok(Math.abs(i.nw - 2 * i.w) <= 1 && Math.abs(i.nh - 2 * i.h) <= 1, `${i.alt}: file is ${i.nw}x${i.nh}, page expects ${2 * i.w}x${2 * i.h}`);
          assert.ok(Math.abs(i.drawn[0] - i.w) <= 1 && Math.abs(i.drawn[1] - i.h) <= 1, `${i.alt}: drawn ${i.drawn} but its own size is ${i.w}x${i.h} (stretched or shrunk)`);   // (the browser keeps the file's exact proportions, so a half-pixel can differ)
          assert.ok(Math.abs(i.exact / (i.nw / i.nh) - 1) < 0.01, `${i.alt}: proportions kept (drawn ${i.exact.toFixed(3)}, file ${(i.nw / i.nh).toFixed(3)})`);
          assert.equal(i.bg, "rgb(255, 255, 255)", `${i.alt}: on a white tile (the logos are drawn on white)`);
        }
      });

      test("logos are small files (a phone loads all 30 in well under 300 KB)", () => {
        const total = fs.readdirSync(dir).reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
        assert.ok(total < 300 * 1024, `${Math.round(total / 1024)} KB`);
      });
    });

    test("each heading links to that style in the catalogue, which opens on exactly that style", async () => {
      const page = await home();
      const rows = await readRows(page);
      assert.deepEqual(rows.map((r) => r.href), ROWS.map(([k]) => `catalogue.html?style=${k}`));
      for (const [k] of ROWS) {
        const p2 = await home();
        await Promise.all([p2.waitForURL(/catalogue\.html/), p2.locator(`.brand-row[data-style="${k}"] .brand-cat`).click()]);
        await p2.waitForLoadState("load");
        await p2.waitForTimeout(200);
        assert.deepEqual(diff({ seg: k }, await collect(p2)), [], k);
      }
    });

    test("the houses stat in the intro is the real number of houses", async () => {
      const page = await home();
      assert.equal(await page.textContent(".brands [data-stat='houses']"), String(new Set(PRODUCTS.map((p) => p.b)).size));
    });

    test("it moves: each track is animating, neighbouring rows run in opposite directions, at different speeds", async () => {
      const page = await home();
      const a = await page.locator(".marquee-track").evaluateAll((els) => els.map((e) => { const s = getComputedStyle(e); return { name: s.animationName, dir: s.animationDirection, state: s.animationPlayState, dur: s.animationDuration }; }));
      a.forEach((x) => { assert.equal(x.name, "marquee"); assert.equal(x.state, "running"); });
      assert.deepEqual(a.map((x) => x.dir), ["normal", "reverse", "normal"]);
      assert.equal(new Set(a.map((x) => x.dur)).size, 3);
      const x1 = await page.locator(".marquee-track").first().evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).m41);
      await page.waitForTimeout(700);
      const x2 = await page.locator(".marquee-track").first().evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).m41);
      assert.notEqual(x1, x2, "the first row has moved");
    });

    test("Pause / Play button stops and restarts every row, says which it is, and is a 44px target", async () => {
      const page = await home();
      const state = () => page.locator(".marquee-track").evaluateAll((els) => els.map((e) => getComputedStyle(e).animationPlayState));
      const btn = page.locator("#brands-pause");
      assert.equal((await btn.textContent()).trim(), "Pause");
      assert.ok((await btn.boundingBox()).height >= 44);
      await btn.click();
      assert.deepEqual(await state(), ["paused", "paused", "paused"]);
      assert.equal((await btn.textContent()).trim(), "Play");
      await page.waitForTimeout(200);                      // the frame already being drawn when Pause was pressed finishes first
      const x1 = await page.locator(".marquee-track").first().evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).m41);
      await page.waitForTimeout(600);
      assert.equal(await page.locator(".marquee-track").first().evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).m41), x1, "nothing moves while paused");
      await btn.click();
      assert.deepEqual(await state(), ["running", "running", "running"]);
      assert.equal((await btn.textContent()).trim(), "Pause");
    });

    test("a row pauses while the mouse is over it", async () => {
      const page = await home();
      await page.locator(".brand-row").nth(1).scrollIntoViewIfNeeded();
      await page.locator(".brand-row").nth(1).locator(".marquee").hover();
      assert.equal(await page.locator(".marquee-track").nth(1).evaluate((e) => getComputedStyle(e).animationPlayState), "paused");
      assert.equal(await page.locator(".marquee-track").nth(0).evaluate((e) => getComputedStyle(e).animationPlayState), "running", "only that row");
    });

    test("for people who ask their device for less motion: nothing scrolls, each row is a still, centred list of the same 10 names", async () => {
      const page = await home({ contextOptions: { reducedMotion: "reduce" } });
      const info = await page.evaluate(() => ({
        anim: [...document.querySelectorAll(".marquee-track")].map((e) => getComputedStyle(e).animationName),
        second: [...document.querySelectorAll(".marquee ul + ul")].map((e) => getComputedStyle(e).display),
        toggle: getComputedStyle(document.querySelector("#brands-pause")).display,
        shown: [...document.querySelectorAll(".brand-row")].map((r) => [...r.querySelector(".marquee ul").children].map((li) => li.getBoundingClientRect().width > 0 && li.getBoundingClientRect().right <= innerWidth + 1).every(Boolean)),
        doc: document.documentElement.scrollWidth, vw: innerWidth,
      }));
      assert.deepEqual(info.anim, ["none", "none", "none"]);
      assert.deepEqual(info.second, ["none", "none", "none"]);
      assert.equal(info.toggle, "none", "no Pause button when nothing moves");
      assert.deepEqual(info.shown, [true, true, true], "every name is visible inside the screen");
      assert.ok(info.doc <= info.vw);
    });

    for (const [label, opts] of [["a laptop", {}], ["a phone (390px)", PHONE(390)], ["a small phone (320px)", PHONE(320)]]) {
      test(`on ${label}: rows stay inside the page (no sideways scroll); every logo tile is the same height and no logo is shrunk to nothing`, async () => {
        const page = await home(opts);
        const m = await page.evaluate(() => ({ vw: innerWidth, doc: document.documentElement.scrollWidth, tiles: [...document.querySelectorAll(".brand-logo")].map((e) => Math.round(e.getBoundingClientRect().height)), logo: Math.min(...[...document.querySelectorAll(".brand-logo img")].map((e) => e.getBoundingClientRect().height)), rows: [...document.querySelectorAll(".marquee")].map((e) => e.getBoundingClientRect().right) }));
        assert.ok(m.doc <= m.vw, "no sideways scrolling");
        assert.equal(new Set(m.tiles).size, 1, `tiles are all one height (${[...new Set(m.tiles)]})`);
        assert.ok(m.logo >= 16, `the thinnest logo is still at least 16px tall (got ${m.logo})`);
        m.rows.forEach((r) => assert.ok(r <= m.vw + 1));
      });
    }

    for (const theme of ["dark", "light"]) {
      test(`${theme} mode: every word in the brands section is readable`, async () => {
        const page = await home({ contextOptions: { colorScheme: theme } });
        await setTheme(page, theme);
        await page.addStyleTag({ content: ".marquee-track { animation: none !important; }" });
        await page.waitForTimeout(500);
        assert.deepEqual(await auditContrast(page), []);
      });
    }
  });

  describe("cart: an i icon on minis and testers says what you will actually get", () => {
    const variants = PRODUCTS.flatMap((p) => p.v.map((v) => ({ p, v })));
    const pick = (pred) => variants.find(pred);
    const SAMPLES = {
      "Mini (Spray)": pick((x) => x.v.p === "Mini (Spray)"),
      "Mini (Dab)": pick((x) => x.v.p === "Mini (Dab)"),
      Vial: pick((x) => x.v.p === "Vial"),
      "Roller Ball": pick((x) => x.v.p === "Roller Ball"),
      "Mini Kit": pick((x) => x.v.p === "Mini Kit"),
      Tester: pick((x) => x.v.g === "Tester"),
      Retail: pick((x) => x.v.g === "Retail"),
      "Gift Set": pick((x) => x.v.p === "Gift Set"),
    };
    const keyOf = (x) => [x.p.s, x.v.m, x.v.p, x.v.r].join("|");
    // the picture the cart should show for an item: a mini's own picture when it has one (listed in the config), else the perfume's photo
    const miniForm = (v) => (v.g !== "Minis" ? "" : /dab/i.test(v.p) ? "dab" : /spray/i.test(v.p) ? "spray" : /vial/i.test(v.p) ? "vial" : "");
    const ownKey = (p, v) => (miniForm(v) && SITE.miniPhotos.includes(`${p.s}--${miniForm(v)}`) ? `${p.s}--${miniForm(v)}` : "");
    const cartWith = async (page, xs) => { await page.evaluate((keys) => keys.forEach((k) => PX.addToCart(k)), xs.map(keyOf)); await page.click("#cart-open"); await page.waitForSelector("#cart.open"); };
    const line = (page, x) => page.locator(`.line[data-k="${keyOf(x)}"]`);

    test("test data assumption: the catalogue has every kind of mini we check", () => {
      for (const [k, x] of Object.entries(SAMPLES)) assert.ok(x, `a ${k} exists`);
    });

    test("every variant of every product: the icon is there for minis (spray, dab, vial, roller, kit) and testers - and for nothing else", async () => {
      const page = await home();
      // the real rule, checked across the whole catalogue in the page itself
      const wrong = await page.evaluate(() => {
        const bad = [];
        for (const p of PRODUCTS) for (const v of p.v) {
          PX.addToCart(PX.keyOf(p, v));
          const key = PX.keyOf(p, v);
          const row = document.querySelector(`.line[data-k="${CSS.escape(key)}"]`);
          const has = !!row.querySelector("[data-info]");
          const should = v.g === "Tester" || v.g === "Minis";
          if (has !== should) bad.push(`${p.b} ${p.n} / ${v.p} ${v.m}: icon ${has ? "shown" : "missing"}`);
          PX.removeFromCart ? PX.removeFromCart(key) : document.querySelector(`.line[data-k="${CSS.escape(key)}"] [data-remove]`).click();
          if (bad.length > 8) break;
        }
        return bad;
      });
      assert.deepEqual(wrong, []);
    });

    test("tapping the i shows the note (named for the kind of item) and tapping again hides it", async () => {
      const page = await home();
      const spray = SAMPLES["Mini (Spray)"], dab = SAMPLES["Mini (Dab)"], vial = SAMPLES.Vial, tester = SAMPLES.Tester;
      await cartWith(page, [spray, dab, vial, tester]);
      const want = [[spray, /travel spray/i], [dab, /dab-on bottle.*no spray/i], [vial, /sample vial/i], [tester, /tester/i]];
      for (const [x, re] of want) {
        const l = line(page, x);
        assert.equal(await l.locator(".line-info").isHidden(), true, "closed to begin with");
        assert.equal(await l.locator("[data-info]").getAttribute("aria-expanded"), "false");
        await l.locator("[data-info]").click();
        assert.equal(await l.locator(".line-info").isVisible(), true);
        assert.equal(await l.locator("[data-info]").getAttribute("aria-expanded"), "true");
        const text = await l.locator(".line-info").textContent();
        assert.match(text, /^What you'll get:/);
        assert.match(text, re, `${x.p.n} / ${x.v.p}`);
        if (x.v.g === "Minis") assert.match(text, ownKey(x.p, x.v) ? /The photo shows the mini you will receive/ : /not the full-size bottle shown in the photo/);
        if (ownKey(x.p, x.v)) assert.doesNotMatch(text, /not the full-size bottle/, "the photo IS the mini, so it must not say otherwise");
        if (x.v.m && x.v.g === "Minis" && /spray|dab/i.test(x.v.p)) assert.ok(text.includes(x.v.m.replace(/\s+/g, "")), `the size (${x.v.m}) is stated`);
        await l.locator("[data-info]").click();
        assert.equal(await l.locator(".line-info").isHidden(), true);
      }
    });

    test("the note is tied to its icon for screen readers (aria-controls / aria-expanded / a name that says which item)", async () => {
      const page = await home();
      const x = SAMPLES["Mini (Dab)"];
      await cartWith(page, [x]);
      const btn = line(page, x).locator("[data-info]");
      const id = await btn.getAttribute("aria-controls");
      assert.equal(await page.locator(`#${id}`).count(), 1);
      assert.match(await btn.getAttribute("aria-label"), /What you'll get/);
      assert.ok((await btn.getAttribute("aria-label")).includes(x.v.p));
    });

    test("the icon is a 44px tap target and works from the keyboard (Enter and Space)", async () => {
      const page = await home(PHONE());
      const x = SAMPLES["Mini (Spray)"];
      await cartWith(page, [x]);
      const b = await line(page, x).locator("[data-info]").boundingBox();
      assert.ok(b.width >= 44 && b.height >= 44, `${b.width}x${b.height}`);
      await line(page, x).locator("[data-info]").focus();
      await page.keyboard.press("Enter");
      assert.equal(await line(page, x).locator(".line-info").isVisible(), true);
      await page.keyboard.press("Space");
      assert.equal(await line(page, x).locator(".line-info").isHidden(), true);
    });

    test("no icon on a normal bottle or a gift set", async () => {
      const page = await home();
      await cartWith(page, [SAMPLES.Retail, SAMPLES["Gift Set"]]);
      assert.equal(await page.locator("[data-info]").count(), 0);
      assert.equal(await page.locator(".line-info").count(), 0);
    });

    test("an open note stays open when the quantity changes, and is gone when the line is removed", async () => {
      const page = await home();
      const a = SAMPLES["Mini (Spray)"], b = SAMPLES.Tester;
      await cartWith(page, [a, b]);
      await line(page, a).locator("[data-info]").click();
      await line(page, a).locator("[data-inc]").click();
      assert.equal(await line(page, a).locator(".line-info").isVisible(), true, "still open after +");
      assert.equal(await line(page, b).locator(".line-info").isHidden(), true, "the other one is still closed");
      await line(page, a).locator("[data-remove]").click();
      assert.equal(await line(page, a).count(), 0);
      await page.evaluate((k) => PX.addToCart(k), keyOf(a));
      assert.equal(await line(page, a).locator(".line-info").isHidden(), true, "added again later: closed, not stuck open");
    });

    test("the note never goes into the WhatsApp order message or the total", async () => {
      const page = await home();
      const xs = [SAMPLES["Mini (Spray)"], SAMPLES.Tester];
      await cartWith(page, xs);
      await line(page, xs[0]).locator("[data-info]").click();
      const msg = await page.getAttribute("#checkout", "data-wa-open");
      assert.doesNotMatch(msg, /What you'll get|full-size bottle|sample/i);
      assert.match(msg, new RegExp(xs[0].p.n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.equal(await page.textContent("#cart-total"), "₹" + (xs[0].v.pr + xs[1].v.pr).toLocaleString("en-IN"));
    });

    test("it also works from the catalogue page's cart, and the cart still shows the note after a reload", async () => {
      const c = await openCatalogue(browser); opened.push(c);
      const x = SAMPLES["Mini (Dab)"];
      await cartWith(c.page, [x]);
      await line(c.page, x).locator("[data-info]").click();
      assert.equal(await line(c.page, x).locator(".line-info").isVisible(), true);
      await c.page.reload();
      await c.page.click("#cart-open");
      assert.equal(await line(c.page, x).locator("[data-info]").count(), 1);
      assert.equal(await line(c.page, x).locator(".line-info").isHidden(), true, "a note starts closed on a fresh page");
    });

    describe("hovering the i shows the note by itself", () => {
      const note = (page, x) => line(page, x).locator(".line-info");
      const icon = (page, x) => line(page, x).locator("[data-info]");

      test("mouse over the i opens it, moving away closes it - for every kind of mini and for testers", async () => {
        const page = await home();
        const xs = [SAMPLES["Mini (Spray)"], SAMPLES["Mini (Dab)"], SAMPLES.Vial, SAMPLES["Roller Ball"], SAMPLES["Mini Kit"], SAMPLES.Tester];
        await cartWith(page, xs);
        await page.mouse.move(2, 2);
        for (const x of xs) {
          assert.equal(await note(page, x).isHidden(), true, `${x.v.p}: closed to begin with`);
          await icon(page, x).hover();
          assert.equal(await note(page, x).isVisible(), true, `${x.v.p}: opens on hover`);
          assert.equal(await icon(page, x).getAttribute("aria-expanded"), "true");
          assert.match(await note(page, x).textContent(), /^What you'll get:/);
          await page.mouse.move(2, 2);
          assert.equal(await note(page, x).isHidden(), true, `${x.v.p}: closes when the mouse leaves`);
          assert.equal(await icon(page, x).getAttribute("aria-expanded"), "false");
        }
      });

      test("hovering one i opens only that item's note", async () => {
        const page = await home();
        const a = SAMPLES["Mini (Spray)"], b = SAMPLES.Tester;
        await cartWith(page, [a, b]);
        await icon(page, a).hover();
        assert.equal(await note(page, a).isVisible(), true);
        assert.equal(await note(page, b).isHidden(), true);
        await icon(page, b).hover();
        assert.equal(await note(page, a).isHidden(), true, "the first one closed as the mouse left it");
        assert.equal(await note(page, b).isVisible(), true);
      });

      test("a click while hovering keeps it open after the mouse leaves; a second click closes it straight away", async () => {
        const page = await home();
        const x = SAMPLES.Tester;
        await cartWith(page, [x]);
        await icon(page, x).hover();
        await icon(page, x).click();
        await page.mouse.move(2, 2);
        assert.equal(await note(page, x).isVisible(), true, "pinned open");
        await icon(page, x).hover();
        await icon(page, x).click();
        assert.equal(await note(page, x).isHidden(), true, "closed even though the mouse is still on the icon");
        await page.mouse.move(2, 2);
        await icon(page, x).hover();
        assert.equal(await note(page, x).isVisible(), true, "and hovering again shows it again");
      });

      test("a touch screen has no hover: a tap opens it, a second tap closes it, and the tap never gets stuck", async () => {
        const page = await home(PHONE());
        const x = SAMPLES["Mini (Dab)"];
        await cartWith(page, [x]);
        assert.equal(await note(page, x).isHidden(), true);
        await icon(page, x).tap();
        assert.equal(await note(page, x).isVisible(), true);
        await page.locator(".cart-head h2").tap();
        assert.equal(await note(page, x).isVisible(), true, "stays open after tapping elsewhere (it was kept open)");
        await icon(page, x).tap();
        assert.equal(await note(page, x).isHidden(), true);
      });

      test("keyboard: tabbing onto the i shows the note, tabbing off hides it, Enter keeps it open", async () => {
        const page = await home();
        const x = SAMPLES["Mini (Spray)"];
        await cartWith(page, [x]);
        await page.focus("#cart-close");
        await page.keyboard.press("Tab");
        assert.equal(await page.evaluate(() => document.activeElement.hasAttribute("data-info")), true, "the i is the next stop in the cart");
        assert.equal(await note(page, x).isVisible(), true, "shown on keyboard focus");
        await page.keyboard.press("Tab");
        assert.equal(await note(page, x).isHidden(), true, "hidden once focus moves on");
        await page.keyboard.press("Shift+Tab");
        assert.equal(await note(page, x).isVisible(), true);
        await page.keyboard.press("Enter");
        await page.keyboard.press("Tab");
        assert.equal(await note(page, x).isVisible(), true, "Enter kept it open");
      });
    });

    describe("each cart item shows the perfume's photo", () => {
      const art = (page, x) => line(page, x).locator(".line-art");

      test("every size of every perfume shows the right picture: a mini with its own picture shows that mini, everything else shows the perfume's photo", async () => {
        const page = await home();
        // worked out here, not by the page: [cart key, expected file] for every size of every perfume
        const cases = PRODUCTS.flatMap((p) => p.v.map((v) => [keyOf({ p, v }), ownKey(p, v) ? `${SITE.imageDir}minis/thumbs/${ownKey(p, v)}.jpg` : `${SITE.imageDir}thumbs/${p.s}.${SITE.imageExt}`, `${p.b} ${p.n} / ${spec(v)}`]));
        const wrong = await page.evaluate((cases) => {
          const bad = [];
          for (const [key, want, label] of cases) {
            PX.addToCart(key);
            const row = document.querySelector(`.line[data-k="${CSS.escape(key)}"]`);
            const img = row.querySelector(".line-art img");
            if (!img || img.getAttribute("src") !== want) bad.push(`${label}: ${img ? img.getAttribute("src") : "no photo"} (wanted ${want})`);
            row.querySelector("[data-remove]").click();
            if (bad.length > 8) break;
          }
          return bad;
        }, cases);
        assert.deepEqual(wrong, []);
        assert.ok(cases.filter((c) => c[1].includes("/minis/")).length === SITE.miniPhotos.length, "every one of the 32 mini pictures is reached from the cart");
      });

      test("a mini's own picture loads in the cart (real 240px file), and the item next to it (full size) keeps the normal photo", async () => {
        const page = await home();
        const mini = [...SITE.miniPhotos].map((k) => { const [slug, form] = k.split("--"); const p = PRODUCTS.find((x) => x.s === slug); return { p, v: p.v.find((v) => miniForm(v) === form), k }; })[0];
        const full = SAMPLES.Retail;
        await cartWith(page, [mini, full]);
        await page.waitForFunction(() => document.querySelectorAll(".line-art img.ok").length === 2);
        assert.ok((await art(page, mini).locator("img").getAttribute("src")).endsWith(`/minis/thumbs/${mini.k}.jpg`));
        assert.equal(await art(page, mini).locator("img").evaluate((i) => i.naturalWidth), 240);
        assert.ok((await art(page, full).locator("img").getAttribute("src")).endsWith(`/thumbs/${full.p.s}.jpg`));
        // the same perfume in two forms: each line has its own picture
        const sameP = PRODUCTS.find((p) => ownKey(p, p.v.find((v) => miniForm(v) === "dab") || {}) && p.v.some((v) => v.g === "Retail"));
        if (sameP) {
          const a = { p: sameP, v: sameP.v.find((v) => miniForm(v) === "dab") }, b = { p: sameP, v: sameP.v.find((v) => v.g === "Retail") };
          await cartWith(page, [a, b]);
          await page.waitForFunction(() => document.querySelectorAll(".line-art img.ok").length === 4);
          assert.notEqual(await art(page, a).locator("img").getAttribute("src"), await art(page, b).locator("img").getAttribute("src"));
        }
      });

      test("if a mini's picture file is missing on the server, the cart shows the perfume's normal photo instead (no broken image)", async () => {
        const t = SITE.miniPhotos[0], [slug, form] = t.split("--");
        const p = PRODUCTS.find((x) => x.s === slug), x = { p, v: p.v.find((v) => miniForm(v) === form) };
        const c = await openPage(browser, "index.html");
        await c.page.route(`**/minis/thumbs/${t}.jpg`, (r) => r.fulfill({ status: 404, body: "" }));
        await cartWith(c.page, [x]);
        await c.page.waitForFunction((s) => document.querySelector(".line-art img.ok")?.getAttribute("src")?.endsWith(`/thumbs/${s}.jpg`), slug);
        assert.equal(await c.page.locator(".line-art img").count(), 1);
      });

      test("the photo loads, fills the picture box on white, replaces the bottle outline, and stays through + / −", async () => {
        const page = await home();
        const xs = [SAMPLES["Mini (Spray)"], SAMPLES.Tester, SAMPLES.Retail];
        await cartWith(page, xs);
        await page.waitForFunction((n) => document.querySelectorAll(".line-art img.ok").length === n, xs.length);
        for (const x of xs) {
          const m = await art(page, x).evaluate((el) => { const i = el.querySelector("img"), r = el.getBoundingClientRect(), ir = i.getBoundingClientRect(); return { nw: i.naturalWidth, bg: getComputedStyle(el).backgroundColor, outline: getComputedStyle(el.querySelector(".btl")).display, box: [Math.round(r.width), Math.round(r.height)], within: ir.left >= r.left - 1 && ir.right <= r.right + 1 && ir.top >= r.top - 1 && ir.bottom <= r.bottom + 1, ratio: +(i.naturalWidth / i.naturalHeight).toFixed(2) }; });
          assert.equal(m.nw, 240); assert.equal(m.ratio, 1, "square photo, not stretched");
          assert.equal(m.bg, "rgb(255, 255, 255)"); assert.equal(m.outline, "none"); assert.deepEqual(m.box, [64, 72]); assert.equal(m.within, true);
        }
        await line(page, xs[0]).locator("[data-inc]").click();
        await line(page, xs[0]).locator("[data-dec]").click();
        assert.equal(await art(page, xs[0]).locator("img.ok").count(), 1, "still showing after the cart redraws");
      });

      test("a perfume with no photo (listed in noPhoto) keeps the bottle outline and asks for no file", async () => {
        const x = SAMPLES.Retail;
        const c = await openPage(browser, "index.html", { siteConfig: (t) => t.replace(/noPhoto:\s*\[[^\]]*\]/, `noPhoto: ["${x.p.s}"]`) });
        const asked = []; c.page.on("request", (r) => /thumbs\//.test(r.url()) && asked.push(r.url()));
        await cartWith(c.page, [x]);
        assert.equal(await art(c.page, x).locator("img").count(), 0);
        assert.notEqual(await art(c.page, x).locator(".btl").evaluate((e) => getComputedStyle(e).display), "none");
        assert.deepEqual(asked.filter((u) => u.includes(x.p.s)), []);
        assert.deepEqual(c.errors, []);
      });

      test("if a photo file is missing on the server, the item quietly keeps its bottle outline", async () => {
        const x = SAMPLES.Retail;
        const c = await openPage(browser, "index.html");
        await c.page.route(`**/thumbs/${x.p.s}.jpg`, (r) => r.fulfill({ status: 404, body: "" }));
        await cartWith(c.page, [x]);
        await c.page.waitForFunction((k) => !document.querySelector(`.line[data-k="${CSS.escape(k)}"] .line-art img`), keyOf(x));
        assert.notEqual(await art(c.page, x).locator(".btl").evaluate((e) => getComputedStyle(e).display), "none");
        assert.equal(await c.page.locator(".line-name").count(), 1, "the cart is otherwise normal");
      });

      test("the photo is also in the catalogue page's cart and the picture box is the same size on a small phone", async () => {
        const c = await openCatalogue(browser, PHONE(320)); opened.push(c);
        const x = SAMPLES["Mini (Dab)"];
        await cartWith(c.page, [x]);
        await c.page.waitForSelector(".line-art img.ok");
        assert.deepEqual(await art(c.page, x).evaluate((e) => [Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)]), [64, 72]);
      });
    });

    for (const [label, opts] of [["a laptop", {}], ["a small phone (320px)", PHONE(320)]]) {
      test(`on ${label}: the open note fits inside the cart, below its item, and the cart doesn't scroll sideways`, async () => {
        const page = await home(opts);
        const x = SAMPLES.Tester;
        await cartWith(page, [x]);
        await line(page, x).locator("[data-info]").click();
        const m = await page.evaluate((k) => {
          const cart = document.querySelector("#cart").getBoundingClientRect(), body = document.querySelector(".cart-body");
          const l = document.querySelector(`.line[data-k="${CSS.escape(k)}"]`), n = l.querySelector(".line-info").getBoundingClientRect(), r = l.querySelector(".qty").getBoundingClientRect();
          return { inside: n.left >= cart.left - 1 && n.right <= cart.right + 1, below: n.top >= r.bottom - 1, sideways: body.scrollWidth > body.clientWidth + 1, icon: l.querySelector("[data-info]").getBoundingClientRect() };
        }, keyOf(x));
        assert.equal(m.inside, true);
        assert.equal(m.below, true);
        assert.equal(m.sideways, false);
      });
    }

    for (const theme of ["dark", "light"]) {
      test(`${theme} mode: the icon and the open note are readable`, async () => {
        const page = await home({ contextOptions: { colorScheme: theme } });
        await setTheme(page, theme);
        const xs = [SAMPLES["Mini (Spray)"], SAMPLES.Tester];
        await cartWith(page, xs);
        for (const x of xs) await line(page, x).locator("[data-info]").click();
        await page.waitForTimeout(500);
        assert.deepEqual(await auditContrast(page), []);
      });
    }
  });

  test("no console errors or failed requests on the homepage", () => assert.deepEqual(opened.flatMap((o) => o.errors), []));
});

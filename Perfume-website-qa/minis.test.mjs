// Mini pictures (spray / dab / vial). The card's picture follows the selected size, from the very first moment: a card whose
// pre-selected size is a mini with its own picture opens on that picture; tapping another size shows that size's picture (the normal
// photo, or its own mini picture) and tapping back restores it. Enlarging the photo shows the picture for the selected size.
// Everything else is unchanged.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { SITE, PRODUCTS, SITE_DIR } from "./lib/data.mjs";
import { launch, openCatalogue, applyFilters } from "./lib/browser.mjs";
import { spec } from "./lib/oracle.mjs";

const dir = path.join(SITE_DIR, SITE.imageDir, "minis");
const KEYS = SITE.miniPhotos;
const md5 = (f) => crypto.createHash("md5").update(fs.readFileSync(f)).digest("hex");
const formOf = (v) => (v.g !== "Minis" ? "" : /dab/i.test(v.p) ? "dab" : /spray/i.test(v.p) ? "spray" : /vial/i.test(v.p) ? "vial" : "");
const keyFor = (p, v) => (formOf(v) && KEYS.includes(`${p.s}--${formOf(v)}`) ? `${p.s}--${formOf(v)}` : "");
// every (product, variant) the pictures are meant for, worked out from the config
const TARGETS = KEYS.map((k) => {
  const [slug, form] = k.split("--");
  const p = PRODUCTS.find((x) => x.s === slug);
  const v = p && p.v.find((x) => formOf(x) === form);
  return { k, slug, form, p, v };
});
// the picture a card should show for a selected size label (e.g. "5ml · Mini (Dab)"): that mini's own picture, else the normal photo
const pictureFor = (p, label) => { const v = p.v.find((x) => spec(x) === label); const k = v ? keyFor(p, v) : ""; return k ? `${SITE.imageDir}minis/thumbs/${k}.jpg` : `${SITE.imageDir}thumbs/${p.s}.${SITE.imageExt}`; };
const std = (slug) => `${SITE.imageDir}thumbs/${slug}.${SITE.imageExt}`;
const miniThumb = (k) => `${SITE.imageDir}minis/thumbs/${k}.jpg`;

function jpegSize(file) {
  const b = fs.readFileSync(file);
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  for (let i = 2; i < b.length;) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return null;
}
function csv(text) {                                                  // tiny CSV reader (quoted fields, "" for a quote)
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cur); cur = ""; } else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; } else cur += c;
  }
  return rows;
}

describe("mini pictures", () => {
  let browser;
  const opened = [];
  const fresh = async (opts) => { const c = await openCatalogue(browser, opts); opened.push(c); return c.page; };
  const PHONE = { viewport: { width: 390, height: 844 }, contextOptions: { hasTouch: true, isMobile: true } };
  before(async () => { browser = await launch(); });
  after(async () => { await browser.close(); });

  const cardOf = (page, slug) => page.locator(`#grid .card[data-slug="${slug}"]`);
  const cardSrc = (card) => card.locator(".thumb img").getAttribute("src");
  // open the viewer from a card's photo, read what it shows, close it
  const viewer = async (page, card) => {
    await card.locator(".thumb").click();
    await page.waitForSelector("#lightbox:not([hidden])");
    const r = { src: await page.$eval("#lightbox img", (i) => i.src), caption: await page.textContent("#lightbox figcaption") };
    await page.keyboard.press("Escape");
    await page.waitForSelector("#lightbox", { state: "hidden" });
    return r;
  };

  describe("the files and the list", () => {
    test("32 pictures: every key names a real product and one of its mini sizes of that form (spray / dab / vial), no repeats", () => {
      assert.equal(KEYS.length, 32);
      assert.equal(new Set(KEYS).size, KEYS.length);
      for (const t of TARGETS) { assert.ok(t.p, `${t.k}: product exists`); assert.ok(t.v, `${t.k}: the product has a ${t.form} mini`); assert.ok(["spray", "dab", "vial"].includes(t.form)); }
    });

    test("each has both files, real JPEGs: 800x800 and 240x240, light enough for phones; nothing left over in the folders", () => {
      const bad = [];
      for (const k of KEYS) {
        const a = jpegSize(path.join(dir, k + ".jpg")), b = jpegSize(path.join(dir, "thumbs", k + ".jpg"));
        if (!a || a[0] !== 800 || a[1] !== 800) bad.push(`${k}: full is ${a}`);
        if (!b || b[0] !== 240 || b[1] !== 240) bad.push(`${k}: thumb is ${b}`);
        if (fs.statSync(path.join(dir, k + ".jpg")).size > 120_000) bad.push(`${k}: full is large`);
      }
      assert.deepEqual(bad, []);
      const want = KEYS.map((k) => k + ".jpg").sort();
      assert.deepEqual(fs.readdirSync(dir).filter((f) => f !== "thumbs").sort(), want);
      assert.deepEqual(fs.readdirSync(path.join(dir, "thumbs")).sort(), want);
    });

    test("the pictures are the checked ones (fingerprint of every file) and all different from the normal photo", () => {
      const manifest = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "mini-manifest.json"), "utf8"));
      assert.deepEqual(Object.keys(manifest).sort(), [...KEYS].sort());
      assert.deepEqual(KEYS.filter((k) => md5(path.join(dir, k + ".jpg")) !== manifest[k]), [], "changed — if on purpose, run: node lib/make-mini-manifest.mjs");
      for (const t of TARGETS) assert.notEqual(md5(path.join(dir, t.k + ".jpg")), md5(path.join(SITE_DIR, SITE.imageDir, t.slug + ".jpg")), `${t.k} is just the normal photo again`);
    });

    test("the decision record (mini-photo-mapping.csv) agrees with the list: every USED row is a listed picture and every listed picture has a USED row", () => {
      const rows = csv(fs.readFileSync(path.join(import.meta.dirname, "mini-photo-mapping.csv"), "utf8")).slice(1).filter((r) => r.length > 1);
      const used = rows.filter((r) => r[4] === "USED");
      const keys = used.map((r) => {
        const p = PRODUCTS.find((x) => `${x.b} ${x.n}` === r[5]);
        const v = p && p.v.find((x) => x.g === "Minis" && `${x.m} ${x.p}` === r[6].split(" / ")[0]);
        return p && v ? `${p.s}--${formOf(v)}` : `?${r[5]}`;
      });
      assert.deepEqual(keys.sort(), [...KEYS].sort());
      assert.equal(rows.filter((r) => r[0]).length, 51, "all 51 supplied images are accounted for");
    });
  });

  describe("on the card", () => {
    test("every mini picture: a card whose pre-selected size is that mini opens on its picture; tapping another size and back, the viewer, and the caption all agree", async () => {
      const page = await fresh();
      const problems = []; let viaSize = 0, viaPhoto = 0;
      for (const t of TARGETS) {
        await applyFilters(page, { q: t.p.n, brand: t.p.b });
        const card = cardOf(page, t.slug);
        if (!(await card.count())) { problems.push(`${t.k}: card not found`); continue; }
        const label = spec(t.v), caption = `${t.p.b} ${t.p.n} — ${label}`;
        const selected = (await card.locator(".vchip.on").count()) ? (await card.locator(".vchip.on").textContent()).trim() : (await card.locator(".tag.pkg").textContent()).trim();
        if ((await cardSrc(card)) !== pictureFor(t.p, selected)) problems.push(`${t.k}: opens on ${await cardSrc(card)}, expected ${pictureFor(t.p, selected)} for the pre-selected "${selected}"`);
        const chip = card.locator(".vchip", { hasText: label });
        if (await chip.count()) {
          viaSize++;
          await chip.first().click();
          try { await page.waitForFunction(([s, want]) => document.querySelector(`#grid .card[data-slug="${s}"] .thumb img`)?.getAttribute("src") === want, [t.slug, miniThumb(t.k)], { timeout: 4000 }); }
          catch { problems.push(`${t.k}: tapping "${label}" did not show ${miniThumb(t.k)} (shows ${await cardSrc(card)})`); continue; }
          const m = await card.locator(".thumb").evaluate((e) => ({ ok: e.querySelector("img").classList.contains("ok"), nw: e.querySelector("img").naturalWidth, alt: e.dataset.alt, imgAlt: e.querySelector("img").alt, box: [Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)] }));
          if (!m.ok || m.nw !== 240) problems.push(`${t.k}: picture not loaded`);
          if (m.alt !== caption || m.imgAlt !== caption) problems.push(`${t.k}: caption "${m.alt}"`);
          if (m.box.join() !== "68,68") problems.push(`${t.k}: picture box is ${m.box}`);
          // tapping another size: the normal photo (or that size's own mini picture) comes back
          const back = card.locator(".vchip").filter({ hasNotText: label }).first();
          const backLabel = (await back.textContent()).trim();
          const v2 = t.p.v.find((x) => spec(x) === backLabel), k2 = v2 ? keyFor(t.p, v2) : "";
          const wantBack = k2 ? miniThumb(k2) : std(t.slug);
          await back.click();
          try { await page.waitForFunction(([s, want]) => document.querySelector(`#grid .card[data-slug="${s}"] .thumb img`)?.getAttribute("src") === want, [t.slug, wantBack], { timeout: 4000 }); }
          catch { problems.push(`${t.k}: after tapping "${backLabel}" the picture is ${await cardSrc(card)}, expected ${wantBack}`); }
          await chip.first().click();
          await page.waitForFunction(([s, want]) => document.querySelector(`#grid .card[data-slug="${s}"] .thumb img`)?.getAttribute("src") === want, [t.slug, miniThumb(t.k)], { timeout: 4000 }).catch(() => {});
        } else {
          viaPhoto++;
          // a card that only sells this mini: no sizes to tap, and it shows the mini's picture straight away
          if (await card.locator(".vchip").count()) problems.push(`${t.k}: expected a single-size card`);
          if ((await card.locator(".tag.pkg").textContent()).trim() !== label) problems.push(`${t.k}: single size is not ${label}`);
          if ((await cardSrc(card)) !== miniThumb(t.k)) problems.push(`${t.k}: a mini-only card should open on its mini picture, shows ${await cardSrc(card)}`);
          if ((await card.locator(".thumb").getAttribute("data-alt")) !== caption) problems.push(`${t.k}: caption ${await card.locator(".thumb").getAttribute("data-alt")}`);
        }
        const v = await viewer(page, card);
        if (!v.src.endsWith(`/${SITE.imageDir}minis/${t.k}.jpg`)) problems.push(`${t.k}: viewer shows ${v.src}`);
        if (v.caption !== caption) problems.push(`${t.k}: viewer caption "${v.caption}"`);
      }
      assert.ok(viaSize >= 15 && viaPhoto >= 10, `both kinds of card were exercised (size button ${viaSize}, photo ${viaPhoto})`);
      assert.deepEqual(problems, []);
    });

    // read every card of every page: slug, the picture it shows, and its pre-selected size
    const sweep = async (page) => {
      const out = [];
      for (;;) {
        out.push(...await page.locator("#grid .card").evaluateAll((els) => els.map((e) => ({ slug: e.dataset.slug, src: e.querySelector(".thumb img")?.getAttribute("src"), sel: (e.querySelector(".vchip.on") || e.querySelector(".tag.pkg"))?.textContent.trim(), alt: e.querySelector(".thumb").dataset.alt }))));
        const next = page.locator("#pager .pg.nav").last();
        if (!(await next.count()) || (await next.isDisabled())) break;
        await next.click();
      }
      return out;
    };
    const wrongOnes = (cards) => cards.filter((c) => { const p = PRODUCTS.find((x) => x.s === c.slug); return c.src !== pictureFor(p, c.sel); }).map((c) => `${c.slug} (${c.sel}) shows ${c.src}`);

    test("from the very first moment: with no filter, every one of the 627 cards opens on the picture for its pre-selected size (a mini's own picture where it has one)", async () => {
      const page = await fresh();
      const cards = await sweep(page);
      assert.equal(cards.length, 627);
      assert.deepEqual(wrongOnes(cards), []);
      assert.ok(cards.filter((c) => c.src.includes("/minis/")).length >= 10, "several cards open straight on a mini picture");
    });

    test("with Size = Minis (every pre-selected size is a mini), every card still opens on the right picture, and mini pictures show straight away", async () => {
      const page = await fresh();
      await applyFilters(page, { g: "Minis" });
      const cards = await sweep(page);
      assert.ok(cards.length >= 59, `looked at ${cards.length} cards with minis`);
      assert.deepEqual(wrongOnes(cards), []);
      const withPicture = cards.filter((c) => c.src.includes("/minis/")).length;
      assert.ok(withPicture >= 25, `${withPicture} of them open on a mini picture`);
    });

    test("a card that opens on a mini picture has it loaded (not an outline), captioned with its size, in the same 68px box", async () => {
      const page = await fresh();
      await applyFilters(page, { g: "Minis" });
      await page.evaluate(async () => { for (const c of document.querySelectorAll("#grid .card")) { c.scrollIntoView({ block: "center" }); await new Promise((r) => setTimeout(r, 30)); } });   // photos load as they scroll into view
      await page.waitForFunction(() => [...document.querySelectorAll("#grid .thumb img")].every((i) => i.complete), null, { timeout: 8000 }).catch(() => {});
      const m = await page.locator("#grid .card").evaluateAll((els) => els.map((e) => { const th = e.querySelector(".thumb"), im = th.querySelector("img"); return { src: im?.getAttribute("src"), ok: !!im?.classList.contains("ok"), alt: th.dataset.alt, box: [Math.round(th.getBoundingClientRect().width), Math.round(th.getBoundingClientRect().height)] }; }));
      const minis = m.filter((x) => x.src && x.src.includes("/minis/"));
      assert.ok(minis.length > 0);
      minis.forEach((x) => { assert.ok(x.ok, `${x.src} loaded`); assert.match(x.alt, / — \d/, "the caption names the size"); });
      m.forEach((x) => assert.deepEqual(x.box, [68, 68]));
    });

    test("a mini with no picture supplied (a Chanel vial, a Le Male mini) keeps the normal photo - on the card and in the viewer; normal sizes never show a mini picture", async () => {
      const page = await fresh();
      for (const [house, name] of [["Chanel", "Allure Homme EDT"], ["JPG", "Le Male EDT"], ["Ahmed Al Maghribi", "Black Fume"]]) {
        const p = PRODUCTS.find((x) => x.b === house && x.n === name);
        await applyFilters(page, { q: name, brand: house });
        const card = cardOf(page, p.s);
        const n = await card.locator(".vchip").count();
        for (let i = 0; i < n; i++) {
          await card.locator(".vchip").nth(i).click(); await page.waitForTimeout(250);
          assert.equal(await cardSrc(card), std(p.s), `${name} chip ${i}`);
          const v = await viewer(page, card);
          assert.ok(v.src.endsWith(`/${SITE.imageDir}${p.s}.jpg`), `${name} chip ${i}: viewer shows ${v.src}`);
        }
      }
    });

    test("the photo viewer shows the normal photo for a normal size, and the mini's picture (with its caption) for a mini size", async () => {
      const t = TARGETS.find((x) => x.k === "hermes-terre-dhermes-edt--spray");
      const page = await fresh();
      await applyFilters(page, { q: t.p.n, brand: t.p.b });
      const card = cardOf(page, t.slug);
      await card.locator(".vchip").filter({ hasText: "Tester" }).click();
      const a = await viewer(page, card);
      assert.ok(a.src.endsWith(`/${SITE.imageDir}${t.slug}.jpg`), "Tester: the normal photo, big version");
      assert.equal(a.caption, `${t.p.b} ${t.p.n}`);
      await card.locator(".vchip", { hasText: spec(t.v) }).click();
      await page.waitForFunction((k) => document.querySelector(".card .thumb img")?.getAttribute("src").includes(k), t.k);
      await card.locator(".thumb").click();
      await page.waitForSelector("#lightbox:not([hidden])");
      assert.ok((await page.$eval("#lightbox img", (i) => i.src)).endsWith(`/${SITE.imageDir}minis/${t.k}.jpg`));
      assert.equal(await page.textContent("#lightbox figcaption"), `${t.p.b} ${t.p.n} — ${spec(t.v)}`);
      await page.waitForFunction(() => { const i = document.querySelector("#lightbox img"); return i.complete && i.naturalWidth > 0; });
      assert.equal(await page.locator("#lightbox img").evaluate((i) => i.naturalWidth), 800);
    });

    test("quick successive taps end on the picture for the LAST size tapped (no stale picture)", async () => {
      const page = await fresh();
      const p = PRODUCTS.find((x) => x.s === "hermes-terre-dhermes-edt");
      await applyFilters(page, { q: p.n, brand: p.b });
      await page.evaluate((slug) => { const chips = [...document.querySelectorAll(`#grid .card[data-slug="${slug}"] .vchip`)]; [0, 1, 0, 1, 2, 1].forEach((i) => chips[i].click()); }, p.s);
      await page.waitForTimeout(700);
      assert.equal(await cardSrc(cardOf(page, p.s)), miniThumb("hermes-terre-dhermes-edt--spray"));
      await page.evaluate((slug) => { const chips = [...document.querySelectorAll(`#grid .card[data-slug="${slug}"] .vchip`)]; [0, 1, 2].forEach((i) => chips[i].click()); }, p.s);
      await page.waitForTimeout(700);
      assert.equal(await cardSrc(cardOf(page, p.s)), std(p.s));
    });

    test("after changing a filter the card goes back to the picture for its pre-selected size", async () => {
      const page = await fresh();
      const p = PRODUCTS.find((x) => x.s === "hermes-terre-dhermes-edt");
      await applyFilters(page, { q: p.n, brand: p.b });
      const card = () => cardOf(page, p.s);
      await card().locator(".vchip").filter({ hasText: "Tester" }).click(); await page.waitForTimeout(300);
      assert.equal(await cardSrc(card()), std(p.s), "tapped the tester: the normal photo");
      await applyFilters(page, { q: p.n, brand: p.b, g: "Minis" });
      assert.equal(await cardSrc(card()), miniThumb("hermes-terre-dhermes-edt--dab"), "re-drawn card: pre-selected 5ml dab, so its picture");
    });

    test("a product with no normal photo (noPhoto) shows its mini's picture while a mini is selected, and the outline for the other sizes", async () => {
      const t = TARGETS.find((x) => x.k === "hermes-terre-dhermes-edt--dab");
      const c = await openCatalogue(browser, { siteConfig: (s) => s.replace(/noPhoto:\s*\[[^\]]*\]/, `noPhoto: ["${t.slug}"]`) }); opened.push(c);
      await applyFilters(c.page, { q: t.p.n, brand: t.p.b });
      const card = cardOf(c.page, t.slug);
      await c.page.waitForSelector(`#grid .card[data-slug="${t.slug}"] .thumb img.ok`);
      assert.equal(await cardSrc(card), miniThumb(t.k), "pre-selected 5ml dab: its own picture, even with no normal photo");
      await card.locator(".vchip").filter({ hasText: "Tester" }).click();
      await c.page.waitForFunction((s) => !document.querySelector(`#grid .card[data-slug="${s}"] .thumb img`), t.slug);
      assert.equal(await card.locator(".thumb svg").count(), 1, "the bottle outline shows for a size that has no picture");
      await card.locator(".vchip", { hasText: spec(t.v) }).click();
      await c.page.waitForSelector(`#grid .card[data-slug="${t.slug}"] .thumb img.ok`);
      assert.equal(await cardSrc(card), miniThumb(t.k));
    });

    test("if a mini's file is missing on the server, the card quietly shows the normal photo instead (no outline, no broken image)", async () => {
      const t = TARGETS.find((x) => x.k === "hermes-terre-dhermes-edt--dab");
      const c = await openCatalogue(browser);                       // (not tracked: a deliberate 404 is logged as an error)
      await c.page.route(`**/minis/thumbs/${t.k}.jpg`, (r) => r.fulfill({ status: 404, body: "" }));
      await applyFilters(c.page, { q: t.p.n, brand: t.p.b });
      const card = cardOf(c.page, t.slug);                          // (the pre-selected size is that dab, so the card tries the missing file first)
      await c.page.waitForFunction((s) => document.querySelector(`#grid .card[data-slug="${s}"] .thumb img.ok`)?.getAttribute("src").includes("/thumbs/" + s), t.slug, { timeout: 5000 });
      assert.equal(await cardSrc(card), std(t.slug));
      assert.equal(await card.locator(".thumb svg").isVisible(), false, "the bottle outline stays hidden: a photo is showing");
      assert.doesNotMatch(await card.locator(".thumb").getAttribute("data-alt"), / — /);
      await card.locator(".vchip", { hasText: spec(t.v) }).click();   // tapping it again keeps the normal photo too
      await c.page.waitForTimeout(500);
      assert.equal(await cardSrc(card), std(t.slug));
    });

    test("on a phone a tap on the size or on the photo does the same, and the picture box never changes size", async () => {
      const t = TARGETS.find((x) => x.k === "hermes-terre-dhermes-edt--dab");
      const page = await fresh(PHONE);
      await applyFilters(page, { q: t.p.n, brand: t.p.b });
      const card = cardOf(page, t.slug);
      const box = () => card.locator(".thumb").evaluate((e) => [Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)]);
      const before = await box();
      await card.locator(".vchip", { hasText: "Tester" }).tap();
      await card.locator(".vchip", { hasText: spec(t.v) }).tap();
      await page.waitForFunction((k) => document.querySelector(".card .thumb img")?.getAttribute("src").includes(k), t.k);
      assert.deepEqual(await box(), before);
      await card.locator(".thumb").tap();
      await page.waitForSelector("#lightbox:not([hidden])");
      assert.ok((await page.$eval("#lightbox img", (i) => i.src)).endsWith(`/minis/${t.k}.jpg`));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    });
  });

  describe("everything else is unchanged", () => {
    test("the cart shows the same picture as the card for a mini (its own picture when it has one), the i note matches it, and the order message is the same", async () => {
      const t = TARGETS.find((x) => x.k === "hermes-terre-dhermes-edt--dab");
      const page = await fresh();
      await applyFilters(page, { q: t.p.n, brand: t.p.b });
      const card = cardOf(page, t.slug);
      await card.locator(".vchip", { hasText: spec(t.v) }).click();
      await card.locator(".add").click();
      await page.click("#cart-open");
      await page.waitForSelector(".line-art img.ok");
      assert.equal(await page.locator(".line-art img").first().getAttribute("src"), miniThumb(t.k));
      assert.equal(await page.locator("[data-info]").count(), 1);
      await page.locator("[data-info]").click();
      assert.match(await page.locator(".line-info").textContent(), /dab-on bottle[\s\S]*The photo shows the mini you will receive/);
      assert.match(await page.getAttribute("#checkout", "data-wa-open"), /Terre D'Hermes EDT[\s\S]*5ml · Mini \(Dab\)/);
    });

    test("a mini WITHOUT its own picture still shows the normal photo in the cart, and its note still says it is not the full-size bottle", async () => {
      const x = PRODUCTS.flatMap((p) => p.v.map((v) => ({ p, v }))).find(({ p, v }) => /dab|spray/i.test(v.p) && v.g === "Minis" && !keyFor(p, v));
      assert.ok(x, "test data: a mini with no picture exists");
      const page = await fresh();
      await page.evaluate((k) => PX.addToCart(k), [x.p.s, x.v.m, x.v.p, x.v.r].join("|"));
      await page.click("#cart-open");
      await page.waitForSelector(".line-art img.ok");
      assert.equal(await page.locator(".line-art img").first().getAttribute("src"), std(x.p.s));
      await page.locator("[data-info]").click();
      assert.match(await page.locator(".line-info").textContent(), /not the full-size bottle shown in the photo/);
    });

    test("the cart picture for each of the three kinds (dab, spray, vial) is that kind's picture, on a phone too", async () => {
      const c = await openCatalogue(browser, PHONE); opened.push(c);
      const page = c.page;
      const pick = (form) => TARGETS.find((t) => t.form === form);
      const ts = ["dab", "spray", "vial"].map(pick);
      await page.evaluate((keys) => keys.forEach((k) => PX.addToCart(k)), ts.map((t) => [t.p.s, t.v.m, t.v.p, t.v.r].join("|")));
      await page.click("#cart-open");
      await page.waitForFunction(() => document.querySelectorAll(".line-art img.ok").length === 3);
      const srcs = await page.$$eval(".line-art img", (is) => is.map((i) => i.getAttribute("src")));
      assert.deepEqual(srcs.sort(), ts.map((t) => miniThumb(t.k)).sort());
      assert.equal(await page.evaluate(() => document.querySelector(".cart-body").scrollWidth <= document.querySelector(".cart-body").clientWidth + 1), true);
    });

    test("the homepage hero and the brand logos do not use mini pictures", async () => {
      const src = fs.readFileSync(path.join(SITE_DIR, "index.html"), "utf8");
      assert.doesNotMatch(src, /images\/minis/);
    });
  });

  test("no console errors or failed requests", () => assert.deepEqual(opened.flatMap((o) => o.errors), []));
});

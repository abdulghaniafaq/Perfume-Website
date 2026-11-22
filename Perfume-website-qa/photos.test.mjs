// Product photos: every product that should have a photo has both files, nothing is orphaned, the files are
// real JPEGs of the expected size, the picture-to-product pairing is the one that was checked by eye, and the
// catalogue page shows them (small picture on the card, big one in the viewer) without any failed request.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { SITE, PRODUCTS, SITE_DIR } from "./lib/data.mjs";
import { launch, openCatalogue } from "./lib/browser.mjs";

const IMG = path.join(SITE_DIR, SITE.imageDir);
const THUMBS = path.join(IMG, "thumbs");
const noPhoto = new Set(SITE.noPhoto || []);
const slugs = PRODUCTS.map((p) => p.s);
const withPhoto = PRODUCTS.filter((p) => !noPhoto.has(p.s));
const md5 = (f) => crypto.createHash("md5").update(fs.readFileSync(f)).digest("hex");

// width x height of a JPEG, read from its Start-Of-Frame marker
function jpegSize(file) {
  const b = fs.readFileSync(file);
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    const len = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return null;
}

describe("photo files", () => {
  test("photos are switched on and the folder layout matches the config", () => {
    assert.equal(SITE.photos, true);
    assert.equal(SITE.imageExt, "jpg");
    assert.ok(fs.existsSync(IMG) && fs.existsSync(THUMBS));
  });

  test("noPhoto only lists real products, and none of them has a file", () => {
    const unknown = [...noPhoto].filter((s) => !slugs.includes(s));
    assert.deepEqual(unknown, []);
    const stray = [...noPhoto].filter((s) => fs.existsSync(path.join(IMG, s + ".jpg")) || fs.existsSync(path.join(THUMBS, s + ".jpg")));
    assert.deepEqual(stray, [], "these have a photo now — remove them from noPhoto");
  });

  test("every other product has both the 800px picture and the 240px card picture", () => {
    const missing = withPhoto.flatMap((p) => [path.join(IMG, p.s + ".jpg"), path.join(THUMBS, p.s + ".jpg")].filter((f) => !fs.existsSync(f)).map((f) => path.relative(SITE_DIR, f)));
    assert.deepEqual(missing, []);
  });

  test("no orphan files (every file belongs to a product)", () => {
    const known = new Set(slugs);
    const SHARED = new Set(["og-image.jpg", "apple-touch-icon.png"]);            // the share preview and the home-screen icon belong to the site, not to a product
    const orphans = [IMG, THUMBS].flatMap((d) => fs.readdirSync(d).filter((f) => !fs.statSync(path.join(d, f)).isDirectory() && !SHARED.has(f) && !known.has(f.replace(/\.jpg$/, ""))).map((f) => path.join(path.basename(d), f)));
    assert.deepEqual(orphans, []);
  });

  test("files are real JPEGs: 800x800 and 240x240, and light enough for phones", () => {
    const bad = [];
    for (const p of withPhoto) {
      const full = path.join(IMG, p.s + ".jpg"), thumb = path.join(THUMBS, p.s + ".jpg");
      const a = jpegSize(full), b = jpegSize(thumb);
      if (!a || a[0] !== 800 || a[1] !== 800) bad.push(`${p.s}: full is ${a}`);
      if (!b || b[0] !== 240 || b[1] !== 240) bad.push(`${p.s}: thumb is ${b}`);
      if (fs.statSync(full).size > 150_000) bad.push(`${p.s}: full is ${fs.statSync(full).size} bytes`);
      if (fs.statSync(thumb).size > 20_000) bad.push(`${p.s}: thumb is ${fs.statSync(thumb).size} bytes`);
    }
    assert.deepEqual(bad.slice(0, 10), []);
  });

  test("the pairing checked by eye is unchanged (fingerprint of every picture)", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "photo-manifest.json"), "utf8"));
    assert.deepEqual(Object.keys(manifest).sort(), withPhoto.map((p) => p.s).sort(), "manifest and products disagree");
    const changed = withPhoto.filter((p) => md5(path.join(IMG, p.s + ".jpg")) !== manifest[p.s]).map((p) => p.s);
    assert.deepEqual(changed, [], "these pictures differ from the checked set — if you changed them on purpose, regenerate photo-manifest.json");
  });

  test("the pictures themselves are mostly distinct (only known look-alike pairs share one)", () => {
    const groups = new Map();
    for (const p of withPhoto) { const h = md5(path.join(IMG, p.s + ".jpg")); groups.set(h, [...(groups.get(h) || []), p.s]); }
    const shared = [...groups.values()].filter((g) => g.length > 1).map((g) => g.sort().join(" + ")).sort();
    // exactly the three pairs that were byte-identical in the supplied photos (43/44, 281/290, 424/425)
    assert.deepEqual(shared, [
      "dolce-gabbana-devotion-pour-homme-edp + dolce-gabbana-devotion-pour-homme-parfum",
      "kenzo-leau-par-pour-homme-edt + kenzo-leau-pour-homme-edt",
      "tom-ford-ombre-leather-edp + tom-ford-ombre-leather-parfum",
    ]);
  });
});

describe("photos on the catalogue page", () => {
  let browser, ctx;
  before(async () => { browser = await launch(); ctx = await openCatalogue(browser); });
  after(async () => { await browser.close(); });

  test("every picture file loads in the browser (card size and viewer size)", async () => {
    const failed = await ctx.page.evaluate(async ({ list, dir }) => {
      const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i.naturalWidth > 0); i.onerror = () => res(false); i.src = src; });
      const bad = [];
      for (const s of list) {
        if (!(await load(dir + "thumbs/" + s + ".jpg"))) bad.push("thumbs/" + s);
        if (!(await load(dir + s + ".jpg"))) bad.push(s);
      }
      return bad;
    }, { list: withPhoto.map((p) => p.s), dir: SITE.imageDir });
    assert.deepEqual(failed, []);
  });

  test("the first page of cards shows pictures: small file on the card, nothing missing", async () => {
    // cards below the fold load lazily, so scroll through them first
    await ctx.page.evaluate(async () => {
      for (const c of document.querySelectorAll("#grid .card")) { c.scrollIntoView({ block: "center" }); await new Promise((r) => setTimeout(r, 40)); }
    });
    await ctx.page.waitForFunction(() => [...document.querySelectorAll("#grid .card .thumb img")].every((i) => i.classList.contains("ok")), null, { timeout: 8000 }).catch(() => {});
    const info = await ctx.page.$$eval("#grid .card", (cards) => cards.map((c) => { const im = c.querySelector(".thumb img"); return { slug: c.dataset.slug, src: im?.getAttribute("src"), ok: !!im?.classList.contains("ok"), sel: (c.querySelector(".vchip.on") || c.querySelector(".tag.pkg"))?.textContent.trim() }; }));
    assert.equal(info.length, 48);
    for (const c of info) {
      if (noPhoto.has(c.slug)) { assert.equal(c.src, undefined); continue; }
      // the picture follows the pre-selected size: a mini that has its own picture shows it, everything else shows the product's photo
      const p = PRODUCTS.find((x) => x.s === c.slug), v = p.v.find((x) => [x.m, x.p].filter(Boolean).join(" · ") === c.sel);
      const form = v && v.g === "Minis" ? (/dab/i.test(v.p) ? "dab" : /spray/i.test(v.p) ? "spray" : /vial/i.test(v.p) ? "vial" : "") : "";
      const mini = form && (SITE.miniPhotos || []).includes(`${p.s}--${form}`);
      assert.equal(c.src, mini ? `${SITE.imageDir}minis/thumbs/${p.s}--${form}.jpg` : `${SITE.imageDir}thumbs/${c.slug}.jpg`);
      assert.ok(c.ok, `${c.slug}: picture did not load`);
    }
  });

  test("tapping a picture opens the viewer with the big file and the product name", async () => {
    await ctx.page.evaluate(() => window.scrollTo(0, 0));
    const first = await ctx.page.$eval("#grid .card", (c) => ({ slug: c.dataset.slug, alt: c.querySelector(".thumb").dataset.alt }));
    await ctx.page.click("#grid .card .thumb");
    await ctx.page.waitForSelector("#lightbox:not([hidden])");
    const src = await ctx.page.$eval("#lightbox img", (i) => i.src);          // the browser's full URL
    assert.ok(src.endsWith(`/${SITE.imageDir}${first.slug}.jpg`), src);       // the big file, not the thumbs/ one
    assert.ok(!src.includes("/thumbs/"));
    assert.equal(await ctx.page.$eval("#lightbox figcaption", (f) => f.textContent), first.alt);
    await ctx.page.keyboard.press("Escape");
    await ctx.page.waitForSelector("#lightbox", { state: "hidden" });
  });

  test("a product listed in noPhoto shows the bottle outline and asks for no file", async () => {
    // every product has a photo today, so list one in noPhoto for this page load to prove the fallback still works
    const target = PRODUCTS.find((p) => p.s === "afnan-9am");
    const c2 = await openCatalogue(browser, { siteConfig: (t) => t.replace(/noPhoto:\s*\[[^\]]*\]/, 'noPhoto: ["afnan-9am"]') });
    const asked = [];
    c2.page.on("request", (r) => /assets\/images/.test(r.url()) && asked.push(r.url()));
    await c2.page.fill("#q", target.n);
    await c2.page.waitForFunction((slug) => !!document.querySelector(`#grid .card[data-slug="${slug}"]`), target.s);
    const mine = await c2.page.$eval(`#grid .card[data-slug="${target.s}"]`, (c) => ({ img: !!c.querySelector(".thumb img"), outline: !!c.querySelector(".thumb svg") }));
    assert.deepEqual(mine, { img: false, outline: true });
    assert.deepEqual(asked.filter((u) => u.includes("afnan-9am.jpg")), [], "asked for the photo of a product listed in noPhoto");
    assert.deepEqual(c2.errors, []);
  });

  test("no console errors or failed requests", () => assert.deepEqual(ctx.errors, []));
});

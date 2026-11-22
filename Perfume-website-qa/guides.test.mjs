// The Guides, end to end. Served over real HTTP like the live host (case-sensitive names, real 404s).
//   A  the "Guides" button: in the header and footer of every page, opens the Guides page from every page (laptop and phone menu)
//   B  the Guides page: four cards, each with picture, label, title, short description and "Read more" that opens the right guide
//   C  every guide, on a laptop and on a phone: structure, contents list, images and drawings, every link, the WhatsApp buttons,
//      the page text is visible without scrolling tricks (a bug that really happened), nothing spills sideways
//   D  every claim a guide makes about OUR catalogue is checked against the catalogue (picks sit in the family they are listed under,
//      "Browse all" links filter correctly, the tester discount, the Tester / "No Box" wording, the Mini label, the guarantee wording)
//   E  the new catalogue links (?fm= and ?g=): accepted when valid, ignored when not, and combine with the rest
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SITE, PRODUCTS, SITE_DIR } from "./lib/data.mjs";
import { launch, openPage, collect, diff } from "./lib/browser.mjs";
import { expected, families } from "./lib/oracle.mjs";
import { serve, exactCase } from "./lib/server.mjs";
import { GUIDE_FILES, PAGE_FILES } from "./lib/pages.mjs";

const GUIDES = [
  { file: "guide-spot-genuine-perfume.html", h1: "How to tell genuine perfume from a fake", card: "How to tell a genuine perfume from a fake", cat: "Authenticity" },
  { file: "guide-perfume-for-every-season.html", h1: "Which scent for which season", card: "Which scent profile suits which season", cat: "Choosing a scent" },
  { file: "guide-retail-tester-decant-discovery-set.html", h1: "Retail, tester, decant or discovery set: which one is for you?", tab: "Retail, tester, decant or discovery set: which one?", card: "Retail, tester, decant, discovery set: what's the difference?", cat: "Buying smart" },
  { file: "guide-perfume-testers-explained.html", h1: "Perfume testers: why they cost less, and whether they're legit", tab: "Perfume testers explained: are they legit?", card: "Perfume testers explained: why they're cheaper and whether they're legit", cat: "Buying smart" },
];
const PHONE = { viewport: { width: 390, height: 844 }, contextOptions: { hasTouch: true, isMobile: true, reducedMotion: "reduce" } };
const LAPTOP = { contextOptions: { reducedMotion: "reduce" } };
const read = (f) => fs.readFileSync(path.join(SITE_DIR, f), "utf8");
const idsIn = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const BASE = "https://perfume-x-collections.netlify.app/";

describe("guides, end to end", () => {
  let browser, srv;
  const opened = [];
  const open = async (file, opts = {}) => { const c = await openPage(browser, file, { base: srv.base, ...opts }); opened.push(c); await c.page.waitForTimeout(250); return c; };
  before(async () => { assert.deepEqual(GUIDES.map((g) => g.file), GUIDE_FILES); browser = await launch(); srv = await serve(); });
  after(async () => { for (const c of opened) await c.context.close().catch(() => {}); await browser.close(); await srv.close(); });
  const closeAll = async () => { while (opened.length) await opened.pop().context.close().catch(() => {}); };
  /** wait until the page has stopped scrolling */
  const settled = async (page) => { let last = -1, same = 0; for (let i = 0; i < 50 && same < 3; i++) { const y = await page.evaluate(() => Math.round(scrollY)); same = y === last ? same + 1 : 0; last = y; await page.waitForTimeout(80); } };

  /* ======================================================================== A */
  describe("A. the Guides button", () => {
    after(closeAll);
    test("every one of the 13 pages has Guides in the header (right after Catalogue) and in the footer, pointing at guides.html", async () => {
      for (const file of PAGE_FILES) {
        const { page } = await open(file);
        const r = await page.evaluate(() => ({
          nav: [...document.querySelectorAll("#nav a")].map((a) => [a.textContent.trim(), a.getAttribute("href")]),
          foot: [...document.querySelectorAll(".foot-nav a")].map((a) => [a.textContent.trim(), a.getAttribute("href")]),
        }));
        assert.deepEqual(r.nav.slice(0, 2), [["Catalogue", "catalogue.html"], ["Guides", "guides.html"]], `${file}: header`);
        assert.deepEqual(r.foot.slice(0, 3), [["Home", "index.html"], ["Catalogue", "catalogue.html"], ["Guides", "guides.html"]], `${file}: footer`);
      }
    });

    test("clicking Guides in the header, from every page, opens the Guides page at the top, with the right heading and the right header highlight", async () => {
      for (const file of PAGE_FILES) {
        const { page } = await open(file, LAPTOP);
        if (file === "guides.html") { assert.equal(await page.locator('#nav a[aria-current="page"]').getAttribute("href"), "guides.html"); continue; }
        await Promise.all([page.waitForURL((u) => u.pathname.endsWith("/guides.html")), page.locator('#nav a[href="guides.html"]').click()]);
        await page.waitForLoadState("load");
        assert.equal(await page.evaluate(() => Math.round(scrollY)), 0, `${file}: opens at the top`);
        assert.equal((await page.locator("h1").innerText()).trim(), "Perfume, explained");
        assert.equal(await page.locator('#nav a[aria-current="page"]').getAttribute("href"), "guides.html");
      }
    });

    test("on a phone the Guides link is inside the menu, and tapping it opens the Guides page and closes the menu", async () => {
      for (const file of ["index.html", "catalogue.html", "faq.html", "guide-perfume-testers-explained.html"]) {
        const { page } = await open(file, PHONE);
        assert.equal(await page.locator('#nav a[href="guides.html"]').isVisible(), false, "tucked away until the menu is opened");
        await page.locator("#menu-btn").tap();
        await page.waitForTimeout(300);
        assert.equal(await page.locator("#menu-btn").getAttribute("aria-expanded"), "true");
        const link = page.locator('#nav a[href="guides.html"]');
        assert.equal(await link.isVisible(), true);
        const b = await link.boundingBox();
        assert.ok(b.height >= 40 && b.y + b.height <= 844, `${file}: the Guides link is a proper tap target inside the screen (${Math.round(b.height)}px)`);
        await Promise.all([page.waitForURL((u) => u.pathname.endsWith("/guides.html")), link.tap()]);
        await page.waitForLoadState("load");
        assert.equal((await page.locator("h1").innerText()).trim(), "Perfume, explained");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
    });

    test("the footer Guides link works too", async () => {
      const { page } = await open("index.html");
      await Promise.all([page.waitForURL((u) => u.pathname.endsWith("/guides.html")), page.locator('.foot-nav a[href="guides.html"]').click()]);
      assert.equal((await page.locator("h1").innerText()).trim(), "Perfume, explained");
    });

    test("the FAQ's tester answer links to the testers guide, and the link works", async () => {
      const { page } = await open("faq.html");
      await page.locator("summary", { hasText: "difference between Retail and Tester" }).click();
      await Promise.all([page.waitForURL((u) => u.pathname.endsWith("/guide-perfume-testers-explained.html")), page.locator("details[open] a", { hasText: "full guide to testers" }).click()]);
      assert.equal((await page.locator("h1").innerText()).trim(), GUIDES[3].h1);
    });
  });

  /* ======================================================================== B */
  describe("B. the Guides page", () => {
    after(closeAll);
    test("it shows four cards, in order, each with a picture, a label with the reading time, a title, a short description and a Read more link", async () => {
      const { page, errors } = await open("guides.html");
      assert.equal(await page.locator(".g-grid .g-card").count(), 4);
      const cards = await page.evaluate(() => [...document.querySelectorAll(".g-grid .g-card")].map((c) => {
        const img = c.querySelector("img"), more = c.querySelector(".g-more");
        return {
          title: c.querySelector("h2 a").textContent.trim(), href: c.querySelector("h2 a").getAttribute("href"), meta: c.querySelector(".g-meta").textContent.trim(),
          blurb: c.querySelector(".g-blurb").textContent.trim(), moreHref: more.getAttribute("href"), moreText: more.textContent.replace(/\s+/g, " ").trim(),
          imgOk: img.complete && img.naturalWidth === 640 && img.naturalHeight === 336, imgAlt: img.getAttribute("alt"), links: [...c.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
          imgBoxIsLink: c.querySelector(".g-img").tagName === "A" || !!c.querySelector(".g-img").closest("a"), overlay: getComputedStyle(c.querySelector("h2 a"), "::after").position === "absolute",
        };
      }));
      cards.forEach((c, i) => {
        const g = GUIDES[i];
        assert.equal(c.title, g.card); assert.equal(c.href, g.file); assert.equal(c.moreHref, g.file); assert.deepEqual(c.links, [g.file, g.file], "exactly two links per card: the title and Read more");
        assert.match(c.meta, new RegExp(`^${g.cat} · \\d+ min read$`));
        assert.ok(c.blurb.length >= 60 && c.blurb.length <= 260, `${g.file}: description is ${c.blurb.length} characters`);
        assert.match(c.moreText, /^Read more about /); assert.ok(c.moreText.includes(g.card), "the Read more link says which guide it opens");
        assert.equal(c.imgOk, true, `${g.file}: card picture loads at its real size`); assert.equal(c.imgAlt, "", "decorative picture (the title is right beside it)"); assert.equal(c.imgBoxIsLink, false, "the picture is not a link of its own"); assert.equal(c.overlay, true, "the title link covers the whole card");
      });
      assert.equal(new Set(cards.map((c) => c.blurb)).size, 4, "descriptions are all different");
      assert.deepEqual(errors, []);
    });

    for (const [i, g] of GUIDES.entries()) {
      test(`"${g.card}": the Read more link, the title, the picture and the description all open that guide, and Back returns to the list`, async () => {
        for (const how of ["more", "title", "picture", "description"]) {
          const { page } = await open("guides.html", LAPTOP);
          const card = page.locator(".g-card").nth(i);
          const target = how === "more" ? card.locator(".g-more") : how === "title" ? card.locator("h2 a") : how === "picture" ? card.locator(".g-img") : card.locator(".g-blurb");
          // (the picture and the description are not links themselves: the title's link spreads over the card, so a real click on them opens the guide)
          await Promise.all([page.waitForURL((u) => u.pathname.endsWith(`/${g.file}`)), target.click({ force: how === "picture" || how === "description" })]);
          await page.waitForLoadState("load");
          assert.equal((await page.locator("h1").innerText()).trim(), g.h1, how);
          assert.equal(await page.evaluate(() => Math.round(scrollY)), 0, `${how}: opens at the top`);
          assert.equal(await page.locator('#nav a[aria-current="true"]').getAttribute("href"), "guides.html", "Guides stays lit in the header");
          if (how === "more") {
            await page.goBack(); await page.waitForLoadState("load");
            assert.ok(page.url().endsWith("/guides.html")); assert.equal(await page.locator(".g-card").count(), 4);
          }
        }
      });
    }

    test("with the keyboard: Tab reaches each card's title and Read more link (two stops a card), and Enter opens the guide", async () => {
      const { page } = await open("guides.html");
      const stops = [];
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press("Tab");
        const s = await page.evaluate(() => { const a = document.activeElement; return a && a.closest(".g-card") ? { href: a.getAttribute("href"), cls: a.className, vis: getComputedStyle(a).outlineStyle !== "none" || getComputedStyle(a).boxShadow !== "none" } : null; });
        if (s) stops.push(s);
      }
      assert.deepEqual(stops.map((s) => s.href), GUIDES.flatMap((g) => [g.file, g.file]), "two stops per card, in order");
      assert.ok(stops.every((s) => !/g-img/.test(s.cls)));
      assert.ok(stops.every((s) => s.vis), "a visible focus mark on each");
      // activate the second guide's Read more with Enter
      await page.focus(".g-card:nth-child(2) .g-more");
      await Promise.all([page.waitForURL((u) => u.pathname.endsWith(`/${GUIDES[1].file}`)), page.keyboard.press("Enter")]);
    });

    test("the closing band is visible after scrolling and its buttons work", async () => {
      const { page } = await open("guides.html", LAPTOP);
      await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(900);
      assert.equal(await page.locator(".cta-band").evaluate((e) => getComputedStyle(e).opacity), "1");
      await page.locator(".cta-band [data-wa]").click();
      const wa = await page.evaluate(() => window.__wa);
      assert.equal(wa.length, 1); assert.equal(wa[0], `https://wa.me/${SITE.contact.whatsapp}?text=${encodeURIComponent("Hi! I have a question about your perfumes.")}`);
      await Promise.all([page.waitForURL((u) => u.pathname.endsWith("/catalogue.html")), page.locator(".cta-band a", { hasText: "Browse the catalogue" }).click()]);
    });

    test("on a phone: one card per row, pictures fit, Read more is a proper tap target, no sideways scroll", async () => {
      const { page } = await open("guides.html", PHONE);
      const r = await page.evaluate(() => {
        const cards = [...document.querySelectorAll(".g-card")].map((c) => c.getBoundingClientRect());
        return { lefts: new Set(cards.map((b) => Math.round(b.left))).size, fit: cards.every((b) => b.left >= 0 && b.right <= innerWidth), more: [...document.querySelectorAll(".g-more")].map((a) => Math.round(a.getBoundingClientRect().height)), sw: document.documentElement.scrollWidth, vw: innerWidth };
      });
      assert.equal(r.lefts, 1, "cards stack in a single column"); assert.equal(r.fit, true); assert.ok(r.more.every((h) => h >= 44), `Read more heights ${r.more}`); assert.ok(r.sw <= r.vw);
    });
  });

  /* ======================================================================== C */
  for (const [view, opts] of [["laptop", LAPTOP], ["phone", PHONE]]) for (const g of GUIDES) {
    describe(`C. ${g.file} on a ${view}`, () => {
      let c;
      before(async () => { c = await open(g.file, opts); await c.page.waitForTimeout(500); });
      after(closeAll);

      test("heading, breadcrumb, meta line, title tag and description", async () => {
        const { page } = c;
        assert.equal(await page.locator("h1").count(), 1);
        assert.equal((await page.locator("h1").innerText()).trim(), g.h1);
        assert.equal(await page.title(), `${g.tab || g.h1} — Perfume X Collections`);
        assert.equal(await page.locator('meta[name="description"]').getAttribute("content") !== "", true);
        const crumbs = await page.evaluate(() => [...document.querySelectorAll(".crumbs li")].map((li) => [li.textContent.trim(), li.querySelector("a")?.getAttribute("href") ?? null, li.getAttribute("aria-current")]));
        assert.deepEqual(crumbs, [["Home", "index.html", null], ["Guides", "guides.html", null], [g.card, null, "page"]]);
        const meta = await page.evaluate(() => ({ line: document.querySelector(".guide-meta").textContent.replace(/\s+/g, " ").trim(), dt: document.querySelector(".guide-meta time").getAttribute("datetime"), eyebrow: document.querySelector(".eyebrow").textContent.trim() }));
        assert.match(meta.line, /^\d+ min read By Perfume X Collections Updated November 2026$/); assert.equal(meta.dt, "2026-11-22"); assert.equal(meta.eyebrow, `${g.cat} · Guide`);
      });

      test("the stated reading time matches the length of the text (200 words a minute, within a minute), and the length is sensible", async () => {
        const r = await c.page.evaluate(() => {
          const words = [...document.querySelectorAll(".guide-lead, .guide-body")].map((e) => { const k = e.cloneNode(true); k.querySelectorAll("svg").forEach((s) => s.remove()); return k.textContent; }).join(" ").split(/\s+/).filter(Boolean).length;
          return { words, said: +document.querySelector(".guide-meta span").textContent.match(/\d+/)[0] };
        });
        assert.ok(r.words >= 800 && r.words <= 1500, `${r.words} words`);
        assert.ok(Math.abs(r.said - r.words / 200) <= 1, `says ${r.said} min for ${r.words} words`);
      });

      test("the contents list has exactly the guide's sections, and every item jumps to its heading (under the sticky header, with the address updated)", async () => {
        const { page } = c;
        const ids = await page.evaluate(() => [...document.querySelectorAll(".guide-body > section h2")].map((h) => h.id));
        const toc = await page.evaluate(() => [...document.querySelectorAll(".toc a")].map((a) => [a.getAttribute("href").slice(1), a.textContent.trim()]));
        assert.deepEqual(toc.map(([id]) => id), ids, "contents list = the headings, in order");
        assert.ok(toc.every(([, t]) => t.length > 2) && ids.every(Boolean));
        for (const [id] of toc) {
          await page.locator(`.toc a[href="#${id}"]`).click(); await settled(page);
          assert.equal(new URL(page.url()).hash, `#${id}`);
          const top = await page.evaluate((i) => { const h = document.getElementById(i), r = h.getBoundingClientRect(), head = document.querySelector(".site-header").getBoundingClientRect().bottom; return { top: Math.round(r.top), head: Math.round(head), vis: r.bottom <= innerHeight }; }, id);
          assert.ok(top.top >= top.head - 2 && top.top < 260, `${id}: heading sits at ${top.top}px (header ends ${top.head}px)`);
          assert.equal(top.vis, true);
        }
        await page.evaluate(() => scrollTo(0, 0)); await settled(page);
      });

      test("the page text is visible as soon as it loads, with no scrolling needed (the fade-in must never hide a long article)", async () => {
        const fresh = await open(g.file, opts);
        await fresh.page.waitForTimeout(700);
        const r = await fresh.page.evaluate(() => { const b = document.querySelector(".guide-body"), cs = getComputedStyle(b); return { opacity: cs.opacity, cls: b.className, hiddenTexts: [...b.querySelectorAll("p,li,h2")].filter((e) => getComputedStyle(e).visibility === "hidden" || getComputedStyle(e).opacity === "0").length }; });
        assert.equal(r.opacity, "1", `guide body opacity (${r.cls})`); assert.equal(r.hiddenTexts, 0);
        // and still true on a very small phone
        const tiny = await open(g.file, { viewport: { width: 320, height: 568 }, contextOptions: { hasTouch: true, isMobile: true } });
        await tiny.page.waitForTimeout(700);
        assert.equal(await tiny.page.evaluate(() => getComputedStyle(document.querySelector(".guide-body")).opacity), "1", "320px wide");
      });

      test("pictures and drawings: the top picture loads at 1200×630, every other picture loads, every drawing has a text description, nothing spills sideways", async () => {
        const { page } = c;
        await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } scrollTo(0, 0); });
        await page.waitForTimeout(600);
        const r = await page.evaluate(() => ({
          hero: (() => { const i = document.querySelector(".guide-hero img"); return { ok: i.complete && i.naturalWidth === 1200 && i.naturalHeight === 630, alt: i.alt, w: Math.round(i.getBoundingClientRect().width), vw: innerWidth }; })(),
          broken: [...document.images].filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.getAttribute("src")),
          noSize: [...document.images].filter((i) => !i.hasAttribute("width") || !i.hasAttribute("height")).map((i) => i.getAttribute("src")),
          svgs: [...document.querySelectorAll(".guide-body svg.fig-svg")].map((s) => ({ role: s.getAttribute("role"), label: (s.getAttribute("aria-label") || "").length, w: Math.round(s.getBoundingClientRect().width), parent: Math.round(s.parentElement.getBoundingClientRect().width) })),
          caps: [...document.querySelectorAll(".guide-body figure.fig")].map((f) => !!f.querySelector("figcaption")?.textContent.trim()),
          sw: document.documentElement.scrollWidth, vw: innerWidth,
        }));
        assert.equal(r.hero.ok, true); assert.ok(r.hero.alt.length > 15, "the top picture has a description"); assert.ok(r.hero.w <= r.vw);
        assert.deepEqual(r.broken, []); assert.deepEqual(r.noSize, [], "every picture reserves its space (no jumping)");
        assert.ok(r.svgs.length >= (g.file.includes("season") ? 0 : 1), "the guide carries its drawing");
        for (const s of r.svgs) { assert.equal(s.role, "img"); assert.ok(s.label > 60, "a real description of the drawing"); assert.ok(s.w <= s.parent + 1); }
        assert.ok(r.caps.every(Boolean), "every figure has a caption"); assert.ok(r.sw <= r.vw, `page is ${r.sw}px wide on a ${r.vw}px screen`);
      });

      test("every link in the guide goes somewhere real: the page exists (exact spelling), the #section exists, and nothing 404s", async () => {
        const { page } = c;
        // (the card pictures are links hidden from keyboard and screen readers, with a named link beside them: the audit test checks those)
        const links = await page.evaluate(() => [...document.querySelectorAll("main a[href]")].filter((a) => !(a.getAttribute("aria-hidden") === "true" && a.getAttribute("tabindex") === "-1")).map((a) => ({ href: a.getAttribute("href"), text: a.textContent.replace(/\s+/g, " ").trim(), blank: a.target === "_blank", rel: a.rel })));
        assert.ok(links.length >= 8, `${links.length} links`);
        for (const l of links) {
          assert.ok(l.text.length >= 3 || l.href.includes("catalogue"), `link text: "${l.text}"`);
          assert.doesNotMatch(l.text, /^(click here|here|read more|link)$/i, "descriptive link text");
          if (/^https?:/.test(l.href)) { assert.ok(l.blank && /noopener/.test(l.rel) && /noreferrer/.test(l.rel), `${l.href} opens safely`); continue; }
          const [file0, hash] = l.href.split("#"), file = (file0 || g.file).split("?")[0] || g.file;
          assert.ok(fs.existsSync(path.join(SITE_DIR, file)) && exactCase(SITE_DIR, file), `${l.href} → ${file}`);
          if (hash) assert.ok(idsIn(read(file)).has(hash), `${l.href}: no #${hash} on ${file}`);
        }
        assert.deepEqual(srv.missing, []);
      });

      test("the Keep reading row offers the other three guides (not this one), and each opens", async () => {
        const { page } = c;
        const row = await page.evaluate(() => [...document.querySelectorAll(".g-grid.three .g-card")].map((x) => [x.querySelector("h3 a").getAttribute("href"), x.querySelector("img").complete]));
        assert.deepEqual(row.map(([h]) => h), GUIDES.filter((x) => x.file !== g.file).map((x) => x.file));
        assert.ok(row.every(([, ok]) => ok));
        const other = GUIDES.find((x) => x.file !== g.file);
        await page.locator(`.g-grid.three a.g-more[href="${other.file}"]`).scrollIntoViewIfNeeded();
        await Promise.all([page.waitForURL((u) => u.pathname.endsWith(`/${other.file}`)), page.locator(`.g-grid.three a.g-more[href="${other.file}"]`).click()]);
        assert.equal((await page.locator("h1").innerText()).trim(), other.h1);
        await page.goBack(); await page.waitForLoadState("load");
      });

      test("the closing WhatsApp button opens a wa.me link with the right number and a real message, and the page stays put", async () => {
        const { page } = c;
        const btn = page.locator(".cta-band [data-wa]");
        const msg = await btn.getAttribute("data-wa");
        assert.ok(msg.length > 15 && msg.startsWith("Hi!"));
        await btn.scrollIntoViewIfNeeded(); await page.waitForTimeout(700);
        const url = page.url();
        await page.evaluate(() => { window.__wa.length = 0; });
        await btn.click();
        const wa = await page.evaluate(() => window.__wa);
        assert.deepEqual(wa, [`https://wa.me/${SITE.contact.whatsapp}?text=${encodeURIComponent(msg)}`]);
        assert.equal(page.url(), url);
      });
    });
  }

  describe("C2. things that only some guides have", () => {
    after(closeAll);
    test("spot guide: the figure has six numbered pins, matching the six numbered steps, and the page names the six spots in the same order", async () => {
      const { page } = await open("guide-spot-genuine-perfume.html");
      const r = await page.evaluate(() => ({ pins: [...document.querySelectorAll(".fig-svg .pinn")].map((t) => t.textContent), steps: [...document.querySelectorAll(".guide-body .steps > li > b:first-child")].map((b) => b.textContent.replace(/\.$/, "")) }));
      assert.deepEqual(r.pins, ["1", "2", "3", "4", "5", "6"]);
      assert.deepEqual(r.steps, ["Cellophane", "The box", "The bottle", "The cap", "The sprayer", "The liquid"]);
    });

    test("spot guide: the guarantee wording is the live one: the refund multiple and the audit stores come from the site settings", async () => {
      const a = await open("guide-spot-genuine-perfume.html");
      const read1 = (p) => p.evaluate(() => ({ mult: [...document.querySelectorAll("[data-mult-word]")].map((e) => e.textContent), stores: [...document.querySelectorAll("[data-audit-stores]")].map((e) => e.textContent) }));
      const d = await read1(a.page);
      assert.ok(d.mult.length >= 1 && d.mult.every((t) => t === "three times"));
      assert.ok(d.stores.length >= 1 && d.stores.every((t) => SITE.guarantee.auditStores.every((s) => t.includes(s))));
      const b = await open("guide-spot-genuine-perfume.html", { siteConfig: (t) => t.replace("multiple: 3", "multiple: 2") });
      const e = await read1(b.page);
      assert.ok(e.mult.every((t) => t !== "three times" && t.length > 2), `with a 2× guarantee it reads "${e.mult[0]}"`);
      assert.equal((await b.page.locator("main").innerText()).includes("three times"), false);
    });

    test("seasons guide: the season icons draw (five of them), and the quick-reference table has a heading for every column and a label on every cell", async () => {
      const { page } = await open("guide-perfume-for-every-season.html");
      assert.equal(await page.locator(".season-head svg.sicon").count(), 5);
      const t = await page.evaluate(() => [...document.querySelectorAll(".rtable")].map((tb) => { const heads = [...tb.querySelectorAll("thead th")].map((h) => h.textContent.trim()); return { heads, rows: [...tb.querySelectorAll("tbody tr")].map((r) => [...r.querySelectorAll("td")].map((d) => d.dataset.label)) }; }));
      assert.equal(t.length, 1);
      for (const row of t[0].rows) assert.deepEqual(row, t[0].heads.slice(1), "each cell's label is its column heading");
    });

    test("formats guide: on a phone the comparison table turns into one card per format with every cell labelled; on a laptop it stays a table", async () => {
      const ph = await open("guide-retail-tester-decant-discovery-set.html", PHONE);
      const p = await ph.page.evaluate(() => { const rows = [...document.querySelectorAll(".rtable tbody tr")]; return { n: rows.length, display: getComputedStyle(document.querySelector(".rtable tbody tr")).display, headVisible: (() => { const b = document.querySelector(".rtable thead").getBoundingClientRect(); return b.width > 2 && b.height > 2; })(), fit: rows.every((r) => r.getBoundingClientRect().right <= innerWidth), label: getComputedStyle(document.querySelector(".rtable td"), "::before").content }; });
      assert.equal(p.n, 4); assert.equal(p.display, "block"); assert.equal(p.headVisible, false); assert.equal(p.fit, true); assert.match(p.label, /What it is/);
      const lp = await open("guide-retail-tester-decant-discovery-set.html", LAPTOP);
      assert.equal(await lp.page.evaluate(() => getComputedStyle(document.querySelector(".rtable tbody tr")).display), "table-row");
    });

    test("formats guide: three real mini photos (spray, dab-on, vial) load and each has a description", async () => {
      const { page } = await open("guide-retail-tester-decant-discovery-set.html");
      await page.locator(".strip").scrollIntoViewIfNeeded(); await page.waitForTimeout(800);
      const r = await page.evaluate(() => [...document.querySelectorAll(".strip img")].map((i) => [i.complete && i.naturalWidth === 800, i.alt.length > 20, i.getAttribute("src")]));
      assert.equal(r.length, 3); assert.ok(r.every(([ok, alt]) => ok && alt), JSON.stringify(r));
      assert.deepEqual(r.map(([, , s]) => s.match(/--(\w+)\.jpg/)[1]), ["spray", "dab", "vial"]);
    });

    test("testers guide: the two court write-ups are cited with working-looking addresses, open in a new tab and say they are general information, not legal advice", async () => {
      const { page } = await open("guide-perfume-testers-explained.html");
      const r = await page.evaluate(() => ({ links: [...document.querySelectorAll(".sources a")].map((a) => [a.href, a.target, a.rel]), text: document.querySelector(".sources").textContent }));
      assert.deepEqual(r.links.map(([h]) => new URL(h).hostname), ["www.humphreys.co.uk", "legalblogs.wolterskluwer.com"]);
      assert.ok(r.links.every(([, t, rel]) => t === "_blank" && /noopener/.test(rel)));
      assert.match(r.text, /not legal advice/i);
      const body = await page.locator(".guide-body").innerText();
      for (const must of [/C-127\/09/, /Coty Germany GmbH v\. Xeryus Retail/, /July 2023/, /₹1 lakh/, /did not contest/, /grey area/i, /not an officially approved/i]) assert.match(body, must);
    });
  });

  /* ======================================================================== D */
  describe("D. what the guides say about our catalogue is true", () => {
    after(closeAll);
    const SECTIONS = { spring: ["Floral"], summer: ["Fresh & Citrus"], monsoon: ["Fresh & Citrus"], autumn: ["Amber & Spicy", "Leather & Smoky"], winter: ["Gourmand", "Oud & Woody"] };

    test("seasons guide: every pick is a real catalogue perfume, shown with its real house and name, and sits in a scent family that suits its season", async () => {
      const { page } = await open("guide-perfume-for-every-season.html");
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } });
      await page.waitForTimeout(500);
      const secs = await page.evaluate(() => [...document.querySelectorAll(".guide-body > section")].filter((s) => s.querySelector(".picks")).map((s) => ({
        id: s.querySelector("h2").id,
        picks: [...s.querySelectorAll(".pick")].map((a) => ({ href: a.getAttribute("href"), house: a.querySelector(".pick-house").textContent, name: a.querySelector(".pick-name").textContent, img: a.querySelector("img").getAttribute("src"), loaded: a.querySelector("img").complete && a.querySelector("img").naturalWidth === 240 })),
        browse: [...s.querySelectorAll(".more-link a")].map((a) => decodeURIComponent(a.getAttribute("href").split("fm=")[1])),
      })));
      assert.deepEqual(secs.map((s) => s.id), Object.keys(SECTIONS));
      const used = new Set();
      for (const s of secs) {
        assert.equal(s.picks.length, 3, `${s.id}: three picks`);
        assert.deepEqual(s.browse.sort(), [...SECTIONS[s.id]].sort(), `${s.id}: Browse links name the season's families`);
        for (const pk of s.picks) {
          const slug = pk.img.match(/thumbs\/(.+)\.jpg$/)[1], p = PRODUCTS.find((x) => x.s === slug);
          assert.ok(p, `${slug} is in the catalogue`); assert.equal(pk.house, p.b); assert.equal(pk.name, p.n);
          assert.equal(pk.href, `perfume-${p.s}.html`);
          assert.ok(SECTIONS[s.id].includes(p.fm), `${s.id}: ${p.b} ${p.n} is tagged "${p.fm}", expected ${SECTIONS[s.id]}`);
          assert.ok(p.v.some((v) => v.g === "Retail" || v.g === "Tester"), `${p.n} can actually be ordered`);
          assert.equal(pk.loaded, true, `${slug}: photo loads`); assert.ok(!used.has(slug), `${slug} used twice`); used.add(slug);
        }
      }
    });

    test("seasons guide: each pick opens that perfume's own page, with its name as the heading and every size listed (checked for all 15)", async () => {
      const hrefs = [...new Set([...read("guide-perfume-for-every-season.html").matchAll(/href="(perfume-[^"]+\.html)"/g)].map((m) => m[1]))];
      assert.equal(hrefs.length, 15);
      const bad = [];
      for (const href of hrefs) {
        const p = PRODUCTS.find((x) => `perfume-${x.s}.html` === href);
        if (!p) { bad.push(`${href}: no such perfume`); continue; }
        const { page } = await openPage(browser, href, { base: srv.base });
        opened.push({ context: page.context() });
        const h1 = (await page.locator("h1").innerText()).trim();
        if (h1 !== `${p.b} ${p.n}`) bad.push(`${href}: heading "${h1}"`);
        if ((await page.locator(".size").count()) !== p.v.length) bad.push(`${href}: sizes`);
        await page.context().close();
      }
      assert.deepEqual(bad, []);
    });

    test("every 'Browse all …' link opens the catalogue filtered to that scent family, with the right products, the right chip pressed and a filter tag", async () => {
      const links = [...new Set([...read("guide-perfume-for-every-season.html").matchAll(/href="(catalogue\.html\?fm=[^"]+)"/g)].map((m) => m[1]))];
      assert.equal(links.length, 6);
      for (const href of links) {
        const fm = decodeURIComponent(href.split("fm=")[1]);
        assert.ok(families.includes(fm), `${fm} is a real family`);
        const { page, errors } = await openPage(browser, "catalogue.html", { base: srv.base, query: href.slice("catalogue.html".length) });
        const got = await collect(page);
        assert.deepEqual(diff({ fm }, got), [], fm); assert.equal(got.ui.fm, fm); assert.equal(got.ui.badge, 1); assert.equal(got.ui.tags, 1); assert.deepEqual(errors, []);
        await page.context().close();
      }
    });

    test("formats guide: the Minis & vials and Sets links filter the catalogue correctly, and a mini without its own photo carries the small Mini label the guide describes", async () => {
      for (const g of ["Minis", "Sets"]) {
        const { page } = await openPage(browser, "catalogue.html", { base: srv.base, query: `?g=${g}` });
        const got = await collect(page);
        assert.deepEqual(diff({ g }, got), [], g); assert.equal(got.ui.g, g);
        if (g === "Minis") assert.ok(await page.locator("#grid .mini-badge").count() >= 1, "a Mini label is shown on at least one card");
        await page.context().close();
      }
      const html = read("guide-retail-tester-decant-discovery-set.html");
      assert.ok(html.includes("catalogue.html?g=Minis") && html.includes("catalogue.html?g=Sets"));
    });

    test("seasons guide: the scent-quiz button opens the quiz on the catalogue", async () => {
      const { page } = await open("guide-perfume-for-every-season.html");
      await Promise.all([page.waitForURL((u) => u.pathname.endsWith("/catalogue.html")), page.locator("a", { hasText: "Take the 1-minute scent quiz" }).click()]);
      await page.locator("#quiz-close").waitFor({ state: "visible", timeout: 5000 });
      assert.equal(await page.locator("#quiz").isVisible(), true);
    });

    test("testers guide: 'typically 10–30% cheaper, about 20% in the middle' is what the catalogue really shows for the same size, tester against retail", () => {
      const gaps = [];
      for (const p of PRODUCTS) for (const t of p.v.filter((v) => v.g === "Tester")) { const r = p.v.find((v) => v.g === "Retail" && v.mln === t.mln && v.pr > 0); if (r) gaps.push((1 - t.pr / r.pr) * 100); }
      gaps.sort((a, b) => a - b);
      assert.ok(gaps.length >= 12, `${gaps.length} same-size pairs`);
      const q = (f) => gaps[Math.floor(gaps.length * f)];
      assert.ok(q(0.5) >= 17 && q(0.5) <= 23, `median ${q(0.5).toFixed(1)}%`);
      assert.ok(q(0.25) >= 10 && q(0.75) <= 30, `middle half ${q(0.25).toFixed(1)}–${q(0.75).toFixed(1)}%`);
      assert.match(read("guide-perfume-testers-explained.html"), /typically <b>10–30% cheaper<\/b>, with about 20% in the middle/);
    });

    test("testers guide: 'every tester is listed as a Tester' and the 'No Box' example is real", () => {
      const testers = PRODUCTS.flatMap((p) => p.v.filter((v) => v.g === "Tester"));
      assert.ok(testers.length > 200 && testers.every((v) => v.p === "Tester"));
      assert.ok(testers.some((v) => /No Box/.test(v.r)), "at least one tester really carries a 'No Box' note");
      assert.match(read("guide-retail-tester-decant-discovery-set.html"), /every tester is listed as a <b>Tester<\/b>/);
    });

    test("the guides promise nothing the site does not: no phone number, no 'legal' guarantee, no guaranteed results, no made-up prices in rupees except the worked example and the court costs", () => {
      for (const f of GUIDE_FILES.concat("guides.html")) {
        const t = read(f).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
        assert.ok(!t.includes(SITE.contact.whatsapp.slice(-10)), `${f}: phone number`);
        assert.doesNotMatch(t, /\b(100% legal|completely legal|totally legal|perfectly legal|guaranteed to last|never fake|always genuine)\b/i, f);
        const rupees = (t.match(/₹[\d,]+(?: lakh)?/g) || []);
        const allowed = f.includes("retail-tester-decant") ? ["₹10,000", "₹100", "₹750", "₹150"] : f.includes("testers-explained") ? ["₹1 lakh"] : [];
        assert.deepEqual([...new Set(rupees)].sort(), allowed.sort(), `${f}: amounts in rupees`);
      }
      assert.match(read("guide-retail-tester-decant-discovery-set.html"), /illustrative numbers, not our prices/);
    });

    test("no doubled words, no stray markup and no leftover placeholders in any guide's text", async () => {
      for (const f of GUIDE_FILES) {
        const { page } = await open(f);
        const t = await page.locator("main").innerText();
        const dbl = [...t.matchAll(/\b([A-Za-z]{2,})\s+\1\b/gi)].map((m) => m[0]).filter((w) => !/^(had had|that that)$/i.test(w));
        assert.deepEqual(dbl, [], `${f}: doubled words`);
        assert.doesNotMatch(t, /\b(undefined|NaN|TODO|FIXME|lorem|\[object)\b|\{\{|<\/?[a-z]+>|&amp;|&nbsp;/i, f);
      }
    });
  });

  /* ======================================================================== E */
  describe("E. the new catalogue links (?fm=, ?g=)", () => {
    after(closeAll);
    const run = async (query, F) => {
      const { page, errors } = await openPage(browser, "catalogue.html", { base: srv.base, query });
      opened.push({ context: page.context() });
      const got = await collect(page);
      await page.context().close();
      return { problems: diff(F, got), got, errors };
    };
    test("a valid family and a valid size are applied, together and with the old links (?style=, ?q=)", async () => {
      for (const [q, F] of [
        ["?fm=Floral", { fm: "Floral" }], ["?g=Tester", { g: "Tester" }], ["?g=Retail", { g: "Retail" }],
        ["?fm=Fresh%20%26%20Citrus&g=Tester", { fm: "Fresh & Citrus", g: "Tester" }],
        ["?style=arabian&fm=Gourmand&g=Retail", { seg: "arabian", fm: "Gourmand", g: "Retail" }],
        ["?q=Khamrah&g=Tester", { q: "Khamrah", g: "Tester" }],
      ]) { const r = await run(q, F); assert.deepEqual(r.problems, [], q); assert.deepEqual(r.errors, [], q); }
    });
    test("anything that is not a real filter value is ignored (the catalogue opens in its normal state) and nothing from the address ends up on the page", async () => {
      for (const q of ["?fm=Nope", "?fm=", "?g=Everything", "?g=retail", "?fm=__none__&g=all", "?fm=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E", "?g=Minis%27%3B%20drop"]) {
        const r = await run(q, {});
        assert.deepEqual(r.problems, [], q); assert.deepEqual(r.errors, [], q);
        assert.equal(r.got.ui.badge, 0, `${q}: no filter applied`);
      }
      const { page } = await open("catalogue.html", { query: "?fm=%3Cimg%20src%3Dx%20onerror%3Dwindow.__x%3D1%3E" });
      assert.equal(await page.evaluate(() => window.__x ?? null), null); assert.equal(await page.locator("#grid img[src='x']").count(), 0);
    });
    test("after the page opens the address is tidied (no ?fm= left to be re-applied by a refresh), and the filter can be cleared like any other", async () => {
      const { page } = await open("catalogue.html", { query: "?fm=Floral&g=Tester" });
      await page.waitForTimeout(300);
      assert.equal(new URL(page.url()).search, "");
      await page.locator("#reset").click();
      assert.deepEqual(diff({}, await collect(page)), []);
    });
  });
});

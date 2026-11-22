// Privacy Policy + Terms of Service pages (linked from every footer), the order journey they describe, and the
// "November 2026" last-updated date that must be the same everywhere.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SITE, PRODUCTS, SITE_DIR } from "./lib/data.mjs";
import { launch, openPage } from "./lib/browser.mjs";
import { fmtPrice } from "./lib/oracle.mjs";
import { PAGE_FILES, isSitePage } from "./lib/pages.mjs";

const HTML = fs.readdirSync(SITE_DIR).filter(isSitePage).sort();
const ALL_PAGES = PAGE_FILES.map((f) => f.replace(".html", ""));

describe("privacy policy, terms of service and the updated date", () => {
  let browser;
  const opened = [];
  const open = async (file, opts) => { const c = await openPage(browser, file, opts); opened.push(c); return c.page; };
  const PHONE = (width = 390) => ({ viewport: { width, height: 844 }, contextOptions: { hasTouch: true, isMobile: true } });
  before(async () => { browser = await launch(); });
  after(async () => { await browser.close(); });

  describe("the footer of every page", () => {
    test("there are exactly thirteen pages (nine pages and four guides), and every one lists Privacy Policy and Terms of Service after Contact", async () => {
      assert.deepEqual(HTML.map((f) => f.replace(".html", "")).sort(), [...ALL_PAGES].sort());
      for (const pg of ALL_PAGES) {
        const p = await open(`${pg}.html`);
        const links = await p.locator(".site-footer .foot-nav a").evaluateAll((els) => els.map((a) => [a.textContent.trim(), a.getAttribute("href")]));
        assert.deepEqual(links.slice(-3), [["Contact", "contact.html"], ["Privacy Policy", "privacy.html"], ["Terms of Service", "terms.html"]], pg);
      }
    });

    test("each link opens its own page (one h1, right title) from every page", async () => {
      for (const pg of ALL_PAGES) for (const [label, file, h1] of [["Privacy Policy", "privacy.html", "Privacy Policy"], ["Terms of Service", "terms.html", "Terms of Service"]]) {
        const p = await open(`${pg}.html`);
        await Promise.all([p.waitForURL((u) => u.pathname.endsWith(file)), p.locator(".site-footer .foot-nav a", { hasText: label }).click()]);
        await p.waitForLoadState("load");
        assert.equal(await p.locator("h1").count(), 1, `${pg} → ${file}`);
        assert.equal((await p.textContent("h1")).trim(), h1);
        assert.match(await p.title(), new RegExp(`^${h1} — Perfume X Collections$`));
      }
    });

    test("on a phone the two footer links are at least 44px tall and the footer doesn't spill sideways", async () => {
      for (const pg of ["index", "terms"]) {
        const p = await open(`${pg}.html`, PHONE(320));
        const m = await p.evaluate(() => ({ h: [...document.querySelectorAll('.foot-nav a[href="privacy.html"], .foot-nav a[href="terms.html"]')].map((a) => Math.round(a.getBoundingClientRect().height)), doc: document.documentElement.scrollWidth, vw: innerWidth }));
        m.h.forEach((h) => assert.ok(h >= 44, `${pg}: footer link is ${h}px tall`));
        assert.ok(m.doc <= m.vw);
      }
    });

    test("the legal pages keep the same header, theme switch, cart and footer as every other page", async () => {
      for (const pg of ["privacy", "terms"]) {
        const p = await open(`${pg}.html`);
        for (const sel of ["#nav", "#theme-toggle", "#cart-open", "#menu-btn", ".skip", ".site-footer .legal"]) assert.equal(await p.locator(sel).count(), 1, `${pg}: ${sel}`);
        assert.equal(await p.locator('#nav a[aria-current="page"]').count(), 0, "no header link claims to be this page");
        assert.equal(await p.locator("#nav a").count(), 6);
      }
    });
  });

  describe("Terms of Service", () => {
    test("the order journey is told in the right order: WhatsApp request → availability → payment + screenshot → we confirm receipt → packing within 48 hours → shipped in 3–4 days by state → courier updates on your number", async () => {
      const p = await open("terms.html");
      const steps = (await p.locator("ol.steps li").allTextContents()).map((t) => t.replace(/\s+/g, " ").trim());
      const want = [/send your request on WhatsApp/i, /confirm availability/i, /payment.*screenshot.*WhatsApp/i, /confirm we have received it/i, /Packing begins within 48 hours/i, /shipped within 3–4 days.*which state in India/i, /courier service sends you updates.*phone number you gave us/i];
      assert.equal(steps.length, want.length);
      want.forEach((re, i) => assert.match(steps[i], re, `step ${i + 1}: ${steps[i]}`));
    });

    test("payment is on WhatsApp (not on the site), by screenshot, and only confirmed when we acknowledge it", async () => {
      const t = (await (await open("terms.html")).textContent(".prose")).replace(/\s+/g, " ");
      assert.match(t, /Payment is made through WhatsApp, not on this website/);
      assert.match(t, /never ask for card details here/);
      assert.match(t, /send us a screenshot/);
      assert.match(t, /confirmed only once we tell you we have received your payment/);
      assert.match(t, /never ask for your OTP or banking password/);
    });

    test("the 'not sure yet?' advice is to start with a mini vial, shows the real from-price, and says you can order again", async () => {
      const p = await open("terms.html");
      const section = (await p.locator(".prose h2.h3", { hasText: "Not sure about ordering yet?" }).evaluate((h) => h.nextElementSibling.textContent)).replace(/\s+/g, " ");
      const cheapestVial = Math.min(...PRODUCTS.flatMap((x) => x.v).filter((v) => v.g === "Minis").map((v) => v.pr));
      assert.match(section, /mini vial/i);
      assert.ok(section.includes(`from ${fmtPrice(cheapestVial)}`), `shows the cheapest vial price ${fmtPrice(cheapestVial)}: ${section}`);
      assert.match(section, /genuine and authentic/);
      assert.match(section, /always welcome to order again/);
      assert.doesNotMatch(section, /minimum order/i, "it recommends mini vials, not a minimum order value");
    });

    test("the vial price follows the product data (change the data, the page changes)", async () => {
      const p = await open("terms.html");
      assert.equal(await p.textContent(".prose [data-stat='vial']"), fmtPrice(Math.min(...PRODUCTS.flatMap((x) => x.v).filter((v) => v.g === "Minis").map((v) => v.pr))));
    });

    test("it links to the guarantee terms and the privacy policy, and the links work", async () => {
      const p = await open("terms.html");
      assert.deepEqual(await p.locator(".prose a").evaluateAll((els) => els.map((a) => a.getAttribute("href"))), ["guarantee.html#terms", "privacy.html"]);
    });

    test("short and plain: ten numbered sections, under 700 words", async () => {
      const p = await open("terms.html");
      assert.deepEqual(await p.locator(".prose h2.h3").allTextContents(), ["Using this site", "Prices and availability", "How your order works", "Payment", "Not sure about ordering yet?", "Delivery", "Authenticity", "Brands and content", "Our responsibility", "Changes and contact"].map((t, i) => `${i + 1}. ${t}`));
      const words = (await p.textContent(".prose")).trim().split(/\s+/).length;
      assert.ok(words < 700, `${words} words`);
    });
  });

  describe("Privacy Policy", () => {
    test("covers what is collected, device storage, use, sharing with the courier, other services, keeping, choices and changes", async () => {
      const p = await open("privacy.html");
      assert.deepEqual(await p.locator(".prose h2.h3").allTextContents(), ["What we collect", "On your device", "How we use it", "Who we share it with", "Other services this site uses", "How long we keep it", "Your choices", "Changes and contact"]);
      const t = (await p.textContent(".prose")).replace(/\s+/g, " ");
      assert.match(t, /name, phone number, delivery address.*payment screenshot/);
      assert.match(t, /no accounts and no checkout.*never asks for card or banking details/);
      assert.match(t, /cart and your light or dark mode choice are saved in your own browser/);
      assert.match(t, /courier service so they can deliver.*delivery updates/);
      assert.match(t, /don't sell your information/);
      assert.match(t, /Netlify.*Google Fonts.*don't use advertising trackers/);
      assert.match(t, /show, correct or delete/);
      assert.ok(t.trim().split(" ").length < 500, "short");
    });

    test("what it says about the site is true: no tracking scripts or third-party hosts beyond fonts (nothing is LOADED from elsewhere; the only outbound links are the two cited court write-ups on the testers guide)", () => {
      const CITED = ["https://www.humphreys.co.uk", "https://legalblogs.wolterskluwer.com"];
      const own = (h) => /fonts\.(googleapis|gstatic)\.com$/.test(h) || h === "https://perfume-x-collections.netlify.app";   // (the site's own address is the canonical link, not something loaded)
      const outbound = [];
      for (const f of HTML) {
        const src = fs.readFileSync(path.join(SITE_DIR, f), "utf8");
        // things the page LOADS: scripts, stylesheets, images, frames, media, preconnects
        const loaded = [...src.matchAll(/<(?:script|link|img|iframe|source|video|audio|embed|object)\b[^>]*?\b(?:src|href|data)="(https?:\/\/[^"/]+)/g)].map((m) => m[1]).filter((h) => !own(h));
        assert.deepEqual(loaded, [], `${f} loads from somewhere unexpected`);
        // links a visitor may choose to follow
        for (const m of src.matchAll(/<a\b[^>]*?href="(https?:\/\/[^"/]+)[^"]*"[^>]*>/g)) if (!own(m[1])) outbound.push([f, m[1], /target="_blank"/.test(m[0]) && /rel="[^"]*noopener[^"]*noreferrer/.test(m[0])]);
      }
      assert.deepEqual([...new Set(outbound.map(([f]) => f))], ["guide-perfume-testers-explained.html"], "only the testers guide cites outside sources");
      assert.deepEqual([...new Set(outbound.map(([, h]) => h))].sort(), [...CITED].sort());
      assert.ok(outbound.every(([, , safe]) => safe), "every outbound link opens in a new tab with rel=noopener noreferrer");
      for (const f of fs.readdirSync(path.join(SITE_DIR, "assets/js"))) {
        const src = fs.readFileSync(path.join(SITE_DIR, "assets/js", f), "utf8");
        assert.doesNotMatch(src, /google-analytics|googletagmanager|gtag\(|fbq\(|hotjar|segment\.com|document\.cookie/i, `${f} contains tracking or cookies`);
      }
    });
  });

  describe("both pages", () => {
    for (const pg of ["privacy", "terms"]) {
      test(`${pg}: the 'Message us on WhatsApp' button builds the real link only when tapped, and never writes the number into the page`, async () => {
        const p = await open(`${pg}.html`);
        const btn = p.locator(".cta-band a[data-wa]");
        assert.equal(await btn.getAttribute("href"), "contact.html");
        assert.doesNotMatch(await p.content(), new RegExp(SITE.contact.whatsapp));
        await btn.click();
        const sent = await p.evaluate(() => window.__wa);
        assert.equal(sent.length, 1);
        assert.match(sent[0], new RegExp(`wa\\.me/${SITE.contact.whatsapp}`));
        assert.match(new URL(sent[0]).searchParams.get("text"), /^Hi! I have a question/);
      });

      test(`${pg}: no sideways scroll or clipped text from a 320px phone to a wide screen`, async () => {
        for (const w of [320, 390, 768, 1280, 1920]) {
          const p = await open(`${pg}.html`, { viewport: { width: w, height: 800 } });
          const m = await p.evaluate(() => ({ doc: document.documentElement.scrollWidth, vw: innerWidth, wide: [...document.querySelectorAll(".prose *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length }));
          assert.ok(m.doc <= m.vw && m.wide === 0, `${pg} @${w}`);
        }
      });
    }
  });

  describe("the last-updated date is November 2026 everywhere", () => {
    test("the config says so, and no file in the site mentions the old date", () => {
      assert.equal(SITE.pricesUpdated, "November 2026");
      const bad = [];
      const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
        const f = path.join(d, e.name);
        if (e.isDirectory()) return walk(f);
        if (!/\.(html|js|css|json)$/.test(e.name)) return;
        const src = fs.readFileSync(f, "utf8");
        if (/30 August|August 2026/.test(src)) bad.push(path.relative(SITE_DIR, f));
      });
      walk(SITE_DIR);
      assert.deepEqual(bad, []);
    });

    test("every page shows 'November 2026' in each place it states the date - in the HTML itself and once the page has run", async () => {
      for (const f of HTML) {
        const src = fs.readFileSync(path.join(SITE_DIR, f), "utf8");
        const spans = [...src.matchAll(/<span data-updated>([^<]*)<\/span>/g)].map((m) => m[1]);
        assert.ok(spans.length >= 1, `${f} states the date`);
        spans.forEach((s) => assert.equal(s, "November 2026", `${f}: static text`));
        const p = await open(f);
        const live = await p.locator("[data-updated]").allTextContents();
        assert.equal(live.length, spans.length);
        live.forEach((s) => assert.equal(s, "November 2026", `${f}: on screen`));
      }
    });

    test("changing the one setting changes the date on every page", async () => {
      for (const f of ["index.html", "terms.html", "how-to-order.html", "guarantee.html"]) {
        const p = await open(f, { siteConfig: (t) => t.replace('pricesUpdated: "November 2026"', 'pricesUpdated: "January 2027"') });
        const live = await p.locator("[data-updated]").allTextContents();
        assert.ok(live.length > 0 && live.every((s) => s === "January 2027"), f);
      }
    });
  });

  test("no console errors or failed requests", () => assert.deepEqual(opened.flatMap((o) => o.errors), []));
});

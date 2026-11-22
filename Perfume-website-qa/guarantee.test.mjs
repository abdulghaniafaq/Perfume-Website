// The Guarantee page's claim rules: audits only at reputed stores, no independent audits, and the rules that
// stop fake or random reports. The store names and claim window come from data/site-config.js.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { launch, openPage } from "./lib/browser.mjs";
import { SITE, SITE_DIR } from "./lib/data.mjs";

const html = (name) => fs.readFileSync(path.join(SITE_DIR, name), "utf8");
const list = (stores) => (stores.length > 1 ? `${stores.slice(0, -1).join(", ")} or ${stores.at(-1)}` : stores.join(""));
const text = (page, sel) => page.locator(sel).evaluateAll((els) => els.map((e) => e.textContent.replace(/\s+/g, " ").trim()));

describe("Guarantee page — claim rules", () => {
  let browser, ctx;
  before(async () => { browser = await launch(); ctx = await openPage(browser, "guarantee.html"); });
  after(async () => { await browser.close(); });
  const page = () => ctx.page;

  test("settings: the four reputed stores and a claim window are set", () => {
    assert.deepEqual(SITE.guarantee.auditStores, ["Sephora", "Nykaa", "Shoppers Stop", "Parcos"]);
    assert.ok(Number.isInteger(SITE.guarantee.claimDays) && SITE.guarantee.claimDays > 0);
  });

  describe("who may audit", () => {
    test("the page says audits are done in person at a reputed store, naming them", async () => {
      const notice = (await text(page(), "#claim .notice"))[0];
      assert.match(notice, /in person at a reputed store/i);
      for (const s of SITE.guarantee.auditStores) assert.ok(notice.includes(s), `${s} should be named`);
      assert.deepEqual(await text(page(), "#claim .store-pills li"), SITE.guarantee.auditStores);
      assert.match(notice, /anywhere in the world/);
    });

    test("it says independent and fake audits will not be entertained, and which kinds are refused", async () => {
      const notice = (await text(page(), "#claim .notice"))[0];
      assert.match(notice, /no independent or fake audit will be entertained/i);
      for (const refused of ["Independent labs", "online or app-based checks", "other sellers", "local shops", "self-made reports"]) assert.ok(notice.includes(refused), `should refuse: ${refused}`);
    });

    test("the headline paragraph and the terms agree (no 'any lab or expert' left anywhere on the site)", async () => {
      const hero = (await text(page(), ".guarantee-grid"))[0];
      for (const s of SITE.guarantee.auditStores) assert.ok(hero.includes(s));
      for (const f of ["index.html", "catalogue.html", "how-to-order.html", "guarantee.html", "faq.html", "contact.html"])
        assert.doesNotMatch(html(f), /any lab|independently authenticated|lab or expert|fake-audit claim/i, `${f} still has the old wording`);
      const terms = (await text(page(), "#terms"))[0];
      assert.match(terms, /Audit claim\. A claim is applicable only when the item has been audited in person at a reputed store/);
      assert.match(terms, /Independent or self-arranged audits are not accepted/);
    });
  });

  describe("the rules against fake or random reports", () => {
    const rules = [
      ["Tell us first", /within \d+ days of delivery, before the bottle goes to the store/],
      ["Film the unboxing", /continuous, unedited video/],
      ["A proper written report", /letterhead.*named staff member.*batch code.*not genuine/],
      ["We confirm it with the store", /contact the store directly/],
      ["It must be the bottle we sent", /batch code.*dispatch records.*comes back to us for inspection before we pay out/],
      ["One bottle, one report", /can't be reused or shared/],
      ["It has to say “not genuine”", /Unable to verify.*we don't stock this brand.*not a counterfeit/],
      ["Fraud voids the guarantee", /forged, altered or reused report.*refuse future orders/],
    ];

    test("all eight rules are listed, in order, each with its lead-in", async () => {
      const items = await text(page(), "#claim .claim-rules li");
      assert.equal(items.length, rules.length);
      rules.forEach(([lead, body], i) => { assert.ok(items[i].startsWith(lead), `rule ${i + 1} should start "${lead}", got "${items[i].slice(0, 40)}"`); assert.match(items[i], body, `rule ${i + 1} (${lead})`); });
      assert.equal(await page().locator("#claim .claim-rules li b").count(), rules.length);
    });

    test("each rule is numbered by a counter drawn beside it (1–8), with no bullet of its own", async () => {
      // (the browser reports the counter's formula, not the digit it resolves to, so check the wiring)
      const wired = await page().evaluate(() => {
        const ol = document.querySelector("#claim .claim-rules");
        return {
          reset: getComputedStyle(ol).counterReset, bullet: getComputedStyle(ol).listStyleType,
          items: [...ol.children].map((li) => ({ inc: getComputedStyle(li).counterIncrement, mark: getComputedStyle(li, "::before").content })),
        };
      });
      assert.equal(wired.reset, "rule 0");
      assert.equal(wired.bullet, "none");
      assert.equal(wired.items.length, rules.length);
      wired.items.forEach((it) => assert.deepEqual(it, { inc: "rule 1", mark: "counter(rule)" }));
    });
  });

  describe("settings drive the text", () => {
    test("the claim window and store list on the page match the settings (and the plain HTML already says the same)", async () => {
      const days = SITE.guarantee.claimDays, stores = list(SITE.guarantee.auditStores);
      for (const f of ["guarantee.html", "faq.html"]) {
        const raw = html(f);
        for (const m of raw.matchAll(/data-claim-days>(\d+)</g)) assert.equal(+m[1], days, `${f}: static days`);
        for (const m of raw.matchAll(/data-audit-stores>([^<]+)</g)) assert.equal(m[1], stores, `${f}: static stores`);
      }
      assert.deepEqual([...new Set(await text(page(), "[data-claim-days]"))], [String(days)]);
      assert.deepEqual([...new Set(await text(page(), "[data-audit-stores]"))], [stores]);
    });

    test("change the settings and every mention follows — pills, sentences, claim window", async () => {
      const c = await openPage(browser, "guarantee.html", {
        siteConfig: (s) => s.replace('auditStores: ["Sephora", "Nykaa", "Shoppers Stop", "Parcos"]', 'auditStores: ["Harrods", "Selfridges"]').replace("claimDays: 7", "claimDays: 10"),
      });
      assert.deepEqual(await text(c.page, "#claim .store-pills li"), ["Harrods", "Selfridges"]);
      assert.deepEqual([...new Set(await text(c.page, "[data-audit-stores]"))], ["Harrods or Selfridges"]);
      assert.deepEqual([...new Set(await text(c.page, "[data-claim-days]"))], ["10"]);
      assert.deepEqual(c.errors, []);
      await c.context.close();
    });
  });

  describe("FAQ and links", () => {
    test("the FAQ answer sends people to a reputed store, within the claim window, and links to the rules", async () => {
      const f = await openPage(browser, "faq.html");
      const answer = (await text(f.page, '.faq details:has(summary:has-text("refund guarantee work"))'))[0];
      for (const s of SITE.guarantee.auditStores) assert.ok(answer.includes(s));
      assert.match(answer, new RegExp(`within ${SITE.guarantee.claimDays} days of delivery`));
      assert.match(answer, /Independent labs, apps and other audits aren't accepted/);
      assert.equal(await f.page.locator('.faq a[href="guarantee.html#claim"]').count(), 1);
      assert.deepEqual(f.errors, []);
      await f.context.close();
    });

    test("the '#claim' link in the details box jumps to the rules, and the footer's '#terms' link still works", async () => {
      assert.equal(await page().locator('.details a[href="#claim"]').count(), 1);
      assert.equal(await page().locator("#claim").count(), 1);
      assert.equal(await page().locator("#terms").count(), 1);
      assert.equal(await page().locator('.site-footer a[href="guarantee.html#terms"]').count(), 1);
    });

    test("heading order: one h1, 'Making a claim' (h2) with its h3, then the terms (h2)", async () => {
      assert.equal(await page().locator("h1").count(), 1);
      assert.deepEqual(await text(page(), "#claim h2, #claim h3, #terms h2"), ["Making a claim", "So every claim is genuine and quick to settle", "Authenticity guarantee & terms"]);
    });
  });

  test("no console errors", () => assert.deepEqual(ctx.errors, []));
});

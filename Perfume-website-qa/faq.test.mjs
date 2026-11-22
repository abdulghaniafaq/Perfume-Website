// FAQ boxes (the FAQ page and "How to order"): closed to begin with; opening one closes whichever other box was open.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SITE_DIR } from "./lib/data.mjs";
import { launch, openPage } from "./lib/browser.mjs";
import { mulberry32 } from "./lib/scenarios.mjs";
import { isSitePage } from "./lib/pages.mjs";

const FAQS = [["faq.html", 14], ["how-to-order.html", 3]];

describe("FAQ boxes: closed by default, one open at a time", () => {
  let browser;
  const opened = [];
  const open = async (file, opts) => { const c = await openPage(browser, file, opts); opened.push(c); return c.page; };
  const PHONE = { viewport: { width: 390, height: 844 }, contextOptions: { hasTouch: true, isMobile: true } };
  before(async () => { browser = await launch(); });
  after(async () => { await browser.close(); });

  const openIdx = (p) => p.locator(".faq details").evaluateAll((els) => els.map((e, i) => (e.open ? i : -1)).filter((i) => i >= 0));
  const sum = (p, i) => p.locator(".faq summary").nth(i);

  test("no page ships with a box already open, and every box on the site is inside a .faq group", () => {
    for (const f of fs.readdirSync(SITE_DIR).filter(isSitePage)) {
      const src = fs.readFileSync(path.join(SITE_DIR, f), "utf8");
      assert.doesNotMatch(src, /<details[^>]*\bopen\b/, `${f} has a box open by default`);
      const all = (src.match(/<details/g) || []).length, grouped = ((src.match(/<div class="faq">[\s\S]*?<\/div>/) || [""])[0].match(/<details/g) || []).length;
      assert.equal(all, grouped, `${f}: every <details> sits in the .faq group, so the one-at-a-time rule covers it`);
    }
  });

  for (const [file, n] of FAQS) {
    describe(file, () => {
      test(`${n} boxes, all closed on arrival and after a reload; answers hidden`, async () => {
        const p = await open(file);
        assert.equal(await p.locator(".faq details").count(), n);
        assert.deepEqual(await openIdx(p), []);
        for (let i = 0; i < n; i++) assert.equal(await p.locator(".faq details").nth(i).locator("p").first().isHidden(), true, `answer ${i} hidden`);
        await sum(p, 1).click();
        await p.reload();
        assert.deepEqual(await openIdx(p), [], "closed again after reloading");
      });

      test("clicking a box opens it and shows its answer; clicking another opens that one and closes the first; clicking the open one closes it", async () => {
        const p = await open(file);
        await sum(p, 0).click();
        assert.deepEqual(await openIdx(p), [0]);
        assert.equal(await p.locator(".faq details").nth(0).locator("p").first().isVisible(), true);
        await sum(p, n - 1).click();
        assert.deepEqual(await openIdx(p), [n - 1], "the earlier box closed by itself");
        assert.equal(await p.locator(".faq details").nth(0).locator("p").first().isHidden(), true);
        assert.equal(await p.locator(".faq details").nth(n - 1).locator("p").first().isVisible(), true);
        await sum(p, n - 1).click();
        assert.deepEqual(await openIdx(p), [], "nothing has to stay open");
      });

      test("60 seeded random clicks: never more than one open, and it is always the one just opened", async () => {
        const p = await open(file);
        const rnd = mulberry32(n * 101);
        let model = -1;
        for (let k = 0; k < 60; k++) {
          const i = Math.floor(rnd() * n);
          await sum(p, i).click();
          model = model === i ? -1 : i;
          assert.deepEqual(await openIdx(p), model === -1 ? [] : [model], `after click ${k + 1} on box ${i}`);
        }
      });

      test("keyboard: Enter / Space open a box, and opening another still closes the first", async () => {
        const p = await open(file);
        await p.locator(".faq summary").first().focus();
        await p.keyboard.press("Enter");
        assert.deepEqual(await openIdx(p), [0]);
        await p.keyboard.press("Tab");
        await p.keyboard.press("Space");
        assert.deepEqual(await openIdx(p), [1], "second box opened with Space, first closed");
        await p.keyboard.press("Space");
        assert.deepEqual(await openIdx(p), []);
      });

      test("on a phone a tap does the same", async () => {
        const p = await open(file, PHONE);
        await sum(p, 0).tap();
        await sum(p, 1).tap();
        assert.deepEqual(await openIdx(p), [1]);
      });

      test("the open box's answer stays inside the screen on a small phone, and each question is a 44px target", async () => {
        const p = await open(file, { viewport: { width: 320, height: 640 }, contextOptions: { hasTouch: true, isMobile: true } });
        await sum(p, 0).tap();
        const m = await p.evaluate(() => ({ doc: document.documentElement.scrollWidth, vw: innerWidth, h: [...document.querySelectorAll(".faq summary")].map((s) => Math.round(s.getBoundingClientRect().height)) }));
        assert.ok(m.doc <= m.vw);
        m.h.forEach((h) => assert.ok(h >= 44, `a question is ${h}px tall`));
      });
    });
  }

  test("no console errors or failed requests", () => assert.deepEqual(opened.flatMap((o) => o.errors), []));
});

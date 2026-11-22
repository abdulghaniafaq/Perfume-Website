// Contact page: the masked phone number, the "Request a perfume" form and its catalogue suggestions.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { SITE, PRODUCTS } from "./lib/data.mjs";
import { launch, openPage } from "./lib/browser.mjs";
import { normalize, spec, BANDS, fmtPrice } from "./lib/oracle.mjs";

const NUMBER = SITE.contact.whatsapp;                      // e.g. 916386609272
const LEAK = new RegExp(`${NUMBER}|${NUMBER.slice(2, 7)}|${NUMBER.slice(-5)}|63866 09272`);   // any recognisable slice of it
const decode = (u) => decodeURIComponent(u);
const waText = (u) => { assert.ok(u.startsWith(`https://wa.me/${NUMBER}?text=`), `not a WhatsApp link: ${u.slice(0, 60)}`); return decode(u.slice(`https://wa.me/${NUMBER}?text=`.length)); };
const wa = (page) => page.evaluate(() => window.__wa);

describe("Contact page", () => {
  let browser;
  const opened = [];
  const open = async (file = "contact.html", opts) => { const c = await openPage(browser, file, opts); opened.push(c); return c.page; };
  before(async () => { browser = await launch(); });
  after(async () => { await browser.close(); });

  describe("phone number is masked", () => {
    test("the page shows a masked number and never the real digits (text or markup)", async () => {
      const p = await open();
      assert.equal((await p.locator("#contact-actions .btn").first().textContent()).trim(), "Chat on WhatsApp · +91 ••••• ••272");
      const html = await p.content(), text = await p.evaluate(() => document.body.innerText);
      assert.doesNotMatch(html, LEAK, "number found in the page markup");
      assert.doesNotMatch(text, LEAK, "number found in the visible text");
      const attrs = await p.evaluate(() => [...document.querySelectorAll("*")].flatMap((e) => [...e.attributes].map((a) => a.value)).filter((v) => /\d{5,}/.test(v)));
      assert.deepEqual(attrs.filter((v) => LEAK.test(v)), []);
    });

    test("every page of the site is free of the number (with a cart that has items)", async () => {
      const cartKey = "perfume-x-cart-v1";
      const item = PRODUCTS[0], cart = JSON.stringify([{ k: [item.s, item.v[0].m, item.v[0].p, item.v[0].r].join("|"), qty: 2 }]);
      for (const file of ["index.html", "catalogue.html", "how-to-order.html", "guarantee.html", "faq.html", "contact.html", "privacy.html", "terms.html"]) {
        const p = await open(file, { storage: { [cartKey]: cart } });
        assert.doesNotMatch(await p.content(), LEAK, `${file} exposes the number`);
        assert.ok((await p.locator("#cart-count").textContent()) === "2", `${file}: cart should have loaded`);
      }
    });

    test("tapping each WhatsApp button builds the real link at that moment", async () => {
      const p = await open();
      const main = p.locator("#contact-actions .btn").first();
      assert.equal(await main.getAttribute("href"), "#");
      await main.click();
      await p.click("#restock-link");
      const [a, b] = await wa(p);
      assert.equal(waText(a), "Hi! I have a question about your perfumes.");
      assert.match(waText(b), /restock/i);
      assert.equal((await wa(p)).length, 2);
    });

    test("cart checkout is built on tap too", async () => {
      const item = PRODUCTS[5], key = [item.s, item.v[0].m, item.v[0].p, item.v[0].r].join("|");
      const p = await open("contact.html", { storage: { "perfume-x-cart-v1": JSON.stringify([{ k: key, qty: 1 }]) } });
      await p.click("#cart-open");
      assert.equal(await p.getAttribute("#checkout", "href"), "#");
      assert.doesNotMatch(await p.content(), LEAK);
      await p.click("#checkout");
      const text = waText((await wa(p))[0]);
      assert.match(text, new RegExp(`${item.b} — ${item.n.replace(/[()]/g, "\\$&")}`));
      assert.match(text, new RegExp(`Total: ${fmtPrice(item.v[0].pr).replace(/[₹,]/g, (c) => "\\" + c)}`));
    });

    test("WhatsApp buttons on the other content pages work without exposing the number", async () => {
      for (const file of ["how-to-order.html", "guarantee.html", "faq.html"]) {
        const p = await open(file);
        const link = p.locator("[data-wa]").first();
        assert.equal(await link.getAttribute("href"), "contact.html", `${file}: fallback link should be the contact page`);
        await link.click();
        assert.match(waText((await wa(p))[0]), /^Hi! I have a question/);
        assert.doesNotMatch(await p.content(), LEAK);
      }
    });

    test("catalogue Order buttons carry their message and open WhatsApp on tap", async () => {
      const p = await open("catalogue.html");
      const order = p.locator(".card .order").first();
      assert.equal(await order.getAttribute("href"), "#");
      await order.click();
      assert.match(waText((await wa(p))[0]), /I'd like to order[\s\S]*Is this available\?/);
      assert.doesNotMatch(await p.content(), LEAK);
    });

    test("numberDisplay: 'hidden' removes even the masked digits", async () => {
      const p = await open("contact.html", { siteConfig: (t) => t.replace('numberDisplay: "masked"', 'numberDisplay: "hidden"') });
      assert.equal((await p.locator("#contact-actions .btn").first().textContent()).trim(), "Chat on WhatsApp");
    });

    test("PX.maskPhone keeps the country code and last three digits only", async () => {
      const p = await open();
      const r = await p.evaluate(() => ["+91 63866 09272", "+1 (202) 555-0123", "6386609272", "+44 7700 900123", "12", "", undefined].map(PX.maskPhone));
      assert.deepEqual(r, ["+91 ••••• ••272", "+1 (•••) •••-•123", "•••••••272", "+44 •••• •••123", "12", "", ""]);
    });
  });

  describe("request form: validation", () => {
    test("starts clean: labels, required marks, selects populated from the price bands", async () => {
      const p = await open();
      assert.equal(await p.locator("#request-form").isVisible(), true);
      assert.equal(await p.locator("#request-done").isHidden(), true);
      for (const label of ["Perfume name", "House / brand", "Size", "Budget per bottle", "Your name", "Anything else?"]) assert.equal(await p.getByLabel(label).count(), 1, label);
      assert.deepEqual(await p.locator("#rq-budget option").allTextContents(), ["Not sure", ...BANDS_LABELS()]);
      assert.deepEqual(await p.locator("#rq-size option").allTextContents(), ["Any size", "Full bottle", "Tester", "Small size (mini or vial)"]);
      assert.equal(await p.getAttribute("#rq-name", "autocomplete"), "name");
      assert.equal(await p.locator(".field-msg:not(:empty)").count(), 0);
    });

    test("empty submit: both required fields explain themselves, focus goes to the first, nothing is sent", async () => {
      const p = await open();
      await p.click("#request-form button[type=submit]");
      assert.match(await p.textContent("#rq-perfume-msg"), /which perfume/i);
      assert.match(await p.textContent("#rq-name-msg"), /your name/i);
      assert.equal(await p.getAttribute("#rq-perfume", "aria-invalid"), "true");
      assert.equal(await p.getAttribute("#rq-name", "aria-invalid"), "true");
      assert.equal(await p.evaluate(() => document.activeElement.id), "rq-perfume");
      assert.equal((await wa(p)).length, 0);
      assert.equal(await p.locator("#request-form").isVisible(), true);
    });

    test("only the name missing → focus the name; only the perfume missing → focus the perfume", async () => {
      const p = await open();
      await p.fill("#rq-perfume", "Aventus");
      await p.click("#request-form button[type=submit]");
      assert.equal(await p.evaluate(() => document.activeElement.id), "rq-name");
      assert.equal(await p.textContent("#rq-perfume-msg"), "");
      await p.fill("#rq-perfume", ""); await p.fill("#rq-name", "Sam");
      await p.click("#request-form button[type=submit]");
      assert.equal(await p.evaluate(() => document.activeElement.id), "rq-perfume");
      assert.equal(await p.textContent("#rq-name-msg"), "");
    });

    test("whitespace-only and one-character entries don't count; typing clears the message", async () => {
      const p = await open();
      await p.fill("#rq-perfume", "   "); await p.fill("#rq-name", "A");
      await p.click("#request-form button[type=submit]");
      assert.notEqual(await p.textContent("#rq-perfume-msg"), "");
      assert.notEqual(await p.textContent("#rq-name-msg"), "");
      await p.fill("#rq-perfume", "Oud"); await p.fill("#rq-name", "Al");
      assert.equal(await p.textContent("#rq-perfume-msg"), "");
      assert.equal(await p.getAttribute("#rq-perfume", "aria-invalid"), "false");
      assert.equal(await p.textContent("#rq-name-msg"), "");
      assert.equal((await wa(p)).length, 0);
    });

    test("field length limits hold (80 / 60 / 60 / 200)", async () => {
      const p = await open();
      for (const [id, max] of [["rq-perfume", 80], ["rq-brand", 60], ["rq-name", 60], ["rq-notes", 200]]) {
        await p.locator(`#${id}`).pressSequentially("x".repeat(max + 40), { delay: 0 });
        assert.equal((await p.inputValue(`#${id}`)).length, max, id);
      }
    });
  });

  describe("request form: the WhatsApp message", () => {
    const submit = async (p, f = {}) => {
      if (f.perfume !== undefined) await p.fill("#rq-perfume", f.perfume);
      if (f.brand !== undefined) await p.fill("#rq-brand", f.brand);
      if (f.size) await p.selectOption("#rq-size", f.size);
      if (f.budget) await p.selectOption("#rq-budget", f.budget);
      if (f.name !== undefined) await p.fill("#rq-name", f.name);
      if (f.notes !== undefined) await p.fill("#rq-notes", f.notes);
      await p.click("#request-form button[type=submit]");
    };
    const HEAD = "Hi! I'd like to request a perfume that isn't in your catalogue:";

    test("minimum request: only the filled fields appear — no stray blank lines", async () => {
      const p = await open();
      await submit(p, { perfume: "Zzyzx Noir", name: "Sam" });
      const urls = await wa(p);
      assert.equal(urls.length, 1);
      assert.equal(waText(urls[0]), `${HEAD}\n\nPerfume: Zzyzx Noir\n\nMy name: Sam`);
    });

    test("full request: every field, in order", async () => {
      const p = await open();
      await submit(p, { perfume: "Baccarat Rouge 540 Extrait", brand: "MFK", size: "Full bottle", budget: BANDS_LABELS()[3], name: "Abdul", notes: "2023 batch if possible" });
      assert.equal(waText((await wa(p))[0]), `${HEAD}\n\nPerfume: Baccarat Rouge 540 Extrait\nBrand: MFK\nSize: Full bottle\nBudget: ${BANDS_LABELS()[3]}\nNotes: 2023 batch if possible\n\nMy name: Abdul`);
    });

    test("extra spaces and line breaks are tidied", async () => {
      const p = await open();
      await submit(p, { perfume: "  Oud   Wood \n", name: "  Sam   Lee ", notes: "line one\n\nline   two\n" });
      const t = waText((await wa(p))[0]);
      assert.match(t, /Perfume: Oud Wood\n/);
      assert.match(t, /Notes: line one line two\n/);
      assert.match(t, /My name: Sam Lee$/);
    });

    test("symbols, emoji and non-Latin text survive the link intact", async () => {
      const p = await open();
      const perfume = "L’Homme & Co #1 100% “Édition” ✨", name = "Zoë – 李雷", notes = "a=b?c&d=e%20f +plus";
      await submit(p, { perfume, name, notes });
      const t = waText((await wa(p))[0]);
      assert.ok(t.includes(`Perfume: ${perfume}`) && t.includes(`My name: ${name}`) && t.includes(`Notes: ${notes}`), t);
    });

    test("after sending: form hides, confirmation shows the exact message, focus moves there", async () => {
      const p = await open();
      await submit(p, { perfume: "Aventus", name: "Sam" });
      assert.equal(await p.locator("#request-form").isHidden(), true);
      assert.equal(await p.locator("#request-done").isVisible(), true);
      assert.equal(await p.evaluate(() => document.activeElement.id), "request-done");
      assert.equal(await p.textContent("#request-preview"), waText((await wa(p))[0]));
    });

    test("'Open WhatsApp' re-sends the same message; 'Request another' resets everything", async () => {
      const p = await open();
      await submit(p, { perfume: "Aventus", brand: "Creed", size: "Tester", budget: BANDS_LABELS()[2], name: "Sam", notes: "n" });
      await p.click("#request-open");
      const urls = await wa(p);
      assert.equal(urls.length, 2);
      assert.equal(urls[1], urls[0]);
      assert.equal(await p.getAttribute("#request-open", "href"), "#");
      await p.click("#request-again");
      assert.equal(await p.locator("#request-form").isVisible(), true);
      assert.equal(await p.locator("#request-done").isHidden(), true);
      for (const id of ["rq-perfume", "rq-brand", "rq-name", "rq-notes", "rq-size", "rq-budget"]) assert.equal(await p.inputValue(`#${id}`), "", id);
      assert.equal(await p.locator("#rq-suggest").isHidden(), true);
      assert.equal(await p.evaluate(() => document.activeElement.id), "rq-perfume");
      await submit(p, { perfume: "Second", name: "Sam" });
      assert.equal((await wa(p)).length, 3);
    });

    test("pressing Enter submits; pressing it again can't send twice", async () => {
      const p = await open();
      await p.fill("#rq-perfume", "Oud Royal"); await p.fill("#rq-name", "Sam");
      await p.press("#rq-name", "Enter");
      assert.equal((await wa(p)).length, 1);
      await p.keyboard.press("Enter");
      assert.equal((await wa(p)).length, 1);
    });

    test("anything typed is shown as plain text, never run", async () => {
      const p = await open();
      const evil = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>';
      await submit(p, { perfume: evil, name: evil.slice(0, 50), notes: evil });
      await p.waitForTimeout(150);
      assert.equal(await p.evaluate(() => window.__pwned), undefined);
      assert.ok((await p.textContent("#request-preview")).includes("<img src=x"));
      assert.equal(await p.locator("#request-preview img, #rq-suggest img").count(), 0);
    });
  });

  describe("“Already in our catalogue?” suggestions", () => {
    const expectedMatches = (perfume, brand = "") => {
      const tokens = normalize(`${brand} ${perfume}`).split(" ").filter(Boolean);
      return PRODUCTS.filter((p) => { const base = normalize(`${p.b} ${p.n} ${p.i}`); return p.v.some((v) => tokens.every((t) => `${base} ${normalize(spec(v))}`.includes(t))); });
    };

    test("nothing until 3 characters; nothing for names we don't have", async () => {
      const p = await open();
      await p.fill("#rq-perfume", "ab"); assert.equal(await p.locator("#rq-suggest").isHidden(), true);
      await p.fill("#rq-perfume", "zzzzqq"); assert.equal(await p.locator("#rq-suggest").isHidden(), true);
      await p.fill("#rq-perfume", "kha"); assert.equal(await p.locator("#rq-suggest").isVisible(), true);
    });

    test("matches the catalogue exactly: count, first four, prices, 'See all' link", async () => {
      const p = await open();
      for (const [perfume, brand] of [["khamrah", ""], ["creed aventus", "creed"], ["oud", ""], ["sauvage", "dior"], ["d’hermes", ""], ["eros", "versace"]]) {
        await p.fill("#rq-perfume", perfume); await p.fill("#rq-brand", brand);
        const exp = expectedMatches(perfume, brand);
        if (!exp.length) { assert.equal(await p.locator("#rq-suggest").isHidden(), true, perfume); continue; }
        assert.equal(await p.locator("#rq-suggest").isVisible(), true, perfume);
        assert.match(await p.textContent("#rq-suggest .s-head"), new RegExp(`${exp.length} match${exp.length === 1 ? "" : "es"}`), perfume);
        const rows = await p.locator("#rq-suggest li").evaluateAll((els) => els.map((e) => ({ text: e.textContent.replace(/\s+/g, " ").trim(), href: e.querySelector("a").getAttribute("href") })));
        assert.equal(rows.length, Math.min(4, exp.length), perfume);
        rows.forEach((r, i) => {
          const pr = exp[i];
          assert.ok(r.text.includes(pr.b) && r.text.includes(pr.n), `${perfume}: row ${i} "${r.text}"`);
          assert.ok(r.text.includes(`from ${fmtPrice(Math.min(...pr.v.map((v) => v.pr)))}`), r.text);
          assert.equal(r.text.includes("Inspired by"), Boolean(pr.i), `${perfume}: inspired-by line for ${pr.n}`);
          assert.equal(r.href, `catalogue.html?q=${encodeURIComponent(`${pr.b} ${pr.n}`)}`, "the catalogue searches house + name, so each link carries 'House Name'");
        });
        // "See all": only when there are more than four matches AND the catalogue's search (house + name) has something to show for what was typed
        const typed = `${brand} ${perfume}`.replace(/\s+/g, " ").trim();
        const words = normalize(typed).split(" ").filter(Boolean);
        const listed = PRODUCTS.filter((x) => words.every((k) => normalize(`${x.b} ${x.n}`).includes(k))).length;
        const all = p.locator("#rq-suggest .s-all");
        assert.equal(await all.count(), exp.length > 4 && listed ? 1 : 0, perfume);
        if (exp.length > 4 && listed) {
          assert.equal((await all.textContent()).trim(), `See all ${listed} perfume${listed === 1 ? "" : "s"} matching “${typed.slice(0, 30)}”`);
          assert.equal(await all.getAttribute("href"), `catalogue.html?q=${encodeURIComponent(typed)}`);
        }
      }
    });

    test("straight and curly apostrophes, accents and case behave the same", async () => {
      const p = await open();
      const count = async (v) => { await p.fill("#rq-perfume", v); return (await p.locator("#rq-suggest").isVisible()) ? await p.locator("#rq-suggest .s-head span").textContent() : "none"; };
      assert.equal(await count("d'hermes"), await count("D’HERMES"));
      assert.equal(await count("matiere"), await count("MATIÈRE"));
      assert.notEqual(await count("matiere"), "none");
    });

    test("suggestions follow the brand box and disappear when cleared", async () => {
      const p = await open();
      await p.fill("#rq-perfume", "oud");
      const all = await p.locator("#rq-suggest .s-head span").textContent();
      await p.fill("#rq-brand", "tom ford");
      const dior = await p.locator("#rq-suggest .s-head span").textContent();
      assert.notEqual(all, dior);
      await p.fill("#rq-perfume", ""); assert.equal(await p.locator("#rq-suggest").isHidden(), true);
    });

    test("clicking a suggestion opens the catalogue on that product", async () => {
      const p = await open();
      await p.fill("#rq-perfume", "khamrah");
      const first = p.locator("#rq-suggest li a").first();
      const want = expectedMatches("khamrah")[0];
      await Promise.all([p.waitForURL(/catalogue\.html/), first.click()]);
      await p.waitForLoadState("load");
      assert.equal(await p.inputValue("#q"), `${want.b} ${want.n}`);
      assert.ok(await p.locator(`.card[data-slug="${want.s}"]`).count() >= 1);
      assert.equal(await p.evaluate(() => location.search), "");
    });
  });

  describe("page structure", () => {
    test("#request deep link scrolls the form into view below the sticky header", async () => {
      const p = await open("contact.html", { query: "#request" });
      await p.waitForTimeout(400);
      const top = await p.evaluate(() => document.querySelector("#request").getBoundingClientRect().top);
      assert.ok(top >= -2 && top < 180, `request section top at ${top}px`);
    });
    test("one h1, nothing overflows on a phone, form and confirmation fit", async () => {
      const p = await open("contact.html", { viewport: { width: 390, height: 844 } });
      assert.equal(await p.locator("h1").count(), 1);
      await p.fill("#rq-perfume", "Aventus"); await p.fill("#rq-name", "Sam");
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await p.click("#request-form button[type=submit]");
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await p.locator("#request-done").isVisible(), true);
    });
  });

  test("no console errors or failed requests on any page opened", () => assert.deepEqual(opened.flatMap((o) => o.errors), []));
});

function BANDS_LABELS() {
  const m = fmtPrice;
  return Object.entries(BANDS).map(([, [lo, hi]]) => (hi === Infinity ? `${m(lo)} and above` : lo === 0 ? `Under ${m(hi)}` : `${m(lo)} – ${m(hi)}`));
}

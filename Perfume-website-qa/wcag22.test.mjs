// WCAG 2.2 level AA: the success criteria that axe-core (see a11y.test.mjs) cannot decide on its own.
//
//   A. static, on all 641 pages: language (3.1.1), zoom not blocked (1.4.4), one main + a working skip link (2.4.1), a title (2.4.2),
//      one h1, labelled landmarks (1.3.1), no positive tabindex (2.4.3), the same header and footer links on every page (3.2.3, 3.2.4, 3.2.6),
//      no login / captcha (3.3.8), no dragging (2.5.7), no pointer-down actions (2.5.2), no single-key shortcuts (2.1.4),
//      smooth scrolling only when the visitor allows motion (2.3.3), input purpose on the contact form (1.3.5)
//   B. in a browser, on 14 pages + a sample of perfume pages:
//        - a real Tab walk, forwards and backwards, in light and dark, on a laptop and a phone, with and without the cart bar:
//          the focused control is never completely hidden by the sticky header, the cart bar or the round buttons (2.4.11), has a visible
//          focus indicator (2.4.7) and that indicator contrasts 3:1 with what is behind it (1.4.11)
//        - the borders of form controls contrast 3:1 (1.4.11)
//        - reflow at 320px wide and in landscape (1.4.10, 1.3.4), text at 200% (1.4.4), WCAG text-spacing overrides (1.4.12): no sideways scroll, no clipped text
//        - a visible label is part of the control's spoken name (2.5.3), and two different links never share one spoken name (2.4.4)
//        - the help button is in the same place on every page (3.2.6)
//   What no program can decide (is the spoken text sensible, is the order logical): see UAT-REPORT.md, "manual review".
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { launch, openPage } from "./lib/browser.mjs";
import { serve } from "./lib/server.mjs";
import { setTheme } from "./lib/theme.mjs";
import { SITE_DIR } from "./lib/data.mjs";
import { PAGE_FILES, PAGE_FILES_PLUS, PRODUCT_SAMPLE } from "./lib/pages.mjs";

const ALL_HTML = fs.readdirSync(SITE_DIR).filter((f) => f.endsWith(".html") && !/^google[0-9a-f]{16}\.html$/.test(f)).sort();
const read = (f) => fs.readFileSync(path.join(SITE_DIR, f), "utf8");
const JS = fs.readdirSync(path.join(SITE_DIR, "assets/js")).filter((f) => f.endsWith(".js")).map((f) => [f, read(`assets/js/${f}`)]);
const first = (xs, n = 8) => (xs.length > n ? [...xs.slice(0, n), `… and ${xs.length - n} more`] : xs);
const body = (html) => html.slice(html.indexOf("<body"));
const strip = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, "");

/* ============================================================================================ A */
describe("A. the rules that can be read straight from the pages and scripts", () => {
  const PAGES = ALL_HTML.map((f) => [f, read(f)]);

  test("there are 641 pages to check (14 pages and 627 perfume pages)", () => assert.equal(ALL_HTML.length, 14 + 627));

  test("3.1.1 language: every page says it is in English; 1.4.4 resize: no page blocks zooming", () => {
    const bad = [];
    for (const [f, h] of PAGES) {
      if (!/<html[^>]*\slang="en(-[A-Za-z]+)?"/.test(h)) bad.push(`${f}: no lang`);
      const vp = (h.match(/<meta name="viewport" content="([^"]*)"/) || [])[1];
      if (!vp || !/width=device-width/.test(vp)) bad.push(`${f}: no responsive viewport`);
      if (vp && (/user-scalable\s*=\s*(no|0)/i.test(vp) || /maximum-scale\s*=\s*(0?\.\d+|1(\.0*)?)\b/i.test(vp))) bad.push(`${f}: zooming is blocked (${vp})`);
    }
    assert.deepEqual(first(bad), []);
  });

  test("2.4.1 bypass blocks: the first link on every page is 'Skip to content' and its target exists; 2.4.2 a title; one h1; one main", () => {
    const bad = [];
    for (const [f, h] of PAGES) {
      const b = strip(body(h));
      const firstA = b.match(/<a\b[^>]*>/)?.[0] || "";
      if (!/class="skip"/.test(firstA) || !/href="#main"/.test(firstA)) bad.push(`${f}: first link is ${firstA.slice(0, 60)}`);
      if (!/\sid="main"/.test(b)) bad.push(`${f}: no #main`);
      if ((b.match(/<main\b/g) || []).length !== 1) bad.push(`${f}: ${(b.match(/<main\b/g) || []).length} main elements`);
      if ((b.match(/<h1[\s>]/g) || []).length !== 1) bad.push(`${f}: ${(b.match(/<h1[\s>]/g) || []).length} h1`);
      if (!/<title>[^<]{8,}<\/title>/.test(h)) bad.push(`${f}: no real title`);
      // (a <header> inside a section is not the page's banner, so only the site header and site footer are counted)
      if ((b.match(/<header class="site-header"/g) || []).length !== 1 || (b.match(/<footer class="site-footer"/g) || []).length !== 1) bad.push(`${f}: site header/footer count`);
    }
    assert.deepEqual(first(bad), []);
  });

  test("1.3.1 landmarks: every nav has its own name, no two navs on a page share a name", () => {
    const bad = [];
    for (const [f, h] of PAGES) {
      const navs = [...strip(body(h)).matchAll(/<nav\b([^>]*)>/g)].map((m) => (m[1].match(/aria-label="([^"]+)"/) || [])[1]);
      if (navs.some((n) => !n)) bad.push(`${f}: a nav without a name`);
      if (new Set(navs).size !== navs.length) bad.push(`${f}: two navs named alike (${navs.join(" / ")})`);
    }
    assert.deepEqual(first(bad), []);
  });

  test("2.4.3 focus order: nothing sets a positive tabindex, in any page or script", () => {
    const bad = [];
    for (const [f, h] of PAGES) if (/tabindex="[1-9]/.test(h)) bad.push(f);
    for (const [f, s] of JS) if (/tabindex["']?\s*[,=:]\s*["']?[1-9]/.test(s) || /tabIndex\s*=\s*[1-9]/.test(s)) bad.push(`assets/js/${f}`);
    assert.deepEqual(bad, []);
  });

  test("3.2.3 consistent navigation and 3.2.6 consistent help: the header links and the footer links are the same, in the same order, on every page", () => {
    const links = (h, tag) => { const m = h.match(new RegExp(`<${tag} class="site-${tag}"[\\s\\S]*?</${tag}>`)); return m ? [...m[0].matchAll(/<a\b[^>]*\shref="([^"#][^"]*)"/g)].map((x) => x[1]) : null; };
    const ref = { header: links(read("index.html"), "header"), footer: links(read("index.html"), "footer") };
    assert.ok(ref.header.length >= 7 && ref.footer.length >= 8, `the home page has a header (${ref.header.length} links) and a footer (${ref.footer.length} links)`);
    assert.ok(ref.header.includes("contact.html") && ref.footer.includes("contact.html"), "the Contact page is in both");
    const bad = [];
    for (const [f, h] of PAGES) for (const tag of ["header", "footer"]) {
      const got = links(h, tag);
      if (JSON.stringify(got) !== JSON.stringify(ref[tag])) bad.push(`${f}: ${tag} links differ from the home page's`);
    }
    assert.deepEqual(first(bad), []);
  });

  test("3.3.8 accessible authentication: there is no login, no password field, no captcha, no puzzle anywhere", () => {
    const bad = [];
    for (const [f, h] of PAGES) if (/type="password"|captcha|recaptcha|hcaptcha|turnstile/i.test(h)) bad.push(f);
    for (const [f, s] of JS) if (/type=["']?password|captcha|recaptcha|hcaptcha|turnstile/i.test(s)) bad.push(`assets/js/${f}`);
    assert.deepEqual(bad, []);
  });

  test("2.5.7 dragging: nothing on the site is dragged (no drag, swipe, slider or pointer-move handler); if one is ever added it needs a single-click alternative, and this test must be updated with it", () => {
    const bad = [];
    for (const [f, h] of PAGES) if (/draggable="true"|type="range"|ondrag/i.test(h)) bad.push(f);
    for (const [f, s] of JS) if (/dragstart|draggable|touchmove|pointermove|mousemove|type=["']?range|swipe/i.test(s)) bad.push(`assets/js/${f}`);
    assert.deepEqual(bad, []);
  });

  test("2.5.2 pointer cancellation: the only actions on pointer-down are the two that close the search suggestions (a reversible dismissal); any new one must be reviewed", () => {
    const found = [];
    for (const [f, s] of JS) for (const line of s.split("\n")) if (/addEventListener\(\s*["'](pointerdown|mousedown|touchstart)["']/.test(line)) found.push(`${f}: ${line.trim().slice(0, 70)}`);
    assert.deepEqual(found, [
      'catalogue.js: sugList.addEventListener("mousedown", (e) => e.preventDefault());   // keep the cursor in the search box',
      'catalogue.js: document.addEventListener("pointerdown", (e) => { if (!wrap.contains(e.target)) closeSuggest(); });',
    ].map((s) => s.slice(0, "catalogue.js: ".length + 70)));
  });

  test("2.1.4 character key shortcuts: no script reacts to a plain letter, number or punctuation key (only Escape, Tab, Enter and the arrows)", () => {
    const keys = new Set();
    for (const [, s] of JS) for (const m of s.matchAll(/\be\.key\s*[!=]==?\s*["']([^"']+)["']/g)) keys.add(m[1]);
    const allowed = new Set(["Escape", "Tab", "Enter", "ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End", " "]);
    const storageKeys = [...keys].filter((k) => !allowed.has(k));
    // (common.js also compares e.key with the names of the saved cart and theme in the 'storage' event; those are not key presses)
    assert.deepEqual(storageKeys.filter((k) => k.length === 1), []);
  });

  test("2.3.3 and 2.2.2 motion: every scripted smooth scroll is switched off for visitors who ask for less motion; the moving brand rows have a Pause button", () => {
    const bad = [];
    for (const [f, s] of JS) for (const [i, line] of s.split("\n").entries()) if (/behavior:\s*["']smooth["']/.test(line) && !/prefers-reduced-motion/.test(line)) bad.push(`${f}:${i + 1}: ${line.trim().slice(0, 90)}`);
    assert.deepEqual(bad, [], "a smooth scroll that ignores prefers-reduced-motion");
    const home = read("index.html");
    assert.match(home, /<button class="marquee-toggle" id="brands-pause" type="button" aria-controls="brand-rows">Pause<\/button>/);
    assert.match(read("assets/css/site.css"), /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none !important/);
  });

  test("1.3.5 identify input purpose: the contact form's name field says autocomplete=name, and no field that collects personal details switches it off", () => {
    const h = read("contact.html");
    assert.match(h, /<input id="rq-name"[^>]*autocomplete="name"/);
    for (const m of h.matchAll(/<(input|textarea|select)\b[^>]*>/g)) {
      const tag = m[0];
      if (/name="(name|email|phone|tel|mobile|address|city|pincode)"/.test(tag) && /autocomplete="off"/.test(tag)) assert.fail(`personal field with autocomplete off: ${tag.slice(0, 80)}`);
    }
  });
});

/* ============================================================================================ B */
describe("B. in a browser", () => {
  let browser, srv;
  const opened = [];
  before(async () => { browser = await launch(); srv = await serve(); });
  after(async () => { await browser.close(); await srv.close(); });

  const LAPTOP = { viewport: { width: 1360, height: 900 } };
  const PHONE = { viewport: { width: 390, height: 844 }, contextOptions: { hasTouch: true, isMobile: true } };
  const calm = (page) => page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important} .reveal,[data-reveal]{opacity:1!important;transform:none!important}" });
  const open = async (file, view, theme = "dark", extra = {}) => {
    const c = await openPage(browser, file, { base: srv.base, ...view, ...extra, contextOptions: { ...(view.contextOptions || {}), ...(extra.contextOptions || {}), colorScheme: theme } });
    opened.push(c);
    await setTheme(c.page, theme);
    await calm(c.page);
    await c.page.waitForTimeout(250);
    return c;
  };
  const KHAMRAH = "perfume-lattafa-khamrah.html";
  const WALK_PAGES = ["index.html", "catalogue.html", "perfumes.html", "guides.html", "guide-perfume-for-every-season.html", "faq.html", "contact.html", KHAMRAH, PRODUCT_SAMPLE[1]];

  /* ------------------------------------------------------------------ the Tab walk (2.4.11, 2.4.7, 1.4.11) */
  const probe = () => {
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) return null;
    const desc = (e) => `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}${e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".") : ""} "${(e.getAttribute("aria-label") || e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 30)}"`;
    const out = { desc: desc(el) };
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return { ...out, why: "has no size on screen" };
    const x0 = Math.max(r.left, 0), x1 = Math.min(r.right, innerWidth), y0 = Math.max(r.top, 0), y1 = Math.min(r.bottom, innerHeight);
    if (x1 - x0 <= 1 || y1 - y0 <= 1) return { ...out, why: "has focus but is outside the window" };
    let free = 0, cover = null;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
      const t = document.elementFromPoint(x0 + ((x1 - x0) * (i + 0.5)) / 6, y0 + ((y1 - y0) * (j + 0.5)) / 4);
      if (t && (el.contains(t) || t.contains(el))) free++; else if (t && !cover) cover = t;
    }
    if (!free) return { ...out, why: `is completely covered by ${desc(cover)}` };
    // the focus indicator, and its contrast with what is behind it
    const parse = (c) => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[,/\s]+/).filter(Boolean).map(Number); return [r, g, b, a]; };
    const over = (top, bot) => [top[0] * top[3] + bot[0] * (1 - top[3]), top[1] * top[3] + bot[1] * (1 - top[3]), top[2] * top[3] + bot[2] * (1 - top[3]), 1];
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
    const behind = (start) => { const stack = []; for (let e = start; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3] > 0) { stack.push(c); if (c[3] >= 0.99) break; } } let base = stack.length && stack[stack.length - 1][3] >= 0.99 ? stack.pop() : [255, 255, 255, 1]; while (stack.length) base = over(stack.pop(), base); return base; };
    // the ring may be on the control itself or on the pill/box built around it (e.g. the sort drop-down)
    const ringOf = (e) => {
      const cs = getComputedStyle(e);
      if (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) return { color: parse(cs.outlineColor), inside: parseFloat(cs.outlineOffset) < 0, width: parseFloat(cs.outlineWidth) };
      if (cs.boxShadow && cs.boxShadow !== "none") { const m = cs.boxShadow.match(/rgba?\([^)]+\)/); if (m) return { color: parse(m[0]), inside: /inset/.test(cs.boxShadow), width: 2 }; }
      return null;
    };
    let holder = el, ring = ringOf(el);
    for (let up = el.parentElement, n = 0; !ring && up && n < 2; up = up.parentElement, n++) { const r = ringOf(up); if (r) { ring = r; holder = up; } }
    if (!ring || !ring.color) return { ...out, why: "has no visible focus indicator (no outline, no ring)" };
    const bg = ring.inside ? behind(holder) : behind(holder.parentElement);
    const ink = ring.color[3] < 1 ? over(ring.color, bg) : ring.color;
    const k = ratio(ink, bg);
    if (k < 3) return { ...out, why: `its focus indicator is only ${k.toFixed(2)}:1 against what is behind it (needs 3:1)` };
    return null;
  };
  const walk = async (page, steps) => {
    const problems = [];
    const go = async (key) => { for (let i = 0; i < steps; i++) { await page.keyboard.press(key); await page.waitForTimeout(25); const r = await page.evaluate(probe); if (r) problems.push(`${r.desc} ${r.why}`); } };
    await go("Tab");
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
    await go("Shift+Tab");                                          // from the top, Shift+Tab wraps to the end of the page: the footer and the round buttons
    return problems;
  };

  describe("Tab walk: focus is never hidden, always visible, and the indicator is clear against its background", () => {
    for (const theme of ["dark", "light"]) for (const [vl, view] of [["laptop", LAPTOP], ["phone", PHONE]]) {
      if (theme === "light" && vl === "phone" && false) continue;
      test(`${theme} · ${vl}: ${WALK_PAGES.length} pages, 45 Tab stops forwards and 45 backwards`, async () => {
        const bad = [];
        for (const file of WALK_PAGES) {
          const { page, context } = await open(file, view, theme);
          try { for (const p of await walk(page, 45)) bad.push(`${file}: ${p}`); } finally { await context.close(); }
        }
        assert.deepEqual(first([...new Set(bad)], 14), []);
      });
    }

    for (const [vl, view] of [["laptop", LAPTOP], ["phone", PHONE]]) {
      test(`${vl}: with an item in the cart (the cart bar and the round buttons showing) the end of a perfume page and of the catalogue is still reachable`, async () => {
        const bad = [];
        for (const file of [KHAMRAH, "catalogue.html"]) {
          const { page, context } = await open(file, view, "dark");
          try {
            if (file === KHAMRAH) await page.locator(".p-add").first().click();
            else { await page.waitForSelector("#grid .card"); await page.locator("#grid .card .add, #grid .card [data-add]").first().click(); }
            await page.waitForTimeout(400);
            assert.ok(await page.locator("body.has-cart-bar").count() || vl === "laptop", `${file}: the cart bar shows on a phone`);
            for (const p of await walk(page, 30)) bad.push(`${file}: ${p}`);
          } finally { await context.close(); }
        }
        assert.deepEqual(first([...new Set(bad)], 14), []);
      });
    }

    test("2.4.1: Enter on 'Skip to content' lands on the main content (the next Tab goes to its first control, not back to the header)", async () => {
      for (const file of ["index.html", KHAMRAH, "faq.html"]) {
        const { page, context } = await open(file, LAPTOP, "dark");
        try {
          await page.keyboard.press("Tab");
          assert.equal(await page.evaluate(() => document.activeElement.className), "skip", `${file}: the skip link is the first stop`);
          await page.keyboard.press("Enter");
          await page.keyboard.press("Tab");
          const inMain = await page.evaluate(() => !!document.activeElement.closest("main") || document.activeElement.id === "main");
          assert.ok(inMain, `${file}: focus went into the main content`);
        } finally { await context.close(); }
      }
    });
  });

  /* ------------------------------------------------------------------ control borders (1.4.11) */
  describe("1.4.11 non-text contrast: the edges of form controls", () => {
    // (the sort drop-down's edge is the pill around it, so the pill is measured; the Filters panel is opened for its own drop-down)
    const FIELDS = [["contact.html", "#rq-perfume, #rq-brand, #rq-name, #rq-notes, #rq-size, #rq-budget", 6], ["catalogue.html", "#q, .sort", 2], ["catalogue.html#filters", "#brand", 1]];
    for (const theme of ["dark", "light"]) {
      test(`${theme}: each text box and drop-down is told apart from the page by a border or fill of at least 3:1`, async () => {
        const bad = [];
        for (const [target, sel, count] of FIELDS) {
          const [file, panel] = target.split("#");
          const { page, context } = await open(file, LAPTOP, theme);
          try {
            if (panel) { await page.click("#filters-open"); await page.waitForSelector("#filters:not([hidden])"); await page.waitForTimeout(300); }
            const rows = await page.evaluate((sel) => {
              const parse = (c) => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[,/\s]+/).filter(Boolean).map(Number); return [r, g, b, a]; };
              const over = (top, bot) => [top[0] * top[3] + bot[0] * (1 - top[3]), top[1] * top[3] + bot[1] * (1 - top[3]), top[2] * top[3] + bot[2] * (1 - top[3]), 1];
              const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
              const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
              const behind = (start) => { const stack = []; for (let e = start; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3] > 0) { stack.push(c); if (c[3] >= 0.99) break; } } let base = stack.length && stack[stack.length - 1][3] >= 0.99 ? stack.pop() : [255, 255, 255, 1]; while (stack.length) base = over(stack.pop(), base); return base; };
              return [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().width > 0).map((e) => {
                const cs = getComputedStyle(e), out = behind(e.parentElement);
                const bw = parseFloat(cs.borderTopWidth) || 0, bc = parse(cs.borderTopColor), fill = parse(cs.backgroundColor);
                const border = bw > 0 && cs.borderTopStyle !== "none" && bc ? ratio(bc[3] < 1 ? over(bc, out) : bc, out) : 0;
                const fillR = fill && fill[3] > 0 ? ratio(fill[3] < 1 ? over(fill, out) : fill, out) : 0;
                return { id: e.id || e.className || e.tagName, border: +border.toFixed(2), fill: +fillR.toFixed(2) };
              });
            }, sel);
            assert.equal(rows.length, count, `${target}: found the controls`);
            for (const r of rows) if (Math.max(r.border, r.fill) < 3) bad.push(`${file} ${r.id}: border ${r.border}:1, fill ${r.fill}:1 against the page`);
          } finally { await context.close(); }
        }
        assert.deepEqual(bad, []);
      });
    }
  });

  /* ------------------------------------------------------------------ reflow, text size and spacing (1.4.10, 1.3.4, 1.4.4, 1.4.12) */
  const overflowing = (page) => page.evaluate(() => ({ over: Math.max(0, document.documentElement.scrollWidth - innerWidth), w: innerWidth }));
  const clipped = (page) => page.evaluate(() => {
    const out = [];
    const clips = (v) => v === "hidden" || v === "clip";
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest(".marquee, svg, [inert], [hidden], [aria-hidden='true'], .cart, .overlay, .sheet, .modal, .lightbox, .toast, .skip")) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      if (!clips(cs.overflowX) && !clips(cs.overflowY)) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) continue;                  // a visually hidden helper or a closed panel
      if (!el.textContent.trim()) continue;
      const v = clips(cs.overflowY) && el.scrollHeight > el.clientHeight + 2, h = clips(cs.overflowX) && el.scrollWidth > el.clientWidth + 2;
      if (v || h) out.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/)[0] : ""} "${el.textContent.trim().replace(/\s+/g, " ").slice(0, 28)}" (${v ? "cut off at the bottom" : "cut off at the side"})`);
    }
    return out;
  });
  const SPACING = "*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important} p,li,dd,blockquote{margin-bottom:2em!important}";

  describe("reflow, text size and spacing", () => {
    test("1.4.10 reflow: at 320px wide (400% zoom) and in a landscape phone, nothing needs sideways scrolling, on all 30 pages", async () => {
      const bad = [];
      for (const [label, vp] of [["320px wide", { width: 320, height: 640 }], ["landscape phone", { width: 844, height: 390 }]]) {
        for (const file of PAGE_FILES_PLUS) {
          const { page, context } = await open(file, { viewport: vp, contextOptions: { hasTouch: true, isMobile: true } }, "dark");
          try { const o = await overflowing(page); if (o.over > 1) bad.push(`${file} (${label}): ${o.over}px too wide`); } finally { await context.close(); }
        }
      }
      assert.deepEqual(first(bad), []);
    });

    const SPACING_PAGES = ["index.html", "catalogue.html", "perfumes.html", "guides.html", "guide-spot-genuine-perfume.html", "faq.html", "contact.html", "how-to-order.html", KHAMRAH, PRODUCT_SAMPLE[2], PRODUCT_SAMPLE[5]];
    for (const [name, css, label] of [["1.4.4 resize text: with all text at 200%", "html{font-size:200%!important}", "200%"], ["1.4.12 text spacing: with the line, letter, word and paragraph spacing a reader may set", SPACING, "spacing"]]) {
      for (const [vl, view] of [["laptop", LAPTOP], ["phone", PHONE]]) {
        test(`${name} (${vl}): no sideways scroll and no text cut off`, async () => {
          const bad = [];
          for (const file of SPACING_PAGES) {
            const { page, context } = await open(file, view, "dark");
            try {
              await page.addStyleTag({ content: css });
              await page.waitForTimeout(250);
              const o = await overflowing(page);
              if (o.over > 1) bad.push(`${file}: ${o.over}px too wide`);
              for (const c of await clipped(page)) bad.push(`${file}: ${c}`);
            } finally { await context.close(); }
          }
          assert.deepEqual(first([...new Set(bad)], 12), [], label);
        });
      }
    }
  });

  /* ------------------------------------------------------------------ names (2.5.3, 2.4.4) */
  describe("what a screen reader says", () => {
    const names = () => {
      const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      const labelIn = [], seen = new Map();
      for (const el of document.querySelectorAll("a[href], button, [role=button], summary")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || el.closest("[inert],[hidden],[aria-hidden='true']")) continue;
        const closed = el.closest("details:not([open])");   // the answers of a closed question are not on screen yet
        if (closed && !el.closest("summary")) continue;
        const aria = (el.getAttribute("aria-label") || "").trim();
        const text = (el.innerText || "").trim();
        const spoken = aria || text || (el.querySelector("img[alt]")?.getAttribute("alt") || "").trim() || el.getAttribute("title") || "";
        if (aria && norm(text) && !norm(aria).includes(norm(text))) labelIn.push(`"${text.slice(0, 30)}" is not in its spoken name "${aria.slice(0, 60)}"`);
        if (!spoken) labelIn.push(`${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ")[0] : ""} has no spoken name`);
        // a button is told apart by its name together with the labelled group it sits in (e.g. the sizes of one perfume)
        const key = norm(spoken) + (el.tagName === "A" ? "" : ` [${norm(el.closest("[role=group][aria-label]")?.getAttribute("aria-label") || "")}]`);
        const dest = el.tagName === "A" ? el.href : "button";
        if (!seen.has(key)) seen.set(key, new Set());
        seen.get(key).add(dest);
        if (!seen.has(key + "#n")) seen.set(key + "#n", 0);
        seen.set(key + "#n", seen.get(key + "#n") + 1);
      }
      const clash = [];
      for (const [k, v] of seen) if (typeof v !== "number" && !k.endsWith("#n")) {
        const count = seen.get(k + "#n");
        if (v.size > 1 && [...v].filter((d) => d !== "button").length > 1) clash.push(`"${k.slice(0, 50)}" names ${v.size} different places`);
        else if (v.has("button") && count > 1) clash.push(`"${k.slice(0, 50)}" is the name of ${count} different buttons`);
      }
      return { labelIn, clash };
    };

    test("2.5.3 label in name and 4.1.2 name: where a control has a spoken name, it starts from what is written on it; nothing is nameless; and 2.4.4: one name never leads to two places or stands for several buttons (14 pages + the sample)", async () => {
      const bad = [];
      for (const file of PAGE_FILES_PLUS) {
        const { page, context } = await open(file, LAPTOP, "dark");
        try { const r = await page.evaluate(names); for (const x of [...r.labelIn, ...r.clash]) bad.push(`${file}: ${x}`); } finally { await context.close(); }
      }
      assert.deepEqual(first([...new Set(bad)], 14), []);
    });

    test("the same checks in the states people reach: a perfume added to the cart (the button says 'In cart'), the cart open, the catalogue's cards and an open FAQ answer", async () => {
      const bad = [];
      const add = async (file, act) => {
        const { page, context } = await open(file, LAPTOP, "dark");
        try { await act(page); const r = await page.evaluate(names); for (const x of [...r.labelIn, ...r.clash]) bad.push(`${file}: ${x}`); } finally { await context.close(); }
      };
      await add(KHAMRAH, async (p) => { await p.locator(".p-add").first().click(); await p.waitForTimeout(300); });
      await add(KHAMRAH, async (p) => { await p.locator(".p-add").first().click(); await p.waitForTimeout(300); await p.locator("#cart-open, [data-cart-open], .cart-btn").first().click(); await p.waitForTimeout(400); });
      await add("catalogue.html", async (p) => { await p.waitForSelector("#grid .card"); });
      await add("faq.html", async (p) => { await p.locator("summary, .faq button").first().click(); await p.waitForTimeout(300); });
      assert.deepEqual(first([...new Set(bad)], 14), []);
    });
  });

  /* ------------------------------------------------------------------ consistent help (3.2.6) */
  describe("3.2.6 consistent help", () => {
    for (const [vl, view] of [["laptop", LAPTOP], ["phone", PHONE]]) {
      test(`${vl}: the round WhatsApp button is on every page, in exactly the same place`, async () => {
        const seen = new Map(), missing = [];
        for (const file of PAGE_FILES_PLUS) {
          const { page, context } = await open(file, view, "dark");
          try {
            const box = await page.evaluate(() => { const e = document.querySelector(".wa-float"); if (!e) return null; const r = e.getBoundingClientRect(); return `${Math.round(innerWidth - r.right)},${Math.round(innerHeight - r.bottom)},${Math.round(r.width)}x${Math.round(r.height)}`; });
            if (!box) missing.push(file); else seen.set(file, box);
          } finally { await context.close(); }
        }
        assert.deepEqual(missing, [], "pages without the help button");
        assert.equal(new Set(seen.values()).size, 1, `the button sits in different places: ${JSON.stringify([...new Set(seen.values())])}`);
      });
    }
  });

  test("the pages logged no console errors or failed requests during these checks", () => {
    const errors = opened.flatMap((o) => o.errors).filter((e) => !/stylesheet/i.test(e));
    assert.deepEqual([...new Set(errors)].slice(0, 6), []);
  });
});

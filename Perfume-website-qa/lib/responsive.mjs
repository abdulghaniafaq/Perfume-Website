// The responsive audit: opens every page and the key UI states (menu, cart drawer, quiz, contact form)
// at a given screen size and reports anything a visitor would trip over.
import { pageUrl } from "./data.mjs";
import { openPage } from "./browser.mjs";
import { PAGE_FILES_PLUS } from "./pages.mjs";

/** [width, height, label] — phones, sideways phones, foldables, tablets, laptops, desktops, ultrawide. */
export const DEVICES = [
  [320, 568, "small phone"], [360, 640, "Android"], [375, 667, "iPhone SE / 8"], [390, 844, "iPhone 14"], [412, 915, "Pixel"], [430, 932, "iPhone Pro Max"],
  [568, 320, "small phone, sideways"], [667, 375, "iPhone, sideways"], [844, 390, "iPhone 14, sideways"], [932, 430, "Pro Max, sideways"],
  [540, 720, "foldable"], [600, 960, "7-inch tablet"],
  [768, 1024, "iPad, portrait"], [810, 1080, "iPad 10th gen"], [820, 1180, "iPad Air"], [834, 1194, "iPad Pro 11"],
  [1024, 768, "iPad, landscape"], [1112, 834, "iPad Pro, landscape"], [1194, 834, "iPad Pro 11, landscape"],
  [1280, 720, "laptop"], [1366, 768, "laptop"], [1440, 900, "MacBook"], [1536, 864, "laptop"], [1920, 1080, "desktop"], [2560, 1440, "QHD monitor"], [3440, 1440, "ultrawide"],
];
export const PAGES = PAGE_FILES_PLUS.map((f) => f.replace(".html", ""));

/** Touch emulation for anything up to iPad-Pro landscape; phones also get the mobile viewport behaviour. */
export const contextFor = (w) => ({ hasTouch: w <= 1194, isMobile: w <= 1194 && w < 1000, reducedMotion: "reduce" });

// ---- runs inside the page; must stay self-contained --------------------------------------------------
export const auditDOM = (layerSel) => {
  const out = [];
  // when a modal / drawer is open, only the controls inside it are expected to be reachable
  const inLayer = (el) => !layerSel || !!el.closest(layerSel);
  // does anything IN FLOW (not absolutely positioned, like a badge) stick out of this box?
  const flowOverflow = (el) => {
    const box = el.getBoundingClientRect();
    return [...el.querySelectorAll("*")].some((d) => {
      for (let p = d; p && p !== el; p = p.parentElement) if (["absolute", "fixed"].includes(getComputedStyle(p).position)) return false;
      return d.getBoundingClientRect().right > box.right + 1.5;
    });
  };
  const vw = innerWidth, vh = innerHeight;
  const desc = (el) => `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""}`;
  const shown = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const clipsX = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o !== "visible") return true; } return false; };
  const skip = (el) => el.closest(".sr-only, .skip, svg *, script, style, .hero-art");

  document.body.querySelectorAll("*").forEach((el) => {
    if (skip(el) || !shown(el)) return;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    // 1. sticking out of the screen sideways
    if ((r.right > vw + 1 || r.left < -1) && !clipsX(el) && cs.position !== "fixed") out.push({ t: "off-screen", d: `${desc(el)} ${Math.round(r.left)}→${Math.round(r.right)} (screen ${vw})` });
    // 2. content spilling out of its own box
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && cs.overflowX === "visible" && !["inline", "table-cell"].includes(cs.display) && el.tagName !== "HTML" && el.tagName !== "BODY" && flowOverflow(el))
      out.push({ t: "content-overflow", d: `${desc(el)} content ${el.scrollWidth}px in a ${el.clientWidth}px box` });
    // 3. clipped text (hidden overflow, not an ellipsis)
    if (["hidden", "clip"].includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== "ellipsis" && el.textContent.trim() && !el.matches(".thumb, .modal, .cart-body"))
      out.push({ t: "clipped-text", d: `${desc(el)} "${el.textContent.trim().slice(0, 30)}" ${el.scrollWidth}>${el.clientWidth}` });
  });

  // 4. tiny text
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n; (n = walker.nextNode()); ) {
    const el = n.parentElement;
    if (!n.textContent.trim() || skip(el) || !shown(el) || seen.has(el)) continue;
    seen.add(el);
    const fs = parseFloat(getComputedStyle(el).fontSize);
    const floor = el.closest(".thumb") ? 9 : 11;     // the volume label inside the bottle thumbnail may be a little smaller
    if (fs < floor) out.push({ t: "tiny-text", d: `${desc(el)} ${fs.toFixed(1)}px "${n.textContent.trim().slice(0, 24)}"` });
  }

  // 5. tap targets (phones & tablets): 44px for main controls, 40px for chips / steppers, never under 32px
  if (vw <= 1100) {
    document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, summary").forEach((el) => {
      if (skip(el) || !shown(el) || !inLayer(el)) return;
      const r = el.getBoundingClientRect();
      const par = el.closest("p, li");                      // a link inside a sentence is "inline text" — exempt
      if (par && par.textContent.trim().length > el.textContent.trim().length + 8) return;
      const m = Math.min(r.width, r.height);
      const primary = el.matches(".btn, .add, .order, .nav a, .menu-btn, .cart-btn, .icon-btn, .chip, .seg button, .filters-btn, .pn-chip, .pg, input, select, textarea, .quiz-opt, summary, .brand, .foot-nav a");
      if (m < (primary ? 44 : 40) - 0.5) out.push({ t: m < 32 ? "tap-target<32" : primary ? "tap-target<44" : "tap-target<40", d: `${desc(el)} ${Math.round(r.width)}×${Math.round(r.height)} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 20)}"` });
    });
  }

  // 6. header: the logo, the links and the buttons must not collide or cram
  if (document.querySelector(".bar")) {
    const parts = [".brand", ".nav", ".bar-actions"].map((s) => document.querySelector(s)).filter((e) => e && shown(e));
    const rects = parts.map((e) => [desc(e), e.getBoundingClientRect()]);
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const [na, a] = rects[i], [nb, b] = rects[j];
      if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom && b.top < a.bottom) out.push({ t: "header-overlap", d: `${na} overlaps ${nb}` });
    }
    const nav = document.querySelector(".nav");
    if (nav && shown(nav) && getComputedStyle(nav).position !== "absolute") {
      nav.querySelectorAll("a").forEach((a) => { const rg = document.createRange(); rg.selectNodeContents(a); if (rg.getClientRects().length > 1) out.push({ t: "nav-wraps", d: `"${a.textContent.trim()}" wraps onto two lines` }); });
      const r = nav.getBoundingClientRect(), br = document.querySelector(".brand").getBoundingClientRect(), ac = document.querySelector(".bar-actions").getBoundingClientRect();
      if (r.left < br.right + 8 || r.right > ac.left - 8) out.push({ t: "header-cramped", d: `links ${Math.round(r.left)}–${Math.round(r.right)} squeezed between logo (${Math.round(br.right)}) and buttons (${Math.round(ac.left)})` });
    }
  }

  // 7. controls covered by something else (can't be tapped)
  document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, summary").forEach((el) => {
    if (skip(el) || !shown(el) || el.closest(".cart:not(.open)") || !inLayer(el)) return;
    if (el.closest("details:not([open])") && !el.closest("summary")) return;   // inside a collapsed FAQ answer
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > vw || y > vh) return;                       // not on screen right now
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {   // scrolled out of a scrolling box
      if (!["auto", "scroll", "hidden"].includes(getComputedStyle(p).overflowY)) continue;
      const pr = p.getBoundingClientRect();
      if (y < pr.top || y > pr.bottom) return;
    }
    const hdr = document.querySelector(".site-header");
    if (hdr && !el.closest(".site-header") && y < hdr.getBoundingClientRect().bottom) return;   // scrolled under the sticky header
    const top = document.elementFromPoint(x, y);
    // Things that float over the page (the phone's cart bar, the round WhatsApp button, back to top, the "Added" message) always have some
    // content passing underneath as the page scrolls, like the sticky header. That a control is never stuck under them is checked on purpose
    // in ux.test.mjs (focus is kept clear by scroll padding; the end of every page has room).
    if (top && top.closest("#cart-bar, #wa-float, #to-top, #toast")) return;
    if (top && top !== el && !el.contains(top) && !top.contains(el)) out.push({ t: "covered-control", d: `${desc(el)} is covered by ${desc(top)}` });
  });

  // catalogue grid columns
  const cards = [...document.querySelectorAll("#grid .card")];
  let cols = null;
  if (cards.length) { const t0 = Math.round(cards[0].getBoundingClientRect().top); cols = cards.filter((c) => Math.abs(Math.round(c.getBoundingClientRect().top) - t0) < 3).length; }
  return { issues: out, cols, scrollW: document.documentElement.scrollWidth, vw, vh };
};

/** Run the whole audit at one screen size. Returns a list of findings (empty = all good) plus the catalogue column count. */
export async function auditDevice(browser, [w, h], { scheme = "dark" } = {}) {
  const findings = [];
  let columns = null;
  const { page, context, errors } = await openPage(browser, "index.html", { viewport: { width: w, height: h }, contextOptions: { ...contextFor(w), colorScheme: scheme } });
  const note = (where, r) => {
    if (r.scrollW > r.vw + 1) findings.push(`${where}: page scrolls sideways (${r.scrollW}px wide on a ${r.vw}px screen)`);
    for (const i of r.issues) findings.push(`${where}: [${i.t}] ${i.d}`);
  };
  const settle = async () => { await page.evaluate(() => document.querySelectorAll(".reveal").forEach((e) => e.classList.add("in"))); await page.waitForTimeout(100); };
  const go = async (file, query = "") => { await page.goto(pageUrl(file, query)); await settle(); };

  for (const pg of PAGES) {
    await go(`${pg}.html`);
    const r = await page.evaluate(auditDOM);
    if (pg === "catalogue") columns = r.cols;
    note(pg, r);
  }

  // phone-style menu
  await go("index.html");
  if (await page.locator("#menu-btn").isVisible()) {
    await page.evaluate(() => document.querySelector("#menu-btn").click());
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => { const n = document.querySelector("#nav"); return { bottom: Math.round(n.getBoundingClientRect().bottom), vh: innerHeight, scrollable: n.scrollHeight > n.clientHeight + 1 }; });
    if (m.bottom > m.vh && !m.scrollable) findings.push(`menu: ends at ${m.bottom}px on a ${m.vh}px-tall screen and can't scroll`);
    note("menu", await page.evaluate(auditDOM, ".site-header"));
    await page.evaluate(() => document.querySelector("#menu-btn").click());
  }

  // cart drawer with three items
  await go("catalogue.html");
  for (const i of [0, 1, 2]) await page.locator(".card").nth(i).locator(".add").click();
  await page.evaluate(() => document.querySelector("#cart-open").click());
  await page.waitForTimeout(450);
  const c = await page.evaluate(() => {
    const d = document.querySelector("#cart").getBoundingClientRect(), b = document.querySelector(".cart-body").getBoundingClientRect(), f = document.querySelector("#cart-foot").getBoundingClientRect();
    return { w: Math.round(d.width), vw: innerWidth, bodyH: Math.round(b.height), footBottom: Math.round(f.bottom), vh: innerHeight };
  });
  if (c.w > c.vw) findings.push(`cart: drawer is ${c.w}px wide on a ${c.vw}px screen`);
  if (c.footBottom > c.vh + 1) findings.push(`cart: checkout button area runs off the bottom (${c.footBottom} > ${c.vh})`);
  if (c.bodyH < 120) findings.push(`cart: item list is only ${c.bodyH}px tall`);
  note("cart", await page.evaluate(auditDOM, ".cart.open"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(350);

  // the Filters panel, open with a few choices made (so the tags and the greyed-out options are on screen too)
  await go("catalogue.html");
  await page.evaluate(() => document.querySelector("#filters-open").click());
  await page.evaluate(() => { document.querySelector("#brand").value = "Lattafa"; document.querySelector("#brand").dispatchEvent(new Event("change", { bubbles: true })); document.querySelector('#gender [data-v="Men"]').click(); });
  await page.waitForTimeout(350);
  const fp = await page.evaluate(() => {
    const s = document.querySelector("#filters").getBoundingClientRect(), d = document.querySelector("#pn-done").getBoundingClientRect(), b = document.querySelector(".sheet-body");
    return { top: Math.round(s.top), bottom: Math.round(s.bottom), left: Math.round(s.left), right: Math.round(s.right), vw: innerWidth, vh: innerHeight, doneOk: d.top >= 0 && d.bottom <= innerHeight + 1, bodyH: Math.round(b.getBoundingClientRect().height) };
  });
  if (fp.left < -0.5 || fp.right > fp.vw + 0.5) findings.push(`filters panel: sticks out sideways (${fp.left}→${fp.right} on a ${fp.vw}px screen)`);
  if (fp.top < 0 || fp.bottom > fp.vh + 0.5) findings.push(`filters panel: runs off the screen (${fp.top}→${fp.bottom} on a ${fp.vh}px-tall screen)`);
  if (!fp.doneOk) findings.push("filters panel: the 'Show … fragrances' button is off-screen");
  if (fp.bodyH < 110) findings.push(`filters panel: the choices area is only ${fp.bodyH}px tall`);
  note("filters panel", await page.evaluate(auditDOM, "#filters"));
  await page.keyboard.press("Escape");

  // quiz: first question and results
  await go("catalogue.html", "?quiz=1");
  await page.waitForTimeout(150);
  const q = await page.evaluate(() => { const m = document.querySelector(".modal-card").getBoundingClientRect(), x = document.querySelector("#quiz-close").getBoundingClientRect(); return { w: Math.round(m.width), vw: innerWidth, closeTop: Math.round(x.top), closeRight: Math.round(x.right) }; });
  if (q.w > q.vw) findings.push(`quiz: card is ${q.w}px wide on a ${q.vw}px screen`);
  if (q.closeTop < 0 || q.closeRight > q.vw) findings.push(`quiz: close button is off-screen (top ${q.closeTop}, right ${q.closeRight})`);
  note("quiz question", await page.evaluate(auditDOM, "#quiz"));
  await page.locator(".quiz-opt").first().click();
  while (await page.locator(".quiz-opts").count()) await page.click(".quiz-skip");
  note("quiz results", await page.evaluate(auditDOM, "#quiz"));

  // contact form with catalogue suggestions showing
  await go("contact.html");
  await page.fill("#rq-perfume", "creed aventus");
  await page.fill("#rq-brand", "creed");
  note("contact form", await page.evaluate(auditDOM));

  await context.close();
  if (errors.length) findings.push(`console: ${errors[0]}`);
  return { findings, columns };
}

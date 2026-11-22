import { chromium, firefox, webkit } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { pageUrl, SITE_DIR } from "./data.mjs";
import { expected, countLabel, isDefault, pageSizeFor, DEFAULT_FILTERS, fmtPrice } from "./oracle.mjs";

export const launch = (engine = "chromium") =>
  engine === "firefox" ? firefox.launch() : engine === "webkit" ? webkit.launch()
    : chromium.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });

/**
 * Opens a page of the site in a fresh context. Collects every console error / failed request, and records
 * each WhatsApp link the page opens in window.__wa (window.open is replaced, so nothing really launches).
 * `siteConfig(text)` can rewrite site-config.js on the way in (e.g. to flip a setting).
 */
export async function openPage(browser, file, { viewport = { width: 1360, height: 900 }, query = "", siteConfig, productsData, storage, contextOptions = {}, base } = {}) {   // base: "http://127.0.0.1:1234/" to load over HTTP (see lib/server.mjs) instead of from disk
  // colorScheme: the site follows the device setting, so pin the tests to dark (the main look) unless a test asks for light.
  const context = await browser.newContext({ viewport, colorScheme: "dark", ...contextOptions });   // contextOptions: e.g. { hasTouch, isMobile, reducedMotion, colorScheme }
  // Fonts come from Google; stub them so tests don't depend on the network.
  // (set REAL_FONTS=1 to load the real web fonts from Google instead, as a visitor's browser does: see browsers.test.mjs)
  if (!process.env.REAL_FONTS) await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  if (siteConfig) {
    // (read from disk: Playwright's route.fetch can't fetch file:// URLs)
    await context.route(/site-config\.js$/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: siteConfig(fs.readFileSync(path.join(SITE_DIR, "data", "site-config.js"), "utf8")) }));
  }
  if (productsData) {   // productsData(text) can rewrite data/products-data.js on the way in (e.g. to remove one gender tag)
    await context.route(/products-data\.js$/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: productsData(fs.readFileSync(path.join(SITE_DIR, "data", "products-data.js"), "utf8")) }));
  }
  await context.addInitScript(() => {
    window.__wa = [];
    window.open = (url) => { window.__wa.push(String(url)); return { opener: null }; };
  });
  if (storage) await context.addInitScript((kv) => { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); }, storage);
  const page = await context.newPage();
  // The site's strict Content-Security-Policy (see _headers, applied by lib/server.mjs) refuses inline <style> and <script> tags, which is what
  // addStyleTag / addScriptTag with `content` create. So tests inject the way browser dev tools do: a style sheet through the style sheet API
  // (not an inline tag) and a script by running its source through the debugger. The policy itself stays fully enforced for the site.
  const addStyleTag = page.addStyleTag.bind(page), addScriptTag = page.addScriptTag.bind(page);
  page.addStyleTag = (opts = {}) => (opts.content
    ? page.evaluate((css) => { const s = new CSSStyleSheet(); s.replaceSync(css); document.adoptedStyleSheets = [...document.adoptedStyleSheets, s]; }, opts.content)
    : addStyleTag(opts));
  page.addScriptTag = (opts = {}) => (opts.content ? page.evaluate(opts.content).then(() => undefined) : addScriptTag(opts));
  // Playwright's waitForFunction runs its function through eval inside the page, which the policy also refuses (no 'unsafe-eval'); so wait by polling page.evaluate instead
  page.waitForFunction = async (fn, arg, { timeout = 30000, polling = 50 } = {}) => {
    const end = Date.now() + timeout;
    for (;;) {
      const ok = await page.evaluate(fn, arg).catch((e) => { if (/context was destroyed|navigation/i.test(String(e.message))) return false; throw e; });
      if (ok) return ok;
      if (Date.now() > end) throw new Error(`page.waitForFunction: Timeout ${timeout}ms exceeded.`);
      await page.waitForTimeout(polling);
    }
  };
  const errors = [];
  page.on("console", (m) => ["error", "warning"].includes(m.type()) && errors.push(`console.${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => errors.push(`requestfailed: ${r.url()}`));
  await page.goto(base ? `${base}${file}${query}` : pageUrl(file, query), { waitUntil: "load" });
  return { page, context, errors };
}

/** Opens catalogue.html in a fresh context (see openPage). */
export const openCatalogue = (browser, opts = {}) => openPage(browser, "catalogue.html", opts);

/*
 * Drives the REAL controls inside the page, the way a visitor would: style tabs, the sort dropdown, the search box,
 * and — for house / for / scent / price / size — opening the Filters panel, choosing, and closing it again.
 * A choice that the page has greyed out (0 results) is still pressed (that is how tests force a dead end).
 * Installed once per page load as window.__drive.
 */
const DRIVE_SRC = `(() => {
  if (window.__drive) return;
  const $ = (s) => document.querySelector(s);
  const press = (b) => { b.disabled = false; b.click(); };
  const withPanel = (fn) => { const was = !$("#filters").hidden; if (!was) $("#filters-open").click(); try { fn(); } finally { if (!was) $("#pn-done").click(); } };
  const GROUP = { gd: "#gender", fm: "#family", price: "#price", g: "#size" };
  const OFF = { gd: "", fm: "", price: "", g: "all" };
  const setSelect = (id, v) => { const el = $(id); el.value = v; if (el.value !== v) throw new Error('no option "' + v + '" in ' + id); el.dispatchEvent(new Event("change", { bubbles: true })); };
  window.__drive = (key, v) => {
    if (key === "seg") return $('#segChips [data-seg="' + v + '"]').click();
    if (key === "sort") return setSelect("#sort", v);
    if (key === "q") {
      const i = $("#q"); i.value = v; i.dispatchEvent(new Event("input", { bubbles: true }));
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));   // "finished typing, moved on": puts the suggestion list away so it can't sit over other controls
      return;
    }
    if (key === "brand") return withPanel(() => setSelect("#brand", v));
    return withPanel(() => {
      const g = $(GROUP[key]);
      if (v === OFF[key]) { const on = g.querySelector('[aria-pressed="true"]'); if (on) press(on); return; }
      const b = g.querySelector('[data-v="' + v + '"]');
      if (!b) throw new Error('no option "' + v + '" in ' + GROUP[key]);
      if (b.getAttribute("aria-pressed") !== "true") press(b);
    });
  };
})()`;

/** Change ONE control the way a user would, without resetting anything first. */
export const change = async (page, key, value) => {
  await page.evaluate(DRIVE_SRC);
  await page.evaluate(async ({ key, value }) => {
    window.__drive(key, value);
    if (key === "q") await new Promise((r) => setTimeout(r, 140)); // search is debounced
  }, { key, value });
};

/** Drive the real controls (tab clicks, panel choices, typing) in the given order. */
export const applyFilters = async (page, F, order = Object.keys(F)) => {
  await page.evaluate(DRIVE_SRC);
  await page.evaluate(async ({ F, order }) => {
    const $ = (s) => document.querySelector(s);
    const reset = $("#reset");
    if (!reset.hidden) reset.click();
    const first = $('#pager .pg[data-p="1"]');
    if (first && !first.classList.contains("on")) first.click();
    for (const k of order) window.__drive(k, F[k]);
    if ("q" in F) await new Promise((r) => setTimeout(r, 140)); // search is debounced
  }, { F, order });
};

/** Walk every results page via the pager and read what a user would see. */
export const collect = (page) =>
  page.evaluate(() => {
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => [...document.querySelectorAll(s)];
    const txt = (e) => e.textContent.replace(/\s+/g, " ").trim();
    const cards = () => $$("#grid .card").map((c) => {
      const chips = [...c.querySelectorAll(".vchip")];
      const prices = chips.length ? chips.map((ch) => { ch.click(); return txt(c.querySelector(".price")); }) : [txt(c.querySelector(".price"))];
      if (chips.length) chips[0].click();
      return { slug: c.dataset.slug, prices, labels: chips.length ? chips.map(txt) : [txt(c.querySelector(".tag.pkg"))] };
    });
    const pager = () => ({
      parts: $$("#pager .pg:not(.nav), #pager .pg-gap").map((e) => (e.classList.contains("pg-gap") ? "…" : txt(e))),
      active: ($("#pager .pg.on") || {}).textContent || null,
      prevDisabled: !!($$("#pager .pg.nav")[0] || {}).disabled,
      nextDisabled: !!($$("#pager .pg.nav").at(-1) || {}).disabled,
      present: !!$("#pager .pg"),
    });
    const pressed = (sel, attr) => $$(sel).filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset[attr]);
    const chosen = (id) => pressed(`#${id} .pn-chip`, "v").join();   // the panel's tap-to-choose groups ("" = nothing chosen)
    const ui = {
      seg: pressed("#segChips button", "seg"),
      brand: $("#brand").value, gd: chosen("gender"), fm: chosen("family"), price: chosen("price"), g: chosen("size"),
      sort: $("#sort").value, q: $("#q").value,
      badge: $("#filters-badge").hidden ? 0 : +$("#filters-badge").textContent, tags: $$("#ftags .ftag").length,
    };
    const out = { ui, vw: innerWidth, count: txt($("#count")), resetHidden: $("#reset").hidden, empty: !!$("#grid .empty"), pages: [] };
    for (let i = 0; i < 200; i++) {
      out.pages.push({ cards: cards(), pager: pager() });
      const next = $$("#pager .pg.nav").at(-1);
      if (!next || next.disabled) break;
      next.click();
    }
    return out;
  });

/** Compare a collected result to the oracle. Returns a list of human-readable problems. */
export function diff(F, got) {
  const exp = expected(F);
  const problems = [];
  const n = exp.length;
  const PAGE_SIZE = pageSizeFor(got.vw);                      // 24 a page on a phone-width screen, 48 otherwise
  const flat = got.pages.flatMap((p) => p.cards);

  if (got.count !== countLabel(n, 1, PAGE_SIZE)) problems.push(`count label "${got.count}" ≠ expected "${countLabel(n, 1, PAGE_SIZE)}"`);
  if (flat.length !== n) problems.push(`shown ${flat.length} products ≠ expected ${n}`);
  const gotSlugs = flat.map((c) => c.slug), expSlugs = exp.map((r) => r.slug);
  if (gotSlugs.join() !== expSlugs.join()) {
    const extra = gotSlugs.filter((s) => !expSlugs.includes(s)), missing = expSlugs.filter((s) => !gotSlugs.includes(s));
    problems.push(extra.length || missing.length
      ? `unexpected: [${extra.slice(0, 4)}]${extra.length > 4 ? "…" : ""} missing: [${missing.slice(0, 4)}]${missing.length > 4 ? "…" : ""}`
      : "same products but wrong ORDER");
  } else {
    flat.forEach((c, i) => {
      const e = exp[i].variants.map((v) => v.shown);
      if (c.prices.join("|") !== e.join("|")) problems.push(`${c.slug}: variant prices [${c.prices}] ≠ expected [${e}]`);
    });
  }
  const pages = Math.max(1, Math.ceil(n / PAGE_SIZE));
  if (n === 0 && !got.empty) problems.push("empty state not shown");
  if (n > 0 && got.empty) problems.push("empty state shown but results expected");
  if (got.pages.length !== pages) problems.push(`walked ${got.pages.length} pages ≠ expected ${pages}`);
  if (n > 0 && got.pages.some((p, i) => p.cards.length !== (i < pages - 1 ? PAGE_SIZE : n - PAGE_SIZE * (pages - 1)))) problems.push("a page has the wrong number of cards");
  if (pages > 1 !== got.pages[0].pager.present) problems.push(`pager ${got.pages[0].pager.present ? "shown" : "missing"} for ${n} results`);
  if (got.resetHidden !== isDefault(F)) problems.push(`"Clear filters" ${got.resetHidden ? "hidden" : "visible"} but filters are ${isDefault(F) ? "default" : "active"}`);

  // the controls must mirror the active filters
  const want = { ...DEFAULT_FILTERS, ...F };
  if (got.ui.seg.join() !== want.seg) problems.push(`style tabs pressed [${got.ui.seg}] ≠ "${want.seg}"`);
  for (const k of ["brand", "gd", "fm", "price", "sort", "q"]) if (got.ui[k] !== want[k]) problems.push(`control "${k}" shows "${got.ui[k]}" ≠ "${want[k]}"`);
  if (got.ui.g !== (want.g === "all" ? "" : want.g)) problems.push(`size choice shows "${got.ui.g}" ≠ "${want.g}"`);
  // the Filters button's number and the little tags under the controls must count exactly what is chosen in the panel
  const inPanel = ["brand", "gd", "fm", "price", "g"].filter((k) => want[k] !== DEFAULT_FILTERS[k]).length;
  if (got.ui.badge !== inPanel) problems.push(`Filters badge shows ${got.ui.badge}, but ${inPanel} panel filters are on`);
  if (got.ui.tags !== inPanel) problems.push(`${got.ui.tags} filter tags shown, but ${inPanel} panel filters are on`);

  // pager invariants on every page
  got.pages.forEach((pg, i) => {
    const cur = i + 1, p = pg.pager;
    if (pages === 1) return;
    const nums = p.parts.filter((x) => x !== "…").map(Number);
    if (p.active !== String(cur)) problems.push(`page ${cur}: active page shows "${p.active}"`);
    if (p.prevDisabled !== (cur === 1)) problems.push(`page ${cur}: Prev disabled=${p.prevDisabled}`);
    if (p.nextDisabled !== (cur === pages)) problems.push(`page ${cur}: Next disabled=${p.nextDisabled}`);
    const need = [1, pages, cur, Math.max(1, cur - 1), Math.min(pages, cur + 1)];
    if (need.some((x) => !nums.includes(x))) problems.push(`page ${cur}: pager missing one of ${need} (has ${p.parts})`);
    if (nums.some((x, k) => k && x <= nums[k - 1])) problems.push(`page ${cur}: pager numbers not strictly ascending (${p.parts})`);
    p.parts.forEach((x, k) => { if (x === "…" && Number(p.parts[k + 1]) - Number(p.parts[k - 1]) < 2) problems.push(`page ${cur}: ellipsis hides nothing (${p.parts})`); });
    p.parts.forEach((x, k) => { if (x !== "…" && k && p.parts[k - 1] !== "…" && Number(x) - Number(p.parts[k - 1]) > 1) problems.push(`page ${cur}: unmarked gap (${p.parts})`); });
  });
  return problems;
}

/** Run scenarios [{F, order?}] and return failures (empty array = all good). */
export async function runScenarios(page, scenarios, { maxFailures = 12 } = {}) {
  const failures = [];
  for (const sc of scenarios) {
    const F = sc.F ?? sc;
    try {
      await applyFilters(page, F, sc.order ?? Object.keys(F));
      const problems = diff(F, await collect(page));
      if (problems.length) failures.push({ filters: F, order: sc.order, problems: problems.slice(0, 4) });
    } catch (e) {
      failures.push({ filters: F, problems: [`threw: ${e.message}`] });
    }
    if (failures.length >= maxFailures) break;
  }
  return failures;
}

export const fmt = (failures) => failures.length ? "\n" + failures.map((f) => `  • ${JSON.stringify(f.filters)}${f.order ? " order=" + f.order : ""}\n      - ${f.problems.join("\n      - ")}`).join("\n") : "";
export { expected, DEFAULT_FILTERS, fmtPrice };

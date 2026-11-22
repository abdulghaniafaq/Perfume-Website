// Security of the site as it will run on Netlify.
//
//   A. the _headers file (what Netlify sends with every page): HTTPS-only, a strict Content-Security-Policy, no framing, no sniffing,
//      limited referrers, unused browser features switched off, and never a "noindex"
//   B. the pages are written so that policy can be strict: no inline scripts but the one allowed by its fingerprint, no inline styles or handlers,
//      no third-party code, no network calls, links that open new tabs cannot reach back, nothing stray or secret in the folder to upload
//   C. in a browser, with the real headers applied: the policy is really enforced (an injected script, handler, request, picture and frame are all refused),
//      every page and every kind of interaction runs without one violation, and hostile text put in through every door
//      (address bar, search box, contact form, the saved cart and theme) is shown as text and never runs
//   What this cannot cover: Netlify's own account security (turn on two-factor sign-in) - see README.md, sections 8 and 12.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { launch, openPage } from "./lib/browser.mjs";
import { serve, parseHeadersFile, headersFor } from "./lib/server.mjs";
import { SITE, SITE_DIR, PRODUCTS } from "./lib/data.mjs";
import { PAGE_FILES_PLUS } from "./lib/pages.mjs";

const read = (f) => fs.readFileSync(path.join(SITE_DIR, f), "utf8");
const first = (xs, n = 8) => (xs.length > n ? [...xs.slice(0, n), `… and ${xs.length - n} more`] : xs);
const ALL_HTML = fs.readdirSync(SITE_DIR).filter((f) => f.endsWith(".html") && !/^google[0-9a-f]{16}\.html$/.test(f)).sort();
const JS = fs.readdirSync(path.join(SITE_DIR, "assets/js")).filter((f) => f.endsWith(".js")).map((f) => [`assets/js/${f}`, read(`assets/js/${f}`)]);
const CSS = fs.readdirSync(path.join(SITE_DIR, "assets/css")).filter((f) => f.endsWith(".css")).map((f) => [`assets/css/${f}`, read(`assets/css/${f}`)]);
const RULES = parseHeadersFile(read("_headers"));
const H = headersFor(RULES, "/index.html");
const csp = Object.fromEntries((H["Content-Security-Policy"] || "").split(";").map((d) => d.trim()).filter(Boolean).map((d) => { const [k, ...v] = d.split(/\s+/); return [k, v]; }));
const sha = (s) => `'sha256-${crypto.createHash("sha256").update(s).digest("base64")}'`;
const WALK = (dir, out = []) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); e.isDirectory() ? WALK(p, out) : out.push(path.relative(SITE_DIR, p)); } return out; };

/* ============================================================================================ A */
describe("A. the _headers file", () => {
  test("it exists, applies to every path, and is read by Netlify's own rules (a path line, then indented 'Name: value' lines)", () => {
    assert.equal(RULES.length, 1);
    assert.equal(RULES[0].pattern, "/*");
    assert.ok(RULES[0].headers.length >= 8, `${RULES[0].headers.length} headers`);
    for (const [k, v] of RULES[0].headers) { assert.match(k, /^[A-Za-z][A-Za-z0-9-]*$/, `header name ${k}`); assert.ok(v.length > 2 && !/[\r\n]/.test(v), `value of ${k}`); }
    assert.equal(new Set(RULES[0].headers.map(([k]) => k.toLowerCase())).size, RULES[0].headers.length, "no header twice");
  });

  test("the simple protections: HTTPS for a year or more, no sniffing, no framing, limited referrers, a window opened by another site cannot reach back", () => {
    assert.match(H["Strict-Transport-Security"], /^max-age=(\d+)/);
    assert.ok(+H["Strict-Transport-Security"].match(/max-age=(\d+)/)[1] >= 31536000, "HSTS for at least a year");
    assert.equal(H["X-Content-Type-Options"], "nosniff");
    assert.equal(H["X-Frame-Options"], "DENY");
    assert.ok(["strict-origin-when-cross-origin", "strict-origin", "same-origin", "no-referrer"].includes(H["Referrer-Policy"]), H["Referrer-Policy"]);
    assert.ok(["same-origin", "same-origin-allow-popups"].includes(H["Cross-Origin-Opener-Policy"]), H["Cross-Origin-Opener-Policy"]);
    assert.equal(H["X-Permitted-Cross-Domain-Policies"], "none");
  });

  test("Permissions-Policy switches off camera, microphone, location, payment, USB and sensors, with names every browser knows (an unknown name is a console warning)", () => {
    const pp = Object.fromEntries(H["Permissions-Policy"].split(/,\s*(?=[a-z-]+=)/).map((x) => x.trim().split("=")));
    for (const f of ["camera", "microphone", "geolocation", "payment", "usb", "accelerometer", "gyroscope", "magnetometer", "midi", "serial", "hid", "bluetooth", "display-capture", "xr-spatial-tracking"]) assert.equal(pp[f], "()", f);
    for (const bad of ["ambient-light-sensor", "battery", "interest-cohort"]) assert.ok(!(bad in pp), `${bad} is not recognised by current browsers`);
  });

  test("the Content-Security-Policy is strict: this site's own scripts, styles and pictures; Google Fonts only for the font files; no inline code except one fingerprinted script; no plug-ins; no framing; no wildcards", () => {
    const only = (d, allowed) => { assert.ok(csp[d], `${d} is set`); assert.deepEqual(csp[d].filter((t) => !allowed.includes(t) && !/^'sha256-[A-Za-z0-9+/]{43}='$/.test(t)), [], `${d}: ${csp[d].join(" ")}`); };
    only("default-src", ["'self'"]);
    only("script-src", ["'self'"]);
    only("style-src", ["'self'", "https://fonts.googleapis.com"]);
    only("font-src", ["'self'", "https://fonts.gstatic.com"]);
    only("img-src", ["'self'", "data:"]);
    only("connect-src", ["'self'"]);
    assert.deepEqual(csp["object-src"], ["'none'"]);
    assert.deepEqual(csp["frame-ancestors"], ["'none'"]);
    assert.deepEqual(csp["form-action"], ["'self'"]);
    assert.deepEqual(csp["base-uri"], ["'self'"]);
    assert.ok("upgrade-insecure-requests" in csp, "anything left on http is upgraded to https");
    const text = H["Content-Security-Policy"];
    assert.doesNotMatch(text, /unsafe-inline|unsafe-eval|unsafe-hashes|\*|\bhttp:|blob:|filesystem:/, "no unsafe keyword, wildcard, plain-http source");
    assert.deepEqual(csp["style-src"].filter((t) => t.startsWith("'sha")), [], "no style needs a fingerprint: the pages have no inline styles");
  });

  test("the fingerprint in the policy is the fingerprint of the one inline script (the light/dark switch) that every page carries; if that script is edited, this test prints the new fingerprint", () => {
    const allowed = new Set(csp["script-src"].filter((t) => t.startsWith("'sha256-")));
    const found = new Map();
    for (const f of ALL_HTML) for (const m of read(f).matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)) { const h = sha(m[1]); found.set(h, (found.get(h) || 0) + 1); }
    assert.equal(found.size, 1, `${found.size} different inline scripts`);
    const [[h, n]] = [...found];
    assert.equal(n, ALL_HTML.length, "every page has it");
    assert.ok(allowed.has(h), `the policy allows ${[...allowed]} but the pages' inline script is ${h}: put ${h} in _headers`);
    assert.equal(allowed.size, 1, "and nothing else is allowed by fingerprint");
  });

  test("the file never asks search engines to stay away (no X-Robots-Tag, no noindex), so Google and AI search can list the site", () => {
    assert.ok(!RULES.flatMap((r) => r.headers).some(([k]) => /^x-robots-tag$/i.test(k)));
    assert.doesNotMatch(read("_headers").replace(/^\s*#.*$/gm, ""), /noindex|nofollow|nosnippet/i);
  });
});

/* ============================================================================================ B */
describe("B. the pages and scripts are written for a strict policy", () => {
  const PAGES = ALL_HTML.map((f) => [f, read(f)]);
  const withoutData = (h) => h.replace(/<script type="application\/ld\+json"[\s\S]*?<\/script>/g, "");

  test("no page has an inline style, an inline event handler, a javascript: link, a frame, a plug-in, a <base> tag or a form that posts elsewhere", () => {
    const bad = [];
    for (const [f, h0] of PAGES) {
      const h = withoutData(h0);
      if (/<style[\s>]/i.test(h)) bad.push(`${f}: <style>`);
      if (/\sstyle\s*=/i.test(h)) bad.push(`${f}: style attribute`);
      if (/\son[a-z]+\s*=\s*["']/i.test(h)) bad.push(`${f}: inline event handler`);
      if (/(href|src|action|formaction)\s*=\s*["']\s*(javascript|vbscript|data:text\/html)/i.test(h)) bad.push(`${f}: script link`);
      if (/<(iframe|frame|object|embed|applet|base)[\s>]/i.test(h)) bad.push(`${f}: frame, plug-in or base tag`);
      for (const m of h.matchAll(/<form\b[^>]*>/g)) if (/\saction\s*=\s*["']https?:/i.test(m[0])) bad.push(`${f}: form posts to another site`);
      if (/\ssrcdoc\s*=/i.test(h)) bad.push(`${f}: srcdoc`);
    }
    assert.deepEqual(first(bad), []);
  });

  test("the scripts never build code from text (no eval, new Function, document.write, string timers, inline-handler or inline-style attributes) and make no network calls of their own", () => {
    const bad = [];
    for (const [f, s] of JS) {
      const code = s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      if (/\beval\s*\(|new\s+Function\s*\(|document\.write(ln)?\s*\(|setTimeout\s*\(\s*["'`]|setInterval\s*\(\s*["'`]|importScripts\s*\(/.test(code)) bad.push(`${f}: runs text as code`);
      if (/setAttribute\(\s*["'](on[a-z]+|style|srcdoc)["']/.test(code)) bad.push(`${f}: sets a handler or style as an attribute`);
      if (/\sstyle\s*=\s*\\?["']/.test(code)) bad.push(`${f}: writes an inline style into the page`);
      if (/\bon[a-z]+\s*=\s*\\?["'][^"']*\(/.test(code.replace(/\.on[a-z]+\s*=\s*function|\bon[A-Z]\w*\s*=/g, ""))) bad.push(`${f}: writes an inline handler`);
      if (/XMLHttpRequest|sendBeacon|WebSocket|EventSource|\bfetch\s*\(/.test(code)) bad.push(`${f}: network call`);
      if (/createElement\(\s*["'](script|iframe|object|embed)["']/.test(code)) bad.push(`${f}: creates a script or frame`);
    }
    assert.deepEqual(bad, []);
  });

  test("no third-party code or pictures: the only outside addresses a page loads are Google Fonts' style sheet and font files (and the preconnect to them)", () => {
    const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
    const bad = [];
    for (const [f, h0] of PAGES) {
      const h = withoutData(h0);
      for (const m of h.matchAll(/<(script|img|source|video|audio|track|input)\b[^>]*\ssrc\s*=\s*["'](https?:)?\/\/([^/"']+)/gi)) bad.push(`${f}: <${m[1]}> loads ${m[3]}`);
      for (const m of h.matchAll(/<link\b[^>]*>/gi)) {
        const href = (m[0].match(/\shref\s*=\s*["']((?:https?:)?\/\/[^"']+)/) || [])[1];
        if (!href) continue;
        const rel = (m[0].match(/\srel\s*=\s*["']([^"']+)/) || [])[1] || "";
        const host = new URL(href, "https://x").host;
        if (/\b(canonical|alternate|author|license|me)\b/.test(rel)) continue;     // these name an address; the browser does not load it
        if (!FONT_HOSTS.includes(host)) bad.push(`${f}: <link rel=${rel}> loads ${host}`);
      }
    }
    for (const [f, s] of CSS) for (const m of s.matchAll(/(?:url\(\s*["']?|@import\s+["'])((?:https?:)?\/\/[^"')\s]+)/g)) bad.push(`${f}: loads ${m[1]}`);
    for (const [f, s] of JS) for (const m of s.matchAll(/["'`](https?:\/\/[^"'`\s]+)/g)) if (!/^https:\/\/(wa\.me|instagram\.com\/\$\{|perfume-x-collections\.netlify\.app|schema\.org|www\.w3\.org)/.test(m[1])) bad.push(`${f}: names ${m[1]}`);
    assert.deepEqual(first([...new Set(bad)]), []);
  });

  test("every link that opens a new tab says rel=noopener, and the script that opens WhatsApp cuts the new window's link back to the page", () => {
    const bad = [];
    for (const [f, h] of PAGES) for (const m of h.matchAll(/<a\b[^>]*\starget\s*=\s*["']_blank["'][^>]*>/g)) if (!/\srel\s*=\s*["'][^"']*\bnoopener\b/.test(m[0])) bad.push(`${f}: ${m[0].slice(0, 90)}`);
    assert.deepEqual(first(bad), []);
    assert.match(read("assets/js/common.js"), /const w = window\.open\(url, "_blank"\);\s*if \(w\) \{ w\.opener = null;/);
  });

  test("the folder to upload holds only the site: no hidden files, source maps, backups, keys, notes, package files or test code; and no secret-looking text anywhere in it", () => {
    const files = WALK(SITE_DIR);
    const stray = files.filter((f) => f.split("/").some((seg) => seg.startsWith(".") && seg !== ".well-known") || /\.(map|bak|orig|swp|log|env|pem|key|crt|p12|sql|sqlite|zip|gz|tar|md|mjs|ts|tsx|jsx|py|sh)$/i.test(f) || /(^|\/)(package(-lock)?\.json|node_modules|\.git|Dockerfile|\.npmrc)(\/|$)/.test(f));
    assert.deepEqual(stray, [], "files that should not be uploaded");
    const bad = [];
    for (const f of files.filter((x) => /\.(html|js|css|txt|xml|json|webmanifest)$/.test(x) || x === "_headers")) {
      const t = read(f);
      if (/-----BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|sk_(live|test)_[A-Za-z0-9]{10,}|xox[bap]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,}/.test(t)) bad.push(`${f}: a key or token`);
      if (/\b(api[_-]?key|secret|passw(or)?d|auth[_-]?token|client[_-]?secret)\b\s*[:=]\s*["'][^"']{6,}/i.test(t)) bad.push(`${f}: a credential-looking value`);
      if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/.test(t.replace(/@(media|font-face|import|keyframes|supports|context|type|id|graph|vocab|container|layer|charset)/g, ""))) bad.push(`${f}: an e-mail address`);
    }
    assert.deepEqual(first(bad), []);
  });

  test("the WhatsApp number is written in exactly one file (data/site-config.js) - not in any page, style, header, sitemap or note", () => {
    const num = SITE.contact.whatsapp, last9 = num.slice(-9), spaced = new RegExp(last9.split("").join("[\\s.-]?"));
    const bad = [];
    for (const f of WALK(SITE_DIR)) {
      if (f === "data/site-config.js" || /\.(jpg|jpeg|png|webp|gif|ico|woff2?)$/i.test(f)) continue;
      const t = fs.readFileSync(path.join(SITE_DIR, f), "utf8");
      if (t.includes(num) || t.includes(last9) || spaced.test(t)) bad.push(f);
    }
    assert.deepEqual(first(bad), []);
  });
});

/* ============================================================================================ C */
describe("C. in a browser, with the real headers", () => {
  let browser, webkit, srv;
  const opened = [];
  before(async () => { browser = await launch(); srv = await serve(); });
  after(async () => { await browser.close(); if (webkit) await webkit.close(); await srv.close(); });

  const spy = () => { window.__csp = []; window.__xss = undefined; document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI || e.sample || ""}`.slice(0, 120))); };
  const open = async (file, extra = {}, b = browser) => {
    const c = await openPage(b, file, { base: srv.base, ...extra });
    opened.push(c);
    await c.page.waitForTimeout(250);
    return c;
  };
  const openSpied = async (file, extra = {}, b = browser) => {
    const context = await b.newContext({ viewport: { width: 1360, height: 900 }, colorScheme: "dark", ...(extra.contextOptions || {}) });
    await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
    await context.addInitScript(() => { window.__wa = []; window.open = (u) => { window.__wa.push(String(u)); return { opener: null }; }; });
    if (extra.storage) await context.addInitScript((kv) => { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); }, extra.storage);
    await context.addInitScript(spy);
    const page = await context.newPage();
    const errors = [];
    page.on("console", (m) => ["error", "warning"].includes(m.type()) && errors.push(`console.${m.type()}: ${m.text()}`));
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("dialog", (d) => d.dismiss());
    await page.goto(`${srv.base}${file}${extra.query || ""}`, { waitUntil: "load" });
    await page.waitForTimeout(300);
    const c = { page, context, errors };
    opened.push(c);
    return c;
  };
  const state = (page) => page.evaluate(() => ({ csp: window.__csp, xss: window.__xss, injected: document.querySelectorAll("img[src='x'], svg[onload], iframe, script:not([src]):not([type]):not(#ld-graph), [onerror], [onload]").length - document.querySelectorAll("script:not([src]):not([type='application/ld+json'])").length }));

  test("the headers really arrive with every page, the 404 page and the data files, and the _headers file itself is not served", async () => {
    for (const p of ["index.html", "perfume-lattafa-khamrah.html", "assets/js/common.js", "robots.txt", "no-such-page.html"]) {
      const r = await fetch(srv.base + p);
      for (const k of ["content-security-policy", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy", "cross-origin-opener-policy"]) assert.ok(r.headers.get(k), `${p}: ${k}`);
      assert.match(r.headers.get("content-security-policy"), /script-src 'self' 'sha256-/, p);
    }
    assert.equal((await fetch(srv.base + "_headers")).status, 404);
  });

  describe("the policy is enforced, not just written down", () => {
    test("an injected script, an injected inline handler, an outside request, an outside picture and an outside style are all refused (and reported)", async () => {
      const { page, context } = await openSpied("index.html");
      try {
        const r = await page.evaluate(async () => {
          const s = document.createElement("script"); s.textContent = "window.__xss = 'script ran'"; document.head.appendChild(s);
          const b = document.createElement("button"); b.setAttribute("onclick", "window.__xss = 'handler ran'"); document.body.appendChild(b); b.click();
          const st = document.createElement("style"); st.textContent = "body{outline:9px solid red}"; document.head.appendChild(st);
          const fetched = await fetch("https://example.com/").then(() => "fetched", () => "blocked");
          const img = new Image(); const imgResult = await new Promise((res) => { img.onerror = () => res("blocked"); img.onload = () => res("loaded"); img.src = "https://example.com/x.png"; setTimeout(() => res("blocked"), 1500); });
          const s2 = document.createElement("script"); s2.src = "https://example.com/x.js"; document.head.appendChild(s2);
          await new Promise((r) => setTimeout(r, 300));
          return { xss: window.__xss, fetched, imgResult, outline: getComputedStyle(document.body).outlineWidth, csp: window.__csp };
        });
        assert.equal(r.xss, undefined, "nothing ran");
        assert.equal(r.fetched, "blocked");
        assert.equal(r.imgResult, "blocked");
        assert.notEqual(r.outline, "9px", "the injected style did not apply");
        for (const d of ["script-src", "style-src", "connect-src", "img-src"]) assert.ok(r.csp.some((x) => x.startsWith(d)), `a ${d} violation was reported: ${JSON.stringify(r.csp)}`);
      } finally { await context.close(); }
    });

    test("no other site can frame the pages (clickjacking), not even a page of this same site", async () => {
      const { page, context } = await openSpied("faq.html");
      try {
        await page.evaluate((u) => { const f = document.createElement("iframe"); f.id = "probe"; f.src = u; document.body.appendChild(f); }, `${srv.base}index.html`).catch(() => {});
        await page.waitForTimeout(1200);
        const framed = page.frames().find((f) => f !== page.mainFrame());
        // either the frame never got the page (blocked, an error page) or the frame holds no site content
        const siteH1 = (await (await fetch(`${srv.base}index.html`)).text()).match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 25);
        const content = framed ? await framed.evaluate(() => document.body.innerText).catch(() => "") : "";
        assert.ok(!content.includes(siteH1), `the site's own page appeared inside a frame: "${content.slice(0, 60)}"`);
        assert.match(content, /blocked|refused|can.t|error/i, `the browser showed its "blocked" page instead (it said: "${content.trim().slice(0, 60)}")`);
      } finally { await context.close(); }
    });
  });

  describe("every page and every kind of use runs without a single policy violation or console message", () => {
    test("the 14 pages and the sample perfume pages, laptop and phone", async () => {
      const bad = [];
      for (const [vl, extra] of [["laptop", {}], ["phone", { contextOptions: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } }]]) {
        for (const file of PAGE_FILES_PLUS) {
          const { page, context, errors } = await openSpied(file, extra);
          try {
            await page.mouse.wheel(0, 4000); await page.waitForTimeout(150);
            const s = await state(page);
            if (s.csp.length) bad.push(`${file} (${vl}): ${s.csp.join("; ")}`);
            for (const e of errors) bad.push(`${file} (${vl}): ${e}`);
          } finally { await context.close(); }
        }
      }
      assert.deepEqual(first(bad), []);
    });

    test("catalogue: search and suggestions, Filters panel, a size chip, Add, the cart, the quiz, the photo viewer", async () => {
      const { page, context, errors } = await openSpied("catalogue.html");
      try {
        await page.click("#q"); await page.keyboard.type("oud", { delay: 20 }); await page.waitForSelector("#suggest:not([hidden]) li"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
        await page.waitForSelector("#grid .card");
        await page.fill("#q", ""); await page.keyboard.press("Escape"); await page.waitForSelector("#grid .card");
        await page.click("#filters-open"); await page.waitForSelector("#filters:not([hidden])");
        await page.selectOption("#brand", { index: 2 }); await page.waitForTimeout(200); await page.selectOption("#brand", { index: 0 }); await page.click("#filters-x");
        await page.waitForSelector("#grid .card");
        const chip = page.locator("#grid .card .vchip").first(); if (await chip.count()) await chip.click();
        await page.locator("#grid .card .add").first().click();
        await page.click("#cart-open"); await page.waitForTimeout(400); await page.keyboard.press("Escape");
        await page.locator("#grid .card .thumb").first().click(); await page.waitForTimeout(300); await page.keyboard.press("Escape");
        const quiz = page.locator("[data-quiz], #quiz-open, .quiz-btn").first(); if (await quiz.count()) { await quiz.click(); await page.waitForTimeout(400); await page.keyboard.press("Escape"); }
        const s = await state(page);
        assert.deepEqual(s.csp, []);
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    });

    test("a perfume page (Add, Order), the contact form (errors, then a request), the FAQ, the home page's Pause button and theme switch", async () => {
      const bad = [];
      const run = async (file, fn) => { const { page, context, errors } = await openSpied(file); try { await fn(page); const s = await state(page); bad.push(...s.csp.map((x) => `${file}: ${x}`), ...errors.map((x) => `${file}: ${x}`)); } finally { await context.close(); } };
      await run("perfume-lattafa-khamrah.html", async (p) => { await p.locator(".p-add").first().click(); await p.locator(".p-order").first().click(); await p.waitForTimeout(200); });
      await run("contact.html", async (p) => { await p.click("#request-form button[type=submit]"); await p.fill("#rq-perfume", "Aventus"); await p.fill("#rq-name", "Sam"); await p.click("#request-form button[type=submit]"); await p.waitForTimeout(300); });
      await run("faq.html", async (p) => { await p.locator("summary").first().click(); });
      await run("index.html", async (p) => { await p.click("#brands-pause"); const t = p.locator(".theme-btn"); if (await t.isVisible()) await t.click(); });
      assert.deepEqual(bad, []);
    });

    test("Safari's engine (WebKit) agrees: home, catalogue, a perfume page, contact and FAQ load under the policy with no violation", async () => {
      webkit = await launch("webkit");
      const bad = [];
      for (const file of ["index.html", "catalogue.html", "perfume-lattafa-khamrah.html", "contact.html", "faq.html"]) {
        const { page, context, errors } = await openSpied(file, {}, webkit);
        try { const s = await state(page); bad.push(...s.csp.map((x) => `${file}: ${x}`), ...errors.map((x) => `${file}: ${x}`)); } finally { await context.close(); }
      }
      assert.deepEqual(bad, []);
    });
  });

  describe("hostile text is shown as text and never runs", () => {
    const PAYLOADS = [
      `"><img src=x onerror="window.__xss='img'">`,
      `<script>window.__xss='script'</script>`,
      `<svg onload="window.__xss='svg'">`,
      `'><iframe srcdoc="<script>parent.__xss='frame'</script>"></iframe>`,
      `javascript:window.__xss='url'`,
      `</textarea></title><img src=x onerror=window.__xss='close'>`,
    ];
    const clean = async (page, what) => { const s = await state(page); assert.equal(s.xss, undefined, `${what}: ran`); assert.equal(s.injected, 0, `${what}: an element was injected`); assert.deepEqual(s.csp, [], `${what}: policy violations`); };

    test("the address bar: ?q=, ?fm=, ?g= and ?style= on the catalogue", async () => {
      for (const [i, p] of PAYLOADS.entries()) for (const key of ["q", "fm", "g", "style"]) {
        const { page, context } = await openSpied("catalogue.html", { query: `?${key}=${encodeURIComponent(p)}` });
        try { await page.waitForSelector("#grid .card, #grid .empty"); await clean(page, `?${key}= payload ${i}`); } finally { await context.close(); }
      }
    });

    test("the search box (typed): suggestions, the 'nothing matches' line, the result cards and the filter tags", async () => {
      const { page, context } = await openSpied("catalogue.html");
      try {
        for (const [i, p] of PAYLOADS.entries()) {
          await page.fill("#q", ""); await page.click("#q"); await page.keyboard.type(p, { delay: 0 }); await page.waitForTimeout(250); await page.keyboard.press("Enter"); await page.waitForTimeout(250);
          await clean(page, `search payload ${i}`);
        }
        assert.ok((await page.inputValue("#q")).length > 0, "the typed text stays in the box as text");
      } finally { await context.close(); }
    });

    test("the contact form: every field, the suggestions under the name field, and the WhatsApp message (the text is carried as text, encoded)", async () => {
      for (const [i, p] of PAYLOADS.entries()) {
        const { page, context } = await openSpied("contact.html");
        try {
          await page.fill("#rq-perfume", p.slice(0, 80)); await page.fill("#rq-brand", p.slice(0, 60)); await page.fill("#rq-name", p.slice(0, 60)); await page.fill("#rq-notes", p.slice(0, 200));
          await page.waitForTimeout(250);
          await clean(page, `contact (typing) payload ${i}`);
          await page.click("#request-form button[type=submit]"); await page.waitForTimeout(300);
          await clean(page, `contact (sent) payload ${i}`);
          const urls = await page.evaluate(() => window.__wa);
          assert.equal(urls.length, 1, `payload ${i}: one WhatsApp link opened`);
          const text = new URL(urls[0]).searchParams.get("text");
          assert.ok(text.includes(p.slice(0, 60).trim()) || text.includes(p.slice(0, 40)), `payload ${i}: the text travels as typed (and encoded in the link)`);
          assert.match(urls[0], /^https:\/\/wa\.me\/\d+\?text=/);
          assert.doesNotMatch(urls[0].split("?text=")[1], /[<>" ]/, "the message part of the link is encoded (no angle brackets, quotes or spaces)");
        } finally { await context.close(); }
      }
    });

    test("the saved cart and theme in the browser's storage: forged entries are ignored, never shown, never run; quantities stay within the limit", async () => {
      const id = PRODUCTS[0];
      const real = `${id.s}|${id.v[0].m}|${id.v[0].p}|${id.v[0].r}`;
      const forged = JSON.stringify([
        { k: `<img src=x onerror="window.__xss='cart'">`, qty: 1 }, { k: "<svg onload=window.__xss='svg'>", qty: 2 }, { k: null, qty: 1e9 }, "<script>window.__xss=1</script>", 7, null,
        { k: real, qty: 1e12 }, { k: real, qty: -5 }, { k: real, qty: "3<img src=x onerror=window.__xss=1>" }, { k: real, qty: 0.5 },
        ...Array.from({ length: 500 }, (_, i) => ({ k: `forged-${i}`, qty: 1 })),
      ]);
      const { page, context } = await openSpied("catalogue.html", { storage: { "perfume-x-cart-v1": forged, "perfume-x-theme": `"><img src=x onerror=window.__xss='theme'>` } });
      try {
        await page.waitForSelector("#grid .card");
        await clean(page, "forged storage");
        await page.click("#cart-open"); await page.waitForTimeout(300);
        const lines = await page.locator("#cart-items li, #cart-items .line").count();
        assert.ok(lines <= 1, `at most the one real item is kept (found ${lines})`);
        const count = Number((await page.locator("#cart-count").textContent()).replace(/\D/g, "") || 0);
        assert.ok(count === 0 || (count > 0 && count <= 99), `a quantity above 99 is not accepted (${count})`);
        assert.ok(["light", "dark"].includes(await page.evaluate(() => document.documentElement.dataset.theme)), "a forged theme falls back to a real one");
        await clean(page, "forged storage, cart open");
      } finally { await context.close(); }
    });

    test("the WhatsApp number is still not in the page after real use (search, cart, order, contact)", async () => {
      const num = SITE.contact.whatsapp, last9 = num.slice(-9);
      const { page, context } = await openSpied("catalogue.html");
      try {
        await page.locator("#grid .card .add").first().click(); await page.click("#cart-open"); await page.waitForTimeout(300);
        let dom = await page.evaluate(() => document.documentElement.outerHTML);
        assert.ok(!dom.includes(num) && !dom.includes(last9), "the number is not in the page's markup");
        await page.goto(`${srv.base}contact.html`); await page.waitForTimeout(300);
        dom = await page.evaluate(() => document.documentElement.outerHTML);
        assert.ok(!dom.includes(num) && !dom.includes(last9), "nor on the contact page");
      } finally { await context.close(); }
    });
  });

  test("no console error or failed request in any of these runs", () => {
    const errors = opened.flatMap((o) => o.errors || []).filter((e) => !/Failed to load resource: net::ERR_FAILED|example\.com|violates the following Content Security Policy|Refused to/i.test(e) && !/stylesheet/i.test(e));
    assert.deepEqual([...new Set(errors)].slice(0, 6), []);
  });
});

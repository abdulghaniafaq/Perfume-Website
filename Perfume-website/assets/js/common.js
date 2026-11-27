/* ==========================================================================
   common.js — loaded on every page, after data/site-config.js and data/products-data.js.

   Provides the shared shell (menu, cart + drawer, WhatsApp links, scroll reveal), prepares the
   catalogue data once, and publishes a small toolkit on window.PX for the page scripts
   (catalogue.js, quiz.js, contact.js).

   window.PX
     data      S (site config) · PRODUCTS · INDEX · BY_SLUG · famCounts · BANDS · bandRange
     text      esc · money · spec · note · detail · normalize · keyOf
     markup    outline · thumbInner · priceHTML · orderOneText · WA_ICON · paintAddButton · fillSelect
     cart      cartQty · onCart · addToCart
     whatsapp  openWhatsApp · maskPhone
     layers    syncLock · layers · escapes      (so the quiz / photo viewer can join Esc + Tab handling)
     theme     get · set                        (light / dark; the header button uses the same code)
   ========================================================================== */
(() => {
  "use strict";

  const S = window.SITE;
  const PRODUCTS = window.PRODUCTS;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const PX = (window.PX = { S, PRODUCTS, $, $$ });

  const CART_KEY = "perfume-x-cart-v1";
  const MAX_QTY = 99;
  const WORDS = { 2: "twice", 3: "three times", 4: "four times", 5: "five times" };

  /* ------------------------------------------------------------------
     Text helpers
     ------------------------------------------------------------------ */
  const esc = (v) =>
    String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = new Intl.NumberFormat(S.locale, { style: "currency", currency: S.currency, maximumFractionDigits: 0 });
  const money = (n) => fmt.format(n);
  const spec = (v) => [v.m, v.p].filter(Boolean).join(" · ");
  // The source spreadsheet turned some remarks (e.g. "11/24") into timestamps like
  // "2026-11-24 00:00:00". Those aren't readable notes, so don't show them.
  const note = (r) => (!r || /^\d{4}-\d{2}-\d{2}[ T]/.test(r) ? "" : r);
  // Size · packaging, plus the remark ("No Box", "Box Damage"…) — used wherever the
  // customer commits to a specific bottle: single orders, the cart and the WhatsApp message.
  const detail = (v) => [spec(v), note(v.r)].filter(Boolean).join(" · ");
  // Search text is compared in a forgiving form: lower-case, accents removed (è → e),
  // apostrophes dropped (d’Hermes, d'Hermes and dHermes all match) and any other
  // punctuation treated as a space.
  const normalize = (s) =>
    String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’‘`´]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const waHref = (text) => `https://wa.me/${S.contact.whatsapp}?text=${encodeURIComponent(text)}`;

  /* ------------------------------------------------------------------
     Catalogue data, prepared once
     ------------------------------------------------------------------ */
  const seg = S.segments;
  const segmentOf = (house) =>
    seg.unclassified.includes(house) ? "" : seg.arabian.includes(house) ? "arabian" : seg.luxury.includes(house) ? "luxury" : "designer";

  const keyOf = (p, v) => [p.s, v.m, v.p, v.r].join("|");   // identifies one bottle (product + size/packaging)
  const INDEX = new Map();                                   // cart key → { p, v }
  const famCounts = new Map();                               // scent family → number of products
  for (const p of PRODUCTS) {
    p.seg = segmentOf(p.b);
    if (p.fm) famCounts.set(p.fm, (famCounts.get(p.fm) || 0) + 1);
    p.key = normalize(`${p.b} ${p.n}`);                      // the catalogue search matches the house and the perfume name, nothing else
    const base = normalize(`${p.b} ${p.n} ${p.i}`);
    for (const v of p.v) {
      v.hay = `${base} ${normalize(spec(v))}`;               // the wider text the request form's "already in our catalogue?" box matches
      INDEX.set(keyOf(p, v), { p, v });
    }
  }
  const BY_SLUG = new Map(PRODUCTS.map((p) => [p.s, p]));

  // Price bands (catalogue filter, quiz, request form). Mutually exclusive: lo <= price < hi,
  // so ₹1,000 sits in "₹1,000 – ₹3,000" only.
  const BANDS = [
    { v: "0-1000", lo: 0, hi: 1000, label: `Under ${money(1000)}`, quiz: `Under ${money(1000)}`, hint: "Mostly small sizes" },
    { v: "1000-3000", lo: 1000, hi: 3000, label: `${money(1000)} – ${money(3000)}`, quiz: `${money(1000)} – ${money(3000)}`, hint: "Everyday favourites" },
    { v: "3000-6000", lo: 3000, hi: 6000, label: `${money(3000)} – ${money(6000)}`, quiz: `${money(3000)} – ${money(6000)}`, hint: "Premium" },
    { v: "6000-10000", lo: 6000, hi: 10000, label: `${money(6000)} – ${money(10000)}`, quiz: `${money(6000)} – ${money(10000)}`, hint: "Luxury" },
    { v: "10000-999999", lo: 10000, hi: Infinity, label: `${money(10000)} & above`, quiz: `${money(10000)} and above`, hint: "Top-tier" },
  ];
  const bandRange = (v) => { const b = BANDS.find((x) => x.v === v); return b ? [b.lo, b.hi] : [0, Infinity]; };

  Object.assign(PX, { esc, money, spec, note, detail, normalize, keyOf, INDEX, BY_SLUG, famCounts, BANDS, bandRange });

  /* ------------------------------------------------------------------
     Shared markup helpers (product cards, quiz results and the cart all use these)
     ------------------------------------------------------------------ */
  // Gold bottle outline sized from the real volume. Linear size follows the cube root of
  // volume, so a 2 ml vial reads small beside a 100 ml bottle without vanishing.
  const outline = (ml) => {
    const MINV = 0.8, MAXV = 200, MINH = 14, MAXH = 46;
    const cb = Math.cbrt;
    const t = ml ? Math.min(1, Math.max(0, (cb(ml) - cb(MINV)) / (cb(MAXV) - cb(MINV)))) : 0.55;
    const h = Math.round(MINH + t * (MAXH - MINH));
    const w = Math.max(9, Math.round(h * 0.58));
    const sw = ml && ml < 6 ? 1.15 : 1.45;
    const capW = Math.max(4, Math.round(w * 0.44));
    const capH = Math.max(3, Math.round(h * 0.15));
    const capX = ((w - capW) / 2).toFixed(1);
    const r = Math.max(1.5, Math.round(w * 0.16));
    const sh = capH + Math.round((h - capH) * 0.24);
    return `<svg class="btl" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
      <rect x="${capX}" y="0.6" width="${capW}" height="${capH}" rx="1" fill="none" stroke="currentColor" stroke-width="${sw}"/>
      <rect x="0.8" y="${capH}" width="${(w - 1.6).toFixed(1)}" height="${(h - capH - 0.8).toFixed(1)}" rx="${r}" fill="none" stroke="currentColor" stroke-width="${sw}"/>
      ${h > 24 ? `<path d="M0.8 ${sh} H${(w - 0.8).toFixed(1)}" stroke="currentColor" stroke-width="${sw}"/>` : ""}
    </svg>`;
  };
  const thumbInner = (v) =>
    outline(v.mln) + (v.mll ? `<span class="ml${v.mll.length > 7 ? " ml-sm" : ""}">${esc(v.mll)}</span>` : "");
  const priceHTML = (v) => `${v.mp > v.pr ? `<s>${money(v.mp)}</s>` : ""}${money(v.pr)}`;
  // The message for a one-item WhatsApp order (the wa.me link itself is built on tap — see below).
  const orderOneText = (p, v) =>
    `Hi! I'd like to order:\n\n${p.b} — ${p.n}${detail(v) ? `\n${detail(v)}` : ""}\n${money(v.pr)}\n\nIs this available?`;
  const WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.7 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.6 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .2-3.2-.7a11.4 11.4 0 0 1-4.7-4.2c-.4-.6-.9-1.5-.9-2.4 0-.9.5-1.3.7-1.5.2-.2.4-.3.6-.3h.5c.2 0 .4 0 .5.4l.8 1.8c.1.2 0 .4-.1.5l-.3.4c-.1.1-.3.3-.1.5.2.4.8 1.2 1.5 1.8.9.8 1.6 1 1.9 1.2.2.1.4 0 .5-.1l.7-.8c.2-.2.3-.1.5-.1l1.7.8c.2.1.4.2.4.3.1.2.1.7 0 1Z"/></svg>';
  // The round "+" button on a card: "+" → "✓" (one in the cart) → the count.
  const paintAddButton = (btn, qty) => {
    btn.classList.toggle("in", qty > 0);
    btn.textContent = qty === 0 ? "+" : qty === 1 ? "✓" : qty;
    const who = btn.dataset.who;   // "Black Fume by Ahmed Al Maghribi": every card's button has its own spoken name
    btn.setAttribute("aria-label", qty ? `${who ? who + ": in" : "In"} cart (${qty}). Add another` : `Add ${who || "this perfume"} to cart`);
  };
  const fillSelect = (target, opts) => {
    const el = typeof target === "string" ? $(target) : target;
    el.innerHTML = opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("");
  };

  /* ---- The picture to show for a perfume at a chosen size (catalogue cards, quiz results) ----
     A mini (spray, dab or vial) that has its own picture (listed in S.miniPhotos) shows it; everything else shows the product's
     photo. `src` is "" when there is nothing to show, and the bottle outline is drawn instead. */
  const MINI_PHOTOS = new Set(S.miniPhotos || []);
  const miniKey = (p, v) => {
    if (v.g !== "Minis") return "";
    const form = /dab/i.test(v.p) ? "dab" : /spray/i.test(v.p) ? "spray" : /vial/i.test(v.p) ? "vial" : "";
    return form && MINI_PHOTOS.has(`${p.s}--${form}`) ? `${p.s}--${form}` : "";
  };
  const photoFor = (p, v) => {
    const label = `${p.b} ${p.n}`;
    if (!S.photos) return { key: "", src: "", std: "", label };
    const key = miniKey(p, v);
    const std = (S.noPhoto || []).includes(p.s) ? "" : `${S.imageDir}thumbs/${p.s}.${S.imageExt}`;
    return { key, src: key ? `${S.imageDir}minis/thumbs/${key}.jpg` : std, std, label: key ? `${label} — ${spec(v)}` : label };
  };
  // A small "Mini" tag on the picture box when the size chosen is a mini (spray, dab, vial, roller, kit) but the picture shown is the full-size
  // bottle (that mini has no picture of its own): it says at a glance that the bottle in the photo is not what arrives.
  const miniBadge = (p, v) => (v.g === "Minis" && !miniKey(p, v) ? '<span class="mini-badge" aria-hidden="true">Mini</span>' : "");
  // The <img> for a picture box ("data-std" lets a missing mini file fall back to the normal photo).
  const photoImg = (ph) => (ph.src ? `<img loading="lazy" decoding="async" src="${esc(ph.src)}" alt="${esc(ph.label)}"${ph.key && ph.std ? ` data-std="${esc(ph.std)}"` : ""}>` : "");
  // Show each picture once it has loaded; a missing mini file falls back to the normal photo, a missing photo is dropped (the outline shows).
  const watchPhotos = (imgs) => imgs.forEach((im) => {
    const done = () => im.classList.add("ok");
    const fail = () => {
      const back = im.dataset.std;
      if (back) { delete im.dataset.std; im.src = back; im.alt = im.alt.split(" — ")[0]; const th = im.closest(".thumb"); if (th) th.dataset.alt = im.alt; } else im.remove();
    };
    im.addEventListener("load", done);
    im.addEventListener("error", fail);
    if (im.complete) im.naturalWidth ? done() : fail();
  });

  Object.assign(PX, { outline, thumbInner, priceHTML, orderOneText, WA_ICON, paintAddButton, fillSelect, miniKey, photoFor, photoImg, watchPhotos, miniBadge });

  /* ------------------------------------------------------------------
     Page text that comes from the config / data
     ------------------------------------------------------------------ */
  $$("[data-brand]").forEach((el) => (el.textContent = S.brand));
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  $$("[data-updated]").forEach((el) => (el.textContent = S.pricesUpdated));

  const mult = S.guarantee.multiple;
  $$("[data-mult]").forEach((el) => (el.textContent = `${mult}×`));
  $$("[data-mult-word]").forEach((el) => (el.textContent = WORDS[mult] || `${mult} times`));

  // Guarantee page + FAQ: the accepted audit stores ("A, B, C or D") and the claim window. The pages carry the same
  // words as plain text, so they read correctly even before this runs.
  const stores = S.guarantee.auditStores;
  const storeList = stores.length > 1 ? `${stores.slice(0, -1).join(", ")} or ${stores.at(-1)}` : stores.join("");
  $$("[data-audit-stores]").forEach((el) => (el.textContent = storeList));
  $$("[data-audit-pills]").forEach((el) => (el.innerHTML = stores.map((s) => `<li>${esc(s)}</li>`).join("")));
  $$("[data-claim-days]").forEach((el) => (el.textContent = S.guarantee.claimDays));

  const minis = PRODUCTS.flatMap((p) => p.v).filter((v) => v.g === "Minis");
  const stats = {
    products: PRODUCTS.length,
    houses: new Set(PRODUCTS.map((p) => p.b)).size,
    inspired: PRODUCTS.filter((p) => p.i).length,
    vial: money(Math.min(...minis.map((v) => v.pr))),
  };
  $$("[data-stat]").forEach((el) => (el.textContent = stats[el.dataset.stat]));

  // FAQ boxes (FAQ page and "How to order"): closed to begin with; opening one closes whichever other box was open.
  $$(".faq").forEach((group) => {
    const closeOthers = (box) => $$("details[open]", group).forEach((d) => { if (d !== box) d.open = false; });
    group.addEventListener("click", (e) => {                     // a click (or Enter / Space) on a question: the other box closes in the same instant
      const q = e.target.closest("summary");
      if (q && !q.parentElement.open) closeOthers(q.parentElement);
    });
    group.addEventListener("toggle", (e) => { if (e.target.open) closeOthers(e.target); }, true);   // safety net for boxes opened any other way (toggle doesn't bubble, so listen on the way down)
  });

  // Homepage "Houses we carry": the scrolling logos can be paused (they also pause while hovered).
  const brandPause = $("#brands-pause");
  if (brandPause) {
    brandPause.addEventListener("click", () => {
      const paused = $("#brand-rows").classList.toggle("paused");
      brandPause.textContent = paused ? "Play" : "Pause";
    });
  }

  /* ------------------------------------------------------------------
     WhatsApp links. The number is never written into the page: a WhatsApp button carries only
     its message (data-wa / data-wa-open) and the wa.me address is built at the moment someone
     taps it. (It still lives in data/site-config.js — the browser has to know it to open
     WhatsApp — so this keeps it off the page and away from simple scrapers, not out of reach of
     someone who reads the scripts.)
     ------------------------------------------------------------------ */
  PX.openWhatsApp = (text) => {
    const url = waHref(text);
    const w = window.open(url, "_blank");
    if (w) { w.opener = null; return true; }
    // A popup blocker said no (some Safari and Brave settings, and in-app browsers such as Instagram's): open WhatsApp in this tab
    // instead, so the button never does nothing. The cart is saved, so coming back finds it as it was.
    window.location.assign(url);
    return false;
  };
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-wa-open], [data-wa]");
    if (!a || !S.contact.whatsapp) return;
    e.preventDefault();
    PX.openWhatsApp(a.dataset.waOpen ?? a.dataset.wa);
  });

  // e.g. "+91 98765 43210" → "+91 ••••• ••210": keep the country code and the last three digits.
  PX.maskPhone = (display) => {
    const m = String(display || "").match(/^(\+\d{1,3})([\s\S]*)$/);
    const head = m ? m[1] : "", rest = m ? m[2] : String(display || "");
    const total = (rest.match(/\d/g) || []).length;
    let i = 0;
    return head + rest.replace(/\d/g, (d) => (++i > total - 3 ? d : "•"));
  };

  // Contact page buttons — only the channels filled in data/site-config.js.
  const contactBox = $("#contact-actions");
  if (contactBox) {
    const { whatsapp, whatsappDisplay, numberDisplay, instagram, email } = S.contact;
    const shown = numberDisplay === "hidden" ? "" : PX.maskPhone(whatsappDisplay);
    const items = [];
    // Each button = an icon + a bold line + a smaller line. The text still reads "Chat on WhatsApp · <masked number>" (the dot is hidden by CSS on the second line).
    const IG_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor"/></svg>';
    if (whatsapp) items.push(`<a class="btn btn-gold" href="#" data-wa-open="${esc("Hi! I have a question about your perfumes.")}">${WA_ICON}<span class="ca-text"><span class="ca-main">Chat on WhatsApp</span>${shown ? `<span class="ca-sub"><span class="ca-sep"> · </span>${esc(shown)}</span>` : ""}</span></a>`);
    if (instagram) items.push(`<a class="btn btn-ghost btn-ig" href="https://instagram.com/${esc(instagram)}" target="_blank" rel="noopener">${IG_ICON}<span class="ca-text"><span class="ca-main">Follow us on Instagram</span><span class="ca-sub">@${esc(instagram)}</span></span></a>`);
    if (email) items.push(`<a class="btn btn-ghost" href="mailto:${esc(email)}">${esc(email)}</a>`);
    contactBox.innerHTML = items.join("");
  }
  const restock = $("#restock-link");
  if (restock) restock.dataset.waOpen = "Hi! Please add me to your list — I'd like to hear about restocks and new arrivals.";

  /* ------------------------------------------------------------------
     Header menu (phones)
     ------------------------------------------------------------------ */
  const menuBtn = $("#menu-btn");
  const nav = $("#nav");
  function setMenu(open) {
    nav.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
  }
  menuBtn.addEventListener("click", () => setMenu(!nav.classList.contains("open")));

  /* ------------------------------------------------------------------
     Light / dark theme. The first choice (saved, else the device's setting) is made by the small script in each
     page's <head>, before anything paints, so there is no flash. This wires up the header button, remembers the
     choice, keeps the browser bar colour in step, and follows the device setting until a choice has been saved.
     ------------------------------------------------------------------ */
  const THEME_KEY = "perfume-x-theme";
  const THEME_COLOR = { dark: "#0b0a09", light: "#fbf7ef" };
  const themeBtn = $("#theme-toggle");
  const systemLight = window.matchMedia("(prefers-color-scheme: light)");
  const savedTheme = () => { try { const t = localStorage.getItem(THEME_KEY); return t === "light" || t === "dark" ? t : null; } catch { return null; } };
  const currentTheme = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
  function setTheme(theme, save = false) {
    document.documentElement.dataset.theme = theme;
    $('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
    themeBtn.setAttribute("aria-label", theme === "light" ? "Switch to dark mode" : "Switch to light mode");
    if (save) { try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode: it just won't be remembered */ } }
  }
  setTheme(currentTheme());                                                       // sync the button label with what the head script chose
  themeBtn.addEventListener("click", () => setTheme(currentTheme() === "light" ? "dark" : "light", true));
  systemLight.addEventListener?.("change", (e) => { if (!savedTheme()) setTheme(e.matches ? "light" : "dark"); });
  window.addEventListener("storage", (e) => { if (e.key === THEME_KEY && (e.newValue === "light" || e.newValue === "dark")) setTheme(e.newValue); });   // another tab changed it
  PX.theme = { get: currentTheme, set: (t) => setTheme(t, true) };

  /* ------------------------------------------------------------------
     Cart + drawer (the drawer's markup is injected here so every page shares one copy)
     ------------------------------------------------------------------ */
  document.body.insertAdjacentHTML("beforeend", `
    <div class="overlay" id="overlay" hidden></div>
    <aside class="cart" id="cart" role="dialog" aria-modal="true" aria-labelledby="cart-title" aria-hidden="true">
      <header class="cart-head">
        <h2 id="cart-title">Your cart</h2>
        <button class="icon-btn" id="cart-close" type="button" aria-label="Close cart">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
      </header>
      <div class="cart-body" id="cart-items"></div>
      <footer class="cart-foot" id="cart-foot">
        <div class="cart-total"><span>Total</span><strong id="cart-total">${money(0)}</strong></div>
        <a class="btn btn-gold btn-block" id="checkout" href="#" data-wa-open="">Order on WhatsApp</a>
        <button class="text-btn cart-clear" id="cart-clear" type="button">Clear cart</button>
        <p class="cart-note">Your cart opens as a pre-filled WhatsApp message. We confirm availability, the total and delivery with you there — nothing is charged online.</p>
      </footer>
    </aside>
    <p class="sr-only" id="cart-status" role="status" aria-live="polite"></p>
    <div class="cart-bar" id="cart-bar" hidden>
      <button class="cb-main" id="cb-open" type="button"><span id="cb-label">Cart (0)</span><span aria-hidden="true">·</span><span id="cb-total">${money(0)}</span></button>
      <a class="btn btn-gold cb-order" id="cb-order" href="#" data-wa-open="" aria-label="Order on WhatsApp">Order</a>
    </div>
    <div class="toast" id="toast" hidden><span><span aria-hidden="true">✓</span> Added</span><button class="toast-btn" id="toast-view" type="button">View cart</button></div>
    ${S.contact.whatsapp ? `<a class="wa-float" id="wa-float" href="#" data-wa-open="${esc("Hi! I have a question about your perfumes.")}" aria-label="Chat with us on WhatsApp" title="Chat on WhatsApp">${WA_ICON}</a>` : ""}`);

  const cartEl = $("#cart");
  const overlay = $("#overlay");
  const cartBtn = $("#cart-open");
  const countEl = $("#cart-count");
  const status = $("#cart-status");

  // The cart is stored as [{ k, qty }]; prices are always read from the catalogue.
  let LIST = loadList();
  const listeners = [];

  function loadList() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      return Array.isArray(raw)
        ? raw.filter((x) => x && INDEX.has(x.k) && Number.isInteger(x.qty) && x.qty > 0).slice(0, S.maxCartLines)
            .map((x) => ({ k: x.k, qty: Math.min(x.qty, MAX_QTY) }))
        : [];
    } catch {
      return [];
    }
  }
  function saveList() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(LIST)); } catch { /* storage unavailable — cart still works this visit */ }
  }

  const lines = () => LIST.map((x) => ({ ...INDEX.get(x.k), k: x.k, qty: x.qty }));
  const total = (ls) => ls.reduce((t, l) => t + l.v.pr * l.qty, 0);

  function orderMessage(ls) {
    const rows = ls.map((l, i) => {
      const unit = l.qty > 1 ? `${l.qty} × ${money(l.v.pr)} = ${money(l.v.pr * l.qty)}` : money(l.v.pr);
      return `${i + 1}. ${l.p.b} — ${l.p.n}\n   ${detail(l.v) ? detail(l.v) + " — " : ""}${unit}`;
    });
    return `Hi! I'd like to order:\n\n${rows.join("\n")}\n\nTotal: ${money(total(ls))}\n\nPlease confirm availability.`;
  }

  /* "What you'll get". The catalogue shows one photo per perfume (the full-size retail bottle), so a mini or a tester in
     the cart carries a small "i" that says what will actually arrive. */
  const openNotes = new Set();                                  // cart keys whose note is open (kept when the cart redraws)
  const whatYouGet = (v, own) => {                              // own: the photo beside the item is the mini itself
    if (v.g === "Tester") return "A tester: the same fragrance supplied for sampling, in plain packaging — usually a simple carton or no box at all, and sometimes without a cap (a note beside the size, such as “No Box”, tells you what's missing). The photo shows the full-size retail bottle and its box.";
    if (v.g !== "Minis") return "";
    const small = v.m ? `${v.m.replace(/\s+/g, "")} ` : "";
    const tail = own ? "The photo shows the mini you will receive." : "It is not the full-size bottle shown in the photo.";
    if (/dab/i.test(v.p)) return `A small ${small}dab-on bottle: there is no spray, you dab the scent on. ${tail}`;
    if (/spray/i.test(v.p)) return `A small ${small}travel spray of this fragrance. ${tail}`;
    if (/vial/i.test(v.p)) return `A tiny ${small}sample vial, enough to try the scent. ${tail}`;
    if (/roller/i.test(v.p)) return `A small ${small}roller-ball bottle that you roll on. ${tail}`;
    return "A small-size pack, not the full-size bottle shown in the photo. Message us on WhatsApp if you'd like to know exactly what's inside.";
  };

  function renderCart() {
    const ls = lines();
    for (const k of [...openNotes]) if (!ls.some((l) => l.k === k)) openNotes.delete(k);
    const n = ls.reduce((t, l) => t + l.qty, 0);
    countEl.hidden = n === 0;
    countEl.textContent = n;
    cartBtn.setAttribute("aria-label", n ? `Open cart, ${n} item${n > 1 ? "s" : ""}` : "Open cart");

    $("#cart-items").innerHTML = ls.length
      ? ls.map((l, i) => {
          // the same picture the catalogue card shows for this size: a mini's own photo if it has one, otherwise the perfume's photo;
          // the bottle outline shows until it loads, or if there is none
          const ph = photoFor(l.p, l.v);
          const note = whatYouGet(l.v, !!ph.key), open = openNotes.has(l.k);
          const photo = ph.src ? `<img src="${esc(ph.src)}" alt="" decoding="async"${ph.key && ph.std ? ` data-std="${esc(ph.std)}"` : ""}>` : "";
          return `
          <div class="line" data-k="${esc(l.k)}">
            <div class="line-art">${outline(l.v.mln)}${photo}</div>
            <div>
              <div class="line-name">${esc(l.p.n)}</div>
              <div class="line-meta">${esc(l.p.b)}${detail(l.v) ? " · " + esc(detail(l.v)) : ""}${note ? `<button class="info-btn" type="button" data-info aria-expanded="${open}" aria-controls="line-info-${i}" aria-label="What you'll get: ${esc(detail(l.v))}"><span aria-hidden="true">i</span></button>` : ""}</div>
              <div class="qty">
                <button type="button" data-dec aria-label="Decrease quantity of ${esc(l.p.n)}">−</button>
                <span>${l.qty}</span>
                <button type="button" data-inc aria-label="Increase quantity of ${esc(l.p.n)}">+</button>
              </div>
            </div>
            <div class="line-right">
              <span class="line-price">${money(l.v.pr * l.qty)}</span>
              <button class="text-btn" type="button" data-remove aria-label="Remove ${esc(l.p.n)}">Remove</button>
            </div>
            ${note ? `<p class="line-info" id="line-info-${i}"${open ? "" : " hidden"}><b>What you'll get:</b> ${esc(note)}</p>` : ""}
          </div>`;
        }).join("")
      : `<p class="cart-empty">Your cart is empty.<br><a href="catalogue.html">Browse the catalogue</a></p>`;

    watchPhotos($$("#cart-items .line-art img"));                 // show a photo once it has loaded; a missing mini file falls back to the normal photo, a missing photo is dropped

    $("#cart-foot").hidden = !ls.length;
    $("#cart-total").textContent = money(total(ls));
    if (ls.length) $("#checkout").dataset.waOpen = orderMessage(ls);
    // the phone's bottom bar: "Cart (2) · ₹1,500" opens the cart, "Order" sends the order straight to WhatsApp
    $("#cart-bar").hidden = !ls.length;
    document.body.classList.toggle("has-cart-bar", ls.length > 0);
    if (ls.length) {
      $("#cb-label").textContent = `Cart (${n})`;
      $("#cb-total").textContent = money(total(ls));
      $("#cb-order").dataset.waOpen = orderMessage(ls);
    }
    listeners.forEach((fn) => fn());
  }

  function setQty(k, qty) {
    const at = LIST.findIndex((x) => x.k === k);
    if (qty <= 0) { if (at > -1) LIST.splice(at, 1); }
    else if (at > -1) LIST[at].qty = Math.min(qty, MAX_QTY);
    else LIST.push({ k, qty });
    saveList();
    renderCart();
  }

  /* ---- Phone: a short "Added · View cart" message after every add (shown by the stylesheet on phones only; the cart status line above
          tells screen readers). It stays while it is hovered or has focus. ---- */
  const toastEl = $("#toast");
  let toastTimer;
  const hideToast = () => { clearTimeout(toastTimer); toastEl.classList.remove("show"); toastTimer = setTimeout(() => { toastEl.hidden = true; }, 220); };
  function showToast() {
    clearTimeout(toastTimer);
    toastEl.hidden = false;
    toastEl.classList.remove("show");
    void toastEl.offsetWidth;                                   // restart the fade-in
    toastEl.classList.add("show");
    toastTimer = setTimeout(hideToast, 3500);
  }
  toastEl.addEventListener("focusin", () => clearTimeout(toastTimer));
  toastEl.addEventListener("focusout", () => { if (!toastEl.hidden) toastTimer = setTimeout(hideToast, 1500); });
  // WCAG 2.4.11 (focus not obscured): the message floats above the page, so when keyboard focus moves on to something else it goes away
  // instead of covering that control (the screen reader has already been told; a tap or a click never triggers this)
  document.addEventListener("focusin", (e) => { if (!toastEl.hidden && !toastEl.contains(e.target) && e.target.matches && e.target.matches(":focus-visible")) hideToast(); });
  PX.openCart = () => { if (PX.quiz && PX.quiz.close) PX.quiz.close(); openCart(); };   // (the quiz sits above the cart, so put it away first)
  $("#toast-view").addEventListener("click", () => { hideToast(); PX.openCart(); });
  $("#cb-open").addEventListener("click", () => PX.openCart());

  PX.cartQty = (k) => (LIST.find((x) => x.k === k) || {}).qty || 0;
  PX.onCart = (fn) => listeners.push(fn);   // run fn after every cart change
  PX.addToCart = (k) => {
    const cur = LIST.find((x) => x.k === k);
    if (!cur && LIST.length >= S.maxCartLines) {
      alert(`That's ${S.maxCartLines} different items — send this cart first, then start another.`);
      return false;
    }
    setQty(k, (cur ? cur.qty : 0) + 1);
    status.textContent = `${INDEX.get(k).p.n} added to cart.`;
    countEl.classList.remove("bump");
    void countEl.offsetWidth; // restart the animation
    countEl.classList.add("bump");
    showToast();
    return true;
  };

  /* "What you'll get" appears by itself while the mouse is over the i (or the i has keyboard focus), and goes again when it
     leaves. A click keeps it open; touch screens have no hover, so a tap does that. All the state lives on the line, so the
     cart can redraw (quantity changes) without losing it. */
  const paintNote = (line) => {
    const btn = $("[data-info]", line), note = $(".line-info", line);
    if (!btn || !note) return;
    const d = line.dataset;
    const open = openNotes.has(d.k) || (Boolean(d.hover || d.focus) && !d.mute);
    btn.setAttribute("aria-expanded", String(open));
    note.hidden = !open;
  };
  const infoEnter = (flag) => (e) => {
    const b = e.target.closest("[data-info]");
    if (!b || (flag === "hover" && e.pointerType !== "mouse") || (flag === "focus" && !b.matches(":focus-visible"))) return;
    const line = b.closest(".line");
    line.dataset[flag] = "1";
    delete line.dataset.mute;
    paintNote(line);
  };
  const infoLeave = (flag) => (e) => {
    const b = e.target.closest("[data-info]");
    if (!b || (flag === "hover" && e.pointerType !== "mouse") || b.contains(e.relatedTarget)) return;
    const line = b.closest(".line");
    delete line.dataset[flag];
    delete line.dataset.mute;
    paintNote(line);
  };
  $("#cart-items").addEventListener("pointerover", infoEnter("hover"));
  $("#cart-items").addEventListener("pointerout", infoLeave("hover"));
  $("#cart-items").addEventListener("focusin", infoEnter("focus"));
  $("#cart-items").addEventListener("focusout", infoLeave("focus"));

  $("#cart-items").addEventListener("click", (e) => {
    const line = e.target.closest(".line");
    if (!line) return;
    const k = line.dataset.k;
    const qty = PX.cartQty(k);
    if (e.target.closest("[data-info]")) {                       // a click keeps the note open (or closes it if it was kept open)
      if (openNotes.has(k)) {
        openNotes.delete(k);
        if (line.dataset.hover || line.dataset.focus) line.dataset.mute = "1";   // hide it now, even though the pointer is still over the icon
      } else openNotes.add(k);                                    // it was showing only because of the hover, or (on a touch screen) not at all
      paintNote(line);
      return;
    }
    if (e.target.closest("[data-inc]")) setQty(k, qty + 1);
    else if (e.target.closest("[data-dec]")) setQty(k, qty - 1);
    else if (e.target.closest("[data-remove]")) setQty(k, 0);
  });
  $("#cart-clear").addEventListener("click", () => { LIST = []; saveList(); renderCart(); });

  // Keep the cart in step if it's changed in another tab.
  window.addEventListener("storage", (e) => {
    if (e.key === CART_KEY) { LIST = loadList(); renderCart(); }
  });

  /* ------------------------------------------------------------------
     Overlay layers. The cart drawer lives here; the quiz and the photo viewer register theirs
     (catalogue page). Esc closes the top-most one; Tab stays inside it; the page behind is locked.
     ------------------------------------------------------------------ */
  const cartOpen = () => cartEl.classList.contains("open");
  PX.syncLock = () =>
    document.body.classList.toggle("locked", cartOpen() || !!$(".modal:not([hidden]), .lightbox:not([hidden]), .sheet.locks:not([hidden])"));

  function openCart() {
    hideToast();
    renderCart();
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("show"));
    cartEl.classList.add("open");
    cartEl.setAttribute("aria-hidden", "false");
    cartBtn.setAttribute("aria-expanded", "true");
    PX.syncLock();
    $("#cart-close").focus();
  }
  function closeCart() {
    overlay.classList.remove("show");
    cartEl.classList.remove("open");
    cartEl.setAttribute("aria-hidden", "true");
    cartBtn.setAttribute("aria-expanded", "false");
    setTimeout(() => { if (!cartOpen()) overlay.hidden = true; }, 300);
    PX.syncLock();
    cartBtn.focus();
  }
  cartBtn.addEventListener("click", openCart);
  $("#cart-close").addEventListener("click", closeCart);
  overlay.addEventListener("click", closeCart);

  PX.layers = [() => (cartOpen() ? cartEl : null)];   // top-most first; each returns its element when open
  PX.escapes = [() => { if (cartOpen()) { closeCart(); return true; } return false; }];

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!PX.escapes.some((fn) => fn())) setMenu(false);
      return;
    }
    if (e.key !== "Tab") return;
    const layer = PX.layers.map((fn) => fn()).find(Boolean);
    if (!layer) return;
    const f = $$("button, a[href], select, input", layer).filter((el) => !el.disabled && !el.closest("[hidden]") && el.getAttribute("aria-disabled") !== "true");
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ------------------------------------------------------------------
     Scroll reveal
     ------------------------------------------------------------------ */
  const revealEls = $$(".page-head .wrap > *, .section-head, .trust-list li, .why-card, .style-card, .guarantee-grid > *, .faq details, .cta-band, .contact-actions, .restock, .prose:not(.guide-body)");   // (a guide's body is far taller than the screen, so it could never be 12% visible: it is left out)
  revealEls.forEach((el) => el.classList.add("reveal"));
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }

  renderCart();
})();

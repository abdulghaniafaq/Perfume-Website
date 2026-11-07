/* Shared by every page: config-driven text, mobile menu, the cart + its drawer,
   contact links and scroll-reveal. Page-specific code lives in home.js / catalogue.js. */
(() => {
  "use strict";

  const S = window.SITE;
  const PRODUCTS = window.PRODUCTS;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const PX = (window.PX = {});

  const CART_KEY = "perfume-x-cart-v1";
  const MAX_QTY = 99;
  const WORDS = { 2: "twice", 3: "three times", 4: "four times", 5: "five times" };

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
  const waHref = (text) => `https://wa.me/${S.contact.whatsapp}?text=${encodeURIComponent(text)}`;

  // Search text is compared in a forgiving form: lower-case, accents removed (è → e),
  // apostrophes dropped (d’Hermes, d'Hermes and dHermes all match) and any other
  // punctuation treated as a space.
  const normalize = (s) =>
    String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’‘`´]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

  /* ------------------------------------------------------------------
     Catalogue data, prepared once
     ------------------------------------------------------------------ */
  const seg = S.segments;
  const segmentOf = (house) =>
    seg.unclassified.includes(house) ? "" : seg.arabian.includes(house) ? "arabian" : seg.luxury.includes(house) ? "luxury" : "designer";

  const keyOf = (p, v) => [p.s, v.m, v.p, v.r].join("|");
  const INDEX = new Map(); // cart key -> { p, v }
  for (const p of PRODUCTS) {
    p.seg = segmentOf(p.b);
    const base = normalize(`${p.b} ${p.n} ${p.i}`);
    for (const v of p.v) {
      v.hay = `${base} ${normalize(spec(v))}`; // what a search is matched against, per variant
      INDEX.set(keyOf(p, v), { p, v });
    }
  }
  const BY_SLUG = new Map(PRODUCTS.map((p) => [p.s, p]));

  Object.assign(PX, { S, PRODUCTS, $, $$, esc, money, spec, note, detail, waHref, normalize, keyOf, INDEX, BY_SLUG });

  /* ------------------------------------------------------------------
     Text driven by config / data
     ------------------------------------------------------------------ */
  $$("[data-brand]").forEach((el) => (el.textContent = S.brand));
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  $$("[data-updated]").forEach((el) => (el.textContent = S.pricesUpdated));

  const mult = S.guarantee.multiple;
  $$("[data-mult]").forEach((el) => (el.textContent = `${mult}×`));
  $$("[data-mult-word]").forEach((el) => (el.textContent = WORDS[mult] || `${mult} times`));

  const minis = PRODUCTS.flatMap((p) => p.v).filter((v) => v.g === "Minis");
  const stats = {
    products: PRODUCTS.length,
    houses: new Set(PRODUCTS.map((p) => p.b)).size,
    inspired: PRODUCTS.filter((p) => p.i).length,
    vial: money(Math.min(...minis.map((v) => v.pr))),
  };
  $$("[data-stat]").forEach((el) => (el.textContent = stats[el.dataset.stat]));
  $$("[data-seg-count]").forEach((el) => (el.textContent = PRODUCTS.filter((p) => p.seg === el.dataset.segCount).length));

  // Any link with data-wa opens WhatsApp with that message pre-filled.
  if (S.contact.whatsapp) {
    $$("[data-wa]").forEach((a) => {
      a.href = waHref(a.dataset.wa);
      a.target = "_blank";
      a.rel = "noopener";
    });
  }
  $$("[data-wa-display]").forEach((el) => (el.textContent = S.contact.whatsappDisplay || ""));

  // Contact page buttons — only the channels filled in site-config.js.
  const contactBox = $("#contact-actions");
  if (contactBox) {
    const { whatsapp, whatsappDisplay, instagram, email } = S.contact;
    const items = [];
    if (whatsapp) items.push(`<a class="btn btn-gold" href="${waHref("Hi! I have a question about your perfumes.")}" target="_blank" rel="noopener">Chat on WhatsApp${whatsappDisplay ? ` · ${esc(whatsappDisplay)}` : ""}</a>`);
    if (instagram) items.push(`<a class="btn btn-ghost" href="https://instagram.com/${esc(instagram)}" target="_blank" rel="noopener">Instagram @${esc(instagram)}</a>`);
    if (email) items.push(`<a class="btn btn-ghost" href="mailto:${esc(email)}">${esc(email)}</a>`);
    contactBox.innerHTML = items.join("");
  }
  const restock = $("#restock-link");
  if (restock && S.contact.whatsapp) restock.href = waHref("Hi! Please add me to your list — I'd like to hear about restocks and new arrivals.");

  /* ------------------------------------------------------------------
     Illustration: gold bottle outline sized from the real volume. Linear size
     follows the cube root of volume, so a 2 ml vial reads small beside a
     100 ml bottle without vanishing.
     ------------------------------------------------------------------ */
  PX.outline = (ml) => {
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

  /* ------------------------------------------------------------------
     Mobile menu
     ------------------------------------------------------------------ */
  const menuBtn = $("#menu-btn");
  const nav = $("#nav");
  function setMenu(open) {
    nav.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
  }
  menuBtn.addEventListener("click", () => setMenu(!nav.classList.contains("open")));

  /* ------------------------------------------------------------------
     Cart drawer (markup injected here so every page shares one copy)
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
        <a class="btn btn-gold btn-block" id="checkout" href="#" target="_blank" rel="noopener">Order on WhatsApp</a>
        <button class="text-btn cart-clear" id="cart-clear" type="button">Clear cart</button>
        <p class="cart-note">Your cart opens as a pre-filled WhatsApp message. We confirm availability, the total and delivery with you there — nothing is charged online.</p>
      </footer>
    </aside>
    <p class="sr-only" id="cart-status" role="status" aria-live="polite"></p>`);

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

  function renderCart() {
    const ls = lines();
    const n = ls.reduce((t, l) => t + l.qty, 0);
    countEl.hidden = n === 0;
    countEl.textContent = n;
    cartBtn.setAttribute("aria-label", n ? `Open cart, ${n} item${n > 1 ? "s" : ""}` : "Open cart");

    $("#cart-items").innerHTML = ls.length
      ? ls.map((l) => `
          <div class="line" data-k="${esc(l.k)}">
            <div class="line-art">${PX.outline(l.v.mln)}</div>
            <div>
              <div class="line-name">${esc(l.p.n)}</div>
              <div class="line-meta">${esc(l.p.b)}${detail(l.v) ? " · " + esc(detail(l.v)) : ""}</div>
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
          </div>`).join("")
      : `<p class="cart-empty">Your cart is empty.<br><a href="catalogue.html">Browse the catalogue</a></p>`;

    $("#cart-foot").hidden = !ls.length;
    $("#cart-total").textContent = money(total(ls));
    if (ls.length) $("#checkout").href = waHref(orderMessage(ls));
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

  PX.cartQty = (k) => (LIST.find((x) => x.k === k) || {}).qty || 0;
  PX.onCart = (fn) => listeners.push(fn);
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
    return true;
  };

  $("#cart-items").addEventListener("click", (e) => {
    const line = e.target.closest(".line");
    if (!line) return;
    const k = line.dataset.k;
    const qty = PX.cartQty(k);
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
     Layers: the drawer here; the quiz and photo viewer register theirs on
     the catalogue page. Esc closes the top-most one; Tab stays inside it.
     ------------------------------------------------------------------ */
  const cartOpen = () => cartEl.classList.contains("open");
  PX.syncLock = () =>
    document.body.classList.toggle("locked", cartOpen() || !!$(".modal:not([hidden]), .lightbox:not([hidden])"));

  PX.openCart = () => {
    renderCart();
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("show"));
    cartEl.classList.add("open");
    cartEl.setAttribute("aria-hidden", "false");
    cartBtn.setAttribute("aria-expanded", "true");
    PX.syncLock();
    $("#cart-close").focus();
  };
  PX.closeCart = (restoreFocus = true) => {
    overlay.classList.remove("show");
    cartEl.classList.remove("open");
    cartEl.setAttribute("aria-hidden", "true");
    cartBtn.setAttribute("aria-expanded", "false");
    setTimeout(() => { if (!cartOpen()) overlay.hidden = true; }, 300);
    PX.syncLock();
    if (restoreFocus) cartBtn.focus();
  };
  cartBtn.addEventListener("click", PX.openCart);
  $("#cart-close").addEventListener("click", () => PX.closeCart());
  overlay.addEventListener("click", () => PX.closeCart());

  PX.layers = [() => (cartOpen() ? cartEl : null)];
  PX.escapes = [() => { if (cartOpen()) { PX.closeCart(); return true; } return false; }];

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!PX.escapes.some((fn) => fn())) setMenu(false);
      return;
    }
    if (e.key !== "Tab") return;
    const layer = PX.layers.map((fn) => fn()).find(Boolean);
    if (!layer) return;
    const f = $$("button, a[href]", layer).filter((el) => !el.disabled && !el.closest("[hidden]") && el.getAttribute("aria-disabled") !== "true");
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ------------------------------------------------------------------
     Scroll reveal
     ------------------------------------------------------------------ */
  const revealEls = $$(".page-head .wrap > *, .section-head, .trust-list li, .why-card, .style-card, .guarantee-grid > *, .faq details, .cta-band, .contact-actions, .restock, .prose");
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

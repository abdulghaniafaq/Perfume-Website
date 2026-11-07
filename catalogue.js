/* Catalogue page: filters, search, pagination, add-to-cart, the "Find my scent"
   quiz and the photo viewer. Cart, drawer and shared helpers come from common.js. */
(() => {
  "use strict";

  const { S, PRODUCTS, $, $$, esc, money, spec, note, detail, waHref, normalize, keyOf, BY_SLUG, outline } = window.PX;

  const PAGE_SIZE = 48;
  const NONE = "__none__";
  const ANY = "__any__";

  // Price bands are mutually exclusive — lo <= price < hi — so a ₹1,000 item belongs to
  // "₹1,000 – ₹3,000" only, never also to "Under ₹1,000". Used by the filter AND the quiz.
  const BANDS = [
    { v: "0-1000", lo: 0, hi: 1000, label: `Under ${money(1000)}`, quiz: `Under ${money(1000)}` },
    { v: "1000-3000", lo: 1000, hi: 3000, label: `${money(1000)} – ${money(3000)}`, quiz: `${money(1000)} – ${money(3000)}` },
    { v: "3000-6000", lo: 3000, hi: 6000, label: `${money(3000)} – ${money(6000)}`, quiz: `${money(3000)} – ${money(6000)}` },
    { v: "6000-999999", lo: 6000, hi: Infinity, label: `${money(6000)} & above`, quiz: `${money(6000)} and above` },
  ];
  const bandRange = (v) => { const b = BANDS.find((x) => x.v === v); return b ? [b.lo, b.hi] : [0, Infinity]; };

  /* ------------------------------------------------------------------
     Facts derived from the data
     ------------------------------------------------------------------ */
  const houses = [...new Set(PRODUCTS.map((p) => p.b))].sort((a, b) => a.localeCompare(b));
  const inspCount = new Map();
  PRODUCTS.forEach((p) => p.ib.forEach((h) => inspCount.set(h, (inspCount.get(h) || 0) + 1)));
  const inspHouses = [...inspCount.keys()].sort((a, b) => a.localeCompare(b));
  const inspiredTotal = PRODUCTS.filter((p) => p.i).length;
  const count = (pred) => PRODUCTS.filter(pred).length;

  const thumbInner = (v) =>
    outline(v.mln) + (v.mll ? `<span class="ml${v.mll.length > 7 ? " ml-sm" : ""}">${esc(v.mll)}</span>` : "");

  /* ------------------------------------------------------------------
     Filter controls
     ------------------------------------------------------------------ */
  const fill = (sel, opts) =>
    ($(sel).innerHTML = opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join(""));

  const famCounts = new Map();
  PRODUCTS.forEach((p) => p.fm && famCounts.set(p.fm, (famCounts.get(p.fm) || 0) + 1));

  fill("#brand", [["", "All houses"], ...houses.map((h) => [h, h])]);
  fill("#insp", [["", "≈ Inspired by…"], [ANY, `Any inspiration (${inspiredTotal})`], ...inspHouses.map((h) => [h, `${h} (${inspCount.get(h)})`])]);
  fill("#gender", [
    ["", "Anyone"],
    ...["Men", "Women", "Unisex"].map((g) => [g, `${g} (${count((p) => p.gd === g)})`]),
    [NONE, `Not yet tagged (${count((p) => !p.gd)})`],
  ]);
  fill("#family", [
    ["", "Any scent"],
    ...[...famCounts.keys()].sort((a, b) => famCounts.get(b) - famCounts.get(a)).map((k) => [k, `${k} (${famCounts.get(k)})`]),
    [NONE, `Not yet tagged (${count((p) => !p.fm)})`],
  ]);
  fill("#price", [["", "Any price"], ...BANDS.map((b) => [b.v, b.label])]);

  const state = { q: "", seg: "all", g: "all", insp: "", brand: "", price: "", gd: "", fm: "", sort: "az", page: 1 };
  const DEFAULTS = { ...state };

  function syncControls() {
    $("#q").value = state.q;
    $("#brand").value = state.brand;
    $("#insp").value = state.insp;
    $("#gender").value = state.gd;
    $("#family").value = state.fm;
    $("#price").value = state.price;
    $("#sort").value = state.sort;
    $$("#segChips .chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.seg === state.seg)));
    $$("#pkgChips .chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.g === state.g)));
  }

  /* ------------------------------------------------------------------
     Catalogue
     ------------------------------------------------------------------ */
  const grid = $("#grid");
  const pager = $("#pager");
  let VIEW = new Map(); // slug -> variants currently shown on that card

  function filtered() {
    // Every word typed must appear (in any order) in the product's name/house/"inspired by"
    // text plus the size/packaging of a variant that is actually being shown.
    const tokens = normalize(state.q).split(" ").filter(Boolean);
    const [lo, hi] = bandRange(state.price);
    const out = [];
    for (const p of PRODUCTS) {
      if (state.seg !== "all" && p.seg !== state.seg) continue;
      if (state.brand && p.b !== state.brand) continue;
      if (state.gd === NONE ? p.gd : state.gd && p.gd !== state.gd) continue;
      if (state.fm === NONE ? p.fm : state.fm && p.fm !== state.fm) continue;
      if (state.insp === ANY ? !p.i : state.insp && !p.ib.includes(state.insp)) continue;

      const vs = p.v.filter((v) =>
        (state.g === "all" || v.g === state.g) && v.pr >= lo && v.pr < hi && tokens.every((t) => v.hay.includes(t)));
      if (!vs.length) continue;
      const sorted = state.sort === "lo" ? [...vs].sort((a, b) => a.pr - b.pr) : state.sort === "hi" ? [...vs].sort((a, b) => b.pr - a.pr) : vs;
      out.push({ p, vs: sorted, lo: Math.min(...vs.map((v) => v.pr)), hi: Math.max(...vs.map((v) => v.pr)) });
    }
    if (state.sort === "lo") out.sort((a, b) => a.lo - b.lo);
    else if (state.sort === "hi") out.sort((a, b) => b.hi - a.hi);
    return out;
  }

  const orderOneHref = (p, v) =>
    waHref(`Hi! I'd like to order:\n\n${p.b} — ${p.n}${detail(v) ? `\n${detail(v)}` : ""}\n${money(v.pr)}\n\nIs this available?`);

  const priceHTML = (v) => `${v.mp > v.pr ? `<s>${money(v.mp)}</s>` : ""}${money(v.pr)}`;
  const saveTag = (v) => {
    const off = v.mp > v.pr ? Math.round((1 - v.pr / v.mp) * 100) : 0;
    return off >= 5 ? `<span class="tag save">Save ${off}%</span>` : "";
  };

  function cardHTML(p, vs) {
    const v = vs[0];
    const echo = p.i
      ? `<div class="echo-line"><span class="echo-badge">Inspired by</span><span class="echo-text">${esc(p.i)}</span></div>`
      : "";
    const opts = vs.length > 1
      ? `<div class="meta"><div class="variants" role="group" aria-label="Choose size and packaging">${vs
          .map((x, i) => {
            // Two variants can share size + packaging and differ only by remark ("No Box").
            const twin = vs.some((y) => y !== x && y.m === x.m && y.p === x.p && note(x.r) !== note(y.r));
            return `<button type="button" class="vchip${i === 0 ? " on" : ""}" data-i="${i}">${esc(spec(x) + (twin && note(x.r) ? ` (${note(x.r)})` : ""))}</button>`;
          })
          .join("")}</div><span class="save-slot">${saveTag(v)}</span></div>`
      : `<div class="meta"><span class="tag pkg">${esc(spec(v))}</span><span class="save-slot">${saveTag(v)}</span></div>`;
    const alt = `${p.b} ${p.n}`;
    const img = S.photos
      ? `<img loading="lazy" decoding="async" src="${esc(S.imageDir + p.s + "." + S.imageExt)}" alt="${esc(alt)}">`
      : "";
    return `
      <article class="card" data-slug="${esc(p.s)}" data-sel="0">
        <div class="head">
          <div class="thumb" data-alt="${esc(alt)}">${thumbInner(v)}${img}</div>
          <div class="head-text"><p class="house">${esc(p.b)}</p><h2 class="name">${esc(p.n)}</h2></div>
        </div>
        ${echo}${opts}
        <p class="note">${esc(note(v.r))}</p>
        <div class="foot">
          <span class="price">${priceHTML(v)}</span>
          <span class="acts">
            <button class="add" type="button" aria-label="Add to cart">+</button>
            <a class="order" href="${orderOneHref(p, v)}" target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.7 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.6 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .2-3.2-.7a11.4 11.4 0 0 1-4.7-4.2c-.4-.6-.9-1.5-.9-2.4 0-.9.5-1.3.7-1.5.2-.2.4-.3.6-.3h.5c.2 0 .4 0 .5.4l.8 1.8c.1.2 0 .4-.1.5l-.3.4c-.1.1-.3.3-.1.5.2.4.8 1.2 1.5 1.8.9.8 1.6 1 1.9 1.2.2.1.4 0 .5-.1l.7-.8c.2-.2.3-.1.5-.1l1.7.8c.2.1.4.2.4.3.1.2.1.7 0 1Z"/></svg>Order</a>
          </span>
        </div>
      </article>`;
  }

  function selectVariant(cardEl, i) {
    const vs = VIEW.get(cardEl.dataset.slug);
    const p = BY_SLUG.get(cardEl.dataset.slug);
    if (!vs || !vs[i]) return;
    const v = vs[i];
    cardEl.dataset.sel = i;
    $$(".vchip", cardEl).forEach((c, j) => c.classList.toggle("on", j === i));
    $(".price", cardEl).innerHTML = priceHTML(v);
    $(".save-slot", cardEl).innerHTML = saveTag(v);
    $(".note", cardEl).textContent = note(v.r);
    $(".order", cardEl).href = orderOneHref(p, v);
    const th = $(".thumb", cardEl);
    const img = $("img", th);
    th.innerHTML = thumbInner(v);
    if (img) th.appendChild(img);
    syncAddButtons();
  }

  function syncAddButtons() {
    $$(".card", grid).forEach((c) => {
      const vs = VIEW.get(c.dataset.slug);
      if (!vs) return;
      const q = window.PX.cartQty(keyOf(BY_SLUG.get(c.dataset.slug), vs[+c.dataset.sel || 0]));
      const btn = $(".add", c);
      btn.classList.toggle("in", q > 0);
      btn.textContent = q === 0 ? "+" : q === 1 ? "✓" : q;
      btn.setAttribute("aria-label", q ? `In cart (${q}). Add another` : "Add to cart");
    });
  }
  window.PX.onCart(syncAddButtons);

  function renderShop() {
    const all = filtered();
    const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    const from = (state.page - 1) * PAGE_SIZE;
    const page = all.slice(from, from + PAGE_SIZE);

    $("#count").textContent = !all.length
      ? `0 of ${PRODUCTS.length}`
      : all.length > PAGE_SIZE
        ? `${from + 1}–${from + page.length} of ${all.length}`
        : all.length === PRODUCTS.length ? `${all.length} fragrances` : `${all.length} of ${PRODUCTS.length}`;
    $("#reset").hidden = JSON.stringify(state) === JSON.stringify({ ...DEFAULTS, page: state.page });

    VIEW = new Map(page.map((o) => [o.p.s, o.vs]));
    grid.innerHTML = page.length
      ? page.map((o) => cardHTML(o.p, o.vs)).join("")
      : `<div class="empty"><h2>Nothing matches that</h2><p>Try a different spelling, or clear a filter to widen the search. Or <a href="contact.html">ask us</a> — we may be able to find it.</p></div>`;

    if (S.photos) {
      $$(".thumb img", grid).forEach((im) => {
        if (im.complete) { im.naturalWidth ? im.classList.add("ok") : im.remove(); return; }
        im.addEventListener("load", () => im.classList.add("ok"), { once: true });
        im.addEventListener("error", () => im.remove(), { once: true });
      });
    }
    drawPager(pages);
    syncAddButtons();
  }

  function pageWindow(cur, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const keep = new Set([1, total, cur, cur - 1, cur + 1]);
    if (cur <= 3) [2, 3, 4].forEach((n) => keep.add(n));
    if (cur >= total - 2) [total - 1, total - 2, total - 3].forEach((n) => keep.add(n));
    const ns = [...keep].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
    return ns.flatMap((n, i) => (i && n - ns[i - 1] > 1 ? ["gap", n] : [n]));
  }

  function drawPager(pages) {
    if (pages <= 1) { pager.innerHTML = ""; return; }
    const cur = state.page;
    const num = (n) => `<button type="button" class="pg${n === cur ? " on" : ""}" data-p="${n}"${n === cur ? ' aria-current="page"' : ""}>${n}</button>`;
    pager.innerHTML =
      `<button type="button" class="pg nav" data-p="${cur - 1}"${cur === 1 ? " disabled" : ""}>‹ Prev</button>` +
      pageWindow(cur, pages).map((n) => (n === "gap" ? '<span class="pg-gap">…</span>' : num(n))).join("") +
      `<button type="button" class="pg nav" data-p="${cur + 1}"${cur === pages ? " disabled" : ""}>Next ›</button>`;
  }

  const refresh = () => { state.page = 1; renderShop(); };

  pager.addEventListener("click", (e) => {
    const b = e.target.closest(".pg");
    if (!b || b.disabled) return;
    state.page = +b.dataset.p;
    renderShop();
    $(".controls").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // Typing is debounced. Any other control first "commits" what is in the search box, so a
  // quick click right after typing can't overwrite the box with stale text and lose the search.
  const searchBox = $("#q");
  let searchTimer;
  const commitSearch = () => { clearTimeout(searchTimer); state.q = searchBox.value; };
  const cancelSearch = () => clearTimeout(searchTimer);
  searchBox.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.q = searchBox.value; refresh(); }, 110);
  });
  $("#segChips").addEventListener("click", (e) => {
    const c = e.target.closest("[data-seg]");
    if (!c) return;
    commitSearch();
    state.seg = c.dataset.seg;
    syncControls(); refresh();
  });
  $("#pkgChips").addEventListener("click", (e) => {
    const c = e.target.closest("[data-g]");
    if (!c) return;
    commitSearch();
    state.g = c.dataset.g;
    syncControls(); refresh();
  });
  [["#brand", "brand"], ["#insp", "insp"], ["#gender", "gd"], ["#family", "fm"], ["#price", "price"], ["#sort", "sort"]].forEach(
    ([sel, key]) => $(sel).addEventListener("change", (e) => { commitSearch(); state[key] = e.target.value; refresh(); })
  );
  $("#reset").addEventListener("click", () => { cancelSearch(); Object.assign(state, DEFAULTS); syncControls(); renderShop(); });

  grid.addEventListener("click", (e) => {
    const chip = e.target.closest(".vchip");
    if (chip) return selectVariant(chip.closest(".card"), +chip.dataset.i);

    const add = e.target.closest(".add");
    if (add) {
      const c = add.closest(".card");
      const p = BY_SLUG.get(c.dataset.slug);
      window.PX.addToCart(keyOf(p, VIEW.get(p.s)[+c.dataset.sel || 0]));
      return;
    }

    const th = e.target.closest(".thumb");
    const img = th && $("img.ok", th);
    if (img) openLightbox(img.src, th.dataset.alt);
  });

  /* ------------------------------------------------------------------
     Photo viewer + quiz (modal layers)
     ------------------------------------------------------------------ */
  const quizEl = $("#quiz");
  const lightbox = $("#lightbox");
  let opener = null;

  function openLightbox(src, caption) {
    opener = document.activeElement;
    $("img", lightbox).src = src;
    $("figcaption", lightbox).textContent = caption;
    lightbox.hidden = false;
    window.PX.syncLock();
  }
  const closeLightbox = () => { lightbox.hidden = true; window.PX.syncLock(); opener?.focus?.(); };
  lightbox.addEventListener("click", closeLightbox);

  const topInspired = [...inspCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(([h]) => h);
  const QUESTIONS = [
    {
      key: "price", q: "What's your budget?", sub: "Per bottle, so we only show what fits.",
      opts: BANDS.map((b) => [b.v, b.quiz]),
    },
    {
      key: "insp", q: "Any designer scent you already love?", sub: "We'll show fragrances inspired by it. Skip if you're exploring.",
      opts: [...topInspired.map((h) => [h, h]), ["", "Not sure — surprise me"]],
    },
    {
      key: "g", q: "Full bottle, or try it first?", sub: "Vials and minis are a low-risk way to test a scent.",
      opts: [["Retail", "Full bottle"], ["Minis", "Try a small size first"], ["all", "Either is fine"]],
    },
  ];
  let qStep = 0;
  const qAns = { price: "", insp: "", g: "all" };

  function quizMatches() {
    const [lo, hi] = bandRange(qAns.price);
    return count((p) => (!qAns.insp || p.ib.includes(qAns.insp)) &&
      p.v.some((v) => (qAns.g === "all" || v.g === qAns.g) && v.pr >= lo && v.pr < hi));
  }

  function renderQuiz() {
    $("#quiz-steps").innerHTML = QUESTIONS.map((_, i) => `<span class="${i <= qStep ? "on" : ""}"></span>`).join("");
    const body = $("#quiz-body");
    if (qStep < QUESTIONS.length) {
      const Q = QUESTIONS[qStep];
      body.innerHTML = `
        <h2 class="quiz-q">${esc(Q.q)}</h2>
        <p class="quiz-sub">${esc(Q.sub)}</p>
        <div class="quiz-opts">${Q.opts.map(([v, t]) => `<button type="button" class="quiz-opt" data-v="${esc(v)}">${esc(t)}</button>`).join("")}</div>
        ${qStep > 0 ? '<button type="button" class="text-btn quiz-back">‹ Back</button>' : ""}`;
    } else {
      const n = quizMatches();
      body.innerHTML = `
        <h2 class="quiz-q">Your matches</h2>
        <p class="quiz-res-n">${n}</p>
        <p class="quiz-sub">${n === 1 ? "fragrance fits" : "fragrances fit"} what you described.</p>
        ${n ? '<button type="button" class="btn btn-gold btn-block" id="quiz-go">Show them</button>' : '<p class="quiz-sub">Nothing matched that combination — try a wider budget.</p>'}
        <button type="button" class="text-btn quiz-back">‹ Start over</button>`;
    }
    $("button", body)?.focus();
  }
  function openQuiz() {
    opener = document.activeElement;
    qStep = 0;
    Object.assign(qAns, { price: "", insp: "", g: "all" });
    quizEl.hidden = false;
    window.PX.syncLock();
    renderQuiz();
  }
  function closeQuiz() { quizEl.hidden = true; window.PX.syncLock(); opener?.focus?.(); }

  $$("[data-quiz]").forEach((b) => b.addEventListener("click", openQuiz));
  $("#quiz-close").addEventListener("click", closeQuiz);
  quizEl.addEventListener("click", (e) => { if (e.target === quizEl) closeQuiz(); });
  $("#quiz-body").addEventListener("click", (e) => {
    const opt = e.target.closest(".quiz-opt");
    if (opt) { qAns[QUESTIONS[qStep].key] = opt.dataset.v; qStep++; return renderQuiz(); }
    if (e.target.closest(".quiz-back")) {
      if (qStep >= QUESTIONS.length) { qStep = 0; Object.assign(qAns, { price: "", insp: "", g: "all" }); }
      else qStep = Math.max(0, qStep - 1);
      return renderQuiz();
    }
    if (e.target.closest("#quiz-go")) {
      cancelSearch();
      Object.assign(state, DEFAULTS, { price: qAns.price, insp: qAns.insp, g: qAns.g });
      syncControls();
      renderShop();
      closeQuiz();
      $(".controls").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  // Esc closes the photo viewer or quiz before the cart; Tab stays inside the quiz.
  window.PX.escapes.unshift(() => {
    if (!lightbox.hidden) { closeLightbox(); return true; }
    if (!quizEl.hidden) { closeQuiz(); return true; }
    return false;
  });
  window.PX.layers.unshift(() => (quizEl.hidden ? null : quizEl));

  /* ------------------------------------------------------------------
     Links from other pages:  catalogue.html?style=arabian  /  ?quiz=1
     ------------------------------------------------------------------ */
  const params = new URLSearchParams(location.search);
  const style = params.get("style");
  if (["designer", "luxury", "arabian"].includes(style)) state.seg = style;
  syncControls();
  renderShop();
  if (params.has("quiz")) openQuiz();
  if ([...params.keys()].length) {
    try { history.replaceState(null, "", location.pathname); } catch { /* not critical */ }
  }
})();

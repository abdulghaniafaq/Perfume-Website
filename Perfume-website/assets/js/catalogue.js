/* Catalogue page: filters, search, pagination, product cards, add-to-cart and the photo viewer.
   The "Find my scent" quiz is in quiz.js; the cart, drawer and shared helpers are in common.js. */
(() => {
  "use strict";

  const PX = window.PX;
  const { S, PRODUCTS, $, $$, esc, spec, note, normalize, keyOf, BY_SLUG, BANDS, bandRange, famCounts,
          thumbInner, priceHTML, orderOneText, WA_ICON, paintAddButton, fillSelect, miniKey, photoFor, photoImg, watchPhotos, miniBadge } = PX;

  // 48 cards a page on a computer or tablet, 24 on a phone (a shorter scroll). "Phone" is the same width the layout uses for its phone version.
  const phoneView = matchMedia("(max-width: 760px)");
  const pageSize = () => (phoneView.matches ? 24 : 48);
  const NONE = "__none__";

  /* ------------------------------------------------------------------
     Facts derived from the data
     ------------------------------------------------------------------ */
  const houses = [...new Set(PRODUCTS.map((p) => p.b))].sort((a, b) => a.localeCompare(b));

  /* ------------------------------------------------------------------
     Filter controls
     ------------------------------------------------------------------ */
  // The five filters that live in the "Filters" panel (the style tabs, the search box and the sort sit outside it).
  // House is a dropdown (89 houses); the rest are tap-to-choose buttons, tap again to clear. The number beside each
  // option (and which options are greyed out) follows the current selection — see refreshFacets() below.
  // `off` is the value that means "no filter" (the state's default).
  const FACETS = [
    { key: "brand", el: "#brand", title: "House", off: "", select: true, options: [["", "All houses"], ...houses.map((h) => [h, h])] },
    { key: "gd", el: "#gender", title: "For", off: "", options: [["Men", "Men"], ["Women", "Women"], ["Unisex", "Unisex"], ...(PRODUCTS.some((p) => !p.gd) ? [[NONE, "Not yet tagged"]] : [])] },   // (the "Not yet tagged" choice is offered only while some perfume really lacks the tag)
    { key: "fm", el: "#family", title: "Scent", off: "", options: [...[...famCounts.keys()].sort((x, y) => famCounts.get(y) - famCounts.get(x)).map((k) => [k, k]), ...(PRODUCTS.some((p) => !p.fm) ? [[NONE, "Not yet tagged"]] : [])] },
    { key: "price", el: "#price", title: "Price", off: "", options: BANDS.map((x) => [x.v, x.label]) },
    { key: "g", el: "#size", title: "Size", off: "all", options: [["Retail", "Retail"], ["Tester", "Testers"], ["Minis", "Minis & vials"], ["Sets", "Sets"]] },
  ];
  const optionText = (f, v) => (f.options.find((o) => o[0] === v) || [, v])[1];
  const chipHTML = (v, label) => `<button type="button" class="pn-chip" data-v="${esc(v)}" aria-pressed="false"><span class="pn-l">${esc(label)}</span> <small></small></button>`;
  for (const f of FACETS) {
    if (f.select) fillSelect(f.el, f.options);
    else $(f.el).innerHTML = f.options.map(([v, t]) => chipHTML(v, t)).join("");
  }

  // sort: "lo" (price, low to high — the default), "hi" (high to low) or "az" (perfume name A to Z)
  const state = { q: "", seg: "all", g: "all", brand: "", price: "", gd: "", fm: "", sort: "lo", page: 1 };
  const DEFAULTS = { ...state };

  // Make every control show what `state` says. (The search box is separate: it is only rewritten when the
  // state changes it, so a half-typed word is never overwritten.)
  const searchBox = $("#q");
  function paintControls() {
    $("#brand").value = state.brand;
    $("#sort").value = state.sort;
    $$("#segChips button").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.seg === state.seg)));
    for (const f of FACETS) {
      if (!f.select) $$(".pn-chip", $(f.el)).forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.v === state[f.key])));
    }
    const on = FACETS.filter((f) => state[f.key] !== f.off);
    $("#ftags").innerHTML = on.map((f) => {
      const t = `${f.title}: ${optionText(f, state[f.key])}`;
      return `<span class="ftag">${esc(t)}<button type="button" data-clear="${f.key}" aria-label="Remove ${esc(t)}">×</button></span>`;
    }).join("");
    const badge = $("#filters-badge");
    badge.hidden = !on.length;
    badge.textContent = on.length;
    $("#filters-open").classList.toggle("on", on.length > 0);
    $("#filters-open").setAttribute("aria-label", on.length ? `Filters, ${on.length} applied` : "Filters");
    $("#q-clear").hidden = !searchBox.value;
  }
  function syncControls() {
    searchBox.value = state.q;
    paintControls();
    closeSuggest();
  }

  /* ------------------------------------------------------------------
     Catalogue
     ------------------------------------------------------------------ */
  const grid = $("#grid");
  const pager = $("#pager");
  let VIEW = new Map(); // slug -> variants currently shown on that card

  // Which products (and which of their variants) fit a set of filters, in catalogue order. The search looks at the house and
  // the perfume NAME (not the "inspired by" text or the size): every word typed must appear in them, in any order.
  // Size and the rest have their own filters.
  function matches(f = state) {
    const tokens = normalize(f.q).split(" ").filter(Boolean);
    const [lo, hi] = bandRange(f.price);
    const out = [];
    for (const p of PRODUCTS) {
      if (f.seg !== "all" && p.seg !== f.seg) continue;
      if (f.brand && p.b !== f.brand) continue;
      if (f.gd === NONE ? p.gd : f.gd && p.gd !== f.gd) continue;
      if (f.fm === NONE ? p.fm : f.fm && p.fm !== f.fm) continue;
      if (!tokens.every((t) => p.key.includes(t))) continue;
      const vs = p.v.filter((v) => (f.g === "all" || v.g === f.g) && v.pr >= lo && v.pr < hi);
      if (vs.length) out.push({ p, vs });
    }
    return out;
  }

  // …in the order the visitor chose: by price, lowest first ("lo") or highest first ("hi"), with products of the same price in catalogue
  // order; or by perfume name, A to Z ("az": digits first, then letters, ignoring capitals, accents and punctuation; the same name from two
  // houses goes house A to Z). The sizes on each card go cheapest first, except when the visitor chose "high to low".
  const sameOrder = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  function filtered() {
    const up = state.sort !== "hi";
    const out = matches().map(({ p, vs }, order) => ({
      p, order,
      vs: [...vs].sort((a, b) => (up ? a.pr - b.pr : b.pr - a.pr)),
      lo: Math.min(...vs.map((v) => v.pr)),
      hi: Math.max(...vs.map((v) => v.pr)),
    }));
    if (state.sort === "az") return out.sort((a, b) => sameOrder(normalize(a.p.n), normalize(b.p.n)) || sameOrder(normalize(a.p.b), normalize(b.p.b)) || a.order - b.order);
    return out.sort((a, b) => (up ? a.lo - b.lo : b.hi - a.hi));
  }

  /* ---- Live counts: each option in the panel shows how many results it would give with the OTHER filters
          as they are now, and an option that would give none is greyed out (the current choice always stays). */
  let facetKey = "";
  function refreshFacets() {
    const key = [state.q, state.seg, state.g, state.brand, state.price, state.gd, state.fm].join("\u0001");
    if (key === facetKey) return;          // only the sort or the page changed — the counts are the same
    facetKey = key;
    for (const f of FACETS) {
      const k = f.key;
      const paint = (el, base, value) => {
        const n = matches({ ...state, [k]: value }).length;
        const off = n === 0 && value !== state[k];
        if (el.tagName === "OPTION") el.textContent = `${base} (${n})`;
        else el.lastElementChild.textContent = n;
        el.disabled = off;
      };
      if (f.select) {
        [...$(f.el).options].forEach((opt, i) => { if (f.options[i][0] !== "") paint(opt, f.options[i][1], f.options[i][0]); });   // "All houses" keeps its plain label
      } else {
        $$(".pn-chip", $(f.el)).forEach((chip, i) => paint(chip, f.options[i][1], f.options[i][0]));
      }
    }
  }

  /* ---- When nothing matches: say which filters are in the way, and offer one-click fixes ---- */
  const FILTER_LABEL = {
    q: () => `Search “${state.q.trim()}”`,
    seg: () => $(`#segChips [data-seg="${state.seg}"]`).dataset.label,
    g: () => optionText(FACETS[4], state.g),
    brand: () => state.brand,
    gd: () => (state.gd === NONE ? "Gender not tagged" : state.gd),
    fm: () => (state.fm === NONE ? "Scent not tagged" : state.fm),
    price: () => BANDS.find((b) => b.v === state.price).label,
  };
  const activeFilters = () => Object.keys(FILTER_LABEL).filter((k) => (k === "q" ? state.q.trim() : state[k] !== DEFAULTS[k]));

  function emptyHTML() {
    const active = activeFilters();
    const fixes = active
      .map((k) => ({ k, label: FILTER_LABEL[k](), n: matches({ ...state, [k]: DEFAULTS[k] }).length }))
      .filter((f) => f.n > 0)
      .sort((a, b) => b.n - a.n);
    const buttons = fixes.map((f) => `<button type="button" class="chip" data-undo="${f.k}">Remove “${esc(f.label)}” <span>${f.n} ${f.n === 1 ? "fragrance" : "fragrances"}</span></button>`).join("");
    return `<div class="empty"><h2>Nothing matches that</h2>
      <p>${active.length > 1 ? "Those filters don't overlap." : "Try a different spelling."}${fixes.length ? " Try removing one:" : ""}</p>
      ${buttons ? `<div class="empty-fixes">${buttons}</div>` : ""}
      <p>Or <a href="contact.html">ask us</a> — we may be able to find it.</p></div>`;
  }

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
      ? `<div class="meta"><div class="variants" role="group" aria-label="Choose size and packaging for ${esc(p.n)} by ${esc(p.b)}">${vs
          .map((x, i) => {
            // Two variants can share size + packaging and differ only by remark ("No Box").
            const twin = vs.some((y) => y !== x && y.m === x.m && y.p === x.p && note(x.r) !== note(y.r));
            return `<button type="button" class="vchip${i === 0 ? " on" : ""}" data-i="${i}">${esc(spec(x) + (twin && note(x.r) ? ` (${note(x.r)})` : ""))}</button>`;
          })
          .join("")}</div><span class="save-slot">${saveTag(v)}</span></div>`
      : `<div class="meta"><span class="tag pkg">${esc(spec(v))}</span><span class="save-slot">${saveTag(v)}</span></div>`;
    // The picture follows the selected size: a mini that has its own picture shows it from the start, everything else shows the photo.
    const ph = photoFor(p, v);
    const alt = ph.label;
    const img = photoImg(ph);
    return `
      <article class="card" data-slug="${esc(p.s)}" data-sel="0">
        <div class="head">
          <div class="thumb" data-alt="${esc(alt)}">${thumbInner(v)}${img}${miniBadge(p, v)}</div>
          <div class="head-text"><p class="house">${esc(p.b)}</p><h2 class="name"><a href="perfume-${esc(p.s)}.html" aria-label="${esc(p.n)} by ${esc(p.b)}: sizes, notes and when to wear it">${esc(p.n)}</a></h2></div>
        </div>
        ${echo}${opts}
        <p class="note">${esc(note(v.r))}</p>
        <div class="card-foot">
          <span class="price">${priceHTML(v)}</span>
          <span class="acts">
            <button class="add" type="button" data-who="${esc(p.n)} by ${esc(p.b)}" aria-label="Add ${esc(p.n)} by ${esc(p.b)} to cart">+</button>
            <a class="order" href="#" data-wa-open="${esc(orderOneText(p, v))}">${WA_ICON}Order</a>
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
    $(".order", cardEl).dataset.waOpen = orderOneText(p, v);
    const th = $(".thumb", cardEl);
    const img = $("img", th);
    th.innerHTML = thumbInner(v);
    if (img) th.appendChild(img);
    th.insertAdjacentHTML("beforeend", miniBadge(p, v));
    showPhoto(cardEl, p, v);
    syncAddButtons();
  }

  /* ---- When the visitor taps another size, the card's picture follows it: a mini (spray, dab or vial) that has its own picture
          shows it, any other size shows the normal photo. (The rule itself — PX.photoFor — is shared with the quiz results.) ---- */
  function showPhoto(cardEl, p, v) {
    if (!S.photos) return;
    const th = $(".thumb", cardEl);
    const ph = photoFor(p, v), k = ph.key, want = ph.src;
    const cur = $("img", th);
    if (!want) {                                                  // this product has no normal photo: show only a mini's own picture, and nothing otherwise
      th._want = "";
      if (cur) cur.remove();
      th.dataset.alt = `${p.b} ${p.n}`;
      return;
    }
    if (cur && cur.getAttribute("src") === want) return;
    if (cur && !cur.complete) {                                   // the card's first photo is still loading: let it finish rather than cancelling it, then show the latest choice
      th._later = [p, v];
      const go = () => { const a = th._later; th._later = null; if (a) showPhoto(cardEl, a[0], a[1]); };
      cur.addEventListener("load", go, { once: true });
      cur.addEventListener("error", go, { once: true });
      return;
    }
    const label = ph.label;
    th._want = want;                                              // (if the visitor taps again before this loads, the older request is dropped)
    const pre = new Image();                                      // load the new picture first, so the old one stays until the new one is ready
    pre.onload = () => {
      if (th._want !== want) return;
      let im = $("img", th);
      if (!im) { im = document.createElement("img"); im.decoding = "async"; th.appendChild(im); }
      im.src = want; im.alt = label; th.dataset.alt = label;
      im.classList.add("ok");
    };
    pre.onerror = () => { if (th._want === want && k) { th._want = ""; showPhoto(cardEl, p, { ...v, g: "" }); } };   // a missing mini file falls back to the normal photo
    pre.src = want;
  }

  function syncAddButtons() {
    $$(".card", grid).forEach((c) => {
      const vs = VIEW.get(c.dataset.slug);
      if (!vs) return;
      paintAddButton($(".add", c), PX.cartQty(keyOf(BY_SLUG.get(c.dataset.slug), vs[+c.dataset.sel || 0])));
    });
  }
  PX.onCart(syncAddButtons);

  function renderShop() {
    const all = filtered();
    refreshFacets();
    const SIZE = pageSize();
    const pages = Math.max(1, Math.ceil(all.length / SIZE));
    if (state.page > pages) state.page = pages;
    const from = (state.page - 1) * SIZE;
    const page = all.slice(from, from + SIZE);

    $("#count").textContent = !all.length
      ? `0 of ${PRODUCTS.length}`
      : all.length > SIZE
        ? `${from + 1}–${from + page.length} of ${all.length}`
        : all.length === PRODUCTS.length ? `${all.length} fragrances` : `${all.length} of ${PRODUCTS.length}`;
    $("#reset").hidden = JSON.stringify(state) === JSON.stringify({ ...DEFAULTS, page: state.page });
    paintControls();
    const n = all.length;
    $("#pn-done").textContent = n ? `Show ${n} ${n === 1 ? "fragrance" : "fragrances"}` : "Show results";

    VIEW = new Map(page.map((o) => [o.p.s, o.vs]));
    grid.innerHTML = page.length
      ? page.map((o) => cardHTML(o.p, o.vs)).join("")
      : emptyHTML();

    if (S.photos) {
      watchPhotos($$(".thumb img", grid));
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

  // Turning a phone sideways (or resizing a window) changes the page size: stay on the cards that were showing.
  let shownSize = pageSize();
  phoneView.addEventListener("change", () => {
    const now = pageSize();
    if (now === shownSize) return;
    state.page = Math.floor(((state.page - 1) * shownSize) / now) + 1;
    shownSize = now;
    renderShop();
  });

  // "Back to top": appears once the visitor has scrolled a screen and a half down, takes them back up, and puts focus on the heading.
  const toTop = $("#to-top");
  let topQueued = false;
  addEventListener("scroll", () => {
    if (topQueued) return;
    topQueued = true;
    requestAnimationFrame(() => { topQueued = false; toTop.hidden = scrollY < innerHeight * 1.5; });
  }, { passive: true });
  toTop.addEventListener("click", () => {
    scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    $("h1").focus({ preventScroll: true });
  });

  pager.addEventListener("click", (e) => {
    const b = e.target.closest(".pg");
    if (!b || b.disabled) return;
    state.page = +b.dataset.p;
    renderShop();
    $(".controls").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  });

  // Typing is debounced. Any other control first "commits" what is in the search box, so a
  // quick click right after typing can't overwrite the box with stale text and lose the search.
  let searchTimer;
  const commitSearch = () => { clearTimeout(searchTimer); state.q = searchBox.value; };
  const cancelSearch = () => clearTimeout(searchTimer);
  searchBox.addEventListener("input", () => {
    $("#q-clear").hidden = !searchBox.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.q = searchBox.value; refresh(); }, 110);
    renderSuggest();
  });
  $("#q-clear").addEventListener("click", () => {
    cancelSearch();
    state.q = "";
    syncControls(); refresh();
    searchBox.focus();
  });

  /* ------------------------------------------------------------------
     Suggestions while typing: perfume names that match what has been typed, best matches first (names that
     start with it, then words that start with it, then anywhere in the name). They follow the other filters —
     a name those filters would hide isn't offered — and choosing one searches for that name.
     ------------------------------------------------------------------ */
  const MAX_SUGGEST = 8;
  const wrap = $(".search-wrap"), sugBox = $("#suggest"), sugList = $("#suggest-list"), sugNone = $("#suggest-none"), sugStatus = $("#suggest-status");
  let sugItems = [], sugActive = -1;
  const sugOpen = () => !sugBox.hidden;

  // What to offer for the typed text: up to two HOUSES whose name contains every typed word (best: starts with it, then a word
  // starts with it, then anywhere; the one with more fragrances first), then PERFUMES whose house + name contain every typed word
  // (best: the name starts with it, then a word of the name does, then the house starts with it, then every word starts a word,
  // then anywhere; shorter names first). Only what the other filters leave visible is offered. At most MAX_SUGGEST in all.
  const MAX_HOUSES = 2;
  function suggestionsFor(text) {
    const t = normalize(text);
    if (!t) return [];
    const tokens = t.split(" ");
    const out = houses
      .map((h) => ({ h, key: normalize(h) }))
      .filter(({ key }) => tokens.every((k) => key.includes(k)))
      .map(({ h, key }) => ({ kind: "house", text: h, r: key.startsWith(t) ? 0 : key.includes(" " + t) ? 1 : 2, n: matches({ ...state, q: h }).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => a.r - b.r || b.n - a.n || a.text.localeCompare(b.text))
      .slice(0, MAX_HOUSES);
    const rank = (p) => { const nm = normalize(p.n); return nm.startsWith(t) ? 0 : nm.includes(" " + t) ? 1 : normalize(p.b).startsWith(t) ? 2 : tokens.every((k) => p.key.startsWith(k) || p.key.includes(" " + k)) ? 3 : 4; };
    matches({ ...state, q: t })
      .map(({ p }, i) => ({ p, r: rank(p), len: normalize(p.n).length, i }))
      .sort((a, b) => a.r - b.r || a.len - b.len || a.i - b.i)
      .slice(0, MAX_SUGGEST - out.length)
      .forEach((x) => out.push({ kind: "perfume", p: x.p }));
    return out;
  }

  // The name with what was typed picked out (typing "kha" → <mark>Kha</mark>mrah). Matching is done on the
  // accent- and apostrophe-folded text, then mapped back onto the real spelling.
  function markHTML(name, tokens) {
    let folded = "";
    const at = [];                                    // folded position → position in the real name
    for (let i = 0; i < name.length; i++) {
      const c = name[i].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (/['’‘`´]/.test(c)) continue;
      for (const ch of c) { folded += ch; at.push(i); }
    }
    const marks = [];
    for (const t of tokens) {
      let from = -1;
      for (let k = folded.indexOf(t); k !== -1; k = folded.indexOf(t, k + 1)) {
        if (from === -1) from = k;
        if (k === 0 || !/[\p{L}\p{N}]/u.test(folded[k - 1])) { from = k; break; }   // prefer the start of a word
      }
      if (from !== -1) marks.push([at[from], at[from + t.length - 1] + 1]);
    }
    marks.sort((a, b) => a[0] - b[0]);
    let out = "", pos = 0;
    for (const [s, e] of marks) {
      if (s < pos) continue;                          // overlapping words: the first one wins
      out += esc(name.slice(pos, s)) + "<mark>" + esc(name.slice(s, e)) + "</mark>";
      pos = e;
    }
    return out + esc(name.slice(pos));
  }

  function renderSuggest() {
    const text = searchBox.value;
    const t = normalize(text);
    if (!t) return closeSuggest();
    sugItems = suggestionsFor(text);
    sugActive = -1;
    const tokens = t.split(" ");
    sugList.innerHTML = sugItems.map((it, i) => it.kind === "house"
      ? `<li role="option" id="sg-${i}" data-i="${i}" data-kind="house" aria-selected="false"><span class="sg-name">${markHTML(it.text, tokens)}</span><span class="sg-house">House · ${it.n} fragrance${it.n === 1 ? "" : "s"}</span></li>`
      : `<li role="option" id="sg-${i}" data-i="${i}" data-kind="perfume" aria-selected="false"><span class="sg-name">${markHTML(it.p.n, tokens)}</span><span class="sg-house">${esc(it.p.b)}</span></li>`).join("");
    sugList.hidden = !sugItems.length;
    sugNone.hidden = sugItems.length > 0;
    if (!sugItems.length) sugNone.textContent = `Nothing matches “${text.trim().slice(0, 40)}”. Try a perfume name or a house name.`;
    sugBox.hidden = false;
    searchBox.setAttribute("aria-expanded", String(sugItems.length > 0));
    searchBox.removeAttribute("aria-activedescendant");
    sugStatus.textContent = sugItems.length
      ? `${sugItems.length} suggestion${sugItems.length === 1 ? "" : "s"}. Use the up and down arrows, then Enter.`
      : "No perfumes or houses match.";
  }

  function closeSuggest() {
    sugBox.hidden = true;
    sugItems = [];
    sugActive = -1;
    searchBox.setAttribute("aria-expanded", "false");
    searchBox.removeAttribute("aria-activedescendant");
  }

  function setActive(i) {
    sugActive = i;
    [...sugList.children].forEach((li, k) => li.setAttribute("aria-selected", String(k === i)));
    if (i < 0) { searchBox.removeAttribute("aria-activedescendant"); return; }
    const li = sugList.children[i];
    searchBox.setAttribute("aria-activedescendant", li.id);
    li.scrollIntoView({ block: "nearest" });
  }

  function pickSuggestion(i) {
    const it = sugItems[i];
    if (!it) return;
    searchBox.value = it.kind === "house" ? it.text : `${it.p.b} ${it.p.n}`;   // a house searches for the house; a perfume for its house + name (so the same name in two houses stays apart)
    $("#q-clear").hidden = false;
    closeSuggest();
    commitSearch();
    refresh();
    if (matchMedia("(pointer: coarse)").matches) searchBox.blur();   // put the keyboard away so the results show
  }

  searchBox.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!sugOpen() && normalize(searchBox.value)) renderSuggest();
      if (!sugItems.length) return;
      e.preventDefault();
      const d = e.key === "ArrowDown" ? 1 : -1;
      setActive(sugActive === -1 ? (d === 1 ? 0 : sugItems.length - 1) : (sugActive + d + sugItems.length) % sugItems.length);
    } else if (e.key === "Enter") {
      if (sugOpen() && sugActive >= 0) { e.preventDefault(); pickSuggestion(sugActive); }
      else if (sugOpen()) { closeSuggest(); commitSearch(); refresh(); }
    } else if (e.key === "Escape" && sugOpen()) {
      e.preventDefault(); e.stopPropagation(); closeSuggest();     // first Esc puts the list away; a second one clears the box
    }
  });
  sugList.addEventListener("mousedown", (e) => e.preventDefault());   // keep the cursor in the search box
  sugList.addEventListener("click", (e) => { const li = e.target.closest("li"); if (li) pickSuggestion(+li.dataset.i); });
  wrap.addEventListener("focusout", (e) => { if (!sugBox.contains(e.relatedTarget)) closeSuggest(); });
  document.addEventListener("pointerdown", (e) => { if (!wrap.contains(e.target)) closeSuggest(); });
  $("#segChips").addEventListener("click", (e) => {
    const c = e.target.closest("[data-seg]");
    if (!c) return;
    commitSearch();
    state.seg = c.dataset.seg;
    refresh();
  });
  $("#sort").addEventListener("change", (e) => { commitSearch(); state.sort = e.target.value; refresh(); });
  $("#brand").addEventListener("change", (e) => { commitSearch(); state.brand = e.target.value; refresh(); });
  // The tap-to-choose groups in the panel: tapping the chosen one again clears it.
  for (const f of FACETS.filter((x) => !x.select)) {
    $(f.el).addEventListener("click", (e) => {
      const c = e.target.closest(".pn-chip");
      if (!c || c.disabled) return;
      commitSearch();
      state[f.key] = state[f.key] === c.dataset.v ? f.off : c.dataset.v;
      refresh();
    });
  }
  // The small tags under the controls: × removes that one filter.
  $("#ftags").addEventListener("click", (e) => {
    const x = e.target.closest("[data-clear]");
    if (!x) return;
    commitSearch();
    state[x.dataset.clear] = DEFAULTS[x.dataset.clear];
    refresh();
  });
  $("#reset").addEventListener("click", () => { cancelSearch(); Object.assign(state, DEFAULTS); syncControls(); renderShop(); });
  // "Reset filters" inside the panel clears only what the panel holds (house, who, scent, price, size).
  $("#pn-clear").addEventListener("click", () => {
    commitSearch();
    for (const f of FACETS) state[f.key] = f.off;
    refresh();
  });

  /* ------------------------------------------------------------------
     The Filters panel: a small card under the button on computers, a bottom sheet on phones.
     Esc, the ×, a tap outside, or the "Show N" button closes it, and focus goes back to the Filters button.
     ------------------------------------------------------------------ */
  const sheet = $("#filters"), sheetBack = $("#filters-back"), filtersBtn = $("#filters-open");
  const phone = matchMedia("(max-width: 760px)");
  const sheetOpen = () => !sheet.hidden;
  // Computers: the card hangs under the Filters button (right edges lined up) and never runs off the bottom of the
  // window — if there is little room it scrolls inside. Phones: the stylesheet makes it a bottom sheet.
  function placeSheet() {
    if (phone.matches) { sheet.removeAttribute("style"); return; }
    const r = filtersBtn.getBoundingClientRect(), header = $(".site-header").getBoundingClientRect().bottom;
    let top = Math.max(r.bottom + 8, header + 8);
    if (innerHeight - top - 16 < 520) top = header + 8;      // not much room under the button (a short laptop screen): start just below the header instead
    sheet.style.top = `${top}px`;
    sheet.style.right = `${Math.max(8, document.documentElement.clientWidth - r.right)}px`;
    sheet.style.maxHeight = `${Math.max(240, innerHeight - top - 16)}px`;
  }
  function openSheet() {
    commitSearch();
    closeSuggest();
    sheet.hidden = sheetBack.hidden = false;
    placeSheet();
    sheet.classList.toggle("locks", phone.matches);          // on a phone the page behind is locked, like the cart
    filtersBtn.setAttribute("aria-expanded", "true");
    PX.syncLock();
    $("#filters-x").focus({ preventScroll: true });
  }
  function closeSheet(restoreFocus = true) {
    if (!sheetOpen()) return;
    sheet.hidden = sheetBack.hidden = true;
    sheet.classList.remove("locks");
    filtersBtn.setAttribute("aria-expanded", "false");
    PX.syncLock();
    if (restoreFocus) filtersBtn.focus({ preventScroll: true });
  }
  filtersBtn.addEventListener("click", () => (sheetOpen() ? closeSheet() : openSheet()));
  $("#filters-x").addEventListener("click", () => closeSheet());
  $("#pn-done").addEventListener("click", () => closeSheet());
  sheetBack.addEventListener("click", () => closeSheet());
  phone.addEventListener("change", () => closeSheet(false));   // rotating / resizing across the phone breakpoint: start fresh
  window.addEventListener("resize", () => { if (sheetOpen()) placeSheet(); });
  // The search box is narrower on a phone (the Filters button sits beside it), so it gets a shorter hint there.
  const hint = (small) => { searchBox.placeholder = small ? "Perfume or brand…" : "Search perfume or brand name…"; };
  hint(phone.matches);
  phone.addEventListener("change", (e) => hint(e.matches));
  PX.escapes.unshift(() => { if (sheetOpen()) { closeSheet(); return true; } return false; });
  PX.layers.unshift(() => (sheetOpen() ? sheet : null));

  grid.addEventListener("click", (e) => {
    const undo = e.target.closest("[data-undo]");
    if (undo) {
      commitSearch();
      state[undo.dataset.undo] = DEFAULTS[undo.dataset.undo];
      syncControls();
      return refresh();
    }

    const chip = e.target.closest(".vchip");
    if (chip) return selectVariant(chip.closest(".card"), +chip.dataset.i);

    const add = e.target.closest(".add");
    if (add) {
      const c = add.closest(".card");
      const p = BY_SLUG.get(c.dataset.slug);
      PX.addToCart(keyOf(p, VIEW.get(p.s)[+c.dataset.sel || 0]));
      return;
    }

    const th = e.target.closest(".thumb");
    if (!th) return;
    // Enlarging the photo: if the size chosen on the card is a mini with its own picture, the viewer shows that picture (so a card
    // that only sells a mini, with no sizes to tap, can still show it); otherwise it shows the photo on the card.
    const cardEl = th.closest(".card"), vs = VIEW.get(cardEl.dataset.slug), prod = BY_SLUG.get(cardEl.dataset.slug);
    const sel = vs && vs[+cardEl.dataset.sel || 0], k = sel ? miniKey(prod, sel) : "";
    if (S.photos && k) return openLightbox(`${S.imageDir}minis/${k}.jpg`, `${prod.b} ${prod.n} — ${spec(sel)}`);
    const img = $("img.ok", th);
    if (img) openLightbox(img.src.replace("/thumbs/", "/"), th.dataset.alt);   // the card shows the small file; the viewer loads the big one
  });

  /* ------------------------------------------------------------------
     Photo viewer
     ------------------------------------------------------------------ */
  const lightbox = $("#lightbox");
  let opener = null;

  function openLightbox(src, caption) {
    opener = document.activeElement;
    $("img", lightbox).src = src;
    $("figcaption", lightbox).textContent = caption;
    lightbox.hidden = false;
    PX.syncLock();
  }
  const closeLightbox = () => { lightbox.hidden = true; PX.syncLock(); opener?.focus?.(); };
  lightbox.addEventListener("click", closeLightbox);

  // Esc closes the photo viewer before the cart.
  PX.escapes.unshift(() => { if (!lightbox.hidden) { closeLightbox(); return true; } return false; });

  // Show the catalogue searched for a perfume name (used by the quiz's "See all sizes"). The search looks at names
  // only, so the house is passed separately and chosen as the House filter: that shows exactly that product.
  PX.catalogue = {
    search(text, house = "") {
      cancelSearch();
      Object.assign(state, DEFAULTS, { q: text, brand: house });
      syncControls();
      renderShop();
      $(".controls").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    },
  };

  /* ------------------------------------------------------------------
     Links from other pages:  catalogue.html?style=arabian  /  ?quiz=1  /  ?q=khamrah   (q is a perfume name)  /  ?fm=Floral  /  ?g=Minis
     ------------------------------------------------------------------ */
  const params = new URLSearchParams(location.search);
  const style = params.get("style");
  if (["designer", "luxury", "arabian"].includes(style)) state.seg = style;
  const qParam = params.get("q");
  if (qParam) state.q = qParam.slice(0, 80);
  // ?fm=Floral (a scent family) and ?g=Minis (Retail, Tester, Minis or Sets): only values the filters really offer are accepted
  const fmParam = params.get("fm");
  if (fmParam && famCounts.has(fmParam)) state.fm = fmParam;
  const gParam = params.get("g");
  if (["Retail", "Tester", "Minis", "Sets"].includes(gParam)) state.g = gParam;
  syncControls();
  renderShop();
  if (params.has("quiz")) PX.quiz.open();
  if ([...params.keys()].length) {
    try { history.replaceState(null, "", location.pathname); } catch { /* not critical */ }
  }
})();

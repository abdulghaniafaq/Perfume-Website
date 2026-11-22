/* "Find my scent" quiz (catalogue page).
   Needs common.js. Load it BEFORE catalogue.js: catalogue.js calls PX.quiz.open() for the ?quiz=1
   link, and this file calls PX.catalogue.search() when someone taps "See all sizes". */
(() => {
  "use strict";

  const PX = window.PX;
  const { PRODUCTS, $, $$, esc, money, detail, keyOf, BY_SLUG, BANDS, famCounts,
          thumbInner, priceHTML, orderOneText, WA_ICON, paintAddButton, photoFor, photoImg, watchPhotos, miniBadge } = PX;

  const quizEl = $("#quiz");
  let opener = null;   // what gets focus back when the quiz closes

  /* ------------------------------------------------------------------
     "Find my scent" — seven adaptive questions, and the numbers always add up:
       • each question sorts every fragrance still in the running into exactly ONE of its options
         (anything that fits none lands in a catch-all row such as "Not specified"), so the options
         always add up to the number in the running;
       • picking an option keeps exactly those fragrances — the number beside it is what you get, and
         the next question's options add up to it;
       • the options and the filter come from the same sorting, so they can't disagree.
     A fragrance has several sizes, but it is counted once, at its cheapest listing; that listing decides
     its price band and size group, and it is the one shown on the result card.
     A question is skipped automatically when fewer than two of its options have anything in them.
     ------------------------------------------------------------------ */
  const ORDER = ["gender", "style", "family", "origin", "insp", "budget", "size"];
  const BLANK = () => Object.fromEntries(ORDER.map((k) => [k, ""]));
  const PICKS_PER_PAGE = 6;
  const REST = "__rest__";   // the catch-all row of a question

  const GENDER_LABEL = { Men: "For men", Women: "For women", Unisex: "Unisex" };
  const STYLE_LABEL = { designer: "Designer houses", luxury: "Luxury & niche", arabian: "Middle Eastern" };
  const ORIGIN_LABEL = { own: "A house's own scent", inspired: "Inspired by a classic" };
  const SIZE_LABEL = { Retail: "Full bottle", Tester: "Tester", Minis: "Small size to try" };
  const REST_LABEL = { gender: "Gender not specified", style: "Other houses", family: "No scent family listed", insp: "Inspired by other classics", size: "Sets & other sizes" };
  const FAMILY_HINT = {
    "Fresh & Citrus": "Clean, bright, energising", Floral: "Rose, jasmine, soft petals", Gourmand: "Sweet — vanilla, caramel, dessert",
    "Oud & Woody": "Deep, smoky, rich woods", "Amber & Spicy": "Warm, resinous, spiced", "Leather & Smoky": "Bold, dark, suede and smoke", Musk: "Soft, skin-like, clean",
  };
  const familyList = [...famCounts.keys()].sort((a, b) => famCounts.get(b) - famCounts.get(a));
  const bandById = (v) => BANDS.find((b) => b.v === v);

  // Each fragrance's one listing: its cheapest (the first, if two cost the same).
  const headline = new Map(PRODUCTS.map((p) => [p, p.v.reduce((a, b) => (b.pr < a.pr ? b : a))]));

  /** Which option of a question a fragrance falls under (one each; REST when it fits none). */
  const bucketOf = {
    gender: (p) => p.gd || REST,
    style: (p) => (STYLE_LABEL[p.seg] ? p.seg : REST),
    family: (p) => p.fm || REST,
    origin: (p) => (p.i ? "inspired" : "own"),
    budget: (p) => BANDS.find((b) => headline.get(p).pr >= b.lo && headline.get(p).pr < b.hi).v,
    size: (p) => (SIZE_LABEL[headline.get(p).g] ? headline.get(p).g : REST),
  };

  /** The most common inspiring houses (by each fragrance's first-listed house) among these fragrances. */
  function topHouses(pool, n = 8) {
    const m = new Map();
    pool.forEach(({ p }) => { if (p.ib[0]) m.set(p.ib[0], (m.get(p.ib[0]) || 0) + 1); });
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([h]) => h);
  }

  /** The fragrances that fit every answer so far, each with the listing that is shown for it. */
  function poolFor(A) {
    // "Other classics" means: not one of the houses that were listed at that question.
    const listed = A.insp === REST ? new Set(topHouses(poolFor({ ...A, insp: "", budget: "", size: "" }))) : null;
    return PRODUCTS.filter((p) => ORDER.every((k) => {
      if (!A[k]) return true;
      if (k !== "insp") return bucketOf[k](p) === A[k];
      return A.insp === REST ? !(p.ib[0] && listed.has(p.ib[0])) : p.ib[0] === A.insp;
    })).map((p) => ({ p, v: headline.get(p) }));
  }

  /** Ranked picks: cheaper first, or pricier first for budgets from ₹6,000; ties keep catalogue order. */
  function rankFor(A) {
    const premium = A.budget && bandById(A.budget).lo >= 6000;
    const items = poolFor(A).map(({ p, v }, order) => ({ p, v, order }));
    return items.sort((a, b) => (premium ? b.v.pr - a.v.pr : a.v.pr - b.v.pr) || a.order - b.order);
  }

  /** Options for a question: the listed ones plus a catch-all row, each with how many fragrances it holds. */
  function rows(key, A, defs, rest) {
    const m = new Map();
    poolFor(A).forEach(({ p }) => { const b = bucketOf[key](p); m.set(b, (m.get(b) || 0) + 1); });
    const list = defs.map(([v, label, hint]) => ({ v, label, hint, n: m.get(v) || 0 }));
    if (rest) list.push({ v: REST, label: rest[0], hint: rest[1], n: m.get(REST) || 0 });
    return list;
  }

  const QUESTIONS = [
    {
      key: "gender", q: "Who is it for?", skip: "Anyone / not sure",
      sub: PRODUCTS.some((p) => !p.gd) ? "Some fragrances have no gender on record yet — they sit under “Not specified”." : "Each fragrance is listed for men, for women, or as unisex.",   // (the "Not specified" row, and the sentence about it, exist only while some perfume lacks the tag)
      options: (A) => rows("gender", A, [["Men", "For him"], ["Women", "For her"], ["Unisex", "Unisex — to share", "Suits anyone"]], ["Not specified", "No gender on record"]),
    },
    {
      key: "style", q: "Which kind of house appeals to you?", sub: "Think of the names you'd be proud to wear.", skip: "Open to everything",
      options: (A) => rows("style", A, [
        ["designer", "Designer houses", "Chanel, Dior, Versace, Gucci…"],
        ["luxury", "Luxury & niche", "Tom Ford, Margiela, Montale, Mancera…"],
        ["arabian", "Middle Eastern", "Lattafa, Rasasi, Armaf, Afnan…"],
      ], ["Other houses", "Not grouped yet"]),
    },
    {
      key: "family", q: "Which scent family pulls you in?", skip: "Not sure yet",
      sub: PRODUCTS.some((p) => !p.fm) ? "Some fragrances have no scent family on record yet — they sit under “Not specified”." : "Each fragrance is filed under one scent family.",
      options: (A) => rows("family", A, familyList.map((f) => [f, f, FAMILY_HINT[f]]), ["Not specified", "No scent family on record"]),
    },
    {
      key: "origin", q: "A house's own scent — or one inspired by a famous classic?", sub: "Inspired-by fragrances are original creations that share a scent profile with a well-known designer scent.", skip: "Either is fine",
      options: (A) => rows("origin", A, [["own", "A house's own scent", "Signature creations"], ["inspired", "Inspired by a famous scent", "Echoes a well-known classic"]]),
    },
    {
      // Only asked once you've said you want an inspired-by fragrance (otherwise "other classics" would mean nothing).
      key: "insp", q: "Which famous scent do you already love?", sub: "Shows only fragrances inspired by it.", skip: "None in particular",
      options: (A) => {
        if (A.origin !== "inspired") return [];
        const pool = poolFor(A), houses = topHouses(pool);
        const list = houses.map((h) => ({ v: h, label: h, hint: "", n: pool.filter(({ p }) => p.ib[0] === h).length }));
        return [...list, { v: REST, label: "Other classics", hint: "Every other house", n: pool.length - list.reduce((s, o) => s + o.n, 0) }];
      },
    },
    {
      key: "budget", q: "What's your budget per bottle?", sub: "From everyday value to top-tier luxury. Each fragrance is counted once, at its lowest price.", skip: "Flexible",
      options: (A) => rows("budget", A, BANDS.map((b) => [b.v, b.quiz, b.hint])),
    },
    {
      key: "size", q: "What size would you like?", sub: "Testers are the same fragrance in plain packaging; small sizes are a low-risk way to try one. Each fragrance is counted once, by its lowest-priced size.", skip: "Any size",
      options: (A) => rows("size", A, [["Retail", "Full bottle", "Retail packaging"], ["Tester", "Tester", "Same scent, plain packaging"], ["Minis", "Small size to try", "Minis & vials"]], ["Sets & other", "Gift sets, partial bottles"]),
    },
  ];

  const qa = BLANK();      // the answers so far ("" = no preference)
  let qStep = 0;           // 0…6 = a question, 7 = results
  let shown = PICKS_PER_PAGE;
  const RESULTS = QUESTIONS.length;

  const answersBefore = (i) => Object.fromEntries(ORDER.map((k, j) => [k, j < i ? qa[k] : ""]));
  const optionsFor = (i) => QUESTIONS[i].options(answersBefore(i)).filter((o) => o.n > 0);
  const isAsked = (i) => optionsFor(i).length >= 2;
  /** First question at or after i that is worth asking; skipped ones have their answer cleared. */
  function forwardFrom(i) {
    for (; i < RESULTS; i++) {
      if (isAsked(i)) return i;
      qa[QUESTIONS[i].key] = "";
    }
    return RESULTS;
  }
  function backFrom(i) {
    for (i -= 1; i >= 0; i--) if (isAsked(i)) return i;
    return 0;
  }

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  const LABELS = { gender: GENDER_LABEL, style: STYLE_LABEL, origin: ORIGIN_LABEL, size: SIZE_LABEL };
  function labelOf(key, v) {
    if (v === REST) return REST_LABEL[key];
    if (key === "family") return v;
    if (key === "insp") return `Inspired by ${v}`;
    if (key === "budget") return bandById(v).quiz;
    return LABELS[key][v];
  }
  const summaryOf = (A) => ORDER.filter((k) => A[k]).map((k) => labelOf(k, A[k]));

  const quizCard = $(".modal-card", quizEl);
  const quizBody = $("#quiz-body");

  function renderQuestion() {
    const Q = QUESTIONS[qStep];
    const opts = optionsFor(qStep);
    if (qa[Q.key] && !opts.some((o) => o.v === qa[Q.key])) qa[Q.key] = "";
    const running = poolFor(answersBefore(qStep)).length;
    quizBody.innerHTML = `
      <p class="quiz-count" aria-live="polite"><b>${running}</b> ${running === 1 ? "fragrance" : "fragrances"} in the running</p>
      <h2 class="quiz-q" tabindex="-1">${esc(Q.q)}</h2>
      <p class="quiz-sub">${esc(Q.sub)}</p>
      <div class="quiz-opts" data-q="${Q.key}" role="group" aria-label="${esc(Q.q)}">${opts.map((o) => `
        <button type="button" class="quiz-opt${qa[Q.key] === o.v ? " on" : ""}" data-v="${esc(o.v)}" aria-pressed="${qa[Q.key] === o.v}">
          <span class="qo-main"><span class="qo-label">${esc(o.label)}</span>${o.hint ? `<span class="qo-hint">${esc(o.hint)}</span>` : ""}</span>
          <span class="qo-n" title="${plural(o.n, "fragrance", "fragrances")}">${o.n}</span>
        </button>`).join("")}
      </div>
      <div class="quiz-nav">
        ${qStep > 0 ? '<button type="button" class="text-btn quiz-back">‹ Back</button>' : "<span></span>"}
        <button type="button" class="text-btn quiz-skip">${esc(Q.skip)} →</button>
      </div>`;
  }

  const adviceText = (ranked) => {
    const lines = summaryOf(qa).map((s) => `• ${s}`);
    const picks = ranked.slice(0, 3).map((r, i) => `${i + 1}. ${r.p.b} ${r.p.n} (${money(r.v.pr)})`);
    return ["Hi! I took the scent quiz on your site.", "", ...(lines.length ? ["My answers:", ...lines, ""] : []),
      ...(picks.length ? ["Top picks:", ...picks, ""] : []), "Can you help me choose?"].join("\n");
  };

  function resultHTML(it) {
    const { p, v } = it;
    const ph = photoFor(p, v);                                  // the same picture rule as the catalogue cards (a mini with its own picture shows it)
    return `
      <article class="qr" data-k="${esc(keyOf(p, v))}" data-slug="${esc(p.s)}">
        <div class="thumb qr-art" data-alt="${esc(ph.label)}">${thumbInner(v)}${photoImg(ph)}${miniBadge(p, v)}</div>
        <div class="qr-main">
          <p class="house">${esc(p.b)}</p>
          <h3 class="qr-name">${esc(p.n)}</h3>
          ${p.i ? `<p class="qr-insp">Inspired by ${esc(p.i)}</p>` : ""}
          <p class="qr-spec">${esc(detail(v))}</p>
        </div>
        <div class="qr-side">
          <span class="price">${priceHTML(v)}</span>
          <span class="acts">
            <button class="add" type="button" data-who="${esc(p.n)} by ${esc(p.b)}" aria-label="Add ${esc(p.n)} by ${esc(p.b)} to cart">+</button>
            <a class="order" href="#" data-wa-open="${esc(orderOneText(p, v))}">${WA_ICON}Order</a>
          </span>
          <button type="button" class="text-btn qr-view">See all sizes</button>
        </div>
      </article>`;
  }

  function renderResults() {
    const ranked = rankFor(qa);
    const summary = summaryOf(qa).map((s) => `<span class="tag pkg">${esc(s)}</span>`).join("");
    const list = ranked.slice(0, shown).map(resultHTML).join("");
    quizBody.innerHTML = ranked.length ? `
      <h2 class="quiz-q" tabindex="-1">Your top picks</h2>
      <p class="quiz-sub"><b>${plural(ranked.length, "fragrance", "fragrances")}</b> fit${ranked.length === 1 ? "s" : ""} your answers${summary ? "" : " — you skipped every question, so here's everything"}.</p>
      ${summary ? `<div class="quiz-summary">${summary}</div>` : ""}
      <div class="qr-list">${list}</div>
      <div class="quiz-end">
        ${shown < ranked.length ? `<button type="button" class="btn btn-ghost quiz-more">Show ${Math.min(PICKS_PER_PAGE, ranked.length - shown)} more</button>` : ""}
        <a class="btn btn-gold" href="#" data-wa-open="${esc(adviceText(ranked))}">Get advice on WhatsApp</a>
      </div>
      <div class="quiz-nav"><button type="button" class="text-btn quiz-change">‹ Change my answers</button><button type="button" class="text-btn quiz-restart">Start again</button></div>`
    : `
      <h2 class="quiz-q" tabindex="-1">Nothing fits that exact mix</h2>
      <p class="quiz-sub">Try loosening one answer — or tell us what you're after and we'll see what we can do.</p>
      ${summary ? `<div class="quiz-summary">${summary}</div>` : ""}
      <div class="quiz-end">
        <button type="button" class="btn btn-gold quiz-change">Change my answers</button>
        <a class="btn btn-ghost" href="#" data-wa-open="${esc(adviceText([]))}">Ask us on WhatsApp</a>
        <a class="btn btn-ghost" href="contact.html#request">Request a perfume</a>
      </div>`;
    watchPhotos($$(".qr-art img", quizBody));
    syncQuizAdd();
  }

  function syncQuizAdd() {
    $$(".qr", quizBody).forEach((r) => paintAddButton($(".add", r), PX.cartQty(r.dataset.k)));
  }
  PX.onCart(syncQuizAdd);

  function renderQuiz() {
    $("#quiz-steps").innerHTML = ORDER.map((_, i) => `<span class="${i <= qStep ? "on" : ""}"></span>`).join("");
    quizCard.classList.toggle("wide", qStep === RESULTS);
    if (qStep < RESULTS) renderQuestion(); else renderResults();
    quizCard.scrollTop = 0;
    const target = $(".quiz-opt.on", quizBody) || $(".quiz-opt", quizBody) || $(".quiz-q", quizBody);
    target?.focus();
  }

  function openQuiz() {
    opener = document.activeElement;
    Object.assign(qa, BLANK());
    qStep = 0;
    shown = PICKS_PER_PAGE;
    quizEl.hidden = false;
    PX.syncLock();
    renderQuiz();
  }
  function closeQuiz() { quizEl.hidden = true; PX.syncLock(); opener?.focus?.(); }

  $$("[data-quiz]").forEach((b) => b.addEventListener("click", openQuiz));
  $("#quiz-close").addEventListener("click", closeQuiz);
  quizEl.addEventListener("click", (e) => { if (e.target === quizEl) closeQuiz(); });
  quizBody.addEventListener("click", (e) => {
    const t = e.target;
    const o = t.closest(".quiz-opt");
    if (o) { qa[QUESTIONS[qStep].key] = o.dataset.v; qStep = forwardFrom(qStep + 1); return renderQuiz(); }
    if (t.closest(".quiz-skip")) { qa[QUESTIONS[qStep].key] = ""; qStep = forwardFrom(qStep + 1); return renderQuiz(); }
    if (t.closest(".quiz-back")) { qStep = backFrom(qStep); return renderQuiz(); }
    if (t.closest(".quiz-change")) { shown = PICKS_PER_PAGE; qStep = forwardFrom(0); return renderQuiz(); }
    if (t.closest(".quiz-restart")) { Object.assign(qa, BLANK()); shown = PICKS_PER_PAGE; qStep = 0; return renderQuiz(); }
    if (t.closest(".quiz-more")) { shown += PICKS_PER_PAGE; const y = quizCard.scrollTop; renderResults(); quizCard.scrollTop = y; return; }
    const add = t.closest(".qr .add");
    if (add) return void PX.addToCart(add.closest(".qr").dataset.k);
    const view = t.closest(".qr-view");
    if (view) {
      const p = BY_SLUG.get(view.closest(".qr").dataset.slug);
      closeQuiz();
      PX.catalogue.search(p.n, p.b);
    }
  });

  // Esc closes the quiz before the cart; Tab stays inside it.
  PX.escapes.unshift(() => { if (!quizEl.hidden) { closeQuiz(); return true; } return false; });
  PX.layers.unshift(() => (quizEl.hidden ? null : quizEl));

  PX.quiz = { open: openQuiz, close: () => { if (!quizEl.hidden) closeQuiz(); } };
})();

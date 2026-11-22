/* Contact page: the "Request a perfume" form. It writes the request out as a WhatsApp
   message (nothing is stored on the site). While the visitor types, it checks the
   catalogue and offers matches, so people find what we already have. */
(() => {
  "use strict";

  const PX = window.PX;
  const { PRODUCTS, $, esc, money, normalize, BANDS, fillSelect } = PX;

  const form = $("#request-form");
  const perfume = $("#rq-perfume"), brand = $("#rq-brand"), size = $("#rq-size"), budget = $("#rq-budget");
  const yourName = $("#rq-name"), notes = $("#rq-notes");
  const suggest = $("#rq-suggest"), done = $("#request-done");

  fillSelect(size, [["", "Any size"], ["Full bottle", "Full bottle"], ["Tester", "Tester"], ["Small size (mini or vial)", "Small size (mini or vial)"]]);
  fillSelect(budget, [["", "Not sure"], ...BANDS.map((b) => [b.quiz, b.quiz])]);

  /* ---- "Already in our catalogue?" ---- */
  const MAX_SUGGESTIONS = 4;

  function matches() {
    if (normalize(perfume.value).length < 3) return [];
    const tokens = normalize(`${brand.value} ${perfume.value}`).split(" ").filter(Boolean);
    return PRODUCTS.filter((p) => p.v.some((v) => tokens.every((t) => v.hay.includes(t))));
  }

  const searchLink = (text) => `catalogue.html?q=${encodeURIComponent(text.trim())}`;

  function renderSuggestions() {
    const found = matches();
    if (!found.length) { suggest.hidden = true; suggest.innerHTML = ""; return; }
    // The catalogue's search looks at the house and the perfume name (not the "inspired by" text), so each link carries "House Name".
    const items = found.slice(0, MAX_SUGGESTIONS).map((p) =>
      `<li><a href="${searchLink(`${p.b} ${p.n}`)}"><span><b>${esc(p.b)}</b> ${esc(p.n)}${p.i ? `<small>Inspired by ${esc(p.i)}</small>` : ""}</span><span class="s-price">from ${money(Math.min(...p.v.map((v) => v.pr)))}</span></a></li>`).join("");
    const typed = `${brand.value} ${perfume.value}`.replace(/\s+/g, " ").trim();
    const words = normalize(typed).split(" ").filter(Boolean);
    const listed = PRODUCTS.filter((p) => words.every((t) => p.key.includes(t))).length;   // what the catalogue would list for that text
    const more = found.length > MAX_SUGGESTIONS && listed
      ? `<a class="s-all" href="${searchLink(typed)}">See all ${listed} perfume${listed === 1 ? "" : "s"} matching “${esc(typed.slice(0, 30))}”</a>` : "";
    suggest.innerHTML = `<p class="s-head">Already in our catalogue? <span>${found.length} match${found.length === 1 ? "" : "es"}</span></p><ul>${items}</ul>${more}`;
    suggest.hidden = false;
  }
  perfume.addEventListener("input", renderSuggestions);
  brand.addEventListener("input", renderSuggestions);

  /* ---- validation ---- */
  const setMsg = (input, text) => {
    $(`#${input.id}-msg`).textContent = text;
    input.setAttribute("aria-invalid", text ? "true" : "false");
  };
  [perfume, yourName].forEach((el) => el.addEventListener("input", () => setMsg(el, "")));

  const clean = (v) => v.replace(/\s+/g, " ").trim();

  // Optional fields are left out entirely when empty (null = "no line"; "" = a deliberate blank line).
  const line = (label, value) => (value ? `${label}: ${value}` : null);

  function buildMessage() {
    return [
      "Hi! I'd like to request a perfume that isn't in your catalogue:", "",
      line("Perfume", clean(perfume.value)),
      line("Brand", clean(brand.value)),
      line("Size", size.value),
      line("Budget", budget.value),
      line("Notes", clean(notes.value)),
      "", line("My name", clean(yourName.value)),
    ].filter((l) => l !== null).join("\n");
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const badPerfume = clean(perfume.value).length < 2;
    const badName = clean(yourName.value).length < 2;
    setMsg(perfume, badPerfume ? "Please tell us which perfume you're looking for." : "");
    setMsg(yourName, badName ? "Please add your name so we know who to reply to." : "");
    if (badPerfume || badName) { (badPerfume ? perfume : yourName).focus(); return; }

    const text = buildMessage();
    PX.openWhatsApp(text);
    $("#request-preview").textContent = text;
    $("#request-open").dataset.waOpen = text;
    form.hidden = true;
    done.hidden = false;
    done.focus();
  });

  $("#request-again").addEventListener("click", () => {
    form.reset();
    [perfume, yourName].forEach((el) => setMsg(el, ""));
    renderSuggestions();
    done.hidden = true;
    form.hidden = false;
    perfume.focus();
  });
})();

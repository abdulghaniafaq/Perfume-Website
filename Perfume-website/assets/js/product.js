/* ==========================================================================
   PERFUME PAGES: the Add buttons and the WhatsApp order links use the same cart, the same keys and the same message as the catalogue
   cards, so a perfume ordered from its own page arrives in the cart (and on WhatsApp) exactly as one ordered from the catalogue.
   (Without scripts the page still reads in full; the Order link then goes to the Contact page.)
   ========================================================================== */
(() => {
  const PX = window.PX;
  if (!PX || !PX.INDEX) return;
  const rows = [...document.querySelectorAll(".size[data-key]")];
  const nameOf = (e) => `${e.p.b} ${e.p.n}, ${[e.v.m, e.v.p].filter(Boolean).join(" ")}${PX.note(e.v.r) ? ` (${PX.note(e.v.r)})` : ""}`;

  // "Add" → "In cart · 2" (the visible words are kept at the start of the spoken name, and the cart's own live region announces each addition)
  const paint = () => rows.forEach((row) => {
    const e = PX.INDEX.get(row.dataset.key);
    if (!e) return;
    const btn = row.querySelector(".p-add"), qty = PX.cartQty(row.dataset.key);
    btn.classList.toggle("in", qty > 0);
    btn.textContent = qty ? `In cart · ${qty}` : "Add";
    btn.setAttribute("aria-label", qty ? `In cart · ${qty}. Add another ${nameOf(e)}` : `Add ${nameOf(e)} to cart`);
  });

  rows.forEach((row) => {
    const e = PX.INDEX.get(row.dataset.key);
    if (!e) return;
    row.querySelector(".p-order").dataset.waOpen = PX.orderOneText(e.p, e.v);          // the same words the catalogue's Order button sends
    row.querySelector(".p-add").addEventListener("click", () => PX.addToCart(row.dataset.key));
  });
  PX.onCart(paint);
  paint();
})();

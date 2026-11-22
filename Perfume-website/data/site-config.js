/* ==========================================================================
   SITE CONFIG — brand, contact details and shop settings. (Edit freely.)
   The product list itself lives next to this file, in products-data.js.
   ========================================================================== */

window.SITE = {
  brand: "Perfume X Collections",

  // Prices are in INR. Changing these changes how every price is formatted.
  currency: "INR",
  locale: "en-IN",

  // Shown in the footer and the terms. Update whenever you refresh prices.
  pricesUpdated: "November 2026",

  contact: {
    // Digits only, with country code, no "+" or spaces.
    whatsapp: "916386609272",
    whatsappDisplay: "+91 63866 09272",
    // How the number is shown on the Contact page: "masked" → +91 ••••• ••272, "hidden" → not shown.
    numberDisplay: "masked",
    // Optional. Leave "" to hide. Instagram is the handle without the "@".
    instagram: "",
    email: ""
  },

  guarantee: {
    // The refund multiple shown across the site: 3 → "3×" / "three times".
    // NOTE: the previous catalogue promised 2× ("double"). Set this to
    // whatever you actually honour — it updates everywhere.
    multiple: 3,

    // A claim is only valid if the bottle is audited IN PERSON at one of these reputed stores (or a comparable
    // well-known store / the brand's own boutique, anywhere in the world). Independent labs, apps, online
    // services and self-made reports are not accepted. Shown on the Guarantee page and in the FAQ.
    auditStores: ["Sephora", "Nykaa", "Shoppers Stop", "Parcos"],

    // How many days after delivery a customer has to raise a claim (with the store's written report).
    claimDays: 7
  },

  // Photos: each product has two files named after its slug, e.g. for afnan-9am:
  //   assets/images/afnan-9am.jpg          (800px, shown when a customer taps the picture)
  //   assets/images/thumbs/afnan-9am.jpg   (240px, the small picture on the card)
  // Products without a photo show a bottle outline sized to their volume. List their slugs
  // in noPhoto so the page doesn't ask for a file that isn't there; remove a slug from the
  // list once you've added its photo.
  photos: true,
  imageDir: "assets/images/",
  imageExt: "jpg",
  noPhoto: [],   // every product has a photo right now

  // Mini pictures. A mini (spray, dab or vial) can have its own picture. The card still opens on the normal photo; the mini's
  // picture appears only when the visitor taps that size on the card (and goes back when they tap another size).
  // Files, named "<slug>--<form>" where form is spray, dab or vial:
  //   assets/images/minis/<key>.jpg          (800px, for the photo viewer)
  //   assets/images/minis/thumbs/<key>.jpg   (240px, on the card)
  // List a key here only once both files exist.
  miniPhotos: [
    "azzaro-forever-wanted-elixir--spray",
    "bath-body-works-gingham--spray",
    "burberry-goddess-edp--spray",
    "burberry-goddess-edp-intense--spray",
    "burberry-goddess-parfum--spray",
    "bvlgari-man-glacial-essence-edp--spray",
    "bvlgari-man-in-black-edp--dab",
    "bvlgari-man-in-black-edp--spray",
    "bvlgari-man-rain-essence-edp--spray",
    "bvlgari-man-wood-essence-edp--spray",
    "bvlgari-omnia-amethyste-edt--spray",
    "bvlgari-omnia-crystalline-edt--spray",
    "bvlgari-pour-homme-edt--dab",
    "bvlgari-rose-goldea-blossom-delight-edp--spray",
    "carolina-herrera-212-men-nyc-edt--spray",
    "hermes-barenia-edp-intense--spray",
    "hermes-h24-edp--spray",
    "hermes-terre-dhermes-eau-givree-edp--spray",
    "hermes-terre-dhermes-edp-intense--dab",
    "hermes-terre-dhermes-edt--dab",
    "hermes-terre-dhermes-edt--spray",
    "hermes-terre-dhermes-parfum--spray",
    "lancome-idole-leau-de-parfum--spray",
    "narciso-rodriguez-bleu-noir-parfum--spray",
    "paco-rabanne-1-million-edt--vial",
    "paco-rabanne-invictus-victory-absolu-parfum-intense--vial",
    "paco-rabanne-million-gold-parfum-her--spray",
    "salvatore-ferragamo-ferragamo-edt--dab",
    "salvatore-ferragamo-uomo-casual-life-edt--dab",
    "salvatore-ferragamo-uomo-urban-feel-edt--dab",
    "versace-dylan-blue-edt--dab",
    "versace-pour-homme-edt--dab"
  ],

  // Max distinct items in one cart message.
  maxCartLines: 30,

  /* ------------------------------------------------------------------------
     SEGMENTS — drives the Designer / Luxury & niche / Middle Eastern filter.
     A house is "arabian" or "luxury" if listed here, "designer" otherwise,
     and not part of any segment if listed under `unclassified` (it still
     shows under "All"). Check these lists — they're my best grouping, not
     something from your old catalogue.
     ---------------------------------------------------------------------- */
  segments: {
    arabian: [
      "Afnan", "Ahmed Al Maghribi", "Al Haramain", "Arabiyat Prestige", "Armaf",
      "Fragrance World", "French Avenue", "French Avenue X Aromatix", "Gulf Orchid",
      "Ibraheem Al Qurashi", "Khadlaj", "Lattafa", "Maison Alhambra", "Maison Asrar",
      "My Perfumes", "Nusuk", "Paris Corner", "Rasasi", "Rayhaan", "Swiss Arabian",
      "Thameen", "Zimaya"
    ],
    luxury: [
      "Christian Dior", "Guerlain", "Hermes", "Jo Malone", "Maison Crivelli",
      "Maison Margiela", "Mancera", "Montale", "Orto Parisi", "Tom Ford"
    ],
    unclassified: ["Dumont", "Lomani", "Remy Latour"]
  }
};

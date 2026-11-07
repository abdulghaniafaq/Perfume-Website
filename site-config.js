/* ==========================================================================
   SITE CONFIG — brand, contact details and shop settings.
   The product list itself lives in products-data.js.
   ========================================================================== */

window.SITE = {
  brand: "Perfume X Collections",

  // Prices are in INR. Changing these changes how every price is formatted.
  currency: "INR",
  locale: "en-IN",

  // Shown in the footer and the terms. Update whenever you refresh prices.
  pricesUpdated: "30 August 2026",

  contact: {
    // Digits only, with country code, no "+" or spaces.
    whatsapp: "916386609272",
    whatsappDisplay: "+91 63866 09272",
    // Optional. Leave "" to hide. Instagram is the handle without the "@".
    instagram: "",
    email: ""
  },

  guarantee: {
    // The refund multiple shown across the site: 3 → "3×" / "three times".
    // NOTE: the previous catalogue promised 2× ("double"). Set this to
    // whatever you actually honour — it updates everywhere.
    multiple: 3
  },

  // Photos: put them in an "images" folder next to index.html, named after
  // each product's slug (e.g. images/afnan-9am.jpg), then set photos: true.
  // Products without a photo show a bottle outline sized to their volume.
  // (Left off until the folder exists, so the site isn't requesting 48 missing
  // files per page.)
  photos: false,
  imageDir: "images/",
  imageExt: "jpg",

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

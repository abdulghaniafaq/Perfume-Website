// An independent re-statement of what the catalogue filters SHOULD do, written from the
// behaviour spec (not copied from catalogue.js). Tests compare the live page to this.
import { SITE, PRODUCTS } from "./data.mjs";

export const PAGE_SIZE = 48;                              // cards per page on a computer or tablet
export const PHONE_PAGE_SIZE = 24;                        // cards per page on a phone
export const PHONE_MAX_WIDTH = 760;                       // "phone" = a screen this many CSS pixels wide or narrower (the layout's own phone width)
export const pageSizeFor = (width) => (width <= PHONE_MAX_WIDTH ? PHONE_PAGE_SIZE : PAGE_SIZE);
export const NONE = "__none__";   // value of the "Not yet tagged" options

// Price bands are mutually exclusive: lo <= price < hi (so ₹1,000 is in exactly one band).
export const BANDS = { "0-1000": [0, 1000], "1000-3000": [1000, 3000], "3000-6000": [3000, 6000], "6000-10000": [6000, 10000], "10000-999999": [10000, Infinity] };

// sort: "lo" = price, low to high (the default) · "hi" = price, high to low · "az" = perfume name A to Z (digits first; capitals, accents and punctuation ignored; same name → house A to Z → catalogue order)
export const DEFAULT_FILTERS = { q: "", seg: "all", g: "all", brand: "", gd: "", fm: "", price: "", sort: "lo" };

const money = new Intl.NumberFormat(SITE.locale, { style: "currency", currency: SITE.currency, maximumFractionDigits: 0 });
export const fmtPrice = (n) => money.format(n);

/** Search normalisation: case, accents, apostrophes (straight/curly) and punctuation don't matter. */
export const normalize = (s) =>
  String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’‘`´]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export const spec = (v) => [v.m, v.p].filter(Boolean).join(" · ");

export const segmentOf = (house) => {
  const s = SITE.segments;
  if (s.unclassified.includes(house)) return "";
  if (s.arabian.includes(house)) return "arabian";
  if (s.luxury.includes(house)) return "luxury";
  return "designer";
};

/** Expected results for a filter set: ordered rows of { slug, house, name, variants:[{price, group, spec}] }. */
export function expected(filters = {}) {
  const F = { ...DEFAULT_FILTERS, ...filters };
  const tokens = normalize(F.q).split(" ").filter(Boolean);
  const [lo, hi] = F.price ? BANDS[F.price] : [0, Infinity];
  const rows = [];

  PRODUCTS.forEach((p, order) => {
    if (F.seg !== "all" && segmentOf(p.b) !== F.seg) return;
    if (F.brand && p.b !== F.brand) return;
    if (F.gd === NONE) { if (p.gd) return; } else if (F.gd && p.gd !== F.gd) return;
    if (F.fm === NONE) { if (p.fm) return; } else if (F.fm && p.fm !== F.fm) return;

    // The search looks at the HOUSE and the perfume NAME only: not the "inspired by" text, not the size or packaging.
    const name = normalize(`${p.b} ${p.n}`);
    if (!tokens.every((k) => name.includes(k))) return;
    let vs = p.v.filter((v) => (F.g === "all" || v.g === F.g) && v.pr >= lo && v.pr < hi);
    if (!vs.length) return;

    vs = [...vs].sort((a, b) => (F.sort === "hi" ? b.pr - a.pr : a.pr - b.pr));   // the sizes on a card go cheapest first, unless "high to low" was chosen
    rows.push({
      slug: p.s, house: p.b, name: p.n, order,
      min: Math.min(...vs.map((v) => v.pr)), max: Math.max(...vs.map((v) => v.pr)),
      variants: vs.map((v) => ({ price: v.pr, group: v.g, spec: spec(v), shown: v.mp > v.pr ? fmtPrice(v.mp) + fmtPrice(v.pr) : fmtPrice(v.pr) })),
    });
  });

  // by price, lowest first (or highest first); products with the same price keep catalogue order
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  if (F.sort === "az") rows.sort((a, b) => cmp(normalize(a.name), normalize(b.name)) || cmp(normalize(a.house), normalize(b.house)) || a.order - b.order);
  else if (F.sort === "hi") rows.sort((a, b) => b.max - a.max || a.order - b.order);
  else rows.sort((a, b) => a.min - b.min || a.order - b.order);
  return rows;
}

export const SUGGEST_MAX = 8;
export const SUGGEST_HOUSES = 2;

/**
 * The suggestions the search box should offer for what has been typed, in order. First up to two HOUSES whose name contains every
 * typed word (best: starts with it, then a word starts with it, then anywhere; more fragrances first, then A-Z) that still have
 * results under the other filters; then PERFUMES whose house + name contain every typed word (best: the name starts with it, then
 * a word of the name does, then the house starts with it, then every typed word starts a word, then anywhere; shorter names first,
 * then catalogue order). At most SUGGEST_MAX in all. Items are { kind:"house", text, n } or { kind:"perfume", slug, name, house }.
 */
export function expectedSuggestions(text, filters = {}) {
  const typed = normalize(text);
  if (!typed) return [];
  const words = typed.split(" ");
  const visible = new Set(expected({ ...filters, q: "" }).map((r) => r.slug));
  const houseList = [...new Set(PRODUCTS.map((p) => p.b))].sort((a, b) => a.localeCompare(b));
  const hs = houseList
    .filter((h) => words.every((w) => normalize(h).includes(w)))
    .map((h) => { const k = normalize(h); return { kind: "house", text: h, r: k.startsWith(typed) ? 0 : k.includes(` ${typed}`) ? 1 : 2, n: expected({ ...filters, q: h }).length }; })
    .filter((x) => x.n > 0)
    .sort((a, b) => a.r - b.r || b.n - a.n || a.text.localeCompare(b.text))
    .slice(0, SUGGEST_HOUSES)
    .map(({ kind, text, n }) => ({ kind, text, n }));
  const found = [];
  PRODUCTS.forEach((p, order) => {
    if (!visible.has(p.s)) return;
    const key = normalize(`${p.b} ${p.n}`), name = normalize(p.n);
    if (!words.every((w) => key.includes(w))) return;
    const startsAWord = (w) => key.startsWith(w) || key.includes(` ${w}`);
    const tier = name.startsWith(typed) ? 0 : name.includes(` ${typed}`) ? 1 : normalize(p.b).startsWith(typed) ? 2 : words.every(startsAWord) ? 3 : 4;
    found.push({ kind: "perfume", slug: p.s, name: p.n, house: p.b, tier, len: name.length, order });
  });
  found.sort((a, b) => a.tier - b.tier || a.len - b.len || a.order - b.order);
  return [...hs, ...found.slice(0, SUGGEST_MAX - hs.length).map(({ kind, slug, name, house }) => ({ kind, slug, name, house }))];
}

export function countLabel(n, page = 1, size = PAGE_SIZE) {
  if (!n) return `0 of ${PRODUCTS.length}`;
  if (n > size) { const from = (page - 1) * size; return `${from + 1}–${from + Math.min(size, n - from)} of ${n}`; }
  return n === PRODUCTS.length ? `${n} fragrances` : `${n} of ${PRODUCTS.length}`;
}

export const isDefault = (f) => Object.entries(DEFAULT_FILTERS).every(([k, d]) => (f[k] ?? d) === d);

export const families = [...new Set(PRODUCTS.map((p) => p.fm).filter(Boolean))];
export const houses = [...new Set(PRODUCTS.map((p) => p.b))];

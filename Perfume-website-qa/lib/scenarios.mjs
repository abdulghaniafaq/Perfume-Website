import { PRODUCTS } from "./data.mjs";
import { NONE, BANDS, families, houses, expected } from "./oracle.mjs";

/** A genuine dead end found in the data (so no test has to assume one): a house with at least two perfumes of one scent family and at least two for one gender, but none of both. */
export const DEAD_END = (() => {
  for (const brand of [...houses].sort()) for (const fm of families) for (const gd of ["Women", "Men", "Unisex"]) {
    if (expected({ brand, fm }).length >= 2 && expected({ brand, gd }).length >= 2 && expected({ brand, fm, gd }).length === 0) return { brand, fm, gd };
  }
  throw new Error("no house has a scent family and a gender that do not overlap: pick another kind of dead end for the tests");
})();

export const SEGS = ["designer", "luxury", "arabian"];
export const PKGS = ["Retail", "Tester", "Minis", "Sets"];
export const GENDERS = ["Men", "Women", "Unisex", ...(PRODUCTS.some((p) => !p.gd) ? [NONE] : [])];   // (the page offers "Not yet tagged" only while some perfume lacks the tag)
export const FAMILIES = [...families, ...(PRODUCTS.some((p) => !p.fm) ? [NONE] : [])];
export const PRICES = Object.keys(BANDS);
export const SORTS = ["lo", "hi", "az"];

// Representative values for combined scenarios (full lists are used for single-filter runs).
// Search is by HOUSE and perfume NAME. "tester", "100ml" and "lost cherry" are words that are in no house or name (a packaging,
// a size, an "inspired by" phrase): they must find nothing. "lattafa" finds a whole house.
export const QUERIES = ["oud", "vanilla", "oud wood", "wood oud", "d'hermes", "d’hermes", "lhomme", "elixir", "edp", "  OUD  ", "tester", "100ml", "lattafa", "lost cherry", "tom ford", "ford tom", "dior", "lattafa khamrah"];
export const POOL = {
  seg: SEGS, g: PKGS, price: PRICES, sort: SORTS, gd: GENDERS, fm: FAMILIES, q: QUERIES,
  brand: ["Tom Ford", "Lattafa", "Dior", "Kayali", "Afnan", "Hermes", "Paco Rabanne", "Christian Dior", "Dumont", "Burberry"],
};

export function mulberry32(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const singleFilterScenarios = () => [
  {}, // default state
  ...SEGS.map((v) => ({ seg: v })),
  ...PKGS.map((v) => ({ g: v })),
  ...[...new Set(PRODUCTS.map((p) => p.b))].map((v) => ({ brand: v })),
  ...GENDERS.map((v) => ({ gd: v })),
  ...FAMILIES.map((v) => ({ fm: v })),
  ...PRICES.map((v) => ({ price: v })),
  ...SORTS.map((v) => ({ sort: v })),
  ...QUERIES.map((v) => ({ q: v })),
];

/** Every pair of non-default values from two different filters (≈1,300 scenarios). */
export function pairwiseScenarios() {
  const keys = Object.keys(POOL), out = [];
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++)
    for (const a of POOL[keys[i]]) for (const b of POOL[keys[j]]) out.push({ [keys[i]]: a, [keys[j]]: b });
  return out;
}

/** Seeded random 3–6-way combinations, applied in random order (reproducible). */
export function randomScenarios(count = 300, seed = 20260807) {
  const rnd = mulberry32(seed), keys = Object.keys(POOL), out = [];
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  while (out.length < count) {
    const n = 3 + Math.floor(rnd() * 4), ks = shuffle(keys).slice(0, n), F = {};
    ks.forEach((k) => (F[k] = pick(POOL[k])));
    out.push({ F, order: shuffle(ks) });
  }
  return out;
}

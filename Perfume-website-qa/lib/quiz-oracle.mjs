// Independent statement of the "Find my scent" rules (written from the spec, not from quiz.js).
//
//  Questions, in order: gender, style, family, origin, insp, budget, size.
//  THE NUMBERS ALWAYS ADD UP. Each question sorts every fragrance still in the running into exactly ONE of
//  its options; a fragrance that fits none goes into a catch-all row (REST). Picking an option keeps exactly
//  that row, so the number beside it is what you get, and the next question's options add up to it.
//    gender  → the tag: Men / Women / Unisex          (no tag → REST "Not specified")
//    style   → designer / luxury / arabian            (6 ungrouped houses → REST "Other houses")
//    family  → the scent family tag                   (no tag → REST "Not specified")
//    origin  → own (not inspired-by) / inspired
//    insp    → only asked once origin = inspired. The fragrance's FIRST-listed inspiring house; the 8 most
//              common houses among the fragrances in the running are listed, every other one is REST "Other classics"
//    budget  → the price band of the fragrance's CHEAPEST listing   (lo <= price < hi)
//    size    → the packaging group of that same cheapest listing: Retail / Tester / Minis (sets etc. → REST)
//  A fragrance has one listing in the quiz — its cheapest (the first, if tied) — and that is the one shown.
//  Order of the list: cheaper first; pricier first for budgets from ₹6,000; ties keep catalogue order.
//  An option is hidden when it holds 0; a question is skipped when fewer than 2 options remain.
import { PRODUCTS } from "./data.mjs";
import { BANDS, segmentOf, fmtPrice, spec } from "./oracle.mjs";

export const STEPS = ["gender", "style", "family", "origin", "insp", "budget", "size"];
export const REST = "__rest__";
export const blank = () => Object.fromEntries(STEPS.map((k) => [k, ""]));
export const note = (r) => (!r || /^\d{4}-\d{2}-\d{2}[ T]/.test(r) ? "" : r);
export const detail = (v) => [spec(v), note(v.r)].filter(Boolean).join(" · ");

export const GENDER_LABEL = { Men: "For men", Women: "For women", Unisex: "Unisex" };
export const STYLE_LABEL = { designer: "Designer houses", luxury: "Luxury & niche", arabian: "Middle Eastern" };
export const ORIGIN_LABEL = { own: "A house's own scent", inspired: "Inspired by a classic" };
export const SIZE_LABEL = { Retail: "Full bottle", Tester: "Tester", Minis: "Small size to try" };
export const REST_LABEL = { gender: "Gender not specified", style: "Other houses", family: "No scent family listed", insp: "Inspired by other classics", size: "Sets & other sizes" };
const bandQuizLabel = (v) => { const m = fmtPrice; const [lo, hi] = BANDS[v]; return hi === Infinity ? `${m(lo)} and above` : lo === 0 ? `Under ${m(hi)}` : `${m(lo)} – ${m(hi)}`; };

// scent families, most common first (ties keep first-appearance order)
const famCount = new Map();
PRODUCTS.forEach((p) => p.fm && famCount.set(p.fm, (famCount.get(p.fm) || 0) + 1));
const FAMILIES = [...famCount.keys()].sort((a, b) => famCount.get(b) - famCount.get(a));

/** The one listing of a fragrance used by the quiz: the cheapest, first one if tied. */
const listingOf = (p) => { let best = p.v[0]; for (const v of p.v) if (v.pr < best.pr) best = v; return best; };
const bandOfPrice = (pr) => Object.keys(BANDS).find((k) => pr >= BANDS[k][0] && pr < BANDS[k][1]);

/** Which option of a question each fragrance falls under. (Not used for "insp", which depends on the pool.) */
const bucket = (key, p) => {
  switch (key) {
    case "gender": return ["Men", "Women", "Unisex"].includes(p.gd) ? p.gd : REST;
    case "style": return segmentOf(p.b) || REST;
    case "family": return p.fm || REST;
    case "origin": return p.i ? "inspired" : "own";
    case "budget": return bandOfPrice(listingOf(p).pr);
    case "size": return ["Retail", "Tester", "Minis"].includes(listingOf(p).g) ? listingOf(p).g : REST;
    default: throw new Error(key);
  }
};

const countBy = (items, fn) => { const m = new Map(); items.forEach((x) => { const k = fn(x); m.set(k, (m.get(k) || 0) + 1); }); return m; };
const firstHouse = (p) => p.ib[0] ?? null;
const topHouses = (items, n = 8) => [...countBy(items.filter((x) => firstHouse(x.p)), (x) => firstHouse(x.p))]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([h]) => h);

export function pool(A) {
  const base = PRODUCTS.map((p, order) => ({ p, v: listingOf(p), order }))
    .filter(({ p }) => ["gender", "style", "family", "origin", "budget", "size"].every((k) => !A[k] || bucket(k, p) === A[k]));
  if (!A.insp) return base;
  if (A.insp !== REST) return base.filter(({ p }) => firstHouse(p) === A.insp);
  // "other classics": not one of the houses that were listed when the question was asked
  const listed = new Set(topHouses(pool({ ...A, insp: "", budget: "", size: "" })));
  return base.filter(({ p }) => !(firstHouse(p) && listed.has(firstHouse(p))));
}

export function rank(A) {
  const premium = !!A.budget && BANDS[A.budget][0] >= 6000;
  return pool(A).sort((a, b) => (premium ? b.v.pr - a.v.pr : a.v.pr - b.v.pr) || a.order - b.order);
}

export function summary(A) {
  const label = (k, v) => v === REST ? REST_LABEL[k]
    : k === "gender" ? GENDER_LABEL[v] : k === "style" ? STYLE_LABEL[v] : k === "origin" ? ORIGIN_LABEL[v]
    : k === "size" ? SIZE_LABEL[v] : k === "budget" ? bandQuizLabel(v) : k === "insp" ? `Inspired by ${v}` : v;
  return STEPS.filter((k) => A[k]).map((k) => label(k, A[k]));
}

/** Visible options (value + count) for a step, given the answers to the steps before it. Counts add up to pool(before). */
export function options(step, before) {
  const key = STEPS[step], items = pool(before);
  let list;
  if (key === "insp") {
    if (before.origin !== "inspired") return [];
    const houses = topHouses(items), by = countBy(items, (x) => firstHouse(x.p));
    list = houses.map((h) => [h, by.get(h)]);
    list.push([REST, items.length - list.reduce((s, [, n]) => s + n, 0)]);
  } else {
    const by = countBy(items, (x) => bucket(key, x.p));
    const wanted = { gender: ["Men", "Women", "Unisex"], style: ["designer", "luxury", "arabian"], family: FAMILIES, origin: ["own", "inspired"], budget: Object.keys(BANDS), size: ["Retail", "Tester", "Minis"] }[key];
    list = [...wanted, ...(["gender", "style", "family", "size"].includes(key) ? [REST] : [])].map((v) => [v, by.get(v) || 0]);
  }
  return list.filter(([, n]) => n > 0).map(([v, n]) => ({ v, n }));
}

/** Picks by position from a list of numbers: choice % (options + 1); the last slot means "skip". */
export const randomChooser = (choices) => { let i = 0; return (key, opts) => { const pick = choices[i++ % choices.length] % (opts.length + 1); return pick === opts.length ? "" : opts[pick].v; }; };
/** Picks the wanted answer for each question when it is on offer, otherwise skips. */
export const answerChooser = (want) => (key, opts) => (opts.some((o) => o.v === want[key]) ? want[key] : "");

/**
 * Simulate a visitor who works through the quiz forward only. `choose(key, options)` returns the
 * value to answer with, or "" to skip. Questions with fewer than two options are never asked.
 */
export function simulate(choose) {
  const A = blank(), asked = [];
  for (let step = 0; step < STEPS.length; step++) {
    const before = Object.fromEntries(STEPS.map((k, j) => [k, j < step ? A[k] : ""]));
    const opts = options(step, before);
    if (opts.length < 2) { A[STEPS[step]] = ""; continue; }
    asked.push({ key: STEPS[step], counter: pool(before).length, opts });
    A[STEPS[step]] = choose(STEPS[step], opts);
  }
  const ranked = rank(A);
  const cards = ranked.map((r) => ({ slug: r.p.s, price: fmtPrice(r.v.pr), spec: detail(r.v) }));
  return { answers: A, asked, ranked, cards, sequence: cards.map((c) => "C:" + c.slug), summary: summary(A), total: ranked.length };
}

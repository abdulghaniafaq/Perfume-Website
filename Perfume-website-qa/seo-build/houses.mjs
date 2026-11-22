// Facts about houses and perfumes that both the A-Z list (perfumes.html) and the individual perfume pages need, in one place.
import { PRODUCTS } from "../lib/data.mjs";
import { segmentOf, fmtPrice } from "../lib/oracle.mjs";
import { esc } from "./shared.mjs";

export const STYLE = { designer: "Designer", luxury: "Luxury & niche", arabian: "Middle Eastern", "": "" };
export const FOR = { Men: "for men", Women: "for women", Unisex: "unisex", "": "" };
export const slug = (s) => s.toLowerCase().replace(/&/g, " and ").normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
/** a remark in the data that a reader should see (some remarks are stray dates, which the catalogue hides too) */
export const note = (r) => (r && !/^\d{4}-\d{2}-\d{2}/.test(r) ? r : "");
/** "100ml Retail" */
export const variantName = (v) => [v.m, v.p].filter(Boolean).join(" ");
export const variantText = (v) => `${variantName(v)} ${fmtPrice(v.pr)}${note(v.r) ? ` (${note(v.r)})` : ""}`;
/** the address of a perfume's own page (in the site's main folder, so the shared scripts' relative paths keep working) */
export const productFile = (p) => `perfume-${p.s}.html`;

/** the houses A to Z, each with its perfumes and the id of its section on perfumes.html */
export function houseList() {
  const by = new Map();
  for (const p of PRODUCTS) { if (!by.has(p.b)) by.set(p.b, []); by.get(p.b).push(p); }
  const names = [...by.keys()].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  const seen = new Set();
  return names.map((name) => { let id = `house-${slug(name)}`; while (seen.has(id)) id += "-2"; seen.add(id); return { name, id, style: STYLE[segmentOf(name)], products: by.get(name) }; });
}
export const HOUSES = houseList();
export const houseOf = (p) => HOUSES.find((h) => h.name === p.b);

/** one line of the A-Z list: the perfume's name as a link to its own page, then its facts, sizes and prices */
export const productLine = (p) => {
  const facts = [p.fm, FOR[p.gd]].filter(Boolean).join(", ");
  return `<a class="pl" href="${productFile(p)}" aria-label="${esc(p.n)} by ${esc(p.b)}">${esc(p.n)}</a> <span class="pd">${facts ? `— ${esc(facts)}. ` : "— "}${p.v.map((v) => esc(variantText(v))).join("; ")}.${p.i ? ` Inspired by ${esc(p.i)}.` : ""}</span>`;
};

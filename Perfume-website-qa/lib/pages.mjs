// The pages of the site, in one place: the nine pages and the four guides. Site-wide tests loop over these.
export const GUIDE_FILES = [
  "guide-spot-genuine-perfume.html",
  "guide-perfume-for-every-season.html",
  "guide-retail-tester-decant-discovery-set.html",
  "guide-perfume-testers-explained.html",
];
/** Google Search Console's ownership-check file (google + 16 hex characters + .html): it must sit in the site folder, and it is not a page */
export const isGoogleVerification = (f) => /^google[0-9a-f]{16}\.html$/.test(f);
/** an .html file in the site folder that is a real page */
export const isSitePage = (f) => f.endsWith(".html") && !isGoogleVerification(f) && !/^perfume-[a-z0-9-]+\.html$/.test(f);
export const PAGE_FILES = ["index.html", "catalogue.html", "perfumes.html", "guides.html", "how-to-order.html", "guarantee.html", "faq.html", "contact.html", "privacy.html", "terms.html", ...GUIDE_FILES];

/** the 627 perfume pages are generated from the product data; these are the files and a hand-picked sample used by the heavy suites */
import { PRODUCTS } from "./data.mjs";
export const productFile = (p) => `perfume-${p.s}.html`;
export const PRODUCT_FILES = PRODUCTS.map(productFile);
export const isProductPage = (f) => /^perfume-[a-z0-9-]+\.html$/.test(f);
const count = (p) => p.v.length;
const first = (pred) => PRODUCTS.find(pred);
/** a sample that covers every kind of page: each scent family, strengths, no family, no strength, many sizes, minis only, sets, testers with a remark, a market price, the longest name */
export const PRODUCT_SAMPLE_SLUGS = [...new Set([
  "lattafa-khamrah", "chanel-bleu-de-chanel-edp", "afnan-highness-v", "tom-ford-neroli-portofino-acqua-edt", "gucci-flora-gorgeous-magnolia-edp", "tom-ford-ombre-leather-parfum", "lattafa-the-kingdom-man", "lattafa-liam-grey",
  first((p) => p.fm === "Musk")?.s,
  first((p) => p.fm === "Fresh & Citrus" && p.v.length > 1)?.s,
  [...PRODUCTS].sort((a, b) => count(b) - count(a))[0].s,
  first((p) => p.v.every((v) => v.g === "Minis"))?.s,
  first((p) => p.v.some((v) => v.g === "Sets"))?.s,
  first((p) => p.v.some((v) => v.g === "Tester" && /No Box/.test(v.r)))?.s,
  first((p) => p.v.some((v) => v.mp > v.pr))?.s,
  first((p) => !p.fm && /\bEDP\b/.test(p.n))?.s,
  [...PRODUCTS].sort((a, b) => (b.b + b.n).length - (a.b + a.n).length)[0].s,
].filter(Boolean))];
export const PRODUCT_SAMPLE = PRODUCT_SAMPLE_SLUGS.map((s) => `perfume-${s}.html`);
/** every page the heavy suites visit: the 14 pages and the sample of perfume pages */
export const PAGE_FILES_PLUS = [...PAGE_FILES, ...PRODUCT_SAMPLE];

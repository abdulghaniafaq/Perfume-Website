// Builds one page per perfume (perfume-<slug>.html, 627 of them) into ../Perfume-website, from data/products-data.js.
// Every sentence on a page comes from a fact in the catalogue (name, house, scent family, who it is for, strength, sizes, prices, remarks,
// "inspired by"), from the guidance model (guidance.mjs: derived only from scent family and strength, and the page says so), or from the
// verified notes file (details/notes.json: only notes that two or more sources agree on). Nothing is guessed per perfume.
// Run:  node seo-build/products.mjs     (run it again whenever products or prices change; products.test.mjs fails if a page is out of date)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCTS, SITE, SITE_DIR } from "../lib/data.mjs";
import { fmtPrice, segmentOf } from "../lib/oracle.mjs";
import { shell, abs, esc, orgMin, orgRef, website, breadcrumb, webpage, faqNode, graph, plain } from "./shared.mjs";
import { HOUSES, houseOf, productFile, variantName, note, STYLE } from "./houses.mjs";
import { wearGuide, strengthOf, FAMILIES, SEASONS, article, FOR_TEXT, whenPhrase } from "./guidance.mjs";
import { MULT, STORES } from "../guides-build/helpers.mjs";
import { icon } from "../guides-build/art.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ALL_NOTES = JSON.parse(fs.readFileSync(path.join(here, "details/notes.json"), "utf8"));
/** only notes whose sources fully agree are shown; the rest stay in the file (as "medium") until they are checked against the brand's own page */
export const NOTES = Object.fromEntries(Object.entries(ALL_NOTES).filter(([, v]) => v.confidence === "high"));

const perMl = (v) => (v.mln > 0 ? Math.round(v.pr / v.mln) : 0);
const label = (v) => `${variantName(v)}${note(v.r) ? ` (${note(v.r)})` : ""}`;
/** the sizes cheapest first, the same order as the catalogue card */
const bySize = (p) => [...p.v].sort((a, b) => a.pr - b.pr);
const cheapest = (p) => p.v.reduce((a, b) => (b.pr < a.pr ? b : a));
const priciest = (p) => p.v.reduce((a, b) => (b.pr > a.pr ? b : a));
const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : xs[0] || "");
/** a tester's saving against the retail bottle of the same size, when both are listed */
const testerSaving = (p, v) => {
  if (v.g !== "Tester") return null;
  const r = p.v.find((x) => x.g === "Retail" && x.mln === v.mln && x.pr > 0);
  return r ? { r, diff: r.pr - v.pr, pct: Math.round((1 - v.pr / r.pr) * 100) } : null;
};
/** what the buyer actually receives, in words (the same wording as the cart's "What you'll get" note) */
function whatYouGet(v) {
  if (v.g === "Tester") return "A tester: the same fragrance supplied for sampling, in plain packaging, usually a simple carton or no box at all, and sometimes without a cap. A note beside the size, such as “No Box”, tells you what is missing.";
  if (v.g !== "Minis") return "";
  const small = v.m ? `${v.m.replace(/\s+/g, "")} ` : "", tail = "It is not the full-size bottle shown in the photo.";
  if (/dab/i.test(v.p)) return `A small ${small}dab-on bottle: there is no spray, you dab the scent on. ${tail}`;
  if (/spray/i.test(v.p)) return `A small ${small}travel spray of this fragrance. ${tail}`;
  if (/vial/i.test(v.p)) return `A tiny ${small}sample vial, enough to try the scent. ${tail}`;
  if (/roller/i.test(v.p)) return `A small ${small}roller-ball bottle that you roll on. ${tail}`;
  return "A small-size pack, not the full-size bottle shown in the photo.";
}

/* ---------------------------------------------------------------- the words */
const fullName = (p) => `${p.b} ${p.n}`;
function intro(p) {            // "Lattafa Khamrah is a Gourmand perfume for men and women."
  const fam = p.fm ? `${article(p.fm)} ${p.fm} perfume` : "a perfume";
  const forWhom = p.gd ? ` for ${FOR_TEXT[p.gd]}` : "";
  return p.fm || p.gd ? `${fullName(p)} is ${fam}${forWhom}.` : `${fullName(p)} is a perfume from ${p.b}.`;
}
function overview(p) {         // the paragraphs under "About", every sentence a fact
  const st = strengthOf(p.n), style = STYLE[segmentOf(p.b)], lo = cheapest(p), n = p.v.length, out = [];
  out.push(`${intro(p)}${style ? ` ${p.b} is one of our ${style} houses.` : ""}${st ? ` It is ${st.plain}.` : ""}`);
  out.push(`We stock it in ${n} ${n > 1 ? "sizes and packagings" : "size"}: ${list(bySize(p).map(label))}. The lowest price is ${fmtPrice(lo.pr)} (${variantName(lo)}).${testerLine(p)}`);
  if (p.i) out.push(`In our catalogue it is listed as inspired by ${p.i}. That means it shares a scent profile with that fragrance, which is named for reference only. It is an original creation of ${p.b}, not a copy or repackaging of it.`);
  return out;
}
function testerLine(p) {
  const s = p.v.map((v) => [v, testerSaving(p, v)]).find(([, x]) => x);
  return s ? ` The tester is ${fmtPrice(s[1].diff)} (${s[1].pct}%) less than the retail ${variantName(s[1].r)}.` : "";
}
function quickAnswer(p) {   // (the price is not repeated here: the sizes list, the first question and the About section carry it)
  return `${intro(p)} Order it on WhatsApp: every bottle is genuine, or we refund ${MULT} what you paid.`;
}
const titleOf = (p) => { const b = fullName(p); for (const t of [`${b}: price in India and sizes`, `${b}: price in India`, b]) if (t.length + 24 <= 74) return t; return b; };
function descOf(p) {
  const head = `${fullName(p)}${p.fm ? ` (${p.fm})` : ""}: `, tail = " Genuine, ordered on WhatsApp, shipped across India.";
  let parts = p.v.map((v) => `${variantName(v)} ${fmtPrice(v.pr)}`);
  while (parts.length > 1 && (head + parts.join(", ") + "." + tail).length > 158) parts.pop();
  return head + parts.join(", ") + "." + tail;
}

/* ---------------------------------------------------------------- the blocks */
const sizeRow = (p, v) => {
  const key = [p.s, v.m, v.p, v.r].join("|"), lab = label(v), save = testerSaving(p, v), ml = perMl(v), what = whatYouGet(v);
  return `<li class="size" data-key="${esc(key)}">
            <div class="size-info">
              <p class="size-name">${esc(lab)}</p>${ml ? `\n              <p class="size-meta">${fmtPrice(ml)} per ml</p>` : ""}${save ? `\n              <p class="size-save">${fmtPrice(save.diff)} (${save.pct}%) less than the retail ${esc(variantName(save.r))}</p>` : ""}${what ? `\n              <p class="size-what">${esc(what)}</p>` : ""}
            </div>
            <p class="size-price">${v.mp > v.pr ? `<s><span class="sr-only">Market price </span>${fmtPrice(v.mp)}</s> ` : ""}<span class="sr-only">Our price </span>${fmtPrice(v.pr)}</p>
            <div class="size-acts"><button type="button" class="p-add" aria-label="Add ${esc(fullName(p))}, ${esc(lab)}, to cart">Add</button><a class="btn btn-gold p-order" href="contact.html" data-wa-open="${esc(`Hi! I'd like to order ${fullName(p)} (${lab}). Is this available?`)}">Order on WhatsApp<span class="sr-only"> for ${esc(fullName(p))}, ${esc(lab)}</span></a></div>
          </li>`;
};
const FIT = { best: "Best", ok: "Good", less: "Less ideal", neutral: "Fine" };
function wearSection(p) {
  const g = wearGuide(p), lines = [];
  if (!g) {
    return `<section class="p-sec" id="wear" aria-labelledby="wear-h">
          <h2 id="wear-h">When to wear it</h2>
          <p>We haven't tagged ${esc(p.n)}'s scent family yet, and its name doesn't state a strength, so we can't give season or time advice from our data. Tell us the weather and the occasion and we'll suggest what suits, or <a href="guide-perfume-for-every-season.html">read the seasons guide</a> to see how scent families behave through the year.</p>
          <p class="cta-note"><a class="btn btn-ghost" href="catalogue.html?quiz=1">Take the 1-minute scent quiz</a></p>
        </section>`;
  }
  const neutral = SEASONS.every((s) => g.fit[s] === "neutral");
  const strip = neutral ? `<p>An eau de parfum is a versatile middle strength: it suits most weather.</p>`
    : `<ul class="seasons" aria-label="How well it suits each season">${SEASONS.map((s) => `<li class="s-${g.fit[s]}">${icon(s.toLowerCase(), 34)}<span class="s-name">${s}</span><span class="s-fit">${FIT[g.fit[s]]}</span></li>`).join("")}</ul>`;
  const chips = (xs) => `<ul class="chips">${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  const rows = [g.times.length && ["Best times", chips(g.times)], g.occasions.length && ["Good for", chips(g.occasions)], g.tip && ["Tip", esc(g.tip)]].filter(Boolean);
  return `<section class="p-sec" id="wear" aria-labelledby="wear-h">
          <h2 id="wear-h">When to wear it</h2>
          ${strip}${rows.length ? `\n          <dl class="wear">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>` : ""}
          <p class="fine">${esc(g.why.join(" "))} This guidance is based on ${esc(g.basis.join(" and "))}. It is general advice about this kind of perfume, not a test of this exact bottle. <a href="guide-perfume-for-every-season.html">Read the seasons guide</a>.</p>
        </section>`;
}
function notesSection(p) {
  const n = NOTES[p.s]?.notes, fam = FAMILIES[p.fm];
  const pyramid = n && (n.top || n.heart || n.base) ? [["Top", n.top], ["Heart", n.heart], ["Base", n.base]].filter(([, v]) => v?.length) : null;
  let body;
  if (n && (pyramid || n.all)) {
    const srcs = [...new Set((NOTES[p.s].sources || []).map((u) => new URL(u).hostname.replace(/^www\./, "")))];
    body = `${pyramid ? `<dl class="notes">${pyramid.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v.join(", "))}</dd></div>`).join("")}</dl>` : `<p class="notes-all">${esc(n.all.join(", "))}.</p>`}
          <p class="fine">Notes as published by ${esc(list(srcs) || "the house and fragrance databases")}, checked against more than one source. This is not a full ingredient list, and notes can differ between sources and batches. If you need to avoid a particular ingredient, check the box or ask us first.</p>`;
  } else if (fam) {
    body = `<p>We haven't listed the exact notes of ${esc(p.n)} yet. Perfumes in the ${esc(p.fm)} family typically feature ${esc(fam.typical)}. That describes the family, not this perfume's exact notes. Message us if a particular note matters to you, for example because of an allergy, and we'll tell you what we know.</p>`;
  } else {
    body = `<p>We haven't listed the notes of ${esc(p.n)} yet. If a particular note matters to you, for example because of an allergy, message us and we'll tell you what we know.</p>`;
  }
  return `<section class="p-sec" id="notes" aria-labelledby="notes-h">
          <h2 id="notes-h">Notes</h2>
          ${body}
        </section>`;
}
/* ---------------------------------------------------------------- where the perfume sits in the range (derived only from the catalogue's own prices and names) */
/** the lowest price for a full-size bottle: 30ml or more, testers included (null when a perfume is only listed in minis, vials or sets, which cannot be compared with bottles) */
const FULL_ML = 30;
const fullStart = (q) => { const xs = q.v.filter((v) => parseFloat(v.m) >= FULL_ML).map((v) => v.pr); return xs.length ? Math.min(...xs) : null; };
const FULL = new Map(PRODUCTS.map((q) => [q.s, fullStart(q)]));
const median = (xs) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const STOP = new Set(["the", "eau", "le", "la", "l", "d", "pour", "de", "du", "for", "by", "of", "and", "new", "un", "une", "des"]);
/** the word that names a perfume's line within its house: "212" for 212 VIP Rose, "bleu" for Bleu De Chanel EDP, "eros" for Eros Parfum */
const lineKey = (q) => q.n.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/['’]/g, " ").replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean).find((w) => !STOP.has(w)) || "";
const BY_SEGMENT = new Map();
for (const q of PRODUCTS) { const k = segmentOf(q.b); if (!BY_SEGMENT.has(k)) BY_SEGMENT.set(k, []); BY_SEGMENT.get(k).push(q); }
/** one line of a list of related perfumes: its name as a link, then what it costs compared with this page's perfume */
const peerLink = (q, p, withHouse) => {
  const a = FULL.get(q.s), b = FULL.get(p.s), c = cheapest(q);
  const what = a != null && b != null
    ? `full size from ${fmtPrice(a)} (${a === b ? `the same price as ${esc(p.n)}` : `${fmtPrice(Math.abs(a - b))} ${a > b ? "more" : "less"} than ${esc(p.n)}`})`
    : `from ${esc(variantName(c))} ${fmtPrice(c.pr)}`;
  return `<li><a href="${productFile(q)}">${esc(withHouse ? fullName(q) : q.n)}</a><span>${what}</span></li>`;
};
function rangeSection(p) {
  const h = houseOf(p), lo = FULL.get(p.s), style = STYLE[segmentOf(p.b)], rows = [];
  if (lo != null) {
    const mates = h.products.filter((q) => FULL.get(q.s) != null);
    if (mates.length >= 3) {
      const prices = mates.map((q) => FULL.get(q.s)), rank = 1 + prices.filter((x) => x < lo).length;
      rows.push([`In the ${esc(p.b)} range`, `<p>The lowest full-size price of ${esc(p.n)} (a bottle of ${FULL_ML}ml or more, testers included) is ${fmtPrice(lo)}. That is number ${rank} of the ${mates.length} ${esc(p.b)} perfumes we list in full size, counting from the cheapest. The house runs from ${fmtPrice(Math.min(...prices))} to ${fmtPrice(Math.max(...prices))}, with a middle price of ${fmtPrice(median(prices))}.</p>`]);
    }
    const seg = (BY_SEGMENT.get(segmentOf(p.b)) || []).filter((q) => FULL.get(q.s) != null);
    if (style && seg.length >= 10) {
      const prices = seg.map((q) => FULL.get(q.s)), others = seg.length - 1;
      const below = Math.round((100 * prices.filter((x) => x < lo).length) / others), above = Math.round((100 * prices.filter((x) => x > lo).length) / others);
      rows.push([`Among ${esc(style)} perfumes`, `<p>Among the ${seg.length} ${esc(style)} perfumes we list in full size, that price is higher than ${below}% of them and lower than ${above}% (the middle full-size price is ${fmtPrice(median(prices))}).</p>`]);
    }
  }
  const line = h.products.filter((q) => q !== p && lineKey(q) && lineKey(q) === lineKey(p)).sort((a, b) => a.n.localeCompare(b.n));
  if (line.length) rows.push([`Other versions in this line`, `<ul class="line">${line.slice(0, 6).map((q) => peerLink(q, p, false)).join("")}</ul>${line.length > 6 ? `<p>and ${line.length - 6} more: <a href="perfumes.html#${h.id}">see all ${esc(p.b)} perfumes</a>.</p>` : ""}`]);
  const key = (q) => q.i.trim().toLowerCase();
  const same = p.i ? PRODUCTS.filter((q) => q !== p && q.i && key(q) === key(p) && !line.includes(q)).sort((a, b) => a.s.localeCompare(b.s)) : [];
  if (same.length) rows.push([`Also inspired by ${esc(p.i)}`, `<ul class="line">${same.slice(0, 5).map((q) => peerLink(q, p, true)).join("")}</ul>${same.length > 5 ? `<p>and ${same.length - 5} more in the <a href="catalogue.html?q=${encodeURIComponent(p.i)}">catalogue</a>.</p>` : ""}`]);
  if (!rows.length) return "";
  return `<section class="p-sec" id="range" aria-labelledby="range-h">
          <h2 id="range-h">Where it sits in our range</h2>
          <dl class="pf">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
        </section>`;
}
function glance(p) {
  const st = strengthOf(p.n), h = houseOf(p), style = STYLE[segmentOf(p.b)];
  const rows = [
    ["House", `<a href="perfumes.html#${h.id}">${esc(p.b)}</a>`],
    style && ["Style", esc(style)],
    ["Scent family", p.fm ? `<a href="catalogue.html?fm=${encodeURIComponent(p.fm)}">${esc(p.fm)}</a>` : "Not tagged yet"],
    ["For", p.gd ? esc(p.gd === "Unisex" ? "Men and women (unisex)" : p.gd === "Men" ? "Men" : "Women") : "Not specified"],
    ["Strength", st ? esc(st.label) : "Not stated in the name"],
    ["Sizes and packagings", String(p.v.length)],
    p.i && ["Listed as inspired by", esc(p.i)],
  ].filter(Boolean);
  return `<section class="p-sec" id="glance" aria-labelledby="glance-h">
          <h2 id="glance-h">At a glance</h2>
          <dl class="pf">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
        </section>`;
}
/** other perfumes to look at: the same house, and similar ones from other houses. "Similar" starts with the closest match (the same scent family, or with no family the same style and strength) and is topped up from wider and wider groups, so every page offers six onward links. Chosen by position, so every page gets different neighbours. */
function neighbours(p) {
  const rotate = (xs) => { const rest = xs.filter((x) => x.s !== p.s); const start = rest.filter((x) => x.s.localeCompare(p.s) < 0).length; return [...rest.slice(start), ...rest.slice(0, start)]; };
  const sameHouse = rotate(houseOf(p).products).slice(0, 6);
  const st = strengthOf(p.n), seg = segmentOf(p.b);
  const others = PRODUCTS.filter((x) => x.b !== p.b).sort((a, b) => a.s.localeCompare(b.s));
  const tiers = [
    p.fm ? others.filter((x) => x.fm === p.fm) : others.filter((x) => !x.fm && segmentOf(x.b) === seg && (strengthOf(x.n)?.label || "") === (st?.label || "")),
    others.filter((x) => segmentOf(x.b) === seg && (!p.gd || x.gd === p.gd) && (strengthOf(x.n)?.label || "") === (st?.label || "")),
    others.filter((x) => segmentOf(x.b) === seg),
    others,
  ];
  const similar = [], seen = new Set();
  for (const tier of tiers) {
    for (const x of rotate(tier)) { if (similar.length >= 6) break; if (!seen.has(x.s)) { seen.add(x.s); similar.push(x); } }
    if (similar.length >= 6) break;
  }
  return { sameHouse, similar, similarAllFamily: !!p.fm && similar.every((x) => x.fm === p.fm) };
}
const tile = (q) => `<li><a class="rel-tile" href="${productFile(q)}"><span class="rel-img"><img src="assets/images/thumbs/${q.s}.jpg" alt="" width="240" height="240" loading="lazy" decoding="async"></span><span class="rel-text"><span class="rel-house">${esc(q.b)}</span><span class="rel-name">${esc(q.n)}</span><span class="rel-from">From ${fmtPrice(cheapest(q).pr)}</span></span></a></li>`;
function faq(p) {
  const lo = cheapest(p), g = wearGuide(p);
  const prices = bySize(p).map((v) => `${label(v)} ${fmtPrice(v.pr)}`).join(", ");
  const items = [
    [`How much does ${fullName(p)} cost in India?`, `${p.n} costs from ${fmtPrice(lo.pr)} (${variantName(lo)}). Our prices: ${prices}. Prices are in INR and were last updated <span data-updated>${esc(SITE.pricesUpdated)}</span>; we confirm availability and the final total on WhatsApp before you pay.`],
    [`Is ${fullName(p)} genuine?`, `Every fragrance we list is officially sourced and 100% authentic. If a reputed store (${STORES}) confirms in writing that an item is not genuine, we refund ${MULT} what you paid for it, if you claim within <span data-claim-days>${SITE.guarantee.claimDays}</span> days of delivery.${p.v.some((v) => v.g === "Tester") ? " Testers, minis and vials are as described beside each size." : ""}`],
  ];
  if (g && g.best.length) items.push([`When is ${p.n} best worn?`, `Going by ${g.basis.join(" and ")}, ${p.n} suits ${list(g.best)} best${g.times.length ? `, and it works best ${list(g.times.map(whenPhrase))}` : ""}. This is general advice about this kind of perfume, not a test of this exact bottle.`]);
  else items.push([`What sizes does ${p.n} come in?`, `We have ${p.v.length} ${p.v.length > 1 ? "sizes and packagings" : "size"}: ${list(bySize(p).map((v) => `${label(v)} at ${fmtPrice(v.pr)}`))}. Tell us what you need it for and we'll suggest the best way to buy it.`]);
  return items;
}

/* ---------------------------------------------------------------- one page */
function page(p) {
  const file = productFile(p), h = houseOf(p), url = abs(file), photo = `assets/images/${p.s}.jpg`;
  const title = titleOf(p), desc = descOf(p), qa = faq(p), nb = neighbours(p), st = strengthOf(p.n), style = STYLE[segmentOf(p.b)];
  const tags = [p.fm, p.gd && (p.gd === "Unisex" ? "Unisex" : p.gd === "Men" ? "For men" : "For women"), st?.label, style].filter(Boolean);
  const hasOther = p.v.some((v) => v.g === "Tester" || v.g === "Minis");
  const lo = cheapest(p), hi = priciest(p), ov = overview(p);
  const main = `
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="index.html">Home</a></li><li><a href="perfumes.html">All perfumes</a></li><li><a href="perfumes.html#${h.id}">${esc(p.b)}</a></li><li aria-current="page">${esc(p.n)}</li></ol></nav>
    </div>

    <article class="product">
      <div class="wrap p-grid">
        <div class="p-media">
          <figure class="p-photo">
            <img src="${photo}" alt="${esc(fullName(p))} bottle" width="800" height="800" decoding="async" fetchpriority="high">${hasOther ? `\n            <figcaption>The photo shows the full-size bottle. Testers, minis and vials arrive as described beside each size.</figcaption>` : ""}
          </figure>
        </div>
        <div class="p-main">
          <p class="eyebrow">${esc(p.b)}${style ? ` · ${esc(style)}` : ""}</p>
          <h1>${esc(fullName(p))}</h1>${tags.length ? `\n          <ul class="p-tags" aria-label="About this perfume">${tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
          <div class="quick"><p class="quick-title">Quick answer</p><p>${quickAnswer(p)}</p></div>
          <section class="p-sec" id="sizes" aria-labelledby="sizes-h">
            <h2 id="sizes-h">Sizes and prices</h2>
            <ul class="sizes">
          ${bySize(p).map((v) => sizeRow(p, v)).join("\n          ")}
            </ul>
            <p class="fine">Prices are in INR and were last updated <span data-updated>${esc(SITE.pricesUpdated)}</span>. We confirm availability and the final total with you on WhatsApp before you pay. <a href="how-to-order.html">How ordering works</a>.</p>
          </section>
        </div>
      </div>

      <div class="wrap narrow p-body">
        <section class="p-sec" id="about" aria-labelledby="about-h">
          <h2 id="about-h">About ${esc(p.n)}</h2>
          ${ov.map((t) => `<p>${esc(t)}</p>`).join("\n          ")}
        </section>
        ${glance(p)}
        ${wearSection(p)}
        ${notesSection(p)}
        ${rangeSection(p)}
        <section class="p-sec" id="questions" aria-labelledby="questions-h">
          <h2 id="questions-h">Common questions</h2>
          ${qa.map(([q, a]) => `<h3>${esc(q)}</h3>\n          <p>${a}</p>`).join("\n          ")}
        </section>
      </div>
    </article>

    <section class="section section-alt" aria-labelledby="${nb.sameHouse.length ? "more-h" : "similar-h"}">
      <div class="wrap">${nb.sameHouse.length ? `
        <h2 id="more-h" class="related-title">More from ${esc(p.b)}</h2>
        <ul class="rel">${nb.sameHouse.map(tile).join("")}</ul>
        <p class="more-link"><a href="perfumes.html#${h.id}">See all ${h.products.length} ${esc(p.b)} perfumes</a></p>` : ""}
        <h2 id="similar-h" class="related-title">${nb.similarAllFamily ? `More ${esc(p.fm)} perfumes` : "Similar perfumes"}</h2>
        <ul class="rel">${nb.similar.map(tile).join("")}</ul>${nb.similarAllFamily ? `\n        <p class="more-link"><a href="catalogue.html?fm=${encodeURIComponent(p.fm)}">Browse all ${esc(p.fm)} perfumes</a></p>` : `\n        <p class="more-link"><a href="perfumes.html">Browse all perfumes A to Z</a></p>`}
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="cta-band">
          <h2>Questions about ${esc(p.n)}?</h2>
          <p>Ask us about sizes, what is in the box, or whether it suits what you like. We're happy to help.</p>
          <div class="cta-row"><a class="btn btn-gold" data-wa="${esc(`Hi! I have a question about ${fullName(p)}.`)}" href="contact.html">Message us on WhatsApp</a><a class="btn btn-ghost" href="catalogue.html">Browse the catalogue</a></div>
        </div>
      </div>
    </section>`;
  const gender = { Men: "male", Women: "female", Unisex: "unisex" }[p.gd];
  const ns = NOTES[p.s]?.notes;
  const jsonld = graph([
    orgMin(), website(),
    webpage({ file, type: "ItemPage", name: `${title} — Perfume X Collections`, description: desc, extra: { mainEntity: { "@id": `${url}#product` }, primaryImageOfPage: { "@type": "ImageObject", url: abs(photo) } } }),
    breadcrumb(file, [["Home", abs("")], ["All perfumes", abs("perfumes.html")], [p.b, `${abs("perfumes.html")}#${h.id}`], [p.n, url]]),
    {
      "@type": "Product", "@id": `${url}#product`, name: fullName(p), description: plain(quickAnswer(p)), image: [abs(photo)], sku: p.s, url,
      brand: { "@type": "Brand", name: p.b }, ...(p.fm ? { category: p.fm } : {}),
      ...(gender ? { audience: { "@type": "PeopleAudience", suggestedGender: gender } } : {}),
      additionalProperty: [p.fm && { "@type": "PropertyValue", name: "Scent family", value: p.fm }, st && { "@type": "PropertyValue", name: "Strength", value: st.label }, style && { "@type": "PropertyValue", name: "Style", value: style }, ns && (ns.top || ns.all) && { "@type": "PropertyValue", name: "Notes", value: [...(ns.top || []), ...(ns.heart || []), ...(ns.base || []), ...(ns.all || [])].join(", ") }].filter(Boolean),
      offers: { "@type": "AggregateOffer", priceCurrency: "INR", lowPrice: lo.pr, highPrice: hi.pr, offerCount: p.v.length, offers: bySize(p).map((v) => ({ "@type": "Offer", name: label(v), price: v.pr, priceCurrency: "INR", url: `${url}#sizes`, seller: orgRef })) },
    },
    faqNode(file, qa),
  ]);
  return shell({ file, title, desc, image: photo, imageW: 800, imageH: 800, twitterCard: "summary", imageAlt: `${fullName(p)} bottle`, type: "website", jsonld, css: ["product.css"], bodyClass: "product-page", main, scripts: ["assets/js/product.js"] });
}

/* ---------------------------------------------------------------- write them all (and remove pages of perfumes that no longer exist) */
const wanted = new Set(PRODUCTS.map(productFile));
let removed = 0;
for (const f of fs.readdirSync(SITE_DIR)) if (/^perfume-[a-z0-9-]+\.html$/.test(f) && !wanted.has(f)) { fs.unlinkSync(path.join(SITE_DIR, f)); removed++; }
let bytes = 0;
for (const p of PRODUCTS) { const html = page(p); bytes += Buffer.byteLength(html); fs.writeFileSync(path.join(SITE_DIR, productFile(p)), html); }
const withNotes = PRODUCTS.filter((p) => NOTES[p.s]?.notes).length;
console.log(`${PRODUCTS.length} perfume pages written (${(bytes / PRODUCTS.length / 1024).toFixed(1)} KB each on average, ${(bytes / 1048576).toFixed(1)} MB in all), ${removed} stale removed; exact notes on ${withNotes}`);

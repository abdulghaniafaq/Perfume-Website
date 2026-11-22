// Builds guides.html and the four guide pages into ../Perfume-website, using the shared page shell (seo-build/shared.mjs).
// Run:  node guides-build/build.mjs
import fs from "node:fs";
import path from "node:path";
import { GUIDES, INDEX, SITE_URL, PUBLISHED, MODIFIED } from "./meta.mjs";
import { BODIES } from "./content.mjs";
import { SITE_DIR, esc } from "./helpers.mjs";
import { shell, abs, orgMin, orgRef, website, breadcrumb, webpage, faqNode, graph, plain } from "../seo-build/shared.mjs";

/** words in a block of HTML, and the reading time in whole minutes (200 words a minute, never less than 1) */
const words = (html) => html.replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").split(/\s+/).filter(Boolean).length;
const minutes = (html) => Math.max(1, Math.round(words(html) / 200));

const KEYWORDS = {
  spot: "how to spot fake perfume, genuine perfume check, perfume batch code, counterfeit perfume India, original perfume",
  seasons: "best perfume for summer, perfume for monsoon, perfume for winter, perfume by season India, eau de toilette vs eau de parfum",
  formats: "tester vs retail perfume, perfume decant, discovery set, perfume vial, price per ml perfume",
  testers: "perfume tester, are perfume testers genuine, why are testers cheaper, tester perfume India, perfume tester legal",
};
const ABOUT = { spot: "Spotting counterfeit perfume", seasons: "Choosing a perfume for the season", formats: "Perfume formats: retail, tester, decant and discovery set", testers: "Perfume testers" };
const CITATIONS = { testers: ["https://www.humphreys.co.uk/articles/trademark-rights-are-not-exhausted-in-perfume-testers-european-court-decision", "https://legalblogs.wolterskluwer.com/trademark-blog/india-commercial-sale-of-perfume-testers-amounts-to-unfair-trade-practice-under-indian-trademark-law/"] };

/* one card on the Guides page (and the "keep reading" row): picture, small label, title, short description, Read more */
function card(g, level, mins) {
  const href = g.file, h = `h${level}`;
  return `<article class="g-card">
          <div class="g-img"><img src="assets/images/guides/${g.img}-card.jpg" alt="" width="640" height="336" loading="lazy" decoding="async"></div>
          <div class="g-body">
            <p class="g-meta">${esc(g.cat)} · ${mins} min read</p>
            <${h}><a class="g-title" href="${href}">${esc(g.cardTitle)}</a></${h}>
            <p class="g-blurb">${esc(g.blurb)}</p>
            <a class="g-more" href="${href}">Read more<span class="sr-only"> about ${esc(g.cardTitle)}</span> <span aria-hidden="true">→</span></a>
          </div>
        </article>`;
}

const cta = (c) => `
    <section class="section">
      <div class="wrap">
        <div class="cta-band">
          <h2>${esc(c.title)}</h2>
          <p>${esc(c.text)}</p>
          <div class="cta-row"><a class="btn btn-gold" data-wa="${esc(c.wa)}" href="contact.html">Message us on WhatsApp</a><a class="btn btn-ghost" href="catalogue.html">Browse the catalogue</a></div>
        </div>
      </div>
    </section>`;

/** the "Common questions" section, made from the same list that feeds the FAQPage data, so the two can never differ */
const faqSection = (b) => `
<section>
  <h2 id="faq">Common questions</h2>
  ${b.faq.map(([q, a]) => `<h3>${q}</h3>\n  <p>${a}</p>`).join("\n  ")}
  ${b.faqAfter || ""}
</section>`;

const bodyOf = (b) => b.html + "\n" + faqSection(b);
const mins = {};
for (const g of GUIDES) { const b = BODIES[g.id]; mins[g.id] = minutes(b.lead + bodyOf(b)); }

/* ---------- the four articles ---------- */
const out = {};
for (const g of GUIDES) {
  const b = BODIES[g.id];
  const others = GUIDES.filter((x) => x.id !== g.id);
  const image = `assets/images/guides/${g.img}-og.jpg`;
  const main = `
    <div class="wrap narrow">
      <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="index.html">Home</a></li><li><a href="guides.html">Guides</a></li><li aria-current="page">${esc(g.cardTitle)}</li></ol></nav>
    </div>

    <article class="guide">
      <header class="guide-head">
        <div class="wrap narrow">
          <p class="eyebrow">${esc(g.cat)} · Guide</p>
          <h1>${esc(g.title)}</h1>
          <p class="guide-meta"><span>${mins[g.id]} min read</span> <span>By Perfume X Collections</span> <span>Updated <time datetime="${MODIFIED}">November 2026</time></span></p>
          <div class="quick"><p class="quick-title">Quick answer</p><p>${b.quick}</p></div>
          <p class="guide-lead">${b.lead}</p>
          <figure class="guide-hero"><img src="assets/images/guides/${g.img}.jpg" alt="${esc(g.cover.head.join(" "))}: an illustration for this guide" width="1200" height="630" decoding="async"></figure>
          <nav class="toc" aria-label="In this guide"><p class="toc-title">In this guide</p><ol>${b.toc.map(([id, t]) => `<li><a href="#${id}">${esc(t)}</a></li>`).join("")}</ol></nav>
        </div>
      </header>

      <div class="section section-tight">
        <div class="wrap narrow">
          <div class="guide-body prose">${bodyOf(b)}
          </div>
        </div>
      </div>
    </article>

    <section class="section section-alt">
      <div class="wrap">
        <h2 class="related-title">Keep reading</h2>
        <div class="g-grid three">
        ${others.map((o) => card(o, 3, mins[o.id])).join("\n        ")}
        </div>
      </div>
    </section>
${cta(b.cta)}`;
  const metaTitle = g.metaTitle || g.title;                         // the browser-tab / search-result title can be shorter than the heading
  const fullTitle = `${metaTitle} — Perfume X Collections`;
  const wc = words(b.lead + bodyOf(b));
  const jsonld = graph([
    orgMin(), website(),
    webpage({ file: g.file, name: fullTitle, description: g.desc, extra: { mainEntity: { "@id": `${abs(g.file)}#article` } } }),
    {
      "@type": "Article", "@id": `${abs(g.file)}#article`, headline: g.title, description: g.desc, image: [abs(image)],
      datePublished: PUBLISHED, dateModified: MODIFIED, author: orgRef, publisher: orgRef, mainEntityOfPage: { "@id": `${abs(g.file)}#webpage` },
      inLanguage: "en-IN", articleSection: g.cat, wordCount: wc, timeRequired: `PT${mins[g.id]}M`, keywords: KEYWORDS[g.id],
      about: { "@type": "Thing", name: ABOUT[g.id] }, abstract: plain(b.quick), ...(CITATIONS[g.id] ? { citation: CITATIONS[g.id] } : {}),
    },
    breadcrumb(g.file, [["Home", abs("")], ["Guides", abs("guides.html")], [g.title, abs(g.file)]]),
    faqNode(g.file, b.faq),
  ]);
  out[g.file] = shell({ file: g.file, title: metaTitle, desc: g.desc, image, imageAlt: `${g.cover.head.join(" ")}: a guide from Perfume X Collections`, type: "article", jsonld, navCurrent: "guides.html", navMode: "true", bodyClass: "guide-page", css: ["guides.css"], main });
}

/* ---------- the Guides page ---------- */
{
  const image = "assets/images/guides/guide-spot-genuine-perfume-og.jpg";
  const main = `
    <section class="page-head">
      <div class="wrap">
        <p class="eyebrow">Guides</p>
        <h1>Perfume, explained</h1>
        <p class="section-sub">Short, honest guides to buying perfume with confidence: spotting a fake, choosing a scent for the weather, and knowing what you are paying for.</p>
      </div>
    </section>

    <section class="section section-tight">
      <div class="wrap">
        <div class="g-grid">
        ${GUIDES.map((g) => card(g, 2, mins[g.id])).join("\n        ")}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="cta-band">
          <h2>Ready to find yours?</h2>
          <p>Browse the catalogue, take the one-minute scent quiz, or message us with any question.</p>
          <div class="cta-row"><a class="btn btn-gold" href="catalogue.html">Browse the catalogue</a><a class="btn btn-ghost" data-wa="Hi! I have a question about your perfumes." href="contact.html">Message us on WhatsApp</a></div>
        </div>
      </div>
    </section>`;
  const jsonld = graph([
    orgMin(), website(),
    webpage({ file: INDEX.file, type: "CollectionPage", name: `${INDEX.title} — Perfume X Collections`, description: INDEX.desc, extra: { mainEntity: { "@id": `${abs(INDEX.file)}#guides` } } }),
    breadcrumb(INDEX.file, [["Home", abs("")], ["Guides", abs(INDEX.file)]]),
    { "@type": "ItemList", "@id": `${abs(INDEX.file)}#guides`, name: "Perfume guides", numberOfItems: GUIDES.length, itemListElement: GUIDES.map((g, i) => ({ "@type": "ListItem", position: i + 1, url: abs(g.file), name: g.title })) },
  ]);
  out[INDEX.file] = shell({ file: INDEX.file, title: INDEX.title, desc: INDEX.desc, image, imageAlt: "Perfume guides from Perfume X Collections", jsonld, navCurrent: "guides.html", navMode: "page", css: ["guides.css"], main });
}

for (const [f, html] of Object.entries(out)) fs.writeFileSync(path.join(SITE_DIR, f), html);
console.log(Object.entries(out).map(([f, h]) => `${f}  ${(h.length / 1024).toFixed(1)} KB`).join("\n"));
console.log("reading times:", mins);

// Shared by the page builders: the page shell (head, header, footer), and the structured data (JSON-LD) pieces.
// The same entity ids are used on every page so that search engines and AI assistants see ONE shop, not thirteen.
import { esc } from "../guides-build/helpers.mjs";
import { SITE_URL, MODIFIED } from "../guides-build/meta.mjs";

export { SITE_URL, MODIFIED, esc };
export const abs = (p) => SITE_URL + p;
/** a page's own address as it declares it (the home page is the root of the site, not /index.html) */
export const pageUrl = (file) => (file === "index.html" ? SITE_URL : abs(file));

export const NAV = [["catalogue.html", "Catalogue"], ["guides.html", "Guides"], ["how-to-order.html", "How to order"], ["guarantee.html", "Guarantee"], ["faq.html", "FAQ"], ["contact.html", "Contact"]];
export const FOOT = [["index.html", "Home"], ["catalogue.html", "Catalogue"], ["guides.html", "Guides"], ["perfumes.html", "All perfumes"], ["how-to-order.html", "How to order"], ["guarantee.html", "Guarantee"], ["faq.html", "FAQ"], ["contact.html", "Contact"], ["privacy.html", "Privacy Policy"], ["terms.html", "Terms of Service"]];
const MARK = `<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3l9 13-9 13-9-13z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M16 9l4.5 7-4.5 7-4.5-7z" fill="currentColor"/></svg>`;
const THEME_JS = `(function(){var d=document.documentElement,t;d.classList.add('js');try{t=localStorage.getItem('perfume-x-theme')}catch(e){}if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';d.dataset.theme=t;if(t==='light')document.querySelector('meta[name="theme-color"]').setAttribute('content','#fbf7ef')})();`;
const ICON = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230b0a09'/%3E%3Cpath d='M32 10l14 22-14 22L18 32z' fill='%23d4af6a'/%3E%3C/svg%3E`;

/** Search engines and AI answer engines are told they may show long snippets and large pictures (it only takes effect once the noindex header is removed) */
export const ROBOTS_META = "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";

/* ---------------------------------------------------------------- structured data */
const LOGO = abs("assets/images/apple-touch-icon.png"), OG = abs("assets/images/og-image.jpg");
export const ORG_ID = `${SITE_URL}#organization`, SITE_ID = `${SITE_URL}#website`;
export const orgRef = { "@id": ORG_ID };
/** the shop, in short (the home page carries the full description under the same id) */
export const orgMin = () => ({ "@type": "OnlineStore", "@id": ORG_ID, name: "Perfume X Collections", url: SITE_URL, logo: { "@type": "ImageObject", url: LOGO }, image: OG });
export const website = () => ({
  "@type": "WebSite", "@id": SITE_ID, name: "Perfume X Collections", url: SITE_URL, inLanguage: "en-IN", publisher: orgRef,
  potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}catalogue.html?q={search_term_string}` }, "query-input": "required name=search_term_string" },
});
export const breadcrumb = (file, trail) => ({ "@type": "BreadcrumbList", "@id": `${abs(file)}#breadcrumb`, itemListElement: trail.map(([name, url], i) => ({ "@type": "ListItem", position: i + 1, name, item: url })) });
export const webpage = ({ file, type = "WebPage", name, description, extra = {} }) => ({
  "@type": type, "@id": `${pageUrl(file)}#webpage`, url: pageUrl(file), name, description, inLanguage: "en-IN",
  isPartOf: { "@id": SITE_ID }, about: orgRef, publisher: orgRef, dateModified: MODIFIED, breadcrumb: { "@id": `${abs(file)}#breadcrumb` }, ...extra,
});
/** text of an answer as a person reads it (tags removed, entities decoded, one space between words) */
export const plain = (html) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
export const faqNode = (file, qa) => ({
  "@type": "FAQPage", "@id": `${abs(file)}#faq`, url: abs(file), isPartOf: { "@id": `${abs(file)}#webpage` }, inLanguage: "en-IN",
  mainEntity: qa.map(([q, a]) => ({ "@type": "Question", name: plain(q), acceptedAnswer: { "@type": "Answer", text: plain(a) } })),
});
export const graph = (nodes) => ({ "@context": "https://schema.org", "@graph": nodes });
/** JSON for a <script> tag: "<" is escaped so nothing in the data can end the tag early */
export const jsonScript = (g) => `<script type="application/ld+json" id="ld-graph">${JSON.stringify(g).replace(/</g, "\\u003c")}</script>`;

/* ---------------------------------------------------------------- page shell */
export function shell({ file, title, desc, image = "assets/images/og-image.jpg", imageW = 1200, imageH = 630, twitterCard = "summary_large_image", imageAlt = "Perfume X Collections: genuine designer, luxury and Middle-Eastern perfumes at insider prices", type = "website", jsonld, navCurrent, navMode = "page", bodyClass = "", css = [], scripts = [], main, fullTitle }) {
  const full = fullTitle || `${title} — Perfume X Collections`;
  const nav = NAV.map(([h, t]) => `<a href="${h}"${h === navCurrent ? ` aria-current="${navMode}"` : ""}>${t}</a>`).join("\n        ");
  const foot = FOOT.map(([h, t]) => `<a href="${h}">${t}</a>`).join("\n        ");
  const styles = ["site.css", ...css].map((c) => `<link rel="stylesheet" href="assets/css/${c}">`).join("\n  ");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(full)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="robots" content="${ROBOTS_META}">
  <meta name="theme-color" content="#0b0a09">
  <meta property="og:type" content="${type}">
  <meta property="og:site_name" content="Perfume X Collections">
  <meta property="og:title" content="${esc(full)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta name="twitter:card" content="${twitterCard}">
  <meta name="twitter:image" content="${abs(image)}">
  <meta property="og:url" content="${abs(file)}">
  <meta property="og:locale" content="en_IN">
  <meta property="og:image" content="${abs(image)}">
  <meta property="og:image:width" content="${imageW}">
  <meta property="og:image:height" content="${imageH}">
  <meta property="og:image:alt" content="${esc(imageAlt)}">
  <link rel="canonical" href="${abs(file)}">
  <link rel="apple-touch-icon" href="assets/images/apple-touch-icon.png">
  <link rel="icon" href="${ICON}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Jost:wght@400;500;600&display=swap" rel="stylesheet">
  ${styles}
  ${jsonScript(jsonld)}
  <script>${THEME_JS}</script>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ""}>
  <a class="skip" href="#main">Skip to content</a>

  <header class="site-header">
    <div class="wrap bar">
      <a class="brand" href="index.html">
        ${MARK}
        <span data-brand>Perfume X Collections</span>
      </a>

      <nav id="nav" class="nav" aria-label="Main">
        ${nav}
      </nav>

      <div class="bar-actions">
        <button class="theme-btn" id="theme-toggle" type="button" aria-label="Switch to light mode">
          <svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          <svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 14.4A8.4 8.4 0 0 1 9.6 3.8a8.4 8.4 0 1 0 10.6 10.6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
        </button>
        <button class="cart-btn" id="cart-open" type="button" aria-label="Open cart" aria-controls="cart" aria-expanded="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          <span class="cart-count" id="cart-count" hidden>0</span>
        </button>
        <button class="menu-btn" id="menu-btn" type="button" aria-label="Menu" aria-controls="nav" aria-expanded="false">
          <span></span><span></span>
        </button>
      </div>
    </div>
  </header>

  <main id="main">
${main}
  </main>

  <footer class="site-footer">
    <div class="wrap foot">
      <div>
        <a class="brand" href="index.html">
          ${MARK}
          <span data-brand>Perfume X Collections</span>
        </a>
        <p class="foot-tag">Genuine designer, luxury &amp; Middle-Eastern perfumes at insider prices.</p>
      </div>
      <nav class="foot-nav" aria-label="Footer">
        ${foot}
      </nav>
    </div>
    <div class="wrap legal">
      <p>Prices in INR and subject to availability · last updated <span data-updated>November 2026</span> · <a href="guarantee.html#terms">Authenticity guarantee &amp; terms</a></p>
      <p>© <span data-year>2026</span> <span data-brand>Perfume X Collections</span>. All brand names and trademarks belong to their respective owners. <span data-brand>Perfume X Collections</span> is an independent retailer and is not affiliated with or endorsed by any of the brands listed.</p>
    </div>
  </footer>

  <script src="data/site-config.js"></script>
  <script src="data/products-data.js"></script>
  <script src="assets/js/common.js"></script>${scripts.map((s) => `\n  <script src="${s}"></script>`).join("")}
</body>
</html>
`;
}

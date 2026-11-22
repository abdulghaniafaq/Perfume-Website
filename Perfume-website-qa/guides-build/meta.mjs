// What each guide is called, in one place. The page text lives in content.mjs; the images are made by covers.mjs.
export const SITE_URL = "https://perfume-x-collections.netlify.app/";
export const PUBLISHED = "2026-11-13";          // date the guides were written
export const MODIFIED = "2026-11-22";           // date the pages were last changed in a way a reader would notice: shown on the guides ("Updated"), in the structured data and in the sitemap. Change it whenever you change a page's text.

export const GUIDES = [
  {
    id: "spot",
    file: "guide-spot-genuine-perfume.html",
    img: "guide-spot-genuine-perfume",
    cat: "Authenticity",
    title: "How to tell genuine perfume from a fake",
    cardTitle: "How to tell a genuine perfume from a fake",
    desc: "A practical check you can do at home: price, seller, box, batch code, bottle, sprayer and liquid, and what a tester or mini should look like.",
    blurb: "Six quick checks (price, packaging, batch code, bottle, sprayer and liquid) that catch most fakes, and the things that look wrong but aren't.",
    cover: { head: ["Genuine or fake?", "The six-point check"], sub: "What to look at before you buy" },
  },
  {
    id: "seasons",
    file: "guide-perfume-for-every-season.html",
    img: "guide-perfume-for-every-season",
    cat: "Choosing a scent",
    title: "Which scent for which season",
    cardTitle: "Which scent profile suits which season",
    desc: "Match scent families to the weather: fresh citrus for summer, green and woody notes for the monsoon, warm amber for autumn, rich gourmand and oud for winter.",
    blurb: "Heat and cold change how a fragrance behaves. Here is what to wear in spring, summer, the monsoon, autumn and winter, with picks from our catalogue.",
    cover: { head: ["The right scent", "for every season"], sub: "Spring · Summer · Monsoon · Autumn · Winter" },
  },
  {
    id: "formats",
    file: "guide-retail-tester-decant-discovery-set.html",
    img: "guide-retail-tester-decant-discovery-set",
    cat: "Buying smart",
    title: "Retail, tester, decant or discovery set: which one is for you?",
    metaTitle: "Retail, tester, decant or discovery set: which one?",
    cardTitle: "Retail, tester, decant, discovery set: what's the difference?",
    desc: "Four ways to buy the same fragrance, explained: what you get, what you don't, how they differ in price per ml, and who each one suits.",
    blurb: "Same perfume, four ways to buy it. What comes in the box, what doesn't, how the price per ml changes, and which one suits you.",
    cover: { head: ["Retail, tester,", "decant or set?"], sub: "Same fragrance, different ways to buy" },
  },
  {
    id: "testers",
    file: "guide-perfume-testers-explained.html",
    img: "guide-perfume-testers-explained",
    cat: "Buying smart",
    title: "Perfume testers: why they cost less, and whether they're legit",
    metaTitle: "Perfume testers explained: are they legit?",
    cardTitle: "Perfume testers explained: why they're cheaper and whether they're legit",
    desc: "What a perfume tester is, why it costs less, why brands say it isn't for sale, how testers reach resellers, and an honest answer to \"is it legit?\"",
    blurb: "Genuine perfume in plain packaging. Why testers are cheaper, why brands say they aren't for sale, how they reach resellers, and the honest answer on legitimacy.",
    cover: { head: ["Perfume testers,", "explained"], sub: "Why they cost less and what to know" },
  },
];

export const INDEX = {
  file: "guides.html",
  title: "Perfume guides",
  desc: "Plain-spoken guides on spotting fake perfume, choosing a scent for the season, and understanding testers, decants and discovery sets.",
};

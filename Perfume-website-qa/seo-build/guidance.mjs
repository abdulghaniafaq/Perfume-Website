// The "when to wear it" guidance on each perfume page. It is NEVER a claim about one particular bottle: it follows from two facts the
// catalogue really holds (the scent family, and the strength shown in the name: EDT, EDP, Parfum...), using the same reasoning as the
// seasons guide: heat amplifies scent and cold mutes it; fresh and airy suits heat; warm, rich and sweet suits cool weather.
// A perfume with neither fact gets no season advice, only an invitation to ask. The page always says what the advice is based on.

export const SEASONS = ["Spring", "Summer", "Monsoon", "Autumn", "Winter"];

/** season fit per scent family (the same pairing as guide-perfume-for-every-season.html) */
export const FAMILIES = {
  "Fresh & Citrus": { best: ["Spring", "Summer", "Monsoon"], ok: ["Autumn"], less: ["Winter"], times: ["Morning", "Daytime", "Afternoon"], occasions: ["The office", "Casual days out", "Travel and sport"], typical: "citrus fruits such as lemon, bergamot or grapefruit, fresh herbs such as mint, and marine or aromatic accords", why: "Fresh citrus feels light in the heat, and heat makes scent travel, so it stays pleasant when it is warm or humid." },
  "Floral": { best: ["Spring", "Summer"], ok: ["Monsoon", "Autumn"], less: [], times: ["Daytime", "Afternoon", "Early evening"], occasions: ["Daytime events", "Dates and dinners", "Weddings and celebrations"], typical: "flowers such as rose, jasmine, peony, magnolia or lily, often with a green or lightly fruity top", why: "Florals are soft and airy, which suits mild, bright weather, and many are comfortable all year." },
  "Amber & Spicy": { best: ["Autumn", "Winter"], ok: ["Spring"], less: ["Summer", "Monsoon"], times: ["Evening", "Night"], occasions: ["Evenings out", "Festive occasions", "Dinners"], typical: "amber and resins, warm spices such as cardamom, cinnamon or pepper, and sometimes vanilla or woods", why: "Warm, resinous notes feel cosy when it is cool, and can feel heavy in peak heat." },
  "Oud & Woody": { best: ["Autumn", "Winter"], ok: ["Spring", "Monsoon"], less: ["Summer"], times: ["Evening", "Night"], occasions: ["Formal events", "Evenings out", "Festive occasions"], typical: "oud, sandalwood, cedar or other woods, often with spice, amber or incense", why: "Deep woods and oud have presence in cool air, and can be overpowering in peak heat." },
  "Leather & Smoky": { best: ["Autumn", "Winter"], ok: ["Spring"], less: ["Summer", "Monsoon"], times: ["Evening", "Night"], occasions: ["Evenings out", "Formal events"], typical: "leather, tobacco, incense or smoky woods, often softened with amber or spice", why: "Leather and smoke are dense and warm, which suits cooler evenings." },
  "Gourmand": { best: ["Autumn", "Winter"], ok: ["Spring"], less: ["Summer", "Monsoon"], times: ["Evening", "Night"], occasions: ["Evenings out", "Festive occasions", "Cold days"], typical: "sweet, edible notes such as vanilla, tonka bean, caramel, coffee, nuts or dried fruit", why: "Sweet, rich scents feel comforting in the cold, and many people find them cloying in muggy weather." },
  "Musk": { best: ["Spring", "Summer", "Monsoon", "Autumn", "Winter"], ok: [], less: [], times: ["Daytime"], occasions: ["The office", "Everyday wear", "Close to the skin"], typical: "soft, clean musks that sit close to the skin", why: "Clean musks are gentle and sit close to the skin, so they work in any weather." },
};

/** the strength shown in the name; "tier" says whether it is lighter or richer than a standard eau de parfum */
export function strengthOf(name) {
  const n = name;
  if (/\b(Pure Parfum|Parfum|Extrait)\b/i.test(n)) return { label: "Parfum", tier: "rich", plain: "a parfum (extrait), the most concentrated strength" };
  if (/\bElixir\b/i.test(n)) return { label: "Elixir", tier: "rich", plain: "an elixir, a rich, concentrated strength" };
  if (/\b(EDC|Cologne)\b/i.test(n)) return { label: "Cologne (EDC)", tier: "light", plain: "an eau de cologne, a light and fresh strength" };
  if (/\bEDP\b/i.test(n)) return { label: /\b(Intense|Extreme|Extra)\b/i.test(n) ? "EDP (Intense)" : "EDP", tier: /\b(Intense|Extreme|Extra)\b/i.test(n) ? "rich" : "mid", plain: /\b(Intense|Extreme|Extra)\b/i.test(n) ? "an intense eau de parfum, richer than a standard EDP" : "an eau de parfum (EDP), a rich, long-lasting strength" };
  if (/\bEDT\b/i.test(n)) return { label: /\b(Intense|Extreme)\b/i.test(n) ? "EDT (Intense)" : "EDT", tier: /\b(Intense|Extreme)\b/i.test(n) ? "mid" : "light", plain: /\b(Intense|Extreme)\b/i.test(n) ? "an intense eau de toilette, stronger than a standard EDT" : "an eau de toilette (EDT), a lighter, brighter strength" };
  return null;
}

const STRENGTH_TIP = {
  light: "Its lighter strength suits warm weather; use a few more sprays when it is cold.",
  mid: "Eau de parfum strength is versatile; in peak heat start with one or two sprays.",
  rich: "Its richer strength is strong: use fewer sprays, and go easy in peak heat.",
};

/** the wear guide for one perfume, or null when neither fact is known */
export function wearGuide(p) {
  const fam = FAMILIES[p.fm] || null, st = strengthOf(p.n);
  if (!fam && !st) return null;
  const g = { basis: [], best: [], ok: [], less: [], times: [], occasions: [], why: [], tip: st ? STRENGTH_TIP[st.tier] : "", family: fam ? p.fm : "", strength: st };
  if (fam) { g.basis.push(`its scent family (${p.fm})`); Object.assign(g, { best: [...fam.best], ok: [...fam.ok], less: [...fam.less], times: [...fam.times], occasions: [...fam.occasions] }); g.why.push(fam.why); }
  if (st) g.basis.push(`its strength (${st.label})`);
  if (!fam && st && st.tier === "light") Object.assign(g, { best: ["Spring", "Summer", "Monsoon"], ok: ["Autumn"], less: ["Winter"], times: ["Daytime"] }), g.why.push("Lighter strengths feel comfortable in the heat.");
  if (!fam && st && st.tier === "rich") Object.assign(g, { best: ["Autumn", "Winter"], ok: ["Spring", "Monsoon"], less: ["Summer"], times: ["Evening", "Night"] }), g.why.push("Rich, concentrated strengths have presence in cool air and can overwhelm in the heat.");
  // a rich strength in a "best in summer" family: keep it but flag the heat
  if (fam && st && st.tier === "rich" && g.best.includes("Summer")) { g.best = g.best.filter((s) => s !== "Summer"); g.ok = [...g.ok, "Summer"]; }
  // a light strength in a cold-weather family: it is comfortable in cool, not only cold, weather
  if (fam && st && st.tier === "light" && g.less.includes("Summer")) { g.less = g.less.filter((s) => s !== "Summer"); g.ok = [...g.ok, "Summer"]; }
  g.fit = Object.fromEntries(SEASONS.map((s) => [s, g.best.includes(s) ? "best" : g.ok.includes(s) ? "ok" : g.less.includes(s) ? "less" : "neutral"]));
  return g;
}

/** a time of day as it reads in a sentence */
const WHEN = { Morning: "in the morning", Daytime: "during the day", Afternoon: "in the afternoon", "Early evening": "in the early evening", Evening: "in the evening", Night: "at night" };
export const whenPhrase = (t) => WHEN[t] || t.toLowerCase();

/** "a", "an" */
export const article = (w) => (/^[aeiou]/i.test(w) ? "an" : "a");
export const FOR_TEXT = { Men: "men", Women: "women", Unisex: "men and women" };

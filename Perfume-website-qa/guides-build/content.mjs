// The text of the four guides. Facts come from the research notes in README.md; anything about our own catalogue is checked by the tests.
import { figSpot, figSizes, figTester, icon } from "./art.mjs";
import { picks, mini, fam, MULT, STORES } from "./helpers.mjs";

const wa = (msg, label = "Message us on WhatsApp") => `<a class="btn btn-gold" data-wa="${msg}" href="contact.html">${label}</a>`;

/* ======================================================================== 1. Genuine or fake */
const spot = {
  lead: "Counterfeit perfume is cheap to make and easy to photograph, which is why it turns up on marketplaces, Instagram pages and even small shops. The good news: fakes usually slip on the small details. No single check proves a bottle is genuine, so treat the six spots below as a set. The more of them line up, the more confident you can be.",
  toc: [["before", "Price and seller"], ["six", "The six spots to check"], ["not-fake", "Looks wrong, but isn't"], ["unsure", "Still unsure?"], ["faq", "Common questions"]],
  html: `
<section>
  <h2 id="before">Before you check anything: price and seller</h2>
  <p>Two things can be judged before the parcel arrives.</p>
  <p><b>Price.</b> Authorised shops sell at prices the brands set or recommend, so a new, sealed bottle of a famous designer perfume at a small fraction of every shop's price should make you ask why. Price alone doesn't settle it, though. Testers, bottles with no box, older batches and many Middle-Eastern houses are honestly cheaper. A trustworthy seller tells you which one you are buying, in the listing and not after you have paid.</p>
  <p><b>Seller.</b> Look for a clear description of what you are getting (Retail, Tester, No Box), real photos, a way to reach an actual person, and a written promise of what happens if the bottle turns out not to be genuine. Be wary of words like <em>first copy</em>, <em>master copy</em>, <em>AAA</em> or <em>1:1</em>. Those describe imitations, however they are dressed up.</p>
</section>

<section>
  <h2 id="six">The six spots to check</h2>
  <p>Once the bottle is in your hands, go through these in order. The numbers match the picture.</p>
  <figure class="fig">
    ${figSpot()}
    <figcaption>Six places to look on a boxed bottle. The batch code on the box (2) should match the one on the bottle (3).</figcaption>
  </figure>
  <ol class="steps">
    <li><b>Cellophane.</b> It should be tight and clean, neatly folded at the ends, with a straight, narrow seam. Loose, wrinkled or glue-streaked wrap is a warning sign. It is not proof on its own, because boxes get scuffed in warehouses and can be re-wrapped, so use it as a reason to look harder at the other five.</li>
    <li><b>The box.</b> Printing should be crisp, evenly coloured and spelt correctly, on sturdy card with clean folds. It lists the name, strength (EDP, EDT and so on), volume in ml, ingredients, country of manufacture and a barcode. Perfume imported into India usually also carries an importer's label with a name, address and MRP. Find the <b>batch code</b>: a short mix of letters and numbers, normally stamped, embossed or printed on the base or a flap, and not part of the box artwork.</li>
    <li><b>The bottle.</b> Glass should be thick, clear and even, with no bubbles and neat seams, and the lettering sharp and straight. Look for the same batch code on the bottle, often on the base or the back. <b>It should match the code on the box.</b> A different code, or none where that brand normally prints one, is a red flag.</li>
    <li><b>The cap.</b> It should fit snugly, sit straight and feel solid. Hollow, rattly or badly aligned caps are common on fakes. Some brands use light plastic caps by design, so compare with a photo of the genuine one on the brand's own site.</li>
    <li><b>The sprayer.</b> Look for a neat metal collar, a fine even mist, and no dribbling or squirting. The thin tube inside should reach the bottom of the bottle and no further. A long tube curling up at the base is a classic giveaway.</li>
    <li><b>The liquid.</b> It should be clear and evenly coloured, with no cloudiness or floating specks, filled to about the level other bottles of that fragrance show. The scent should open the way you expect and develop over the next hours. Something sharp and alcoholic that vanishes within the hour points the wrong way.</li>
  </ol>
  <div class="notice">
    <p class="notice-title">Use the nose last</p>
    <p>The scent is the weakest test. Skin, weather and reformulations change how real perfume smells, and genuine perfume darkens slowly with age and heat. And a matching batch code isn't proof either: copies sometimes reuse real codes, while thousands of genuine bottles share one code, so seeing the same code on two bottles isn't suspicious. Judge the six spots together, not one at a time.</p>
  </div>
</section>

<section>
  <h2 id="not-fake">Things that look wrong, but aren't</h2>
  <p>Some genuine products are sold looking different on purpose. Don't mistake them for fakes.</p>
  <ul class="bullets">
    <li><b>A tester</b> comes in a plain white or brown carton (or none), with no cellophane and sometimes no cap. That is how testers are made. Read <a href="guide-perfume-testers-explained.html">Perfume testers explained</a>.</li>
    <li><b>Minis, vials and decants</b> have no brand box, and the batch code belongs to the bottle they were filled from. Read <a href="guide-retail-tester-decant-discovery-set.html">Retail, tester, decant or discovery set</a> to see what each should look like.</li>
    <li><b>“No Box” or “Box Damage”</b> in a listing is the seller telling you the truth about the packaging, not hiding a fake.</li>
    <li><b>Older or regional packaging.</b> Brands redesign boxes and bottles from time to time, and different countries get different languages and labels. Compare with photos of the same year and market where you can.</li>
    <li><b>A slightly different smell</b> from your last bottle. Batches vary a little and brands adjust formulas. A completely different smell is worth questioning; a slight change is normal.</li>
  </ul>
</section>

<section>
  <h2 id="unsure">Still unsure? Have it checked in person</h2>
  <p>If something doesn't feel right, don't guess. Take the bottle to a reputed perfume store and ask the staff to look at it: ${STORES}, or the brand's own boutique. They handle genuine stock every day and can compare yours with what is on their shelves.</p>
  <p>That is exactly how our guarantee works. If a reputed store confirms in writing that something you bought from us is not genuine, we refund ${MULT} what you paid for that item. The <a href="guarantee.html#claim">claim rules</a> explain the steps, including filming the unboxing.</p>
  <p>Before you order from anyone, ask for pictures of the box and the bottle with the batch code visible. A seller who sends them happily is a good sign; one who dodges the question tells you something too.</p>
</section>`,
  quick: "To check whether a perfume is genuine, look at six things: the cellophane, the box, the bottle, the cap, the sprayer and the liquid. The batch code on the box should match the one on the bottle. No single check proves it, so judge them together, and if you are still unsure, have it checked in person at a reputed perfume store.",
  faq: [
    ["How can I tell if a perfume is original?", "Check six things: the cellophane, the box, the bottle, the cap, the sprayer and the liquid. The batch code on the box should match the one on the bottle. No single check is proof, so judge them together, and ask the seller for photos of the box and bottle with the batch code visible before you order."],
    ["Does a matching batch code prove a perfume is genuine?", "No. A matching code is necessary but not sufficient: copies sometimes reuse real codes, and thousands of genuine bottles share one batch code. Treat it as one check among six, and look at the glass, the cap, the sprayer and the liquid as well."],
    ["Can a fake perfume smell like the real one?", "Some imitations smell close at first. They are often sharper, thinner and gone within the hour, but scent is the weakest test, because skin, weather and reformulations change how genuine perfume smells too. Check the packaging, the batch code and the sprayer first, and use the nose last."],
    ["Is a perfume without a box fake?", "Not necessarily. Testers, minis, vials and bottles sold as “No Box” are genuine products sold without retail packaging. A good seller says so in the listing. Check the batch code on the bottle itself, and be wary of a seller who will not tell you which format you are buying."],
    ["What should I do if I think I have a fake?", `Take it to a reputed perfume store (${STORES}) and ask the staff to look at it. If you bought it from us and the store confirms in writing that it is not genuine, send us the report on WhatsApp within <span data-claim-days>7</span> days of delivery and we refund ${MULT} what you paid for that item. Film the unboxing first: our <a href="guarantee.html#claim">claim rules</a> need it.`],
  ],
  cta: { title: "Want to ask before you order?", text: "Tell us which perfume you are looking at and we'll answer any question about it.", wa: "Hi! I have a question about a perfume before I order." },
};

/* ======================================================================== 2. Seasons */
const seasonBlock = (id, ico, when, title, intro, facts, pickSlugs, links) => `
<section>
  <div class="season-head">${icon(ico, 36)}<div><p class="season-when">${when}</p><h2 id="${id}">${title}</h2></div></div>
  <p>${intro}</p>
  <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
  ${picks(pickSlugs)}
  <p class="more-link">${links.map(([name, label]) => `<a href="${fam(name)}">${label}</a>`).join(" &nbsp;·&nbsp; ")}</p>
</section>`;

const seasons = {
  lead: "Heat, cold and humidity change how a perfume behaves on your skin. The same fragrance can feel crisp in January and suffocating in May. Choosing by season isn't a rule, just a shortcut to what will feel good on you and not overwhelm everyone around you.",
  toc: [["ideas", "Three ideas to start"], ["glance", "At a glance"], ["spring", "Spring"], ["summer", "Summer"], ["monsoon", "Monsoon"], ["autumn", "Autumn"], ["winter", "Winter"], ["daynight", "By day, by night"], ["start", "Not sure where to start?"], ["faq", "Common questions"]],
  html: `
<section>
  <h2 id="ideas">Three ideas that make choosing easy</h2>
  <ol class="steps">
    <li><b>Heat amplifies, cold mutes.</b> In hot weather a perfume projects further and can turn heavy fast, so go lighter in strength and use fewer sprays. In the cold, scent stays closer to the skin, so richer fragrances and a little more spray work well.</li>
    <li><b>Match the family to the weather.</b> Think fresh, airy and watery when it's hot, warm, resinous and sweet when it's cool. The scent families in our catalogue (Fresh &amp; Citrus, Floral, Amber &amp; Spicy, Oud &amp; Woody, Leather &amp; Smoky and Gourmand) line up with this naturally.</li>
    <li><b>Strength matters as much as scent.</b> Eau de toilette (EDT) is the lighter, brighter style. Eau de parfum (EDP) is richer and usually lasts longer. Parfum or extrait is the most concentrated. The usual ranges (about 5–15% fragrance oil for EDT, 15–20% for EDP, 20–30% for parfum) are industry habits, not legal standards, so treat them as a rough guide.</li>
  </ol>
</section>

<section>
  <h2 id="glance">The seasons at a glance</h2>
  <table class="rtable">
    <thead><tr><th scope="col">Season</th><th scope="col">Scent families</th><th scope="col">Strength</th><th scope="col">How much</th></tr></thead>
    <tbody>
      <tr><th scope="row">Spring</th><td data-label="Scent families">Floral, green, light fruity</td><td data-label="Strength">EDT or light EDP</td><td data-label="How much">Moderate</td></tr>
      <tr><th scope="row">Summer</th><td data-label="Scent families">Fresh &amp; Citrus, aquatic</td><td data-label="Strength">EDT or light EDP</td><td data-label="How much">Light hand: start with one or two sprays</td></tr>
      <tr><th scope="row">Monsoon</th><td data-label="Scent families">Fresh, green, clean and light woody</td><td data-label="Strength">EDT or light EDP</td><td data-label="How much">Light to moderate</td></tr>
      <tr><th scope="row">Autumn</th><td data-label="Scent families">Amber &amp; Spicy, Leather &amp; Smoky</td><td data-label="Strength">EDP</td><td data-label="How much">Moderate</td></tr>
      <tr><th scope="row">Winter</th><td data-label="Scent families">Gourmand, Oud &amp; Woody</td><td data-label="Strength">EDP or parfum</td><td data-label="How much">Generous</td></tr>
    </tbody>
  </table>
  <p class="fine">The months are rough. The seasons arrive at different times in different cities, so go by the weather where you live.</p>
</section>

${seasonBlock("spring", "spring", "Roughly February to March · mild and bright", "Spring: soft and floral",
  "Mild days and blossoming gardens suit fragrances that smell like fresh flowers and green leaves. Look in the <b>Floral</b> family: rose, jasmine, peony, magnolia and lily, often with a green or lightly fruity top. An eau de toilette or a light eau de parfum keeps it airy.",
  [["Look for", "Soft florals, green notes, light fruit, gentle musks"], ["Strength", "EDT or light EDP"], ["Tip", "Mild weather is forgiving, so you can wear most strengths. Choose by mood and keep it airy."]],
  ["gucci-flora-gorgeous-magnolia-edp", "afnan-mystique-bouquet", "maison-alhambra-rose-petals"], [["Floral", "Browse all Floral perfumes →"]])}

${seasonBlock("summer", "summer", "Roughly April to June · hot and dry", "Summer: fresh and citrus",
  "When it's hot, scent lifts off the skin quickly and strong sweet fragrances can feel overpowering. Reach for <b>Fresh &amp; Citrus</b>: lemon, bergamot, grapefruit, neroli, mint, marine and aromatic notes. Pick an eau de toilette or a light eau de parfum, start with one or two sprays, and apply to pulse points.",
  [["Look for", "Citrus, neroli, mint, marine and light aromatic notes"], ["Strength", "EDT or light EDP"], ["Tip", "Heat makes scent travel, so go easier than you would in winter. A small travel size lets you refresh later in the day."]],
  ["tom-ford-neroli-portofino-acqua-edt", "prada-luna-rossa-sport-edt", "afnan-9am"], [["Fresh & Citrus", "Browse all Fresh & Citrus perfumes →"]])}

${seasonBlock("monsoon", "monsoon", "Roughly July to September · warm, humid and wet", "Monsoon: clean and green",
  "Humid air carries scent well, and many people find very sweet or heavy fragrances cloying in muggy weather. Aim for clean and fresh: citrus, aquatic notes, green and light woody accords. Lighter strengths and “sport” styles tend to stay pleasant when the air is thick.",
  [["Look for", "Fresh citrus, watery notes, light woods, clean musks"], ["Strength", "EDT or light EDP"], ["Tip", "Avoid layering several scents in humid weather. One clean fragrance reads better than three competing ones."]],
  ["armaf-dunescape", "lattafa-fire-on-ice", "afnan-tribute-blue"], [["Fresh & Citrus", "Browse Fresh & Citrus perfumes →"]])}

${seasonBlock("autumn", "autumn", "Roughly October to November · cooler evenings, festive season", "Autumn: amber, spice and leather",
  "As the evenings cool, move to warmer and rounder scents: amber, spices, leather and a little smoke. The <b>Amber &amp; Spicy</b> and <b>Leather &amp; Smoky</b> families live here, and an eau de parfum starts to make sense. The festive season is a good excuse for something with more presence.",
  [["Look for", "Amber, cardamom and other spices, leather, tobacco, incense"], ["Strength", "EDP"], ["Tip", "These work well from late afternoon into the evening, when the air is cooler."]],
  ["prada-amber-pour-homme-edt", "lattafa-the-kingdom-man", "tom-ford-ombre-leather-parfum"], [["Amber & Spicy", "Browse Amber & Spicy →"], ["Leather & Smoky", "Browse Leather & Smoky →"]])}

${seasonBlock("winter", "winter", "Roughly December to February · cold and dry", "Winter: rich and gourmand",
  "Cold air mutes scent, so this is the time for the big, rich styles: vanilla, tonka, coffee, caramel, oud, sandalwood and resins. <b>Gourmand</b> and <b>Oud &amp; Woody</b> are the families to explore, in eau de parfum or parfum strength. You can afford a few more sprays than in summer.",
  [["Look for", "Vanilla, tonka, coffee, caramel, oud, sandalwood, resins"], ["Strength", "EDP or parfum"], ["Tip", "Cold air mutes scent, so apply to warm spots such as the neck and the inside of the wrists."]],
  ["lattafa-khamrah", "mancera-vanille-exclusive-edp", "gucci-intense-oud-edp"], [["Gourmand", "Browse Gourmand →"], ["Oud & Woody", "Browse Oud & Woody →"]])}

<section>
  <h2 id="daynight">By day, by night</h2>
  <p>Season isn't the only thing that matters. For the office, a classroom or a hot afternoon, keep it light, clean and soft. For evenings and occasions, go richer and deeper. A winter-style scent can work in summer at night with a single spray, and a fresh citrus can lift a cold afternoon. Wear what makes you feel good, because these are guidelines, not rules.</p>
</section>

<section>
  <h2 id="start">Not sure where to start?</h2>
  <ul class="bullets">
    <li><b>Take the scent quiz.</b> Answer a few quick questions and get a short list of perfumes to try.</li>
    <li><b>Try a small size first.</b> A mini or a vial is the cheapest way to live with a scent for a few days. See <a href="guide-retail-tester-decant-discovery-set.html">Retail, tester, decant or discovery set</a> for how the formats differ.</li>
    <li><b>Browse by family.</b> Use the “Browse all” links above, or the Scent filter in the catalogue.</li>
  </ul>
  <p class="cta-note"><a class="btn btn-gold" href="catalogue.html?quiz=1">Take the 1-minute scent quiz</a> &nbsp; <a class="btn btn-ghost" href="catalogue.html?g=Minis">Browse minis &amp; vials</a></p>
  <p class="fine">Seasonal advice is convention rather than science. Scent families overlap, and how a perfume smells depends on your skin and the climate around you, so try before you commit.</p>
</section>`,
  quick: "Choose lighter, fresher perfumes (citrus, aquatic, light woods, usually eau de toilette) for hot and humid weather, and richer ones (amber, gourmand, oud, usually eau de parfum) for cool or cold weather. Heat amplifies scent and cold mutes it, so use fewer sprays in summer and a few more in winter.",
  faq: [
    ["Which perfume is best for summer in India?", `Choose a fresh, light fragrance: citrus, neroli, mint, marine or light aromatic notes, usually an eau de toilette or a light eau de parfum. Heat makes scent travel, so start with one or two sprays. Our <a href="${fam("Fresh & Citrus")}">Fresh &amp; Citrus family</a> is the place to start.`],
    ["What perfume should I wear in the monsoon?", "Humid air carries scent well, so clean and fresh usually works best: citrus, aquatic notes, green and light woody accords, in a light strength. Many people find very sweet or heavy fragrances cloying in muggy weather, so save those for cooler months."],
    ["What is the best perfume for winter?", `Cold air mutes scent, so winter suits rich styles: vanilla, tonka, coffee, caramel, oud, sandalwood and resins, usually in eau de parfum or parfum strength. Our <a href="${fam("Gourmand")}">Gourmand</a> and <a href="${fam("Oud & Woody")}">Oud &amp; Woody</a> families are the ones to explore, and you can use a few more sprays than in summer.`],
    ["Does the weather change how a perfume smells?", "Yes. Heat amplifies a perfume and makes it project further, while cold keeps it closer to the skin and mutes it. That is why lighter strengths and fewer sprays suit hot weather, and richer strengths suit cold weather."],
    ["Is eau de toilette or eau de parfum better for hot weather?", "Eau de toilette (EDT) or a light eau de parfum (EDP) usually suits heat, because they are lighter and brighter. The usual ranges (about 5–15% fragrance oil for EDT and 15–20% for EDP) are industry habits, not legal standards, so use them as a rough guide."],
  ],
  cta: { title: "Tell us the weather, we'll suggest a scent", text: "Message us what you like and where you live, and we'll point you to a few that suit.", wa: "Hi! Can you suggest a perfume for the season?" },
};

/* ======================================================================== 3. Formats */
const formats = {
  lead: "The same perfume can reach you in very different forms: a boxed bottle from a shop, an unboxed tester, a few millilitres in a vial, or a set of tiny samples. They differ in packaging, size, who filled the container and, above all, price per millilitre. Knowing which is which keeps you from paying for things you don't need, and from expecting things you won't get.",
  toc: [["glance", "At a glance"], ["retail", "Retail"], ["tester", "Tester"], ["decant", "Decant"], ["set", "Discovery set"], ["minis", "Minis in our catalogue"], ["cost", "Price per ml"], ["choose", "Which should you choose?"], ["faq", "Common questions"]],
  html: `
<section>
  <h2 id="glance">The four formats at a glance</h2>
  <table class="rtable">
    <thead><tr><th scope="col">Format</th><th scope="col">What it is</th><th scope="col">Packaging</th><th scope="col">Typical size</th><th scope="col">Best for</th></tr></thead>
    <tbody>
      <tr><th scope="row">Retail</th><td data-label="What it is">Made and sold new by the brand</td><td data-label="Packaging">Branded box, cellophane, cap</td><td data-label="Typical size">30–200 ml</td><td data-label="Best for">Gifts, keepers, collectors</td></tr>
      <tr><th scope="row">Tester</th><td data-label="What it is">Made by the brand for sampling at the counter</td><td data-label="Packaging">Plain box or none; often no cap or cellophane</td><td data-label="Typical size">Usually full size</td><td data-label="Best for">Wearing it, not gifting</td></tr>
      <tr><th scope="row">Decant</th><td data-label="What it is">A portion poured from a full bottle into a small atomiser or vial</td><td data-label="Packaging">None, just a label</td><td data-label="Typical size">1–10 ml</td><td data-label="Best for">Trying before you commit</td></tr>
      <tr><th scope="row">Discovery set</th><td data-label="What it is">Several small vials or minis, usually from one house</td><td data-label="Packaging">Presentation box or tray</td><td data-label="Typical size">A few ml each, 3–10 pieces</td><td data-label="Best for">Exploring a house; a first gift</td></tr>
    </tbody>
  </table>
  <p class="fine">Sizes are typical, not exact, and they vary by brand.</p>
  <figure class="fig">
    ${figSizes()}
    <figcaption>The same perfume in five formats, to show the relative sizes (not to scale).</figcaption>
  </figure>
</section>

<section>
  <h2 id="retail">Retail: the full package</h2>
  <p>Retail is the bottle you'd pick up in a shop: made and filled by the brand, sealed in cellophane inside a branded box. It is the full experience and the one to give as a gift. It also costs the most up front, and you only learn whether you really love it after you've bought it.</p>
  <ul class="bullets">
    <li><b>Best for:</b> gifts, collectors, and scents you already know you love.</li>
    <li><b>Watch out for:</b> the highest outlay, and the biggest disappointment if the scent turns out not to suit you.</li>
  </ul>
</section>

<section>
  <h2 id="tester">Tester: the same scent, plain packaging</h2>
  <p>A tester is a bottle the brand supplies to shops so customers can try the scent at the counter. It holds the same fragrance as the retail bottle but comes in plain packaging, often a simple carton or no box at all, and sometimes without a cap. That is why it costs less. If you care more about what is in the bottle than the box around it, a tester is a sensible buy. It is not the one to give as a gift.</p>
  <p>In our catalogue every tester is listed as a <b>Tester</b>, and where something is missing the listing says so, for example “No Box”. For the full story, including why testers cost less and whether they are legit, read <a href="guide-perfume-testers-explained.html">Perfume testers explained</a>.</p>
</section>

<section>
  <h2 id="decant">Decant: a small taste from a big bottle</h2>
  <p>A decant is a portion of a perfume poured from a full bottle into a small atomiser or vial, usually between 1 and 10 ml. It is filled by whoever is selling it, not by the brand. There is no brand box, and the batch code stays on the original bottle, so you are trusting the person who filled it.</p>
  <p>Decants cost more per millilitre than a full bottle, but they let you wear a scent for days before you commit. Ask who filled it and from which bottle, and be careful with unlabelled vials: air, heat and light during the transfer can affect the scent.</p>
  <ul class="bullets">
    <li><b>Best for:</b> testing one fragrance properly on your skin.</li>
    <li><b>Watch out for:</b> unlabelled vials, and sellers who can't tell you where the liquid came from.</li>
  </ul>
</section>

<section>
  <h2 id="set">Discovery set: many scents, one box</h2>
  <p>A discovery set (sometimes called a sampler) is a presentation box of several small vials or minis, usually from one house or one fragrance line. Brand-made sets are filled and sealed at the factory, which makes them the safest of the small formats. They are a good way to explore a house, or a first gift for someone new to perfume.</p>
  <p>The limit is that you get the line-up chosen for you. And a “set” put together by a reseller, rather than the brand, is really a collection of decants, so check who made it.</p>
</section>

<section>
  <h2 id="minis">Minis you'll find in our catalogue</h2>
  <p>Small sizes appear in the catalogue as <b>Minis &amp; vials</b>: travel sprays, dab-on bottles, roller-balls and vials. The listing says which one you are getting. Where the picture shows the mini itself, the listing says so; otherwise the bottle in the photo is the full-size one and the picture carries a small “Mini” label, so you know it is not what arrives.</p>
  <ul class="strip" aria-label="Examples of minis">
    ${mini("hermes-h24-edp--spray", "Mini spray", "a small travel atomiser (Hermès H24 EDP)")}
    ${mini("bvlgari-man-in-black-edp--dab", "Dab-on", "no spray, you dab the scent on (Bvlgari Man in Black EDP)")}
    ${mini("paco-rabanne-1-million-edt--vial", "Vial", "a tiny sample, enough to try the scent (Paco Rabanne 1 Million EDT)")}
  </ul>
  <p class="more-link"><a href="catalogue.html?g=Minis">Browse minis &amp; vials →</a> &nbsp;·&nbsp; <a href="catalogue.html?g=Sets">Browse sets →</a></p>
</section>

<section>
  <h2 id="cost">What does each cost per millilitre?</h2>
  <p>Divide the price by the millilitres and you can compare any format. For example (illustrative numbers, not our prices): a 100 ml bottle at ₹10,000 works out at ₹100 per ml, while a 5 ml decant at ₹750 works out at ₹150 per ml. The decant costs more per ml, but ₹750 instead of ₹10,000 is the price of finding out whether you love the perfume.</p>
  <p>A single spray is roughly 0.1 ml, so 1 ml gives about ten sprays. That makes a 5 ml decant around fifty sprays, enough for a couple of weeks of wearing. Atomisers differ, so take the numbers as a rough guide.</p>
</section>

<section>
  <h2 id="choose">So which should you choose?</h2>
  <ul class="bullets">
    <li><b>Never smelled it?</b> Start with a vial, a mini or a discovery set.</li>
    <li><b>Know you love it and want the box</b> for a gift or a collection? Retail.</li>
    <li><b>Know you love it and care more about the liquid than the box?</b> A tester.</li>
    <li><b>Need something for the handbag or a trip?</b> A mini travel spray.</li>
    <li><b>Want to compare several scents from one house?</b> A discovery set.</li>
  </ul>
  <div class="notice">
    <p class="notice-title">Always check what you are getting</p>
    <p>Whichever format you pick, the listing should say exactly what arrives. Ours do: the size, the type (Retail, Tester, Mini and so on) and any note such as “No Box” appear on every card. If you are ever unsure, ask us before you order.</p>
  </div>
</section>`,
  quick: "A retail bottle is brand-packaged and boxed. A tester is the same fragrance in plain packaging, usually cheaper. A decant is a small portion poured from a full bottle. A discovery set is a box of several small samples. Use vials, decants or sets to try a scent, and retail or tester to wear it.",
  faq: [
    ["What is the difference between a tester and a retail perfume?", `A retail bottle is made and sold new by the brand in a branded box with cellophane and a cap. A tester is a brand-made bottle supplied for sampling at the counter. It holds the same fragrance in plain packaging, often with no box or cap, which is why it costs less. <a href="guide-perfume-testers-explained.html">Read more about testers</a>.`],
    ["What is a perfume decant?", "A decant is a small portion of a perfume poured from a full bottle into a small atomiser or vial, usually 1 to 10 ml, by the seller and not the brand. It has no brand box, so you rely on the seller. Decants cost more per ml than a full bottle but let you try a scent for days."],
    ["What is a perfume discovery set?", "A discovery set (or sampler) is a presentation box of several small vials or minis, usually from one house or fragrance line. Brand-made sets are filled and sealed at the factory, which makes them the safest small format. They suit exploring a house or a first gift."],
    ["Is a decant cheaper than a full bottle?", "A decant costs less up front but more per millilitre. For example (illustrative numbers, not our prices): a 100 ml bottle at ₹10,000 is ₹100 per ml, while a 5 ml decant at ₹750 is ₹150 per ml. The decant is the cheaper way to find out whether you love a perfume."],
    ["How many sprays are in 1 ml of perfume?", "A spray is roughly 0.1 ml, so 1 ml gives about ten sprays. A 5 ml decant is around fifty sprays, enough for a couple of weeks of wearing. Atomisers differ, so take the numbers as a rough guide."],
  ],
  cta: { title: "Not sure which format to pick?", text: "Tell us the perfume and what you need it for, and we'll suggest the best way to buy it.", wa: "Hi! Which format should I buy: retail, tester or mini?" },
};

/* ======================================================================== 4. Testers */
const testers = {
  lead: "Testers are some of the best-value bottles in perfume, and some of the most misunderstood. Here is a plain account of what they are, why they cost less, why brands say they are not for sale, how they reach resellers, and whether buying one is legit.",
  toc: [["short", "The short answer"], ["what", "What a tester is"], ["cheaper", "Why testers cost less"], ["notforsale", "Why they aren't “for sale”"], ["how", "How they reach resellers"], ["legit", "So, is it legit?"], ["who", "Who should buy one"], ["checklist", "Before you buy"], ["faq", "Common questions"]],
  html: `
<section>
  <h2 id="short">The short answer</h2>
  <div class="notice">
    <p class="notice-title">Genuine product, grey-area trade</p>
    <p>A tester is a <b>genuine</b>, brand-made bottle meant for sampling at the counter. It holds the same fragrance as the retail bottle, in plainer packaging, at a lower price. But brands don't intend testers to be sold, and in some countries courts have sided with brands against resellers. So a tester is not a fake, and it is not an officially approved retail product either. We would rather say so plainly.</p>
  </div>
</section>

<section>
  <h2 id="what">What a tester is</h2>
  <p>A tester is a bottle that a brand supplies to perfume shops and department-store counters so customers can try a fragrance before they buy it. The brand makes it and fills it with its fragrance, then packs it for the counter instead of the shelf.</p>
  <p>You can usually recognise one by its packaging:</p>
  <ul class="bullets">
    <li>a plain white or brown carton, sometimes stamped “Tester” or “Not for sale”, or no box at all</li>
    <li>no cellophane wrap</li>
    <li>a plain cap, or no cap</li>
    <li>a bottle that is otherwise the same as the retail one</li>
  </ul>
  <figure class="fig">
    ${figTester()}
    <figcaption>Same fragrance, different packaging: the retail pack on the left, a tester on the right.</figcaption>
  </figure>
</section>

<section>
  <h2 id="cheaper">Why testers cost less</h2>
  <p>You are not saving on the liquid. You are saving on everything around it.</p>
  <ul class="bullets">
    <li><b>Simpler packaging.</b> No gift box, no cellophane, often no cap. Those things cost money and the saving is passed on.</li>
    <li><b>Never meant as retail stock.</b> A tester isn't priced as a shelf product, so there is no retail margin built into it.</li>
    <li><b>How it reached the seller.</b> The route a tester takes to a reseller (see below) is shorter and cheaper than the normal retail chain.</li>
  </ul>
  <p>On our catalogue, where a tester and the retail bottle of the same size are both listed, the tester is typically <b>10–30% cheaper</b>, with about 20% in the middle. Other sellers advertise bigger gaps; it varies by brand and by stock.</p>
</section>

<section>
  <h2 id="notforsale">Why brands say testers aren't “for sale”</h2>
  <p>Brands give testers to retailers as promotional material, to be used on the counter and not sold on. Many are printed or stamped “tester” or “not for sale”. Brands hold that line for two reasons: testers sold at a discount undercut their authorised shops, and a buyer might think they are getting a full retail pack, with box, cap and the brand's after-sales backing.</p>
  <p>How the law treats it differs from place to place:</p>
  <ul class="bullets">
    <li><b>European Union.</b> In 2010 the EU's Court of Justice looked at Coty testers marked “demonstration” and “not for resale” (<i>Coty Prestige Lancaster v. Simex Trading</i>, case C-127/09). It said such labels negate any presumption that the brand consented to the testers being marketed, which leaves the brand free to object to their resale as trademark infringement.</li>
    <li><b>India.</b> In July 2023 the Delhi High Court, in <i>Coty Germany GmbH v. Xeryus Retail Pvt. Ltd.</i>, permanently barred two websites from selling Calvin Klein testers and ordered ₹1 lakh to be paid to the brand. The seller did not contest the case, and commentators describe the finding as an unfair trade practice. It appears to be the first Indian ruling of its kind.</li>
    <li><b>Marketplaces.</b> Some online platforms ban tester listings outright, whatever the law says.</li>
  </ul>
</section>

<section>
  <h2 id="how">How testers reach resellers anyway</h2>
  <p>Brands ship testers in large numbers to distributors, department stores and chains. Over time counters replace worn or empty testers, ranges are refreshed, shops close and distributors are left with surplus. That stock gets sold on to wholesalers, liquidators and discount sellers, and from there it reaches the open market.</p>
  <p>That is the broad path, and brands don't approve of it. We can't speak for every seller. What we can say is what you will always see from us: each tester is listed as a <b>Tester</b>, with anything missing noted (for example “No Box”), and the photo beside it may show the retail bottle, which the listing makes clear.</p>
</section>

<section>
  <h2 id="legit">So, is it legit?</h2>
  <p>It depends on which question you are asking, so here are straight answers to each.</p>
  <ul class="bullets">
    <li><b>Is it genuine?</b> Yes. A tester is the brand's own product with the brand's own fragrance. That is the difference from a fake, which is a copy made by someone else.</li>
    <li><b>Does the brand approve of its resale?</b> No. Brands don't authorise testers to be sold, and in some countries they have taken sellers to court and won. Calling it a grey area is accurate. It is not an official channel.</li>
    <li><b>Is the person buying one at risk?</b> The cases we found were brought by brands against sellers, not against people who bought a bottle to wear. This is general information, not legal advice, and if you are buying testers to resell them, check the rules where you operate.</li>
    <li><b>What do you give up?</b> The box, gift-readiness, sometimes the cap, and anything the brand offers to retail customers.</li>
  </ul>
  <div class="notice">
    <p class="notice-title">What our guarantee covers on a tester</p>
    <p>Our authenticity guarantee covers whether the fragrance is genuine. It does not cover packaging differences, because a tester is sold exactly as its listing describes. See the <a href="guarantee.html#claim">claim rules</a>.</p>
  </div>
</section>

<section>
  <h2 id="who">Who should buy a tester?</h2>
  <p><b>A good fit</b> if you want the fragrance more than the box, you are replacing a bottle you already know and love, or you want to try a pricier house for less.</p>
  <p><b>Better to choose retail</b> if it is a gift, you collect, you need the original box and cap, or you want to deal with the brand's own after-sales support.</p>
</section>

<section>
  <h2 id="checklist">Before you buy a tester</h2>
  <ul class="checks">
    <li>The listing clearly says <b>Tester</b>.</li>
    <li>You have read the note beside the size, such as “No Box” or “No Cap”.</li>
    <li>You know the photo may show the retail bottle, and the tester arrives in plain packaging.</li>
    <li>You have asked about the cap and the fill level if either matters to you.</li>
    <li>You are not buying it as a gift.</li>
    <li>You know the usual checks for any bottle. See <a href="guide-spot-genuine-perfume.html">How to tell genuine perfume from a fake</a>.</li>
  </ul>
</section>
`,
  quick: "A perfume tester is a genuine, brand-made bottle meant for sampling at the counter. It holds the same fragrance as the retail bottle in plain packaging, so it costs less: typically 10–30% less in this shop's catalogue. Brands do not authorise testers to be sold, so reselling them is a grey area, not an official channel.",
  faq: [
    ["Does a tester smell the same as the retail bottle?", "It should, because it is the same fragrance. Any difference you notice is more likely to come from the batch, the age or how it was stored than from the word “tester”."],
    ["Does a tester last as long as a retail bottle?", "Longevity depends on the fragrance, its strength and your skin, not on the box it came in."],
    ["Why does a tester have no cap?", "Counter testers are sprayed all day, so the cap is often left off. Some come with one. The note beside the size tells you."],
    ["How do I know a tester isn't a fake?", "Use the same checks as for any bottle: the glass, the batch code, the sprayer and the liquid. A plain box is normal for a tester, but messy printing or a sloppy sprayer is still a warning sign."],
    ["Can I give a tester as a gift?", "It is better not to. There is no gift box, and the recipient may expect a retail pack. Choose a retail bottle instead."],
  ],
  faqAfter: `<p class="sources"><b>Sources and further reading.</b> <a href="https://www.humphreys.co.uk/articles/trademark-rights-are-not-exhausted-in-perfume-testers-european-court-decision" target="_blank" rel="noopener noreferrer">Humphreys &amp; Co., on the 2010 EU ruling</a> · <a href="https://legalblogs.wolterskluwer.com/trademark-blog/india-commercial-sale-of-perfume-testers-amounts-to-unfair-trade-practice-under-indian-trademark-law/" target="_blank" rel="noopener noreferrer">Kluwer Trademark Blog, on the 2023 Delhi High Court ruling</a>. Both open in a new tab. The information here is general and is not legal advice.</p>`,
  cta: { title: "Questions about a tester?", text: "Ask us what is in the box, what is missing and how full the bottle is before you order.", wa: "Hi! I have a question about a tester." },
};

export const BODIES = { spot, seasons, formats, testers };

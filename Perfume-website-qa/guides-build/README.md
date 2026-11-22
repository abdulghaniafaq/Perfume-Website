# Guides: how they are made (this folder is never uploaded)

The four guides and the Guides page live in the site folder as ordinary HTML (`guides.html`, `guide-*.html`) and can be edited by hand.
This folder holds the small tools that produced them, so they can be regenerated or extended.

| File | What it does |
| --- | --- |
| `meta.mjs` | Titles, short descriptions, categories and cover wording of each guide, plus the publish date. |
| `content.mjs` | The text of each guide (HTML inside template strings). |
| `art.mjs` | The line-art kit: bottles, boxes, vials, season icons and the three in-article figures (inline SVG, they follow light/dark mode). |
| `covers.mjs` | Draws the cover pictures (`<name>.jpg`, `<name>-card.jpg`, `<name>-og.jpg`) into `assets/images/guides/`. |
| `helpers.mjs` | Product tiles taken from the real catalogue; the guarantee wording the site fills in. |
| `build.mjs` | Writes `guides.html` and the four guide pages into `../Perfume-website`, with the same header, footer and head as the other pages. |
| `preview.mjs`, `shots.mjs` | Screenshots for a quick visual check. |

Regenerate everything:

    node guides-build/covers.mjs ../Perfume-website/assets/images/guides
    node guides-build/build.mjs

Running `build.mjs` overwrites the five pages, so make text edits in `content.mjs` / `meta.mjs`, or edit the HTML directly and stop using the builder.

## Adding a fifth guide
1. Add an entry to `GUIDES` in `meta.mjs` and its text to `content.mjs` (`BODIES`), and a cover drawing in `ART` in `covers.mjs`.
2. Run the two commands above.
3. Add the new file name to `lib/pages.mjs` and to `GUIDES` in `guides.test.mjs`, add the page to `sitemap.xml`, and run `npm test`.

## What the text rests on (research notes, November 2026)
- **Spotting fakes:** batch code on box and bottle should match; print, cellophane, glass, cap, sprayer and liquid are red flags, not proof; a matching code alone proves nothing. Gathered from several retailer guides (all of whom sell perfume, so treated as conventions, not facts).
- **Seasons:** heat amplifies and cold mutes scent; lighter strengths for heat, richer for cold; EDT/EDP/parfum ranges are conventions, not regulated. Months are rough Indian seasons. Picks come from the catalogue's own scent-family tags.
- **Formats:** retail / tester / decant / discovery set as described by several fragrance retailers; about 0.1 ml a spray is a common rule of thumb.
- **Testers (the part to have a lawyer read):** Coty Prestige Lancaster v. Simex Trading, CJEU, case C-127/09 (3 June 2010): testers marked "demonstration" and "not for resale" negate any presumption of the brand's consent to marketing. Coty Germany GmbH v. Xeryus Retail Pvt. Ltd., Delhi High Court, CS(COMM) 1298/2018, summary judgment 21 July 2023: permanent injunction against two websites selling Calvin Klein testers, INR 1,00,000 payable to the brand; the defendant did not contest. Sources are law-firm write-ups (Humphreys & Co.; Khaitan & Co. on the Kluwer Trademark Blog), not the judgments themselves.
- **"How testers reach resellers"** is the general trade route (surplus, wholesalers, liquidators). It is NOT a statement about where this shop's testers come from. Replace it with the real story if you want to say so.

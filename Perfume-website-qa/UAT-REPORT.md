# Perfume X Collections: QA regression and UAT report

Site folder tested: `Perfume-website` (31 MB, 8 pages). Test folder: `Perfume-website-qa` (never uploaded).
Browser engines: Chrome (everything), WebKit = the Safari engine (laptop and iPhone-sized). Firefox could not start in the test environment (see "Not covered").

## Result (final run, after the last round of changes)

| Run | Tests | Passed | Failed |
| --- | --- | --- | --- |
| **Full regression run on the final site (22 Nov 2026, 109 minutes): 14 pages + 627 perfume pages, security headers, WCAG 2.2 AA checks, every filter, quiz, guide, browser and screen size** | **1,371** | **1,371** | **0** |
| (the same run before the last fixes: 33 failures, all understood and fixed, then 1 more, then none) | 1,371 | 1,338 / 1,370 | 33 / 1 |
| (earlier, before the perfume pages: 13 pages, the guides, and the browser tests) | 1,015 | 1,015 | 0 |
| (the first full run of the guides, before the fixes below) | 969 | 931 | 38 |

(Firefox is reported as skipped: it cannot start in the test environment. The Safari engine, WebKit, ran.)

## Guides round (November 2026)

New: a Guides button in every header and footer, a Guides page, and four guides (spot a fake, scent by season, retail / tester / decant / discovery set, testers explained), with drawings, covers and real catalogue photos. 95 new end-to-end checks in `guides.test.mjs`; every site-wide suite now covers all 13 pages (`lib/pages.mjs`).

Found by the tests and fixed:

| # | Where | Finding | Fix |
| --- | --- | --- | --- |
| 1 | Guides (all four, phones) | The fade-in effect only starts when 12% of an element is on screen, so a long article could stay invisible forever on a phone. | The article text is excluded from the fade-in. |
| 2 | Seasons guide | "Take the 1-minute scent quiz" button: label drawn in the same gold as the button (contrast 1.0:1). | Gold buttons keep their dark label inside articles. |
| 3 | Header, 901 to about 985 px wide | Six links instead of five: the logo was squeezed and "How to order" wrapped. | The menu button now takes over at 1000px and below. |
| 4 | Guides | "Home" breadcrumb and the card titles were below the 40px tap size on touch screens. | Made larger. |
| 5 | Comparison tables on phones | The hidden header row was flagged as clipped text. | Hidden properly on phones; every cell carries its own label. |
| 6 | Guide article meta line | "5 min read", "By ..." and "Updated ..." had no spaces between them in the HTML. | Spaces added. |
| 7 | Tests | Assumed five header links, same-tab links only, and every link reachable by Tab. | Updated: six links; links to other websites open a new tab; picture links hidden from the keyboard (a titled link sits beside each) are excluded. |

Eight deliberate breakages of the site were each caught by the new tests (fade-in bug back, wrong-family pick, missing contents anchor, missing Guides link, family filter accepting anything, wrong discount claim, Read more opening the wrong guide, wrong number on a drawing pin).

## Perfume pages, accessibility, security and tags (22 November 2026)

- **627 perfume pages** (`perfume-<slug>.html`), generated from `data/products-data.js` by `seo-build/`; sizes and exact prices, season and time of day (from the scent family and strength only, stated on the page), notes only where sources fully agreed (20 perfumes), where the price sits in its house and style, other versions of the line, similar perfumes. 641 addresses in the sitemap.
- **WCAG 2.2 AA**: `wcag22.test.mjs` plus axe on 30 pages × light/dark × laptop/phone. Real problems found and fixed: faint form-field borders (1.2:1), missing focus rings on fields, a phone toast covering the focused control, a logo whose spoken name did not match its text, identical "Add to cart" names on every card, text clipped at 200%, smooth scrolling that ignored reduced motion, and a list column that collapsed to 33px. A scanner cannot prove full conformance: a screen-reader review by a person is still advisable.
- **Security (Netlify)**: `_headers` with a strict Content-Security-Policy, HSTS, no framing, no sniffing, limited referrers, unused browser features off; every page and interaction runs with zero policy violations; hostile text through the address bar, search, contact form and a forged saved cart is shown as text and never runs. Found and fixed: inline styles in three guides (the policy would have blocked them on Netlify) and the WhatsApp number in a code comment. Thirteen deliberate breakages were all caught by the new tests.
- **Tags**: every perfume now has a gender tag (427 added) and a scent family (393 added), from the owner's workbooks. The filters and the quiz no longer show a "Not yet tagged" choice (they show it again by themselves if a perfume ever lacks the tag).
- The sentence "In India it costs from ₹… (size)" was removed from every perfume page, as asked (the price is still in the sizes list, the first question and the About section).

## For you to decide (not test failures)

- **Tags applied as supplied but marked "review required" in your workbooks** (the workbook itself calls them suggestions where publishers disagree):
  gender (15): Ahmed Al Maghribi Musk & Roses (Unisex), Baldessarini Del Mar Limited Edition EDT (Men), Calvin Klein Eternity Summer EDP (Women), Coach New York EDT (Women), Jo Malone Wild Bluebell Cologne (Unisex), Kayali Vacay In A Bottle (Unisex), Lattafa Musamam Black (Unisex), Mancera Cedrat Boise Intense EDP (Unisex), Mancera Coco Vanille (Unisex), Montale Black Aoud EDP (Unisex), Nusuk Al Mukhtalif (Unisex), Tom Ford Black Orchid EDT (Women), Tom Ford Cafe Rose EDP (Women), Tom Ford Metallique EDP (Women), Tom Ford Soleil De Feu EDP (Unisex).
  scent family (10): Afnan Turathi Pour Homme (Fresh & Citrus), Baldessarini Del Mar Limited Edition EDT (Fresh & Citrus), Calvin Klein Eternity Summer EDP (Floral), Coach New York EDT (Floral), Giorgio Armani Code EDT (Amber & Spicy), Givenchy Gentleman EDT (Oud & Woody), Kayali Vacay In A Bottle (Fresh & Citrus), Lattafa Musamam Black (Oud & Woody), Nautica Sail EDT (Fresh & Citrus), Nusuk Al Mukhtalif (Floral).
- Season and time-of-day advice follows the scent family, so the Musk family (8 perfumes, "all seasons") and any family tagged loosely will give general advice; each page says it is general, not a test of that bottle.
- The data file lists Juicy Couture EDP under Elizabeth Arden (the workbook notes this); it is unchanged.
- Firefox could not start in the test environment (two checks are reported as skipped). To run them yourself, in Terminal: `cd "/Users/abdulghani/Desktop/Abdul Coder/Perfume-website-qa" && npm test -- crossbrowser.test.mjs`.

- The testers guide cites two court rulings and says brands do not authorise tester resale, while the FAQ says every fragrance is "officially sourced". Reword one of them if they conflict, and have a lawyer read the testers guide.
- "How testers reach resellers" describes the general trade, not where this shop's testers come from.

## Final round of changes (all tested)

Phone cart bar and "Added - View cart" message; floating WhatsApp button on every page; 24 cards a page on phones plus Back to top;
scent quiz button beside Filters; "Name: A to Z" sort; "Mini" badge on pictures that are not the mini; tighter home spacing and a shorter
phone catalogue heading; share-preview image, canonical addresses, sitemap, robots and store details for perfume-x-collections.netlify.app.
Tests: `ux.test.mjs` (new), `site.audit.test.mjs` (launch details), and the filter / search / responsive / accessibility suites updated for the new rules.

Two real problems found by those tests and fixed: the "Added" message could stay stuck while the mouse was over it, and on a phone with items
in the cart a form field near the bottom of the screen could sit under the new cart bar (focus is now kept clear by scroll padding).

## Issues found by this round and fixed

| # | Where | Finding | Fix |
| --- | --- | --- | --- |
| 1 | Cart | Minis showed the full-size bottle, not the mini picture. | Cart uses the same picture rule as the catalogue card; the "i" note says "The photo shows the mini you will receive" when the picture is the mini. |
| 2 | Catalogue search | Suggestion dropdown failed the keyboard-access accessibility rule (scrollable box nobody can reach with Tab). | The scroll now sits on the listbox itself (the standard pattern); look unchanged. |
| 3 | Catalogue page load | The footer sat mid-screen then jumped down when cards were drawn (layout shift 0.13 on laptop, 0.18 on phone; the "good" mark is 0.1). | Space is held until the cards appear: shift is now 0.000. Not applied when scripts are off. |
| 4 | How to order, Privacy, Terms | Headings skipped a level (h1 straight to h3). | Now proper h2 headings; computed look is identical. |
| 5 | Test method | Test measured the phone search hint wrongly after a Chrome update. | Test corrected; the site was fine. |

## What was checked

| Area | How | Result |
| --- | --- | --- |
| Filters, single | every value of every filter, compared with an independent calculation | pass |
| Filters, combined | every pair (1,300), 300 + 500 random 2-7-way mixes, every house x style x packaging (1,424), every house x price x sort (890), every family x gender x price x packaging (640), 150 on a phone, add-then-remove walks, dead ends explain themselves | pass |
| Search bar | all 627 perfumes by "House Name" and by name, all 89 houses, prefixes, capitals / accents / apostrophes / spacing / reversed words, part-words, misspellings, hostile input, keyboard and mouse, with other filters | pass |
| Every link | each link on all 8 pages, laptop and phone: right page or section, opens at top, no 404, no console error | pass |
| Every WhatsApp button | right number, real message, page stays put | pass |
| Every button | none is dead; every one visibly does something | pass |
| Keyboard | Tab reaches every control, no trap, visible focus mark on each | pass |
| Forms | contact request: validation, limits, message building, suggestions, confirmation; journey with real typing | pass |
| UAT journeys | 8 end-to-end journeys x laptop and phone (search to order, filter to order, quiz, contact, info pages, cart persistence, back/forward, theme) | pass |
| Accessibility | axe-core WCAG 2.0/2.1/2.2 A+AA: 8 pages x light/dark x laptop/phone, plus 13 states | pass |
| Files on a case-sensitive host | every reference spelled exactly; all 627 photos, 30 logos, 32 mini pictures present | pass |
| Markup | titles, descriptions, lang, one h1, ids, alt text, labels, safe links, no stray text | pass |
| Scripts off | all pages still read; catalogue note on the first screen; FAQ still opens | pass |
| Speed (laptop, and phone with CPU 4x slower) | pages ready in about 1 s (laptop) and under 2 s (slow phone); keystroke or filter redraw well under 400 ms; no freezes | pass |
| Layout | 26 screen sizes, light mode on 12, no sideways scroll | pass |
| Safari engine | search, filters, pagination, cart, quiz, FAQ, contact, menu, theme, home animation, on laptop and iPhone size | pass |

## Browsers round (November 2026)

| Browser | How it was tested | Result |
| --- | --- | --- |
| Safari (Mac, iPhone, iPad) | The Safari engine (WebKit) at laptop, iPhone and iPad sizes: all 13 pages, the core visits, the guides, printing, the pop-up fallback (54 checks) | pass |
| Brave, Microsoft Edge (incl. high-contrast colours), Opera, Samsung Internet, Chrome on Android phone and tablet | Chrome's engine behaving as each (identity, screen, settings): the same full visit in each, identical guide content in all six | pass |
| Settings that differ between browsers | Storage blocked; pop-up blocker refusing WhatsApp; Google fonts blocked; real fonts loaded; printing and Save as PDF; no browser sniffing | pass (after two fixes below) |
| Firefox | Could not be run here (see below) | not run |

Found and fixed:

| # | Finding | Fix |
| --- | --- | --- |
| 1 | If a browser's pop-up blocker refused the WhatsApp window (some Safari and Brave settings, in-app browsers such as Instagram's), the WhatsApp buttons silently did nothing. | The button now opens WhatsApp in the same tab when the window is refused. |
| 2 | No print styles: printing or saving as PDF from the dark theme gave pale text on white paper, plus the header, cart and WhatsApp button. | Print styles: dark text on white, no interface parts, the top picture and card row left out to save ink, cited addresses printed. |

Not a finding but worth knowing: with the real web fonts the header fits at every width from 1001px; below that the menu button is used.

## AEO / GEO round (November 2026)

Aim: be found and quoted by answer engines (Google answer boxes, Bing/Copilot, voice) and generative engines (ChatGPT, Claude, Perplexity, Gemini, Google AI answers). Nothing here can promise a result; see `seo-build/README.md` for what the research supports and what does not.

| # | Change | Why |
| --- | --- | --- |
| 1 | `perfumes.html`: all 627 perfumes by house with sizes and prices, as plain text, generated from the product data | The crawlers behind ChatGPT, Claude and Perplexity do not run JavaScript, so they saw an empty catalogue |
| 2 | Quick answer box and five common questions on each guide; FAQ grown from 7 to 14 questions (answers only from facts the Terms and home page already state); an "at a glance" fact list on the home page | Answer-first, quotable text |
| 3 | Structured data on every page (one shop entity with all brands, website with site search, page, breadcrumbs, FAQ, Article, item lists), tested against the visible text | Consistent entity; Google requires markup to match the page |
| 4 | `robots.txt` naming the AI search, assistant and training crawlers (all allowed), `llms.txt`, snippet permissions on every page, sitemap with all 14 pages | Explicit, true crawler guidance |
| 5 | Titles of the home page and two guides shortened (92 / 86 / 86 characters to 74 / 66 / 73) | Search results cut titles at about 60–70 characters |

Found by the tests and fixed: the home page's structured-data address was `/index.html` where the page's canonical is the site root; the new list page used a different element for the "last updated" date than every other page; the list page's HTML (147 KB; about 19 KB compressed) exceeded the 40 KB page budget meant for ordinary pages, so it has its own budget plus a limit on its compressed size.

**Found in the upload folder, not by a test of this round's work: an `email-sender` folder** (an outreach spreadsheet and a Python script with password-related lines) sat inside `Perfume-website`. It is not part of the site and would have been publicly downloadable if the folder was uploaded; the site-folder test flagged it. At the owner's request it was moved out on 21 November 2026 to `Abdul Coder/email-sender-moved-out-of-Perfume-website` (a different `email-sender` project already existed there, so nothing was merged or overwritten, and nothing was deleted). The full run below was made on an exact copy of the site folder without it, checked identical to the real folder afterwards.

## Not covered (needs a person or another environment)

- Firefox: it starts only if its own security sandbox is switched off inside the test environment, which the environment's safety rules do not allow (and which I did not work around). Its tests are written and are reported as skipped, not passed. To run them: open Terminal on your Mac and run `cd "Perfume-website-qa" && npm test -- crossbrowser.test.mjs`.
- The real Safari, Brave, Edge, Opera and Samsung Internet apps: not installed here (or, for Safari, not drivable without switching on "Allow Remote Automation" in its Develop menu). The Safari engine and Chrome's engine stand in for them.
- Real phones (iPhone, Android): emulated only. Worth one look on your own phone after upload.
- WhatsApp itself: the tests confirm the exact link and message; the real app is not opened.
- Screen readers by ear (VoiceOver / TalkBack): automated rules only.
- The live Netlify address still holds the older version until you upload.

## Before launch day

- (Done, 21 Nov 2026) The `_headers` file that told Google not to list the site has been removed; the site becomes listable when it is uploaded.
- After uploading: add the site to Google Search Console and Bing Webmaster Tools and submit `sitemap.xml` (steps in `seo-build/README.md`).
- Confirm "shipped within 3-4 days" means dispatch or delivery; replace the two gift-box photos (Versace Eros EDT, Afnan Turathi Pour Homme).

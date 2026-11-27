# Perfume X Collections: how to look after the website

Last updated: 22 November 2026. The website is live at https://perfume-x-collections.netlify.app/

This guide is written in plain language. If you want the long technical version (every test, every rule), it is in `README-test-details.md`.

---

## 1. The most important rule

There are two folders next to each other:

| Folder | What it is | Upload it? |
| --- | --- | --- |
| `Perfume-website` | The actual website | **Yes. This is the only folder you upload to Netlify.** |
| `Perfume-website-qa` | The checking tools and tests (this folder) | **Never.** |

---

## 2. What is on the site

The site has **641 pages**:

- 8 main pages: Home, Catalogue, How to order, Guarantee, FAQ, Contact, Privacy, Terms
- `perfumes.html`: every perfume, A to Z, grouped by house
- `guides.html` and 4 guides (seasons, testers, retail vs tester vs decant vs discovery set, how to spot a genuine perfume)
- **627 perfume pages**, one for each perfume (for example `perfume-lattafa-khamrah.html`)

The shop has 627 perfumes from 89 houses. Customers order on WhatsApp. Prices are in rupees.

**The perfume pages, the A to Z list, the four guides and `sitemap.xml` are made automatically from your product list. Do not edit them by hand.** Any change you make by hand will be wiped the next time they are rebuilt. See section 3 for how to rebuild.

---

## 3. Everyday jobs

### Change a price, add a perfume, or fix a name

1. Edit `Perfume-website/data/products-data.js`.
2. Rebuild the automatic pages. Open Terminal and run:
   ```
   cd "/Users/abdulghani/Desktop/Abdul Coder/Perfume-website-qa"
   node seo-build/build-all.mjs
   ```
3. Update the "prices last updated" month in `Perfume-website/data/site-config.js` (the line `pricesUpdated`). It shows in the footer, the Terms and the FAQ.
4. Look at the site on your own computer (section 4).
5. Run all the checks (section 5).
6. If everything passes, upload (section 6).

### Other changes

| To change | Edit this |
| --- | --- |
| WhatsApp number, **Instagram name** (the Instagram button on the Contact page; now `perfume_x_collections`, leave it empty to hide the button), brand name, guarantee settings, the list of stores where a perfume can be checked, number of days to make a claim | `Perfume-website/data/site-config.js` |
| Wording on Home, Catalogue, How to order, Guarantee, FAQ, Contact, Privacy or Terms | The matching `.html` file in `Perfume-website` |
| Colours, fonts and spacing | The top of `Perfume-website/assets/css/site.css` (dark colours first, then light colours under it) |
| A product photo | Replace both files for that perfume: `assets/images/<name>.jpg` (big) and `assets/images/thumbs/<name>.jpg` (small). Then run `node lib/make-photo-manifest.mjs` so the checks know the change was on purpose |
| A house logo on the Home page | Replace the file in `assets/images/brands/`, then run `node lib/make-logo-manifest.mjs` |
| A mini-bottle picture | Files are in `assets/images/minis/`. After changing one, run `node lib/make-mini-manifest.mjs` |
| Wording of a guide | The guide texts are built from `guides-build/`. After editing, run `node seo-build/build-all.mjs`, and change the date in `guides-build/meta.mjs` |

If you add a new page or a new menu item, ask for help. It has to be added in several places so that every page shows the same menu and footer. A check fails if one page is different.

---

## 4. Look at the site on your own computer first

Open Terminal and run:

```
cd "/Users/abdulghani/Desktop/Abdul Coder/Perfume-website"
python3 -m http.server 8080 --bind 127.0.0.1
```

Then open http://127.0.0.1:8080/index.html in your browser. Press **Cmd + Shift + R** to make sure you are seeing the newest version. Press **Control + C** in Terminal when you are done.

This preview shows the site exactly as it looks, but it does not apply Netlify's safety headers (section 8). The checks do apply them.

---

## 5. Check everything before uploading

The checks open the site in real browsers, click everything and compare what they see with your product list. One command runs all of them:

```
cd "/Users/abdulghani/Desktop/Abdul Coder/Perfume-website-qa"
npm install                  # only the very first time
caffeinate -dimsu npm test
```

- It takes **about 110 minutes**. `caffeinate` stops the Mac from sleeping while it runs.
- Do not change any site files while it runs.
- To check just one thing quickly, name the file: `npm test -- products.test.mjs`
- It needs Node (version 20 or newer) and Google Chrome installed.

**How to read the result.** At the end you will see a summary. The last full run on 22 November 2026 was **1,371 checks, 1,371 passed, 0 failed**. If your run shows any "fail", do not upload. Fix the problem and run again. The message under each failure says exactly which page or combination went wrong.

**Firefox.** The checks that use Firefox are skipped on some setups. To include them, run this once in your own Terminal: `npx playwright-core install webkit firefox`, then `npm test -- crossbrowser.test.mjs`.

---

## 6. Upload to Netlify

1. Make sure the checks passed (section 5).
2. In Netlify, open the site and go to the **Deploys** page.
3. Drag the **`Perfume-website`** folder onto the upload area. Only this folder.
4. Wait for "Published", then open the live site and hard-refresh (Cmd + Shift + R).

About 2,000 files, about 49 MB. Everything the site needs is inside `Perfume-website`.

---

## 7. What each perfume page shows

Each of the 627 pages has:

- The house and perfume name, and short tags (for men, women or everyone; scent family; strength such as EDP or EDT)
- A short "quick answer"
- Every size with its exact price, "Add" and "Order" buttons that work like the catalogue's
- A short description and an "at a glance" list
- **When to wear it** (seasons and time of day)
- **Notes** (top, heart, base), but only for the 20 perfumes whose sources fully agreed
- **Where it sits in our range**: how its price compares with other perfumes from the same house and in the same style, other versions of the same line, and other perfumes inspired by the same original
- Three common questions with short answers
- More from the same house, and similar perfumes
- Hidden information for Google and AI assistants (name, price in rupees, questions). It always matches what is on the page. It never claims "in stock" or star ratings, because the site does not track those.

**Honesty rule:** a page only says what the product list supports. The "when to wear it" advice comes only from the scent family and the strength, and the page says so. If a perfume's scent family is unknown, the page says that instead of guessing. We do not invent notes. Sixteen more perfumes have notes saved in `seo-build/details/notes.json` but held back because their sources disagreed. They are published only after two good sources agree.

**Tags:** all 627 perfumes now have a gender tag and a scent tag (added on 22 November 2026 from your two spreadsheets). Because nothing is "not tagged" any more, the "Not yet tagged" choice is hidden from the filters and the quiz. It comes back by itself if you ever add a perfume without a tag.

---

## 8. How the site is kept safe

`Perfume-website/_headers` is a small file that Netlify reads. It tells visitors' browsers to follow strict safety rules:

- Only use the site over HTTPS (secure connection)
- Only run this site's own code, plus Google Fonts for the fonts
- Do not let other websites show this site inside a frame
- Block the camera, microphone, location, payment and similar browser features (the site never uses them)
- When a visitor clicks a link to another site, share only the shop's name, not the full page address

The safety check loads every page with these exact rules and also tries to attack the site (for example, by sending harmful text through the search box and the contact form). All attacks are blocked and shown as plain text.

Good to know:

- If you add anything from another website (analytics, a chat button, a map, other fonts), the browser will block it until its address is added to `_headers`. The checks will fail to tell you.
- **Never add a "noindex" line to `_headers`.** It would hide the whole site from Google. The checks fail if one appears.

---

## 9. Easy to use for everyone (accessibility)

The site is checked against the WCAG 2.2 AA rules (the international standard for accessible websites):

- Colours are easy to read in both light and dark mode
- Everything can be used with a keyboard only. The focus outline is always visible and never hidden behind the menu bar, cart bar or message
- Buttons and links have a good size for fingers on a phone
- Text can be made bigger up to 200% and the page still works, with no sideways scrolling even on a small 320px phone
- Screen readers hear sensible names, for example "Add Lattafa Khamrah by Lattafa to cart" instead of just "Add to cart"
- Animations stop for visitors whose device asks for less motion

The tests catch many problems automatically, but they cannot replace a real person trying the site with a screen reader. It is worth doing that once.

---

## 10. Being found on Google and by AI assistants

- Every perfume has its own page, so a search such as "Lattafa Khamrah price in India" can land on exactly that perfume. One page per perfume is the right design.
- `sitemap.xml` lists all 641 pages. `robots.txt` welcomes search engines and AI crawlers. `llms.txt` is a short plain summary for AI assistants.
- Pages also carry hidden information that helps Google and AI assistants understand them. The checks make sure it always matches what visitors see.
- The checks also keep the perfume pages from being copies of each other. Different editions of the same perfume will still sound alike, and that is normal.
- The file `google2fe06118b36636a7.html` in the site folder proves to Google that you own the site. **Never delete it.**

More detail is in `seo-build/README.md`.

---

## 11. Rules that must never be broken

1. Upload only `Perfume-website`.
2. **The WhatsApp number must never appear in any page.** It lives only in `data/site-config.js`, and is put together when someone taps a WhatsApp button. A check scans every file for it.
3. Never put "noindex" or "X-Robots-Tag" in `_headers`.
4. Keep `google2fe06118b36636a7.html` in the site folder.
5. Do not edit the automatic pages by hand. Change the product list and rebuild.
6. Never open or share your `email-sender` folders. They are not part of the website and must stay outside `Perfume-website`.
7. After any change, run the checks before uploading.

---

## 12. Jobs only you can do

- [ ] After uploading, add the site to **Google Search Console**, press **Verify**, submit `sitemap.xml`, and use "Request indexing" for the Home page. Consider Bing Webmaster Tools too.
- [ ] Turn on **two-factor sign-in** for Netlify and for the Google account used with Search Console.
- [ ] Keep "Force HTTPS" switched on in Netlify, and never share Netlify tokens.
- [ ] If you get your own domain name, ask for help updating the site. Some settings (the address in the files, the HTTPS rule, a contact file for security researchers) should be updated at that time.
- [ ] Look over the **15 gender tags and 10 scent tags** marked "review required" in your spreadsheets. They were applied as you supplied them. The list is in `UAT-REPORT.md`.
- [ ] Ask your adviser to read the **Privacy Policy and Terms** (they are plain-language drafts, and do not cover cancellations and returns) and the testers guide, which quotes court cases.
- [ ] Decide whether the "shipped in 3 to 4 days" promise is one you can always keep, and whether "officially sourced" matches what the testers guide says.
- [ ] Two photos are used as your list says but do not look right: Versace Eros EDT (a hand holding a gift box) and Afnan Turathi Pour Homme (a box that says "Supremacy Collector's Edition"). Replace them when you have better ones.
- [ ] Juicy Couture is currently filed under Elizabeth Arden. Decide if that is what you want.
- [ ] Adding more perfume notes needs real research with two agreeing sources per perfume.
- [x] Your Instagram page (instagram.com/perfume_x_collections) is now linked from the Contact page.
- [ ] Optional later: more real shop details (who runs it, city, business number) would help Google and AI assistants trust the site. Only add what is true. The Instagram link could also be added to the hidden page information and the footer if you want.

---

## 13. How the site behaves (rules the checks lock in)

**Catalogue**
- A search box, one **Filters** button, four tabs (All, Designer, Luxury & niche, Middle Eastern) and a sort button (price low to high, or high to low).
- Search finds **house names and perfume names**, in any word order. Capital letters, accents and apostrophes do not matter. It does not search the "inspired by" text or the size. While typing, up to eight suggestions appear: houses first, then perfumes.
- The Filters panel has House, For, Scent, Price and Size. The number beside each choice is how many perfumes you would get. Choices that would give nothing are greyed out. If nothing matches, the page tells you which filter to remove.
- Price groups never overlap. A ₹1,000 perfume is in "₹1,000 to ₹3,000" only. There are five groups, up to ₹10,000 and above.
- Same price? Perfumes stay in catalogue order (house, then name).

**Find my scent quiz**
- Every perfume lands in exactly one answer to each question, so the numbers on the answers always add up to the number "in the running". A perfume with several sizes counts once, at its cheapest listing.
- A question is skipped if fewer than two answers have any perfumes, and empty answers are hidden, so nobody reaches an empty result.

**Cart and orders**
- Each cart item shows the same picture as its catalogue card (a mini bottle shows its own mini picture if there is one).
- A small **i** beside every mini and tester explains what will actually arrive. It is not part of the WhatsApp message.
- Pressing Order opens WhatsApp with the whole order written out. If the browser blocks the pop-up, WhatsApp opens in the same tab.
- The contact page "Request a perfume" form builds its message from the filled-in boxes only. Nothing a visitor types is ever run as code.
- The phone number is shown masked (`+91 ••••• ••272`) or hidden. This is controlled by `numberDisplay` in `site-config.js`.

**Home page**
- Three real photos at the top, each linking to that perfume.
- "Houses we carry": three rows (Middle Eastern, Designer, Luxury & niche) with the 10 houses that have the most perfumes in each, shown as logos. They scroll slowly, pause on hover or with the Pause button, and stand still for visitors who ask for less motion.

**Light and dark mode**
- The site follows the device setting until the visitor taps the sun or moon button. The choice is remembered on every page.

**Phones and small screens**
- From 1000px wide and below the menu becomes a button. Tap targets are at least 44px. Form text is large enough that iPhones do not zoom in. The site is tested from a 320px phone to a very wide monitor.

---

## 14. What the checks cover, in plain words

There are 35 check files with 1,371 checks in total.

| Area | What is checked |
| --- | --- |
| Product list | Every field is valid, no duplicates, A to Z order, every price belongs to one price group |
| Filters and search | Every filter alone, every pair, hundreds of random mixes, the live numbers, the "nothing matches" help, typing in the search box and the suggestions |
| Quiz | Hundreds of random paths, and the numbers always adding up |
| Perfume pages | Every page matches the product list: names, prices, sizes, questions, notes, "when to wear", "where it sits in our range", links. Add and Order buttons work like the catalogue's |
| Home, guides, FAQ, legal pages | Every link, picture and wording rule on those pages |
| Photos | Every perfume has both photos, the right size, and the pictures have not been swapped between perfumes |
| Cart, WhatsApp, contact form | The order message is exact, the number is never in the page, harmful text is shown as text |
| Screens | 26 screen sizes from small phones to ultrawide monitors: no sideways scrolling, nothing cut off, nothing overlapping |
| Browsers | Chrome, Safari's engine (WebKit), Firefox where possible, plus Edge, Brave, Opera, Samsung Internet and Android settings; private mode and blocked pop-ups; printing |
| Accessibility | Automatic scans plus real keyboard walks, zoom, colour contrast, and spoken names |
| Security | The `_headers` rules, and attack attempts that must fail |
| Search and AI | Sitemap, `robots.txt`, `llms.txt`, hidden page information, and that every page works without JavaScript |
| Speed | Page and picture weight, loading time, no jumping while loading, typing stays smooth on a slow phone |
| Click-throughs | Real clicking of every link and button on a laptop and a phone, and full shopping journeys from start to finish |

**What the checks cannot do:** judge whether the writing is good, test with real screen readers, or run Firefox in every setup. Those need a person.

---

## 15. Where things are

```
Perfume-website/                (the website: upload this)
  index.html, catalogue.html, how-to-order.html, guarantee.html,
  faq.html, contact.html, privacy.html, terms.html
  perfumes.html                 A to Z list (made automatically)
  perfume-<name>.html (627)     one page per perfume (made automatically)
  guides.html, guide-*.html     the guides (made automatically)
  _headers                      safety rules for Netlify
  robots.txt, sitemap.xml, llms.txt
  google2fe06118b36636a7.html   proof of ownership for Google
  data/site-config.js           settings: WhatsApp number, dates, guarantee
  data/products-data.js         the 627 perfumes and prices
  assets/                       pictures, styles (css) and code (js)

Perfume-website-qa/             (tools and tests: never upload)
  README.md                     this guide
  README-test-details.md        the long technical version
  UAT-REPORT.md                 the latest test report and the tags to review
  seo-build/                    makes the perfume pages, A to Z list and sitemap
  guides-build/                 makes the four guides
  *.test.mjs                    the checks
```

Other documents: `UAT-REPORT.md` (the test report), `seo-build/README.md` (search engines and AI assistants).

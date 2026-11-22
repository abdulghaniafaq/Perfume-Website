// Draws the cover picture of each guide (gold line art on the site's dark background) and saves it as JPG:
//   <img>.jpg        text-free picture: the article's top image
//   <img>-card.jpg   the same, smaller: the card on the Guides page
//   <img>-og.jpg     with the brand name and the title: the preview shown when the guide is shared (WhatsApp etc.)
// Run:  node guides-build/covers.mjs <output folder>
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { GUIDES } from "./meta.mjs";
import { bottle, box, atomiser, tray, vial, icon, icons, figCSS } from "./art.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(here, "covers-out");
fs.mkdirSync(out, { recursive: true });

const G = "#d4af6a", GH = "#f0d9a4", BG = "#0b0a09";
const text = (x, y, t, size, extra = "") => `<text class="tx" x="${x}" y="${y}" text-anchor="middle" style="font-size:${size}px;font-weight:500;letter-spacing:.14em" ${extra}>${t}</text>`;
const rings = (cx, cy) => [300, 230, 160].map((r, i) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${G}" stroke-width="1.4" opacity="${0.16 - i * 0.03}"/>`).join("");

/* each art: { w, h, svg } drawn in its own coordinate box */
const ART = {
  spot: () => ({
    w: 600, h: 560,
    svg: rings(300, 300)
      + bottle({ x: 195, y: 200, w: 210, h: 280, level: 0.62, code: "4A12", sw: 3, rx: 14 })
      + `<g><circle cx="410" cy="395" r="112" fill="${BG}" fill-opacity=".82" stroke="${GH}" stroke-width="7"/><path d="M490 476L568 554" stroke="${GH}" stroke-width="20" stroke-linecap="round"/>`
      + `<text x="410" y="412" text-anchor="middle" style="font:600 56px Jost,sans-serif;letter-spacing:.08em" fill="${GH}">4A12</text><path d="M338 432h144" stroke="${G}" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 9"/></g>`
      + `<g><circle cx="130" cy="150" r="52" fill="${GH}"/><path d="M106 150l18 18 32-36" fill="none" stroke="${BG}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></g>`,
  }),
  seasons: () => {
    const names = ["spring", "summer", "monsoon", "autumn", "winter"], cx = 300, cy = 340, R = 236;
    const ang = [-170, -127, -90, -53, -10];
    let s = rings(cx, 370);
    names.forEach((nm, i) => {
      const a = (ang[i] * Math.PI) / 180, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      s += `<g><circle class="fl" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="56" stroke-width="2.6"/><g transform="translate(${(x - 38).toFixed(1)} ${(y - 38).toFixed(1)}) scale(1.58)">${icons[nm]}</g></g>`;
    });
    return { w: 620, h: 560, svg: s + bottle({ x: 215, y: 326, w: 190, h: 206, level: 0.62, sw: 3, rx: 16 }) };
  },
  formats: () => ({
    w: 710, h: 450,
    svg: `<g transform="translate(0 -112)">` + box({ x: 0, y: 140, w: 116, h: 330, d: 24, sw: 3 }) + bottle({ x: 150, y: 290, w: 74, h: 180, sw: 3 })
      + `<path class="ln dash" d="M118 140l22-12M6 156l56-10" opacity=".6" stroke-width="2"/>`
      + box({ x: 262, y: 190, w: 100, h: 280, d: 22, plain: true, label: "TESTER", sw: 3 }) + bottle({ x: 392, y: 320, w: 64, h: 150, cap: false, sw: 3 })
      + atomiser({ x: 498, y: 392, w: 32, h: 78 }) + tray({ x: 566, y: 410, w: 140, h: 60, count: 5 })
      + `<path class="ln" d="M0 482h710" opacity=".3" stroke-width="1.6"/>`
      + text(112, 526, "RETAIL", 19) + text(328, 526, "TESTER", 19) + text(514, 526, "DECANT", 19) + text(640, 522, "DISCOVERY", 17) + text(640, 546, "SET", 17) + `</g>`,
  }),
  testers: () => ({
    w: 700, h: 430,
    svg: `<g transform="translate(0 -92)">` + box({ x: 0, y: 120, w: 168, h: 300, d: 28, sw: 3 }) + bottle({ x: 206, y: 250, w: 92, h: 170, sw: 3 })
      + `<path class="ln dash" d="M170 120l26-14M8 138l70-13" opacity=".6" stroke-width="2"/>`
      + `<circle class="fl" cx="346" cy="290" r="30" stroke-width="2.6"/><path class="ln" d="M331 282h30M331 298h30" stroke-width="3.4"/>`
      + box({ x: 400, y: 150, w: 132, h: 270, d: 26, plain: true, label: "TESTER", sw: 3 }) + bottle({ x: 566, y: 266, w: 92, h: 154, cap: false, sw: 3 })
      + text(150, 482, "RETAIL", 21) + text(346, 482, "SAME JUICE", 17) + text(524, 482, "TESTER", 21) + `</g>`,
  }),
};

const FIG_VARS = `--fig-line:${G};--fig-fill:rgba(212,175,106,.09);--fig-soft:rgba(212,175,106,.22);--fig-hi:${GH};--fig-ink:#f3ede2;--fig-muted:#a69d8d;--fig-on:${BG}`;

function page(g, withText) {
  const art = ART[g.id]();
  const box = withText ? { x: 600, y: 74, w: 560, h: 486 } : { x: 60, y: 50, w: 1080, h: 530 };
  const k = Math.min(box.w / art.w, box.h / art.h);
  const tx = box.x + (box.w - art.w * k) / 2, ty = box.y + (box.h - art.h * k) / 2;
  const [l1, l2] = g.cover.head;
  const copy = withText ? `
    <div class="brand"><svg viewBox="0 0 32 32" width="44" height="44"><path d="M16 3l9 13-9 13-9-13z" fill="none" stroke="${G}" stroke-width="1.6"/><path d="M16 9l4.5 7-4.5 7-4.5-7z" fill="${G}"/></svg><span>Perfume X Collections</span></div>
    <p class="eye">${g.cat} · Guide</p>
    <h1>${l1}<br>${l2}</h1>
    <p class="sub">${g.cover.sub}</p>` : "";
  return `<!doctype html><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Jost:wght@400;500;600&display=swap" rel="stylesheet">
<style>${figCSS}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;overflow:hidden;position:relative;background:radial-gradient(70% 90% at 78% 12%,#2a2013 0%,#14100b 45%,${BG} 100%);color:#f3ede2;font-family:Jost,sans-serif}
svg.art{position:absolute;left:0;top:0;${FIG_VARS}}
.brand{position:absolute;left:72px;top:64px;display:flex;align-items:center;gap:14px;font:500 38px "Cormorant Garamond",serif;color:#f0d9a4}
.eye{position:absolute;left:72px;top:206px;font:500 19px Jost;letter-spacing:.22em;text-transform:uppercase;color:${G}}
h1{position:absolute;left:72px;top:248px;width:520px;font:500 64px/1.06 "Cormorant Garamond",serif;color:#f3ede2}
.sub{position:absolute;left:72px;top:446px;width:480px;font:400 25px/1.35 Jost;color:#a69d8d}
</style>
<svg class="art" width="1200" height="630" viewBox="0 0 1200 630"><g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${k.toFixed(4)})">${art.svg}</g></svg>${copy}`;
}

const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const g of GUIDES) {
  for (const withText of [false, true]) {
    const p = await ctx.newPage();
    await p.setContent(page(g, withText), { waitUntil: "networkidle" });
    await p.evaluate(() => document.fonts.ready);
    const png = path.join(out, `${g.img}${withText ? "-og" : ""}.png`);
    await p.screenshot({ path: png });
    await p.close();
  }
}
await browser.close();

// PNG -> JPG (and the small card size) with Pillow
const py = `
import sys
from PIL import Image
out = sys.argv[1]
for name in sys.argv[2:]:
    for suffix in ("", "-og"):
        im = Image.open(f"{out}/{name}{suffix}.png").convert("RGB")
        im.save(f"{out}/{name}{suffix}.jpg", "JPEG", quality=86, optimize=True, progressive=True)
        if suffix == "":
            im.resize((640, 336), Image.LANCZOS).save(f"{out}/{name}-card.jpg", "JPEG", quality=84, optimize=True, progressive=True)
`;
execFileSync("python3", ["-c", py, out, ...GUIDES.map((g) => g.img)]);
for (const f of fs.readdirSync(out)) if (f.endsWith(".png")) fs.unlinkSync(path.join(out, f));
console.log(fs.readdirSync(out).map((f) => `${f} ${(fs.statSync(path.join(out, f)).size / 1024).toFixed(0)}KB`).join("\n"));

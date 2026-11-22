// Line-art kit for the Guides: bottles, boxes, vials, season icons, and the three in-article figures.
// Everything is plain inline SVG that takes its colours from CSS variables (--fig-*), so the same drawing works in the
// dark theme, the light theme and on the rendered cover images (covers.mjs sets the variables itself).
const n = (v) => Math.round(v * 10) / 10;

/** A perfume bottle. (x, y) is the top-left of the glass body. */
export function bottle({ x, y, w, h, level = 0.6, cap = true, tube = true, rx = 10, code = "", sw = 2 }) {
  const nw = w * 0.34, nx = x + (w - nw) / 2, cx = x + w / 2;
  const neckH = h * 0.1, collarH = h * 0.09, capH = h * 0.4, capW = w * 0.6;
  const neckY = y - neckH, collarY = neckY - collarH, capY = collarY - capH;
  const ly = y + h * (1 - level);
  let s = `<g stroke-width="${sw}">`;
  s += `<rect class="fl" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${rx}"/>`;
  s += `<rect class="sf" x="${n(x + 5)}" y="${n(ly)}" width="${n(w - 10)}" height="${n(y + h - 5 - ly)}" rx="${Math.max(3, rx - 4)}"/>`;
  s += `<path class="ln" d="M${n(x + 11)} ${n(y + 14)}v${n(h * 0.32)}" opacity=".45"/>`;
  s += `<rect class="fl" x="${n(nx)}" y="${n(neckY)}" width="${n(nw)}" height="${n(neckH + 2)}"/>`;
  s += `<rect class="fl" x="${n(nx - 5)}" y="${n(collarY)}" width="${n(nw + 10)}" height="${n(collarH)}" rx="2"/>`;
  if (cap) {
    s += `<rect class="fl" x="${n(cx - capW / 2)}" y="${n(capY)}" width="${n(capW)}" height="${n(capH)}" rx="6"/>`;
    s += `<path class="ln" d="M${n(cx - capW / 2 + 7)} ${n(capY + 9)}v${n(capH - 18)}" opacity=".45"/>`;
  } else {                                                                 // no cap: the pump and nozzle show
    s += `<rect class="fl" x="${n(cx - nw * 0.3)}" y="${n(collarY - 11)}" width="${n(nw * 0.6)}" height="12" rx="2"/>`;
    s += `<path class="ln" d="M${n(cx + nw * 0.3)} ${n(collarY - 6)}h9"/>`;
  }
  if (tube) s += `<path class="ln" d="M${n(cx)} ${n(neckY + 4)}V${n(y + h - (code ? 30 : 10))}" stroke-width="1.4" opacity=".7"/>`;
  if (code) s += `<text class="tm" x="${n(cx)}" y="${n(y + h - 11)}" text-anchor="middle" font-size="${n(Math.max(11, w * 0.15))}">${code}</text>`;
  return s + `</g>`;
}

/** A retail box in three-quarter view, with the brand mark and two lines of print on the front. */
export function box({ x, y, w, h, d = 24, plain = false, label = "", sw = 2 }) {
  const cx = x + w / 2;
  let s = `<g stroke-width="${sw}">`;
  s += `<path class="fl" d="M${x} ${y}l${d} ${-d * 0.55}h${w}l${-d} ${d * 0.55}z"/>`;                       // top
  s += `<path class="fl" d="M${x + w} ${y}l${d} ${-d * 0.55}v${h}l${-d} ${d * 0.55}z" opacity=".75"/>`;      // side
  s += `<rect class="fl" x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>`;                              // front
  if (plain) {
    s += `<path class="ln" d="M${x + 10} ${y + 12}h${w - 20}" opacity=".5"/>`;
    if (label) s += `<rect class="ln" x="${n(cx - w * 0.36)}" y="${n(y + h * 0.4)}" width="${n(w * 0.72)}" height="${n(h * 0.17)}" rx="3" stroke-dasharray="4 4"/><text class="tx" x="${n(cx)}" y="${n(y + h * 0.4 + h * 0.115)}" text-anchor="middle" font-size="${n(Math.max(12, w * 0.13))}" letter-spacing=".12em" font-weight="600">${label}</text>`;
  } else {
    s += `<rect class="ln" x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${h - 16}" rx="1" opacity=".5" stroke-width="1.2"/>`;
    const dy = y + h * 0.3, r = Math.min(w * 0.12, 16);
    s += `<path class="ln" d="M${n(cx)} ${n(dy - r * 1.25)}l${n(r)} ${n(r * 1.25)}l${n(-r)} ${n(r * 1.25)}l${n(-r)} ${n(-r * 1.25)}z"/><path class="hi" d="M${n(cx)} ${n(dy - r * 0.55)}l${n(r * 0.45)} ${n(r * 0.55)}l${n(-r * 0.45)} ${n(r * 0.55)}l${n(-r * 0.45)} ${n(-r * 0.55)}z"/>`;
    s += `<path class="ln" d="M${n(cx - w * 0.26)} ${n(y + h * 0.5)}h${n(w * 0.52)}M${n(cx - w * 0.17)} ${n(y + h * 0.58)}h${n(w * 0.34)}" opacity=".7"/>`;
  }
  return s + `</g>`;
}

/** A small spray atomiser (decant) */
export function atomiser({ x, y, w, h, level = 0.7 }) {
  const cx = x + w / 2, ly = y + h * (1 - level);
  return `<g stroke-width="2"><rect class="fl" x="${x}" y="${y}" width="${w}" height="${h}" rx="5"/><rect class="sf" x="${x + 3}" y="${n(ly)}" width="${w - 6}" height="${n(y + h - 3 - ly)}" rx="3"/>`
    + `<rect class="fl" x="${n(cx - w * 0.22)}" y="${n(y - 9)}" width="${n(w * 0.44)}" height="10" rx="1"/><rect class="fl" x="${n(cx - w * 0.3)}" y="${n(y - 22)}" width="${n(w * 0.6)}" height="13" rx="3"/><path class="ln" d="M${n(cx + w * 0.3)} ${n(y - 15)}h7"/></g>`;
}

/** A tiny sample vial with a screw top */
export function vial({ x, y, w, h, level = 0.7 }) {
  const ly = y + h * (1 - level);
  return `<g stroke-width="2"><rect class="fl" x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/><rect class="sf" x="${x + 2.5}" y="${n(ly)}" width="${n(w - 5)}" height="${n(y + h - 2.5 - ly)}" rx="2"/><rect class="hi" x="${n(x - 1)}" y="${n(y - 9)}" width="${n(w + 2)}" height="10" rx="2"/></g>`;
}

/** A flat gift tray holding `count` vials: a discovery set */
export function tray({ x, y, w, h, count = 5 }) {
  const gap = w / count, vw = Math.min(14, gap * 0.55);
  let s = `<g stroke-width="2"><rect class="fl" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/>`;
  for (let i = 0; i < count; i++) s += vial({ x: n(x + gap * (i + 0.5) - vw / 2), y: n(y + 16), w: n(vw), h: n(h - 26), level: 0.65 });
  return s + `</g>`;
}

/** A numbered pin for the annotated figure */
export const pin = (cx, cy, num, r = 15) => `<g><circle class="pinc" cx="${cx}" cy="${cy}" r="${r}"/><text class="pinn" x="${cx}" y="${cy + 6}" text-anchor="middle">${num}</text></g>`;

/* ----- season icons: 48 x 48, drawn around (24, 24) ----- */
const I = (body) => `<g class="ln" stroke-width="2.4">${body}</g>`;
export const icons = {
  spring: I(`<circle cx="24" cy="15" r="5.4"/><circle cx="32.6" cy="21.2" r="5.4"/><circle cx="29.3" cy="31.3" r="5.4"/><circle cx="18.7" cy="31.3" r="5.4"/><circle cx="15.4" cy="21.2" r="5.4"/><circle class="hi" cx="24" cy="25" r="3.6" stroke="none"/><path d="M24 36v9M24 42c-5 0-8-3-9-7M24 42c5 0 8-3 9-7" />`),
  summer: I(`<circle cx="24" cy="24" r="8"/><path d="M24 5v6M24 37v6M5 24h6M37 24h6M10.5 10.5l4.2 4.2M33.3 33.3l4.2 4.2M10.5 37.5l4.2-4.2M33.3 14.7l4.2-4.2"/>`),
  monsoon: I(`<path d="M14 28a8 8 0 0 1 1.5-15.8A10 10 0 0 1 34.6 14 7 7 0 0 1 35 28z"/><path d="M16 33l-3 7M25 33l-3 7M34 33l-3 7"/>`),
  autumn: I(`<path d="M8 40C8 20 20 8 42 8c0 22-12 34-34 32z"/><path d="M8 40L30 18M20 28l1-9M26 22l8 0"/>`),
  winter: I(`<path d="M24 5v38M7.5 14.5l33 19M40.5 14.5l-33 19"/><path d="M19 8l5 4 5-4M19 40l5-4 5 4M9 21l6-1-1-6M39 27l-6 1 1 6M9 27l6 1-1 6M39 21l-6-1 1-6"/>`),
};
export const icon = (name, size = 48, extra = "") => `<svg class="sicon" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true" focusable="false"${extra}>${icons[name]}</svg>`;

/* ----- the three figures that go inside the articles ----- */
const svg = (vb, label, inner) => `<svg class="fig-svg" viewBox="${vb}" role="img" aria-label="${label}" focusable="false">${inner}</svg>`;

/** Guide 1: where to look on a retail pack (six numbered spots) */
export function figSpot() {
  const inner = box({ x: 22, y: 70, w: 178, h: 232, d: 26 })
    + `<path class="ln dash" d="M200 70l26-14M176 70l24-0M226 56v14" opacity=".8" stroke-width="1.6"/>`                       // cellophane fold at the top corner
    + `<path class="ln dash" d="M34 84l60-12M148 292l40-60" opacity=".35" stroke-width="1.6"/>`                              // shine
    + `<rect class="ln" x="36" y="262" width="74" height="26" rx="3" stroke-width="1.6"/><text class="tm" x="73" y="280" text-anchor="middle" font-size="14">4A12</text>`
    + bottle({ x: 338, y: 150, w: 122, h: 152, level: 0.62, code: "4A12" })
    + pin(240, 56, 1) + pin(156, 275, 2) + pin(478, 294, 3) + pin(444, 76, 4) + pin(448, 124, 5) + pin(300, 214, 6)
    + `<path class="ln" d="M456 126h-20M450 280h14M318 214h14" stroke-width="1.4" opacity=".6"/>`;
  return svg("0 0 520 330", "A boxed perfume bottle with six numbered spots to check: 1 the cellophane, 2 the box and its batch code, 3 the bottle and the batch code on its base, 4 the cap, 5 the sprayer and 6 the liquid", inner);
}

/** Guide 3: the same fragrance in five formats (not to scale) */
export function figSizes() {
  const base = 204;
  let s = `<path class="ln" d="M14 ${base + 6}h492" opacity=".35" stroke-width="1.6"/>`;
  s += bottle({ x: 36, y: base - 116, w: 78, h: 116, level: 0.7 });
  s += bottle({ x: 154, y: base - 74, w: 50, h: 74, level: 0.7, sw: 1.8, rx: 7 });
  s += atomiser({ x: 252, y: base - 62, w: 30, h: 62 });
  s += vial({ x: 332, y: base - 44, w: 17, h: 44 });
  s += tray({ x: 392, y: base - 52, w: 108, h: 52, count: 5 });
  const lab = (cx, t) => `<text class="tx" x="${cx}" y="${base + 38}" text-anchor="middle" font-size="19" font-weight="500">${t}</text>`;
  s += lab(75, "100 ml") + lab(179, "10 ml") + lab(267, "5 ml") + lab(340, "2 ml") + lab(446, "5 × 2 ml");
  return svg("0 0 520 250", "The same perfume in five formats, shown larger to smaller: a 100 millilitre bottle, a 10 millilitre travel spray, a 5 millilitre decant, a 2 millilitre vial and a discovery set of five 2 millilitre vials. Not to scale.", s);
}

/** Guide 4: retail pack and tester pack side by side: same liquid, different packaging */
export function figTester() {
  let s = box({ x: 24, y: 76, w: 100, h: 172, d: 22 }) + bottle({ x: 154, y: 146, w: 60, h: 102, level: 0.66 });
  s += `<path class="ln dash" d="M126 76l20-11M28 88l40-8" opacity=".7" stroke-width="1.6"/>`;
  s += box({ x: 292, y: 84, w: 92, h: 164, d: 22, plain: true, label: "TESTER" }) + bottle({ x: 416, y: 152, w: 60, h: 96, level: 0.66, cap: false });
  s += `<circle class="fl" cx="252" cy="160" r="21"/><path class="ln" d="M242 154h20M242 166h20" stroke-width="2.6"/>`;
  const lab = (cx, t) => `<text class="tx" x="${cx}" y="292" text-anchor="middle" font-size="19" font-weight="500" letter-spacing=".14em">${t}</text>`;
  s += lab(118, "RETAIL") + lab(384, "TESTER");
  return svg("0 0 520 310", "A retail pack on the left, with a decorated box, cellophane and a cap, and a tester on the right, with a plain carton and no cap. An equals sign between them shows they hold the same fragrance.", s);
}

/** CSS that gives the drawings their colours (used by the page and by the cover renderer) */
export const figCSS = `
.ln{fill:none;stroke:var(--fig-line);stroke-linecap:round;stroke-linejoin:round}
.fl{fill:var(--fig-fill);stroke:var(--fig-line);stroke-linecap:round;stroke-linejoin:round}
.sf{fill:var(--fig-soft);stroke:none}
.hi{fill:var(--fig-hi);stroke:none}
.dash{stroke-dasharray:5 5}
.tx{fill:var(--fig-ink);font-family:Jost,system-ui,sans-serif}
.tm{fill:var(--fig-muted);font-family:Jost,system-ui,sans-serif;letter-spacing:.06em}
.pinc{fill:var(--fig-hi);stroke:none}
.pinn{fill:var(--fig-on);font:600 18px Jost,system-ui,sans-serif}
`;

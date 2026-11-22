// Helpers for the light / dark theme tests.
//
// auditContrast(page): checks every piece of visible text on the page against what is really behind it (WCAG
// contrast: 4.5:1 for normal text, 3:1 for large text). Where the background is a gradient or a translucent wash,
// the WORST colour it passes through is used, so a pass means the text is readable everywhere it sits.
// Returns a list of problems (empty = fine).

export const auditContrast = (page, { minNormal = 4.5, minLarge = 3 } = {}) =>
  page.evaluate(({ minNormal, minLarge }) => {
    const parse = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = 1] = m[1].split(/[,/\s]+/).filter(Boolean).map(Number);
      return [r, g, b, a];
    };
    const over = (top, bottom) => {                        // top colour (with alpha) painted over an opaque bottom colour
      const a = top[3];
      return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
    };
    const lum = ([r, g, b]) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

    // every background the text could sit on: walk up to the first opaque colour, then add what the gradients/washes above it do to it
    const backgrounds = (el) => {
      const layers = [];
      let base = null;
      for (let e = el; e && !base; e = e.parentElement) {
        const cs = getComputedStyle(e);
        const img = cs.backgroundImage;
        if (img && img !== "none") layers.push((img.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean));
        const bg = parse(cs.backgroundColor);
        if (bg && bg[3] > 0) { if (bg[3] === 1) base = bg; else layers.push([bg]); }
      }
      base = base || parse(getComputedStyle(document.body).backgroundColor);
      let cands = [base];
      // A gradient shows only its own colours (a transparent stop lets what is beneath show through), so the
      // backgrounds it can produce are its stops laid over whatever is below — never the plain colour beneath an opaque one.
      for (const stops of layers.reverse()) if (stops.length) cands = cands.flatMap((c) => stops.map((s) => over(s, c)));   // outermost layer first
      return cands;
    };

    const opacityOf = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity); return o; };
    const visible = (el) => {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && opacityOf(el) > 0.5;   // (hidden or mid-fade elements are skipped)
    };

    const problems = [], seen = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) {
      const text = n.textContent.replace(/\s+/g, " ").trim();
      const el = n.parentElement;
      if (!text || !el || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName) || !visible(el)) continue;
      if (el.closest("[aria-disabled='true'], :disabled, [hidden], .sr-only, svg")) continue;
      const cs = getComputedStyle(el);
      const fg = parse(cs.color);
      if (!fg || fg[3] === 0) continue;                    // transparent text (the gradient "3×" is checked through its own colours below)
      const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 600;
      const large = size >= 24 || (size >= 18.66 && bold);
      const need = large ? minLarge : minNormal;
      let worst = Infinity, against = null;
      for (const bg of backgrounds(el)) {
        const c = over(fg, bg), r = ratio(c, bg);
        if (r < worst) { worst = r; against = bg; }
      }
      if (worst < need) {
        const key = `${el.tagName}.${el.className}|${cs.color}|${against.map(Math.round)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        problems.push(`${worst.toFixed(2)}:1 (needs ${need}) "${text.slice(0, 38)}" — <${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ")[0] : ""}> ${cs.color} on rgb(${against.map(Math.round).slice(0, 3)})`);
      }
    }
    return problems;
  }, { minNormal, minLarge });

/** Make the page show a theme without touching the toggle (what a visitor's saved choice would do). */
export const setTheme = (page, theme) => page.evaluate((t) => window.PX.theme.set(t), theme);

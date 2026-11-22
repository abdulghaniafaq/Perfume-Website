// Renders the figures and season icons on dark and light backgrounds so the drawings can be checked by eye.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { figSpot, figSizes, figTester, icon, figCSS } from "./art.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(here, "preview");
fs.mkdirSync(out, { recursive: true });
const THEMES = {
  dark: "--fig-line:#d4af6a;--fig-fill:rgba(212,175,106,.08);--fig-soft:rgba(212,175,106,.2);--fig-hi:#f0d9a4;--fig-ink:#f3ede2;--fig-muted:#a69d8d;--fig-on:#0b0a09;background:#0b0a09;color:#f3ede2",
  light: "--fig-line:#74561f;--fig-fill:rgba(128,96,42,.09);--fig-soft:rgba(128,96,42,.22);--fig-hi:#664a17;--fig-ink:#1d1810;--fig-muted:#5a5144;--fig-on:#fbf7ef;background:#fbf7ef;color:#1d1810",
};
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
for (const [name, vars] of Object.entries(THEMES)) {
  const html = `<!doctype html><meta charset=utf-8><style>${figCSS} body{margin:0;padding:20px;${vars};font-family:Jost,sans-serif} .row{display:flex;gap:30px;flex-wrap:wrap;margin-bottom:30px} svg.fig-svg{width:520px;border:1px solid ${name === "dark" ? "#333" : "#ccc"}} .ic{display:flex;gap:30px;color:var(--fig-line)} .sicon{--fig-line:#d4af6a} </style>
  <div class="row">${figSpot()}${figSizes()}${figTester()}</div>
  <div class="ic">${["spring", "summer", "monsoon", "autumn", "winter"].map((k) => icon(k, 96)).join("")}</div>`;
  const page = await browser.newPage({ viewport: { width: 1130, height: 760 } });
  await page.setContent(html);
  await page.screenshot({ path: path.join(out, `figs-${name}.png`), fullPage: true });
  await page.close();
}
await browser.close();
console.log("wrote", out);

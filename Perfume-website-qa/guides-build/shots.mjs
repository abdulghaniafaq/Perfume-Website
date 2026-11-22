// Screenshots of the guide pages for a visual check.   node guides-build/shots.mjs <outdir> <file> <WxH> [dark|light] [fullpage|top]
import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";
import { serve } from "../lib/server.mjs";

const [, , outDir, file, size = "1360x900", scheme = "dark", mode = "full"] = process.argv;
const [w, h] = size.split("x").map(Number);
fs.mkdirSync(outDir, { recursive: true });
const srv = await serve();
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1, ...(w < 700 ? { hasTouch: true, isMobile: true } : {}) });
const page = await ctx.newPage();
const errs = [];
page.on("console", (m) => ["error", "warning"].includes(m.type()) && !/fonts\.g/.test(m.text()) && errs.push(m.text()));
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto(srv.base + file, { waitUntil: "load" });
await page.evaluate(async () => { for (const i of document.images) { i.loading = "eager"; } await Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))); });
await page.waitForTimeout(400);
const name = `${file.replace(".html", "")}-${size}-${scheme}${mode === "full" ? "" : "-top"}.png`;
await page.screenshot({ path: path.join(outDir, name), fullPage: mode === "full" });
console.log(name, "errors:", errs, "404s:", srv.missing);
await browser.close(); await srv.close();

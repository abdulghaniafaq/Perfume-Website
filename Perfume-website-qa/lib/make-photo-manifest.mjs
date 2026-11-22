// Regenerates photo-manifest.json (fingerprint of every product picture) from the site folder.
// Run it ONLY after deliberately adding or changing photos:  node lib/make-photo-manifest.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { SITE, PRODUCTS, SITE_DIR } from "./data.mjs";

const noPhoto = new Set(SITE.noPhoto || []);
const manifest = {};
for (const p of PRODUCTS) {
  if (noPhoto.has(p.s)) continue;
  manifest[p.s] = crypto.createHash("md5").update(fs.readFileSync(path.join(SITE_DIR, SITE.imageDir, p.s + ".jpg"))).digest("hex");
}
fs.writeFileSync(path.join(import.meta.dirname, "..", "photo-manifest.json"), JSON.stringify(manifest, null, 1) + "\n");
console.log(Object.keys(manifest).length, "pictures fingerprinted");

// Regenerates mini-manifest.json (fingerprint of every mini picture) from the site folder.
// Run it ONLY after deliberately adding or changing mini pictures:  node lib/make-mini-manifest.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { SITE, SITE_DIR } from "./data.mjs";

const dir = path.join(SITE_DIR, SITE.imageDir, "minis");
const manifest = {};
for (const k of [...SITE.miniPhotos].sort()) manifest[k] = crypto.createHash("md5").update(fs.readFileSync(path.join(dir, k + ".jpg"))).digest("hex");
fs.writeFileSync(path.join(import.meta.dirname, "..", "mini-manifest.json"), JSON.stringify(manifest, null, 1) + "\n");
console.log(Object.keys(manifest).length, "mini pictures fingerprinted");

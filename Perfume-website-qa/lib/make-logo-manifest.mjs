// Regenerates logo-manifest.json (fingerprint of every homepage logo) from the site folder.
// Run it ONLY after deliberately adding or changing logos:  node lib/make-logo-manifest.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { SITE, SITE_DIR } from "./data.mjs";

const dir = path.join(SITE_DIR, SITE.imageDir, "brands");
const manifest = {};
for (const f of fs.readdirSync(dir).sort()) manifest[f.replace(/\.jpg$/, "")] = crypto.createHash("md5").update(fs.readFileSync(path.join(dir, f))).digest("hex");
fs.writeFileSync(path.join(import.meta.dirname, "..", "logo-manifest.json"), JSON.stringify(manifest, null, 1) + "\n");
console.log(Object.keys(manifest).length, "logos fingerprinted");

// Rebuilds everything that is generated, in the right order:  node seo-build/build-all.mjs
// (guides, the A-Z list, the 627 perfume pages, the structured data of the hand-written pages, the sitemap)
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const f of ["guides-build/build.mjs", "seo-build/perfumes.mjs", "seo-build/products.mjs", "seo-build/inject.mjs", "seo-build/sitemap.mjs"]) {
  const out = execFileSync("node", [path.join(root, f)], { encoding: "utf8" }).trim().split("\n").pop();
  console.log(`${f.padEnd(26)} ${out}`);
}

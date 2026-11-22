// Loads the REAL shipped config + catalogue, so tests always run against what is deployed.
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const SITE_DIR = process.env.SITE_DIR || path.resolve(import.meta.dirname, "../../Perfume-website");
const ctx = vm.createContext({ window: {} });
for (const f of ["site-config.js", "products-data.js"]) {
  vm.runInContext(fs.readFileSync(path.join(SITE_DIR, "data", f), "utf8"), ctx, { filename: f });
}
// Clone out of the vm sandbox so arrays/objects are ordinary (same-realm) values for assert.deepEqual.
export const SITE = JSON.parse(JSON.stringify(ctx.window.SITE));
export const PRODUCTS = JSON.parse(JSON.stringify(ctx.window.PRODUCTS));
export const pageUrl = (name, query = "") => pathToFileURL(path.join(SITE_DIR, name)).href + query;

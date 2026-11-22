// A tiny static web server for the site folder, behaving like the real host (Netlify on Linux), not like a Mac disk:
//  - file names are CASE-SENSITIVE ("Catalogue.html" is a 404 even though macOS would open catalogue.html)
//  - unknown paths give a real 404 (the site's _redirects is not applied, so a broken link shows up as a failure)
//  - the same HTTP rules as a browser meets in production (relative URLs resolve against the page address, MIME types matter)
//  - the site's _headers file is applied to every response, as Netlify does (so the security policy is really enforced in the browser tests),
//    and the file itself is never served
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { SITE_DIR } from "./data.mjs";

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".txt": "text/plain; charset=utf-8", ".woff2": "font/woff2" };

/** Netlify's _headers format: a path pattern on its own line, then its headers indented below it ("#" starts a comment). Returns [{ pattern, headers }]. */
export function parseHeadersFile(text) {
  const rules = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (!/^\s/.test(raw)) { rules.push({ pattern: line, headers: [] }); continue; }
    const i = line.indexOf(":");
    if (i > 0 && rules.length) rules[rules.length - 1].headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
  }
  return rules;
}
const patternMatches = (pattern, pathname) => pattern.endsWith("*") ? pathname.startsWith(pattern.slice(0, -1)) : pattern === pathname;
/** the headers Netlify would add to this path */
export function headersFor(rules, pathname) {
  const out = {};
  for (const r of rules) if (patternMatches(r.pattern, pathname)) for (const [k, v] of r.headers) out[k] = out[k] ? `${out[k]}, ${v}` : v;
  return out;
}

/** true when every segment of the path exists with exactly this spelling */
export function exactCase(root, rel) {
  let dir = root;
  for (const seg of rel.split("/").filter(Boolean)) {
    if (!fs.readdirSync(dir).includes(seg)) return false;
    dir = path.join(dir, seg);
  }
  return true;
}

export async function serve(root = SITE_DIR, { headers = true } = {}) {
  const rules = headers && fs.existsSync(path.join(root, "_headers")) ? parseHeadersFile(fs.readFileSync(path.join(root, "_headers"), "utf8")) : [];
  const hits = [], missing = [];                                     // hits: every request [status, url] (tests may clear it); missing: every 404 ever served
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.join(root, rel);
    let status = 200;
    if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile() || !exactCase(root, rel) || /^\/_(headers|redirects)$/.test(rel)) status = 404;
    hits.push([status, url.pathname]); if (status === 404) missing.push(url.pathname);
    const extra = headersFor(rules, url.pathname);
    // (this test server speaks plain http, where Safari's engine would try to upgrade every file to https and fail, and HSTS means nothing:
    //  Netlify serves https only, and security.test.mjs checks that both are in the file)
    if (extra["Content-Security-Policy"]) extra["Content-Security-Policy"] = extra["Content-Security-Policy"].replace(/;?\s*upgrade-insecure-requests/, "");
    delete extra["Strict-Transport-Security"];
    if (status === 404) { res.writeHead(404, { "content-type": "text/plain", ...extra }); return res.end("Not found"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store", ...extra });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  return { base, hits, missing, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }) };
}

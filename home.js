/* Home page: the decorative bottles in the hero. */
(() => {
  "use strict";

  let uid = 0;
  function heroBottle(kind, [c1, c2], letter) {
    const id = `hb${++uid}`;
    const defs = `<defs>
      <linearGradient id="${id}l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
      <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a6a2f"/><stop offset=".45" stop-color="#f0d9a4"/><stop offset="1" stop-color="#9c7a3a"/></linearGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".38" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".1"/></linearGradient>
    </defs>`;
    const gold = `url(#${id}g)`, liquid = `url(#${id}l)`, shine = `url(#${id}s)`;
    const mono = (x, y, size) =>
      `<text x="${x}" y="${y}" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="${size}" font-weight="600" fill="${gold}">${letter}</text>`;
    let shape;
    if (kind === "luxury") {
      shape = `<rect x="84" y="8" width="32" height="32" rx="3" fill="${gold}"/><rect x="92" y="40" width="16" height="14" fill="${gold}"/>
        <path d="M62 60H138L152 236Q152 246 142 246H58Q48 246 48 236Z" fill="${liquid}"/><path d="M62 60H138L152 236Q152 246 142 246H58Q48 246 48 236Z" fill="${shine}"/>
        <path d="M100 60V246M62 60L74 246M138 60L126 246" stroke="#fff" stroke-opacity=".13" fill="none"/>
        <rect x="76" y="128" width="48" height="62" rx="2" fill="#0b0a09" fill-opacity=".38" stroke="${gold}"/>${mono(100, 170, 34)}`;
    } else if (kind === "arabian") {
      shape = `<path d="M100 4C93 18 84 24 88 40H112C116 24 107 18 100 4Z" fill="${gold}"/><circle cx="100" cy="30" r="3.5" fill="${gold}"/>
        <rect x="90" y="40" width="20" height="46" fill="${gold}"/><circle cx="100" cy="166" r="78" fill="${liquid}"/><circle cx="100" cy="166" r="78" fill="${shine}"/>
        <path d="M30 140Q100 170 170 140" stroke="${gold}" stroke-width="2" fill="none"/><path d="M24 196Q100 226 176 196" stroke="${gold}" stroke-width="2" fill="none"/>
        <path d="M100 148L118 172L100 196L82 172Z" fill="#0b0a09" fill-opacity=".4" stroke="${gold}"/>${mono(100, 181, 24)}`;
    } else {
      shape = `<rect x="80" y="12" width="40" height="38" rx="5" fill="${gold}"/><rect x="91" y="50" width="18" height="12" fill="${gold}"/>
        <rect x="42" y="62" width="116" height="178" rx="16" fill="${liquid}"/><rect x="42" y="62" width="116" height="178" rx="16" fill="${shine}"/>
        <rect x="42.5" y="62.5" width="115" height="177" rx="15.5" fill="none" stroke="#fff" stroke-opacity=".25"/>
        <rect x="64" y="124" width="72" height="56" rx="3" fill="#0b0a09" fill-opacity=".38" stroke="${gold}"/>${mono(100, 165, 34)}`;
    }
    return `<svg viewBox="0 0 200 252" aria-hidden="true" focusable="false">${defs}${shape}</svg>`;
  }

  document.getElementById("hero-art").innerHTML = [
    ["hb-1", "designer", ["#2b4a6f", "#0f1d33"], "D"],
    ["hb-2", "luxury", ["#d9a441", "#7a4a10"], "L"],
    ["hb-3", "arabian", ["#8c2433", "#2a0a10"], "M"],
  ].map(([cls, kind, colors, letter]) => `<div class="hb ${cls}">${heroBottle(kind, colors, letter)}</div>`).join("");
})();

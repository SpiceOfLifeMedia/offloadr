// Generate the Offly wordmark logo as a vector SVG + high-res PNGs.
// SVG is the master; PNGs are rendered from PDFs via ImageMagick for crisp text.
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SAGE = "#5A8C72";
const FOREST = "#1E2A24";
const INK = "#141518";
const PARCHMENT = "#F6F3EC";

const OUT = path.resolve("exports/logo");
fs.mkdirSync(OUT, { recursive: true });

// ---------- 1. Vector SVG master (designer-editable) ----------
// Uses sans-serif font-family stack so any opener picks the heaviest
// available local face. Designer can swap to Cera Pro at production time.
function buildSvg(opts: { bg: string | null; ink: string }) {
  const W = 1200;
  const H = 480;
  const fontSize = 280;
  // LOCKED proportions — single source of truth (mirrors brand kit page 2).
  // dot diameter ≈ cap height (radius = fontSize × 0.33).
  const dotR = fontSize * 0.33;
  // Gap from dot edge to "f" stem ≈ 0.06 × fontSize (matches inter-letter rhythm).
  const gap = fontSize * 0.06;
  const text = "ffly";
  const groupCx = W / 2;
  const groupCy = H / 2;
  const baselineY = groupCy + fontSize * 0.34;
  // Dot centre sits ~0.04 × fontSize above cap-mid (≈ 0.40 above baseline).
  const dotCy = baselineY - fontSize * 0.40;
  const ringR = dotR * 0.76;
  const bgRect = opts.bg
    ? `<rect width="${W}" height="${H}" fill="${opts.bg}"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  ${bgRect}
  <g transform="translate(${groupCx}, 0)">
    <!-- The dot is positioned just left of the wordmark; text-anchor middle keeps the pair centred -->
    <g>
      <circle cx="${-180}" cy="${dotCy}" r="${dotR}" fill="${SAGE}"/>
      <circle cx="${-180}" cy="${dotCy}" r="${ringR}" fill="${PARCHMENT}" fill-opacity="0.14"/>
    </g>
    <text x="${-180 + dotR + gap}" y="${baselineY}"
      font-family="'Cera Pro', 'TT Norms Pro', 'Manrope', 'Inter', 'DejaVu Sans', system-ui, sans-serif"
      font-weight="800"
      font-size="${fontSize}"
      letter-spacing="-12"
      fill="${opts.ink}">ffly</text>
  </g>
</svg>`;
}

const svgVariants = [
  { name: "offly-logo-forest", bg: FOREST, ink: PARCHMENT },
  { name: "offly-logo-ink", bg: INK, ink: PARCHMENT },
  { name: "offly-logo-light", bg: PARCHMENT, ink: INK },
  { name: "offly-logo-transparent-light", bg: null, ink: INK },
  { name: "offly-logo-transparent-dark", bg: null, ink: PARCHMENT },
];

for (const v of svgVariants) {
  fs.writeFileSync(path.join(OUT, `${v.name}.svg`), buildSvg({ bg: v.bg, ink: v.ink }));
}

// Mark-only (just the dot) — useful for app icon, favicons
const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <circle cx="512" cy="512" r="430" fill="${SAGE}"/>
  <circle cx="512" cy="512" r="${430 * 0.76}" fill="${PARCHMENT}" fill-opacity="0.14"/>
</svg>`;
fs.writeFileSync(path.join(OUT, "offly-mark.svg"), markSvg);

// App-icon style: sage dot on Forest squircle
const appIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" rx="224" ry="224" fill="${FOREST}"/>
  <circle cx="512" cy="512" r="280" fill="${SAGE}"/>
  <circle cx="512" cy="512" r="${280 * 0.76}" fill="${PARCHMENT}" fill-opacity="0.14"/>
</svg>`;
fs.writeFileSync(path.join(OUT, "offly-app-icon.svg"), appIconSvg);

// ---------- 2. Rasterize SVG masters to high-res PNGs via ImageMagick (RSVG) ----------
const targets = [
  { name: "offly-logo-forest", w: 4096, transparent: false },
  { name: "offly-logo-ink", w: 4096, transparent: false },
  { name: "offly-logo-light", w: 4096, transparent: false },
  { name: "offly-logo-transparent-light", w: 4096, transparent: true },
  { name: "offly-logo-transparent-dark", w: 4096, transparent: true },
  { name: "offly-mark", w: 2048, transparent: true },
  { name: "offly-app-icon", w: 1024, transparent: false },
];

for (const t of targets) {
  const inFile = path.join(OUT, `${t.name}.svg`);
  const outFile = path.join(OUT, `${t.name}.png`);
  const args = [
    "-background", t.transparent ? "none" : "white",
    "-density", "600",
    inFile,
    "-resize", `${t.w}x`,
    "-strip",
    outFile,
  ];
  execFileSync("magick", args, { stdio: "inherit" });
}

console.log("Logo assets written to", OUT);
for (const f of fs.readdirSync(OUT).sort()) {
  const s = fs.statSync(path.join(OUT, f));
  console.log(" ", f, `(${(s.size / 1024).toFixed(1)} KB)`);
}

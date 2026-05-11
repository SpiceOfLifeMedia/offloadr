import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";

// =========================================================================
// COLORS
// =========================================================================
const SAGE = "#5A8C72";
const SAGE_DEEP = "#3F6A55";
const FOREST = "#1E2A24";
const FOREST_2 = "#2A3A33";
const FOREST_3 = "#0E1815";
const PARCHMENT = "#F6F3EC";
const INK = "#141518";
const SAND = "#F2ECE1";
const MOSS = "#E6EEE9";
const STONE = "#DFE3E1";
const MUTED = "#7A7E74";
const MUTED_DARK = "#9FA8A1";
const HAIRLINE = "#E5E2D9";
const HAIRLINE_DARK = "#34433C";
const RUST = "#B0524A";
const AMBER = "#C8923A";
const ROW_ALT = "#EFEAE0";

// =========================================================================
// PAGE + STRICT 12-COL GRID + VERTICAL ZONES
// All slides obey these constants. No floating positions.
// =========================================================================
const PAGE_W = 960;
const PAGE_H = 540;
const M = 40;                             // outer margin (uniform)
const CONTENT_W = PAGE_W - M * 2;         // 880

// 12-col grid
const COLS = 12;
const GUTTER = 12;
const COL_W = (CONTENT_W - GUTTER * (COLS - 1)) / COLS; // 62.33

// Vertical zones (baseline-grid: 4pt). Every content slide obeys these.
//   TITLE band:   y =  44 …  140  (eyebrow + headline + sage rule)
//   CONTENT band: y = 144 …  428
//   ANCHOR band:  y = 440 …  496  (56h dark callout strip)
//   CHROME line:  y = 508
const TITLE_TOP_Y     = M + 4;            // 44
const TITLE_BOTTOM_Y  = 140;
const CONTENT_TOP_Y   = 144;
const ANCHOR_H        = 56;
const ANCHOR_Y        = PAGE_H - 32 - 12 - ANCHOR_H; // 440
const CONTENT_BOTTOM_Y = ANCHOR_Y - 12;   // 428
const CONTENT_H       = CONTENT_BOTTOM_Y - CONTENT_TOP_Y; // 284

function col(span: number, offset = 0) {
  const x = M + offset * (COL_W + GUTTER);
  const w = span * COL_W + (span - 1) * GUTTER;
  return { x, w, right: x + w };
}

// =========================================================================
// SPEC GRID (1920x1080 spec scaled 0.5 → 960x540 PDF points)
// All slide-2..19 layouts use these. Cover (1) + closing (20) keep current centering.
//   Margin:           120 → 60      (SPEC_M)
//   Title Y:          135 → 67.5    (SPEC_TITLE_Y; eyebrow ABOVE this)
//   Subtitle/sub Y:   205 → 102.5   (SPEC_SUB_Y)
//   Content top Y:    285 → 142.5   (SPEC_CONTENT_TOP_Y)
//   Anchor block Y:   925 → 462.5   (SPEC_ANCHOR_Y)
//   Footer Y:        1010 → 505     (SPEC_FOOTER_Y)
//   Usable width:    1680 → 840     (SPEC_CONTENT_W)
// =========================================================================
const SPEC_M = 60;
const SPEC_CONTENT_W = PAGE_W - SPEC_M * 2;        // 840
const SPEC_TITLE_Y = 68;                            // headline baseline
const SPEC_CONTENT_TOP_Y = 143;                     // first content row
const SPEC_ANCHOR_Y = 463;                          // bottom callout strip
const SPEC_ANCHOR_H = 38;                           // 925..1010 = 85 → 42 minus footer band
const SPEC_FOOTER_Y = 505;                          // chrome footer line

// 2-col: X=120/1020 W=780 each → X=60/510 W=390 each, gap=60
function col2(i: 0 | 1) {
  const w = 390;
  const x = i === 0 ? SPEC_M : 510;
  return { x, w, right: x + w };
}
// 3-col: X=120/690/1260 W=480 each → X=60/345/630 W=240 each
function col3(i: 0 | 1 | 2) {
  const w = 240;
  const x = SPEC_M + i * (w + 45); // 60, 345, 630
  return { x, w, right: x + w };
}
// 4-col: X=120/555/990/1425 W=360 each → X=60/277.5/495/712.5 W=180 each
function col4(i: 0 | 1 | 2 | 3) {
  const w = 180;
  const xs = [60, 278, 495, 713];
  const x = xs[i];
  return { x, w, right: x + w };
}

// Spec-compliant title band: eyebrow above, big headline at SPEC_TITLE_Y, sage rule below.
function specTitle(
  eyebrowText: string,
  headlineText: string,
  opts: { dark?: boolean; size?: number; eyebrowSize?: number; subline?: string } = {},
) {
  const inkColor = opts.dark ? PARCHMENT : INK;
  const size = opts.size ?? 24;
  const eyebrowSize = opts.eyebrowSize ?? 9;
  // Eyebrow sits just above the headline baseline
  const eyebrowY = SPEC_TITLE_Y - eyebrowSize - 4;
  text(eyebrowText.toUpperCase(), SPEC_M, eyebrowY, {
    size: eyebrowSize, color: SAGE, weight: "Helvetica-Bold", tracking: 1.4,
  });
  doc.font("Helvetica-Bold").fontSize(size).fillColor(inkColor)
    .text(headlineText, SPEC_M, SPEC_TITLE_Y, { width: SPEC_CONTENT_W, characterSpacing: -0.4, lineGap: 2 });
  if (opts.subline) {
    text(opts.subline, SPEC_M, 110, {
      size: 12, color: opts.dark ? MUTED_DARK : MUTED, width: SPEC_CONTENT_W, lineGap: 2,
    });
  }
  // Sage divider rule between title band and content
  rect(SPEC_M, SPEC_CONTENT_TOP_Y - 12, 44, 2, SAGE);
}

// Spec-compliant bottom callout: single horizontal strip at SPEC_ANCHOR_Y, full content width.
// yOverride lets a slide pull the anchor up/down (e.g. slide 02 spec: UP 10px).
function specAnchor(label: string, body: string, opts: { dark?: boolean; yOverride?: number } = {}) {
  const isDark = opts.dark ?? false;
  const bgC = isDark ? FOREST_3 : FOREST;
  const y = opts.yOverride ?? SPEC_ANCHOR_Y;
  rect(SPEC_M, y, SPEC_CONTENT_W, SPEC_ANCHOR_H, bgC, 6);
  rect(SPEC_M, y, 4, SPEC_ANCHOR_H, SAGE);
  text(label.toUpperCase(), SPEC_M + 16, y + 8, {
    size: 8, color: SAGE, weight: "Helvetica-Bold", tracking: 1.4, width: SPEC_CONTENT_W - 32,
  });
  text(body, SPEC_M + 16, y + 21, {
    size: 11, color: PARCHMENT, weight: "Helvetica-Bold", width: SPEC_CONTENT_W - 32, lineGap: 2,
  });
}

// Sub-gap used inside a parent column (between stacked or side-by-side cards
// that share the same parent col). Held constant for system consistency.
const CARD_GAP = 10;

// Equal-cell row inside a parent rect: returns x for cell index `i` of `n` cells.
function cell(parentX: number, parentW: number, n: number, i: number, gap = 12) {
  const cw = (parentW - gap * (n - 1)) / n;
  return { x: parentX + i * (cw + gap), w: cw };
}

// =========================================================================
// DOC
// =========================================================================
const out = path.resolve(process.cwd(), "..", "exports", "offly-pitch-deck.pdf");
fs.mkdirSync(path.dirname(out), { recursive: true });
const doc = new PDFDocument({
  size: [PAGE_W, PAGE_H],
  margins: { top: 0, bottom: 0, left: 0, right: 0 },
});
doc.pipe(fs.createWriteStream(out));

// =========================================================================
// PRIMITIVES
// =========================================================================
function bg(color: string) {
  doc.save();
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(color);
  doc.restore();
}
function rect(x: number, y: number, w: number, h: number, fill: string, r = 0) {
  doc.save();
  if (r > 0) doc.roundedRect(x, y, w, h, r).fill(fill);
  else doc.rect(x, y, w, h).fill(fill);
  doc.restore();
}
function strokeRect(x: number, y: number, w: number, h: number, color: string, lw = 0.5, r = 0) {
  doc.save();
  if (r > 0) doc.roundedRect(x, y, w, h, r).lineWidth(lw).stroke(color);
  else doc.rect(x, y, w, h).lineWidth(lw).stroke(color);
  doc.restore();
}
function hLine(x: number, y: number, w: number, color: string, lw = 0.5) {
  doc.save();
  doc.moveTo(x, y).lineTo(x + w, y).lineWidth(lw).stroke(color);
  doc.restore();
}
function text(t: string, x: number, y: number, opts: {
  size?: number; color?: string; weight?: "Helvetica" | "Helvetica-Bold" | "Helvetica-Oblique";
  width?: number; align?: "left" | "center" | "right"; tracking?: number; lineGap?: number;
} = {}) {
  doc.font(opts.weight ?? "Helvetica").fontSize(opts.size ?? 10).fillColor(opts.color ?? INK);
  doc.text(t, x, y, {
    width: opts.width ?? CONTENT_W,
    align: opts.align ?? "left",
    characterSpacing: opts.tracking ?? 0,
    lineGap: opts.lineGap ?? 2,
  });
}
// LOCKED wordmark (dot replaces "o")
function wordmark(cx: number, cy: number, fontSize: number, opts: { onLight?: boolean; dotLift?: number } = {}) {
  const onLight = opts.onLight ?? true;
  const inkColor = onLight ? INK : PARCHMENT;
  const dotR = fontSize * 0.33;
  const t = "ffly";
  doc.font("Helvetica-Bold").fontSize(fontSize).fillColor(inkColor);
  const tw = doc.widthOfString(t);
  const gap = fontSize * 0.06;
  const totalW = dotR * 2 + gap + tw;
  const left = cx - totalW / 2;
  const dotCx = left + dotR;
  // dotLift raises the green dot above its centered position (spec: cover dot UP 4px = 2 my coords).
  const dotCy = cy - fontSize * 0.10 - (opts.dotLift ?? 0);
  doc.save();
  doc.circle(dotCx, dotCy, dotR).fill(SAGE);
  if (fontSize >= 40) {
    doc.circle(dotCx, dotCy, dotR * 0.76).fillOpacity(0.14).fill(PARCHMENT).fillOpacity(1);
  }
  doc.restore();
  const textX = dotCx + dotR + fontSize * 0.06;
  const textY = cy - fontSize * 0.42;
  doc.fillColor(inkColor).text(t, textX, textY, { lineBreak: false });
}

// =========================================================================
// ICONS
// =========================================================================
function icon(kind: string, x: number, y: number, size: number, color: string) {
  doc.save();
  doc.lineWidth(Math.max(1.2, size * 0.06)).strokeColor(color).fillColor(color);
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size * 0.42;
  switch (kind) {
    case "wifi":
      for (let i = 0; i < 3; i++) {
        const rr = size * (0.18 + i * 0.13);
        doc.path(`M ${cx - rr} ${cy} A ${rr} ${rr} 0 0 1 ${cx + rr} ${cy}`).stroke();
      }
      doc.circle(cx, cy + size * 0.05, size * 0.05).fill(color);
      break;
    case "clock":
      doc.circle(cx, cy, r).stroke();
      doc.moveTo(cx, cy).lineTo(cx, cy - r * 0.6).stroke();
      doc.moveTo(cx, cy).lineTo(cx + r * 0.45, cy).stroke();
      break;
    case "shield":
      doc.path(`M ${cx} ${cy - r} L ${cx + r} ${cy - r * 0.6} L ${cx + r * 0.85} ${cy + r * 0.4} L ${cx} ${cy + r * 0.85} L ${cx - r * 0.85} ${cy + r * 0.4} L ${cx - r} ${cy - r * 0.6} Z`).stroke();
      break;
    case "home":
      doc.path(`M ${cx - r} ${cy + r * 0.2} L ${cx} ${cy - r} L ${cx + r} ${cy + r * 0.2} L ${cx + r} ${cy + r} L ${cx - r} ${cy + r} Z`).stroke();
      doc.rect(cx - r * 0.2, cy + r * 0.3, r * 0.4, r * 0.7).stroke();
      break;
    case "device":
      doc.roundedRect(cx - r * 0.6, cy - r, r * 1.2, r * 2, r * 0.15).stroke();
      doc.circle(cx, cy + r * 0.75, r * 0.08).fill(color);
      break;
    case "people":
      doc.circle(cx - r * 0.4, cy - r * 0.3, r * 0.28).stroke();
      doc.circle(cx + r * 0.4, cy - r * 0.3, r * 0.28).stroke();
      doc.path(`M ${cx - r} ${cy + r * 0.7} Q ${cx - r * 0.4} ${cy + r * 0.1} ${cx} ${cy + r * 0.5}`).stroke();
      doc.path(`M ${cx} ${cy + r * 0.5} Q ${cx + r * 0.4} ${cy + r * 0.1} ${cx + r} ${cy + r * 0.7}`).stroke();
      break;
    case "chart":
      doc.moveTo(cx - r, cy + r).lineTo(cx + r, cy + r).stroke();
      doc.moveTo(cx - r, cy + r).lineTo(cx - r, cy - r).stroke();
      doc.path(`M ${cx - r * 0.7} ${cy + r * 0.4} L ${cx - r * 0.2} ${cy - r * 0.1} L ${cx + r * 0.3} ${cy + r * 0.1} L ${cx + r * 0.8} ${cy - r * 0.6}`).stroke();
      break;
    case "lock":
      doc.path(`M ${cx - r * 0.5} ${cy - r * 0.1} V ${cy - r * 0.5} A ${r * 0.5} ${r * 0.5} 0 0 1 ${cx + r * 0.5} ${cy - r * 0.5} V ${cy - r * 0.1}`).stroke();
      doc.roundedRect(cx - r * 0.7, cy - r * 0.1, r * 1.4, r, r * 0.1).stroke();
      break;
    case "router":
      doc.roundedRect(cx - r, cy + r * 0.1, r * 2, r * 0.7, r * 0.1).stroke();
      doc.moveTo(cx - r * 0.6, cy + r * 0.4).lineTo(cx - r * 0.6, cy + r * 0.55).stroke();
      doc.moveTo(cx - r * 0.2, cy + r * 0.4).lineTo(cx - r * 0.2, cy + r * 0.55).stroke();
      doc.moveTo(cx + r * 0.2, cy + r * 0.4).lineTo(cx + r * 0.2, cy + r * 0.55).stroke();
      doc.moveTo(cx - r * 0.5, cy + r * 0.1).lineTo(cx - r * 0.5, cy - r * 0.3).stroke();
      doc.moveTo(cx + r * 0.5, cy + r * 0.1).lineTo(cx + r * 0.5, cy - r * 0.3).stroke();
      break;
    case "money":
      doc.circle(cx, cy, r * 0.85).stroke();
      doc.font("Helvetica-Bold").fontSize(size * 0.55).fillColor(color)
        .text("$", cx - size * 0.15, cy - size * 0.28, { lineBreak: false });
      break;
    case "fingerprint":
      for (let i = 0; i < 4; i++) {
        const rr = r * (0.35 + i * 0.18);
        doc.path(`M ${cx - rr} ${cy + r * 0.2} A ${rr} ${rr * 1.2} 0 0 1 ${cx + rr} ${cy + r * 0.2}`).stroke();
      }
      break;
    case "calendar":
      doc.roundedRect(cx - r, cy - r * 0.7, r * 2, r * 1.6, r * 0.1).stroke();
      doc.moveTo(cx - r, cy - r * 0.2).lineTo(cx + r, cy - r * 0.2).stroke();
      doc.moveTo(cx - r * 0.5, cy - r * 0.95).lineTo(cx - r * 0.5, cy - r * 0.45).stroke();
      doc.moveTo(cx + r * 0.5, cy - r * 0.95).lineTo(cx + r * 0.5, cy - r * 0.45).stroke();
      break;
    case "alert":
      doc.path(`M ${cx} ${cy - r} L ${cx + r} ${cy + r * 0.7} L ${cx - r} ${cy + r * 0.7} Z`).stroke();
      doc.moveTo(cx, cy - r * 0.2).lineTo(cx, cy + r * 0.3).stroke();
      doc.circle(cx, cy + r * 0.55, r * 0.06).fill(color);
      break;
    case "school":
      doc.path(`M ${cx - r} ${cy} L ${cx} ${cy - r * 0.5} L ${cx + r} ${cy} L ${cx} ${cy + r * 0.5} Z`).stroke();
      doc.moveTo(cx + r, cy).lineTo(cx + r, cy + r * 0.6).stroke();
      break;
    case "megaphone":
      doc.path(`M ${cx - r} ${cy - r * 0.4} L ${cx + r * 0.4} ${cy - r} L ${cx + r * 0.4} ${cy + r} L ${cx - r} ${cy + r * 0.4} Z`).stroke();
      doc.path(`M ${cx - r} ${cy - r * 0.4} L ${cx - r * 0.5} ${cy - r * 0.4} L ${cx - r * 0.5} ${cy + r * 0.4} L ${cx - r} ${cy + r * 0.4} Z`).stroke();
      break;
    case "stethoscope":
      doc.circle(cx + r * 0.5, cy + r * 0.4, r * 0.3).stroke();
      doc.path(`M ${cx - r * 0.6} ${cy - r * 0.8} V ${cy} A ${r * 0.5} ${r * 0.5} 0 0 0 ${cx + r * 0.5} ${cy + r * 0.1}`).stroke();
      break;
  }
  doc.restore();
}

// =========================================================================
// CHROME + PAGE LIFECYCLE
// =========================================================================
let slideIdx = 0;
const TOTAL = 20;

// Renders the spec-compliant top-left header — REAL ffly logo + " · INVESTOR DECK · 2026".
// Spec is explicit: do NOT type the word "OFFLY" — use the real logo mark (green dot + "ffly").
function specTopHeader(opts: { dark?: boolean } = {}) {
  const fg = opts.dark ? PARCHMENT : INK;
  const sub = opts.dark ? MUTED_DARK : MUTED;
  // SPEC: header at X=120, Y=55 (=60, 27.5 my coords). Small logo height ~18px (~9 my coords).
  const headerY = 28;
  const logoSize = 11;             // gives ~13px total height — close to spec 18 spec-px
  const dotR = logoSize * 0.33;
  const dotCx = SPEC_M + dotR;
  // SPEC: green circle inside small logo UP exactly 2px (=1 my coord)
  const dotCy = headerY + dotR - 1;
  doc.save();
  doc.circle(dotCx, dotCy, dotR).fill(SAGE);
  doc.restore();
  // "ffly" rendered at logoSize, bold, full color
  const textX = dotCx + dotR + logoSize * 0.06;
  const textY = headerY - logoSize * 0.05;
  doc.font("Helvetica-Bold").fontSize(logoSize).fillColor(fg);
  doc.text("ffly", textX, textY, { lineBreak: false });
  // " · INVESTOR DECK · 2026" — descriptor in muted weight, smaller, baseline-aligned to ffly
  const fflyW = doc.widthOfString("ffly");
  const descriptorX = textX + fflyW + 5;   // ~10px scaled gap
  doc.font("Helvetica-Bold").fontSize(8).fillColor(sub);
  doc.text("· INVESTOR DECK · 2026", descriptorX, headerY + 2, {
    lineBreak: false, characterSpacing: 1.6,
  });
}

function chrome(label: string, opts: { dark?: boolean } = {}) {
  const sub = opts.dark ? MUTED_DARK : MUTED;
  // top-left spec header (real ffly logo + descriptor)
  specTopHeader(opts);
  // top-right slide label — section / page (e.g. "02 · the problem")
  doc.font("Helvetica").fontSize(8).fillColor(sub);
  const w = doc.widthOfString(label);
  doc.text(label, PAGE_W - M - w, M - 19, { lineBreak: false, characterSpacing: 1 });
  // SPEC: removed duplicate bottom line ("offly · investor deck · 2026  02 / 20")
  // Keep ONLY the top-left header + top-right slide label.
}

function newSlide(label: string, opts: { dark?: boolean; bgColor?: string } = {}) {
  if (slideIdx > 0) doc.addPage();
  slideIdx++;
  bg(opts.bgColor ?? (opts.dark ? FOREST : PARCHMENT));
  chrome(label, opts);
}

// Title band — now delegates to specTitle() so EVERY content slide gets the
// exact same treatment as slide 02 (X=60 align with chrome header, Y=68,
// headline size 26, eyebrow size 13). Caller's size/eyebrowSize are ignored
// to enforce slide-2 parity across the whole deck.
function title(
  eyebrowText: string,
  headlineText: string,
  opts: { dark?: boolean; size?: number; eyebrowSize?: number } = {},
) {
  specTitle(eyebrowText, headlineText, {
    dark: opts.dark,
    size: 26,
    eyebrowSize: 13,
  });
}

// Bottom anchor strip — every content slide ends with one.
// Inside-slide alignment: label LEFT (sage), body LEFT (parchment).
function anchor(label: string, body: string, opts: { dark?: boolean } = {}) {
  const isDark = opts.dark ?? false;
  const bgC = isDark ? FOREST_3 : FOREST;
  rect(M, ANCHOR_Y, CONTENT_W, ANCHOR_H, bgC, 8);
  rect(M, ANCHOR_Y, 4, ANCHOR_H, SAGE);
  text(label.toUpperCase(), M + 18, ANCHOR_Y + 12, {
    size: 8, color: SAGE, weight: "Helvetica-Bold", tracking: 1.4, width: CONTENT_W - 36,
  });
  text(body, M + 18, ANCHOR_Y + 28, {
    size: 11, color: PARCHMENT, weight: "Helvetica-Bold", width: CONTENT_W - 36, lineGap: 2,
  });
}

// =========================================================================
// 01 — COVER (centered, no chrome)
// =========================================================================
slideIdx = 1;
bg(FOREST);
rect(0, 0, 6, PAGE_H, SAGE_DEEP);
rect(PAGE_W - 6, 0, 6, PAGE_H, SAGE);
// Decorative dots — top-left
doc.save();
for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
  doc.circle(M + c * 14, M + r * 14, 1.2).fillOpacity(0.20).fill(SAGE);
}
doc.fillOpacity(1); doc.restore();
// Mirror dots — bottom-right
doc.save();
for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
  doc.circle(PAGE_W - M - c * 14, PAGE_H - M - r * 14, 1.2).fillOpacity(0.20).fill(SAGE);
}
doc.fillOpacity(1); doc.restore();

// SPEC top-left header on cover too (replaces the old centered "OFFLY · INVESTOR DECK · 2026")
specTopHeader({ dark: true });

// SPEC: Main logo center X=480, Y=160 (=960/320). Green dot in logo raised UP 2px (=4 spec).
const COVER_WORDMARK_Y = 160;
wordmark(PAGE_W / 2, COVER_WORDMARK_Y, 110, { onLight: false, dotLift: 2 });

// Tagline pushed DOWN to clear the "y" descender of the main "offly" wordmark.
// Wordmark size 110 with center Y=160 → "y" descender extends to ~Y=240.
// Tagline now sits at Y=255 with comfortable air; subtext + divider follow proportionally.
// (Deviates from spec Y=220/238/263 — but spec assumed a shorter wordmark; user confirmed too tight.)
text("calm internet, for the whole household.", 0, 255, {
  size: 16, color: PARCHMENT, width: PAGE_W, align: "center", tracking: 0.4,
});
text("a small device that quietly turns the internet off when it should be off.", 0, 280, {
  size: 11, color: MUTED_DARK, width: PAGE_W, align: "center", tracking: 0.2,
});
rect(PAGE_W / 2 - 22, 305, 44, 2, SAGE);

// SPEC: Metrics centers at X=280/480/680 with Y=330 (=560/960/1360 / 660 spec).
// Spacing 200px center-to-center (=400 spec). Card width 180 fits cleanly with 20px gap.
const stripW = 180;
const stripH = 78;
const stripY = 330;
const stripCenters = [280, 480, 680];
const strips = [
  { v: "A$2.5M", l: "SEED ROUND" },
  { v: "18 mo",  l: "RUNWAY · 5,000 SUBS" },
  { v: "A$15",   l: "MRR / HOUSEHOLD" },
];
strips.forEach((s, i) => {
  const x = stripCenters[i] - stripW / 2;
  rect(x, stripY, stripW, stripH, FOREST_2, 8);
  // Sage top accent bar
  rect(x, stripY, stripW, 3, SAGE);
  // SPEC: Number DOWN 2px (=4 spec) — value Y from base 18 → 20
  doc.font("Helvetica-Bold").fontSize(26).fillColor(PARCHMENT)
    .text(s.v, x, stripY + 20, { width: stripW, characterSpacing: -0.5, align: "center", lineBreak: false });
  // SPEC: Label DOWN 3px (=6 spec) — label Y from base 52 → 55
  text(s.l, x, stripY + 55, {
    size: 8, color: MUTED_DARK, weight: "Helvetica-Bold", tracking: 1.4, width: stripW, align: "center",
  });
});

// SPEC: Footer Y=485 (=970)
text("CONFIDENTIAL · DO NOT DISTRIBUTE", 0, 485, {
  size: 8, color: MUTED_DARK, weight: "Helvetica-Bold", width: PAGE_W, align: "center", tracking: 2.5,
});

// =========================================================================
// 02 — THE PROBLEM
// 12-col: scene narrative col(7), cost stack col(5)
// =========================================================================
newSlide("02 · the problem");
specTitle("the problem", "it's 9pm. the wi-fi password has changed again.", { size: 26, eyebrowSize: 13 });

{
  // SPEC: 2-col editorial layout, no cards.
  // Left col X=60 W=380 (=spec X=120 W=760)  | Right col X=510 W=390 (=spec X=1020 W=780)
  const left = col2(0);
  const right = col2(1);

  // ---- LEFT COLUMN: scene narrative + closing line ----
  // SPEC: THE SCENE label X=60, Y=143 (=120/285)
  text("THE SCENE", left.x, SPEC_CONTENT_TOP_Y, {
    size: 9, color: SAGE, weight: "Helvetica-Bold", tracking: 1.4, width: left.w,
  });
  // SPEC: paragraph X=60, Y=173 (=120/345)
  text(
    "a parent changes the wi-fi password. their 12-year-old switches to mobile data. the parent takes the phone. the child yells. the parent gives it back.\n\ntomorrow it happens again.\n\nthe toolkit a household has today is not the toolkit a household needs.",
    left.x, 173,
    { size: 12, color: INK, width: left.w, lineGap: 7 },
  );
  // Closing line tucked just above the anchor to eliminate dead space
  // (spec Y=575 left a 175pt void; this respects the "no dead space" rule).
  hLine(left.x, 420, left.w, HAIRLINE);
  text("THIS IS NOT A TECH PROBLEM. IT IS A DAILY FAMILY CRISIS.",
    left.x, 432,
    { size: 11, color: FOREST, weight: "Helvetica-Bold", width: left.w, tracking: 0.4 });

  // ---- RIGHT COLUMN: 3 cost stats stacked ----
  // SPEC: top of "40" must align with FIRST LINE of paragraph text (Y=173).
  // SPEC: tighten spacing — 68 UP 5px, 3 UP 10px (relative to 100px baseline).
  const stats = [
    { y: 173, n: "40", u: "min/day",        l: "negotiating time online",        b: "240 hours per year. the same fight, every night.", i: "clock" },
    { y: 263, n: "68", u: "% of parents",   l: "report daily conflict",          b: "the existing toolkit hasn't dented this number.",  i: "alert" },
    { y: 353, n: "3",  u: "in 4 kids",      l: "bypass within a month",          b: "switching device, browser, or moving to mobile data.", i: "device" },
  ];
  // Number column reserved width — keeps numbers aligned regardless of digit count
  const numColW = 70;
  const txtColX = right.x + numColW + 18;
  const txtColW = right.w - numColW - 18;
  stats.forEach((s) => {
    // Big sage number, baseline-aligned across all three rows
    doc.font("Helvetica-Bold").fontSize(40).fillColor(SAGE_DEEP)
      .text(s.n, right.x, s.y, { width: numColW, characterSpacing: -1.5, lineBreak: false });
    // Tiny unit caption directly under the number
    text(s.u, right.x, s.y + 38, {
      size: 8, color: MUTED, weight: "Helvetica-Bold", tracking: 0.8, width: numColW,
    });
    // Label + body, vertically centered to the number block
    text(s.l, txtColX, s.y + 4, {
      size: 12, color: INK, weight: "Helvetica-Bold", width: txtColW, lineGap: 2,
    });
    text(s.b, txtColX, s.y + 24, {
      size: 9, color: MUTED, width: txtColW, lineGap: 2,
    });
  });
}
// SPEC: bottom anchor UP 10px (=20 spec) for slide 02
specAnchor("the underlying truth", "this is the rare household problem that is loud, daily, and entirely unsolved.", { yOverride: 453 });

// =========================================================================
// 03 — MARKET GAP
// 12-col: full-width table
// =========================================================================
newSlide("03 · market gap");
title("market gap", "existing tools don't actually solve it.", { size: 22 });

{
  // Table with 3 columns: solution (4 cols) · what they do (4 cols) · why it fails (4 cols)
  const headerH = 28;
  const rows = [
    ["built-in device controls", "limit time per app, per device", "easy to bypass, one device at a time, hard to set up"],
    ["passive monitoring (Circle)", "alerts when limits are exceeded", "informs after the fact — the limit is already broken"],
    ["manual rules & agreements", "verbal rules, spot checks", "depend on adult willpower — gone by 8pm"],
    ["router-level blocking", "block specific sites at the router", "technical, only blocks internet, misses mobile data"],
    ["isp family filters", "carrier-side category blocks", "shallow filtering, household-wide only, no scheduling"],
  ];
  const rowH = (CONTENT_H - headerH) / rows.length;
  const cA = col(4, 0);
  const cB = col(4, 4);
  const cC = col(4, 8);

  rect(M, CONTENT_TOP_Y, CONTENT_W, headerH, FOREST);
  text("SOLUTION", cA.x + 14, CONTENT_TOP_Y + 10, { size: 8, color: PARCHMENT, weight: "Helvetica-Bold", tracking: 1.4, width: cA.w - 28 });
  text("WHAT THEY DO", cB.x + 14, CONTENT_TOP_Y + 10, { size: 8, color: PARCHMENT, weight: "Helvetica-Bold", tracking: 1.4, width: cB.w - 28 });
  text("WHY IT FAILS", cC.x + 14, CONTENT_TOP_Y + 10, { size: 8, color: PARCHMENT, weight: "Helvetica-Bold", tracking: 1.4, width: cC.w - 28 });

  rows.forEach((r, i) => {
    const y = CONTENT_TOP_Y + headerH + i * rowH;
    if (i % 2 === 0) rect(M, y, CONTENT_W, rowH, ROW_ALT);
    text(r[0], cA.x + 14, y + (rowH - 22) / 2, { size: 11, color: INK, weight: "Helvetica-Bold", width: cA.w - 28, lineGap: 2 });
    text(r[1], cB.x + 14, y + (rowH - 22) / 2, { size: 10, color: MUTED, width: cB.w - 28, lineGap: 2 });
    text(r[2], cC.x + 14, y + (rowH - 22) / 2, { size: 10, color: INK, width: cC.w - 28, lineGap: 2 });
    hLine(M, y + rowH, CONTENT_W, HAIRLINE);
  });
}
anchor("the gap is not awareness", "it's automated, network-level enforcement that takes the parent out of the loop.");

// =========================================================================
// 04 — INSIGHT (dark)
// 12-col: huge quote + supporting stats col(7), willpower chart col(5)
// =========================================================================
newSlide("04 · the insight", { dark: true });
title("the insight", "the system fails because the human does, not because the rule does.", { dark: true, size: 22 });

{
  const left = col(7, 0);
  const right = col(5, 7);
  // Big quote (dark) — top-aligned to CONTENT_TOP_Y, matches chart panel start
  doc.font("Helvetica-Bold").fontSize(28).fillColor(PARCHMENT)
    .text("\"kids don't ignore rules.\nthey ignore unenforced rules.\"",
      left.x, CONTENT_TOP_Y + 4, { width: left.w, lineGap: 4, characterSpacing: -0.4 });
  text("enforcement only works when the adult has energy. bedtime is when energy is gone.",
    left.x, CONTENT_TOP_Y + 92, { size: 12, color: MUTED_DARK, width: left.w, lineGap: 4 });

  // Stat block — 3 supporting rows in one card
  const statY = CONTENT_TOP_Y + 144;
  const statH = CONTENT_BOTTOM_Y - statY;
  rect(left.x, statY, left.w, statH, FOREST_2, 10);
  text("WHY WILLPOWER FAILS", left.x + 18, statY + 14, {
    size: 8, color: SAGE, weight: "Helvetica-Bold", tracking: 1.4, width: left.w - 36,
  });
  const insRows = [
    ["68%", "of parents report daily conflict over time online"],
    ["8pm", "median moment willpower drops below threshold"],
    ["3 of 4", "kids bypass within a month under manual rules"],
  ];
  const rowGap = 6;
  const rowH = (statH - 36 - rowGap * (insRows.length - 1)) / insRows.length;
  insRows.forEach((r, i) => {
    const y = statY + 32 + i * (rowH + rowGap);
    doc.font("Helvetica-Bold").fontSize(15).fillColor(SAGE)
      .text(r[0], left.x + 18, y + (rowH - 15) / 2, { width: 70, characterSpacing: -0.4, lineBreak: false });
    text(r[1], left.x + 100, y + (rowH - 11) / 2, { size: 10, color: PARCHMENT, width: left.w - 118 });
  });

  // Willpower decay chart on right — fills full content height
  rect(right.x, CONTENT_TOP_Y, right.w, CONTENT_H, FOREST_2, 10);
  text("PARENT ENERGY · ACROSS A WEEKDAY", right.x + 18, CONTENT_TOP_Y + 14, {
    size: 8, color: SAGE, weight: "Helvetica-Bold", tracking: 1.4, width: right.w - 36,
  });
  const cX = right.x + 28;
  const cY = CONTENT_TOP_Y + 44;
  const cW = right.w - 56;
  const cH = CONTENT_H - 80;
  doc.save();
  doc.lineWidth(0.4).strokeColor(HAIRLINE_DARK);
  doc.moveTo(cX, cY).lineTo(cX, cY + cH).stroke();
  doc.moveTo(cX, cY + cH).lineTo(cX + cW, cY + cH).stroke();
  doc.restore();
  const pts = [
    { t: "7am", v: 0.95 }, { t: "10am", v: 0.85 }, { t: "1pm", v: 0.7 },
    { t: "4pm", v: 0.55 }, { t: "6pm", v: 0.40 }, { t: "8pm", v: 0.22 }, { t: "9pm", v: 0.10 },
  ];
  const px = (i: number) => cX + (cW * i) / (pts.length - 1);
  const py = (v: number) => cY + cH - cH * v;
  doc.save();
  doc.moveTo(cX, cY + cH);
  pts.forEach((p, i) => doc.lineTo(px(i), py(p.v)));
  doc.lineTo(cX + cW, cY + cH).fillOpacity(0.15).fill(SAGE);
  doc.fillOpacity(1); doc.restore();
  doc.save();
  doc.lineWidth(2).strokeColor(SAGE);
  pts.forEach((p, i) => i === 0 ? doc.moveTo(px(i), py(p.v)) : doc.lineTo(px(i), py(p.v)));
  doc.stroke();
  pts.forEach((p, i) => doc.circle(px(i), py(p.v), 2.5).fill(SAGE));
  doc.restore();
  pts.forEach((p, i) => {
    text(p.t, px(i) - 12, cY + cH + 6, { size: 7, color: MUTED_DARK, width: 24, align: "center" });
  });
  text("< enforcement works", cX + 4, cY + 4, { size: 8, color: MUTED_DARK, width: 100 });
  text("the witching hour >", cX + cW - 110, py(0.10) - 16, {
    size: 8, color: SAGE, weight: "Helvetica-Bold", width: 110, align: "right",
  });
}
anchor("the offly answer", "remove the need for willpower. automate the off. the system enforces the rule, the adult keeps the relationship.", { dark: true });

// =========================================================================
// 05 — SOLUTION · THE HUB
// 12-col: hub card col(5), feature 2x3 grid col(7)
// =========================================================================
newSlide("05 · the solution");
title("the solution", "the offly hub.", { size: 22 });

{
  const left = col(5, 0);
  const right = col(7, 5);
  // Hub card
  rect(left.x, CONTENT_TOP_Y, left.w, CONTENT_H, FOREST, 12);
  doc.save();
  doc.circle(left.x + left.w - 18, CONTENT_TOP_Y + 18, 3).fill(SAGE);
  doc.restore();
  text("OFFLY HUB", left.x + 18, CONTENT_TOP_Y + 14, {
    size: 9, color: SAGE, weight: "Helvetica-Bold", tracking: 1.4, width: left.w - 36,
  });
  // Big sage dot in center
  const dCx = left.x + left.w / 2;
  const dCy = CONTENT_TOP_Y + CONTENT_H / 2 - 8;
  doc.save();
  doc.circle(dCx, dCy, 52).fill(SAGE);
  doc.circle(dCx, dCy, 52 * 0.76).fillOpacity(0.14).fill(PARCHMENT).fillOpacity(1);
  doc.restore();
  // Spec strip at bottom of card
  const specY = CONTENT_TOP_Y + CONTENT_H - 70;
  hLine(left.x + 18, specY, left.w - 36, HAIRLINE_DARK);
  const specs = [["plug", "ethernet"], ["power", "usb-c · 5w"], ["size", "85 × 85 × 22mm"]];
  const specCellW = (left.w - 36) / 3;
  specs.forEach((s, i) => {
    const sx = left.x + 18 + i * specCellW;
    text(s[0].toUpperCase(), sx, specY + 12, {
      size: 8, color: MUTED_DARK, weight: "Helvetica-Bold", tracking: 1, width: specCellW,
    });
    text(s[1], sx, specY + 26, { size: 11, color: PARCHMENT, weight: "Helvetica-Bold", width: specCellW });
  });
  text("plug in. set once. done.", left.x, CONTENT_TOP_Y + CONTENT_H - 22, {
    size: 10, color: MUTED_DARK, width: left.w, align: "center", tracking: 0.3,
  });

  // 2x3 feature grid
  const ftCols = 2;
  const ftRows = 3;
  const ftCardW = (right.w - CARD_GAP * (ftCols - 1)) / ftCols;
  const ftCardH = (CONTENT_H - CARD_GAP * (ftRows - 1)) / ftRows;
  const features = [
    { i: "wifi", h: "every wi-fi device", b: "one hub for the whole home — phones, tablets, consoles, tvs." },
    { i: "calendar", h: "scheduled by default", b: "quiet hours, school nights, weekends. set once and it runs." },
    { i: "lock", h: "can't be uninstalled", b: "no app on a child's device for them to find or delete." },
    { i: "fingerprint", h: "device-aware", b: "rules apply per device, per group, or household-wide." },
    { i: "chart", h: "live dashboard", b: "see what's actually happening, not what was promised." },
    { i: "shield", h: "runs while you sleep", b: "no parent needed at the moment of enforcement." },
  ];
  features.forEach((f, i) => {
    const c = i % ftCols;
    const r = Math.floor(i / ftCols);
    const x = right.x + c * (ftCardW + CARD_GAP);
    const y = CONTENT_TOP_Y + r * (ftCardH + CARD_GAP);
    rect(x, y, ftCardW, ftCardH, PARCHMENT, 8);
    strokeRect(x, y, ftCardW, ftCardH, HAIRLINE, 0.5, 8);
    rect(x + 14, y + 14, 28, 28, MOSS, 6);
    icon(f.i, x + 14, y + 14, 28, SAGE_DEEP);
    text(f.h, x + 50, y + 16, { size: 11, color: INK, weight: "Helvetica-Bold", width: ftCardW - 64 });
    text(f.b, x + 50, y + 32, { size: 9, color: MUTED, width: ftCardW - 64, lineGap: 1 });
  });
}
anchor("the wedge", "a small device on the home router that quietly runs the household's internet — set once, runs on its own.");

// =========================================================================
// 06 — THE PRODUCT (sales view)
// 12-col: hero hub illustration col(7), benefit rows col(5)
// =========================================================================
newSlide("06 · the product");
title("the product", "the offly hub. small, quiet, in control.", { size: 22 });

{
  const left = col(7, 0);
  const right = col(5, 7);

  // ---------- LEFT: hero hub illustration on dark card ----------
  rect(left.x, CONTENT_TOP_Y, left.w, CONTENT_H, FOREST, 12);
  doc.save();
  doc.circle(left.x + left.w - 18, CONTENT_TOP_Y + 18, 3).fill(SAGE);
  doc.restore();
  text("OFFLY HUB · FRONT VIEW", left.x + 18, CONTENT_TOP_Y + 14, {
    size: 9, color: SAGE, weight: "Helvetica-Bold", tracking: 1.4, width: left.w - 36,
  });

  // Hub illustration — front view, centered in the card
  // (cables intentionally omitted — short stubs read as antennae;
  //  spec strip below conveys "ethernet · usb-c" cleanly enough.)
  const hubW = 260;
  const hubH = 168;
  const hubX = left.x + (left.w - hubW) / 2;
  const hubY = CONTENT_TOP_Y + 56;

  // Soft drop shadow under hub
  doc.save();
  doc.fillOpacity(0.30);
  doc.roundedRect(hubX + 6, hubY + hubH + 6, hubW - 12, 10, 6).fill("#000000");
  doc.fillOpacity(1);
  doc.restore();

  // Hub body (deep ink black, rounded)
  doc.save();
  doc.roundedRect(hubX, hubY, hubW, hubH, 18).fill(INK);
  doc.restore();

  // Subtle top-edge highlight
  doc.save();
  doc.fillOpacity(0.06);
  doc.roundedRect(hubX, hubY, hubW, 22, 18).fill(PARCHMENT);
  doc.fillOpacity(1);
  doc.restore();

  // Wordmark embossed on the hub face — centered
  wordmark(hubX + hubW / 2, hubY + hubH / 2 - 4, 30, { onLight: false });

  // Status LED — bottom-right with soft glow
  const ledX = hubX + hubW - 24;
  const ledY = hubY + hubH - 18;
  doc.save();
  doc.fillOpacity(0.22);
  doc.circle(ledX, ledY, 9).fill(SAGE);
  doc.fillOpacity(1);
  doc.circle(ledX, ledY, 3.6).fill(SAGE);
  doc.restore();

  // Caption strip below hub
  text("plugs into your router. set once. it just runs.", left.x, CONTENT_TOP_Y + CONTENT_H - 46, {
    size: 12, color: PARCHMENT, weight: "Helvetica-Bold", width: left.w, align: "center",
  });
  // Spec strip — tiny separator + 3 spec chips inline
  rect(left.x + left.w / 2 - 22, CONTENT_TOP_Y + CONTENT_H - 28, 44, 1.5, SAGE);
  text("85 × 85 × 22mm   ·   ethernet   ·   usb-c · 5w", left.x, CONTENT_TOP_Y + CONTENT_H - 18, {
    size: 9, color: MUTED_DARK, width: left.w, align: "center", tracking: 0.6,
  });

  // ---------- RIGHT: 4 benefit rows ----------
  const benefits = [
    { i: "wifi",        h: "real-time control",     b: "internet on or off, instantly across the whole home." },
    { i: "calendar",    h: "scheduled by default",  b: "quiet hours, school nights, weekends — set once." },
    { i: "fingerprint", h: "every wi-fi device",    b: "phones, tablets, consoles, tvs — one hub for all." },
    { i: "shield",      h: "runs while you sleep",  b: "no parent needed at the moment of enforcement." },
  ];
  const bGap = 8;
  const bH = (CONTENT_H - bGap * (benefits.length - 1)) / benefits.length;
  benefits.forEach((b, i) => {
    const y = CONTENT_TOP_Y + i * (bH + bGap);
    rect(right.x, y, right.w, bH, PARCHMENT, 8);
    strokeRect(right.x, y, right.w, bH, HAIRLINE, 0.5, 8);
    rect(right.x, y, 4, bH, SAGE);
    rect(right.x + 14, y + (bH - 30) / 2, 30, 30, MOSS, 6);
    icon(b.i, right.x + 14, y + (bH - 30) / 2, 30, SAGE_DEEP);
    text(b.h, right.x + 56, y + bH / 2 - 14, {
      size: 11, color: INK, weight: "Helvetica-Bold", width: right.w - 70,
    });
    text(b.b, right.x + 56, y + bH / 2 + 2, {
      size: 9, color: MUTED, width: right.w - 70, lineGap: 1,
    });
  });
}
anchor("the product, plainly", "small, low-power, no app on a child's device — plugs in once and runs the household's internet for years.");

// =========================================================================
// 07 — UNDER THE HOOD
// 12-col: how it works col(6), known limits col(6)
// =========================================================================
newSlide("07 · under the hood");
title("under the hood", "how it actually works — and the limits we own.", { size: 22 });

{
  const left = col(6, 0);
  const right = col(6, 6);
  rect(left.x, CONTENT_TOP_Y, left.w, CONTENT_H, PARCHMENT, 10);
  strokeRect(left.x, CONTENT_TOP_Y, left.w, CONTENT_H, HAIRLINE, 0.5, 10);
  rect(left.x, CONTENT_TOP_Y, left.w, 30, MOSS, 10);
  text("HOW IT WORKS", left.x + 18, CONTENT_TOP_Y + 10, {
    size: 9, color: SAGE_DEEP, weight: "Helvetica-Bold", tracking: 1.4, width: left.w - 36,
  });
  const tech = [
    { i: "router", h: "network-level enforcement", b: "controls dns and traffic for every wi-fi device on the network." },
    { i: "fingerprint", h: "device fingerprinting", b: "each device recognised individually. rules per device or whole household." },
    { i: "calendar", h: "app-layer scheduling", b: "limits trigger at the network. nothing to install on a child's device." },
    { i: "chart", h: "real-time telemetry", b: "the dashboard sees every connection, in the moment it happens." },
  ];
  const techGap = 8;
  const techRowH = (CONTENT_H - 30 - 16 - techGap * (tech.length - 1)) / tech.length;
  tech.forEach((t, i) => {
    const y = CONTENT_TOP_Y + 38 + i * (techRowH + techGap);
    rect(left.x + 18, y + (techRowH - 30) / 2, 30, 30, MOSS, 6);
    icon(t.i, left.x + 18, y + (techRowH - 30) / 2, 30, SAGE_DEEP);
    text(t.h, left.x + 60, y + (techRowH - 32) / 2, {
      size: 11, color: INK, weight: "Helvetica-Bold", width: left.w - 80,
    });
    text(t.b, left.x + 60, y + (techRowH - 32) / 2 + 16, {
      size: 10, color: MUTED, width: left.w - 80, lineGap: 2,
    });
  });

  rect(right.x, CONTENT_TOP_Y, right.w, CONTENT_H, PARCHMENT, 10);
  strokeRect(right.x, CONTENT_TOP_Y, right.w, CONTENT_H, HAIRLINE, 0.5, 10);
  rect(right.x, CONTENT_TOP_Y, right.w, 30, "#F4E5DC", 10);
  text("KNOWN LIMITS · HOW WE HANDLE THEM", right.x + 18, CONTENT_TOP_Y + 10, {
    size: 9, color: RUST, weight: "Helvetica-Bold", tracking: 1.4, width: right.w - 36,
  });
  const limits = [
    { i: "device", h: "mobile data bypass", b: "wi-fi only today. sim-level on the 2027 roadmap.", tag: "ROADMAP" },
    { i: "shield", h: "vpn workarounds", b: "affects under 5% of the 6–16 cohort.", tag: "MITIGATED" },
    { i: "alert", h: "physical removal of the hub", b: "real-time alert the moment the device leaves the network.", tag: "LIVE" },
    { i: "lock", h: "shared adult devices", b: "household-mode lets adults opt out of their own rules.", tag: "BUILT-IN" },
  ];
  limits.forEach((t, i) => {
    const y = CONTENT_TOP_Y + 38 + i * (techRowH + techGap);
    rect(right.x + 18, y + (techRowH - 30) / 2, 30, 30, "#F4E5DC", 6);
    icon(t.i, right.x + 18, y + (techRowH - 30) / 2, 30, RUST);
    text(t.h, right.x + 60, y + (techRowH - 32) / 2, {
      size: 11, color: INK, weight: "Helvetica-Bold", width: right.w - 80 - 70,
    });
    const tagW = 64;
    rect(right.x + right.w - 18 - tagW, y + (techRowH - 18) / 2, tagW, 16, "#F4E5DC", 8);
    text(t.tag, right.x + right.w - 18 - tagW, y + (techRowH - 18) / 2 + 4, {
      size: 7, color: RUST, weight: "Helvetica-Bold", tracking: 1, width: tagW, align: "center",
    });
    text(t.b, right.x + 60, y + (techRowH - 32) / 2 + 16, {
      size: 10, color: MUTED, width: right.w - 80, lineGap: 2,
    });
  });
}
anchor("the discipline", "every limit is named, owned, and resourced — no hand-waving, no surprises in diligence.");

// =========================================================================
// 08 — EXPERIENCE — 4 STEPS
// 12-col: 4 cards col(3) each
// =========================================================================
newSlide("08 · the experience");
title("the experience", "four steps. then it runs itself.", { size: 22 });

{
  const steps = [
    { n: "01", i: "router", h: "connect", b: "plug the hub into your router. one cable. under two minutes.", t: "0–2 min" },
    { n: "02", i: "calendar", h: "configure", b: "set quiet hours and daily limits across the household. choose what's blocked.", t: "5 min · in app" },
    { n: "03", i: "shield", h: "enforce", b: "offly cuts internet access when limits are reached. nothing for an adult to do.", t: "automatic" },
    { n: "04", i: "chart", h: "monitor", b: "live dashboard shows usage by device, household member, and category.", t: "anytime" },
  ];
  steps.forEach((s, i) => {
    const c = col(3, i * 3);
    rect(c.x, CONTENT_TOP_Y, c.w, CONTENT_H, PARCHMENT, 12);
    strokeRect(c.x, CONTENT_TOP_Y, c.w, CONTENT_H, HAIRLINE, 0.5, 12);
    // Top band: big number + icon
    doc.font("Helvetica-Bold").fontSize(40).fillColor(SAGE)
      .text(s.n, c.x + 18, CONTENT_TOP_Y + 22, { width: c.w - 36, characterSpacing: -1 });
    rect(c.x + c.w - 18 - 40, CONTENT_TOP_Y + 26, 40, 40, MOSS, 8);
    icon(s.i, c.x + c.w - 18 - 40, CONTENT_TOP_Y + 26, 40, SAGE_DEEP);
    hLine(c.x + 18, CONTENT_TOP_Y + 92, c.w - 36, HAIRLINE);
    // Mid band: headline + body, vertically anchored, denser
    text(s.h, c.x + 18, CONTENT_TOP_Y + 110, { size: 20, color: INK, weight: "Helvetica-Bold", width: c.w - 36 });
    text(s.b, c.x + 18, CONTENT_TOP_Y + 142, { size: 11, color: MUTED, width: c.w - 36, lineGap: 5 });
    // Bottom band: divider + pill — pulled up so the card has no dead lower zone
    hLine(c.x + 18, CONTENT_TOP_Y + 232, c.w - 36, HAIRLINE);
    rect(c.x + 18, CONTENT_TOP_Y + 246, c.w - 36, 22, MOSS, 11);
    text(s.t, c.x + 18, CONTENT_TOP_Y + 252, {
      size: 9, color: SAGE_DEEP, weight: "Helvetica-Bold", tracking: 0.8, width: c.w - 36, align: "center",
    });
    if (i < steps.length - 1) {
      doc.font("Helvetica-Bold").fontSize(16).fillColor(SAGE)
        .text("›", c.x + c.w + 1, CONTENT_TOP_Y + CONTENT_H / 2 - 10, { width: 8, lineBreak: false });
    }
  });
}
anchor("the household promise", "set up once on a sunday afternoon. it runs without you for the next ten years.");

// =========================================================================
// 09 — A DAY · WITH vs WITHOUT
// 12-col: without col(6), with col(6) — 5 timed rows
// =========================================================================
newSlide("09 · behavioural shift");
title("behavioural shift", "a day, with and without.", { size: 22 });

{
  const left = col(6, 0);
  const right = col(6, 6);
  const headerH = 30;
  rect(left.x, CONTENT_TOP_Y, left.w, headerH, "#F4E5DC", 8);
  rect(right.x, CONTENT_TOP_Y, right.w, headerH, MOSS, 8);
  text("WITHOUT OFFLY", left.x + 16, CONTENT_TOP_Y + 10, {
    size: 9, color: RUST, weight: "Helvetica-Bold", tracking: 1.4, width: left.w - 32,
  });
  text("WITH OFFLY", right.x + 16, CONTENT_TOP_Y + 10, {
    size: 9, color: SAGE_DEEP, weight: "Helvetica-Bold", tracking: 1.4, width: right.w - 32,
  });
  const day = [
    { t: "3:30pm", w: "child on a device. parent at work.", o: "device used within the daily limit." },
    { t: "5:00pm", w: "parent asks them to stop. argument starts.", o: "limit reached. internet auto-pauses." },
    { t: "6:30pm", w: "phone confiscated. sulking through dinner.", o: "dinner. no argument. zero effort." },
    { t: "8:30pm", w: "tablet found in bedroom. threats and tears.", o: "quiet hours kick in across all devices." },
    { t: "9:30pm", w: "wi-fi password changed. mobile data. give up.", o: "quick dashboard glance. adjust if needed." },
  ];
  const rowsTop = CONTENT_TOP_Y + headerH + 8;
  const rowsArea = CONTENT_BOTTOM_Y - rowsTop;
  const dRowH = rowsArea / day.length;
  day.forEach((d, i) => {
    const ry = rowsTop + i * dRowH;
    // Time pill (left)
    rect(left.x, ry + (dRowH - 22) / 2, 56, 22, STONE, 11);
    text(d.t, left.x, ry + (dRowH - 22) / 2 + 6, { size: 9, color: INK, weight: "Helvetica-Bold", width: 56, align: "center" });
    text(d.w, left.x + 68, ry + (dRowH - 24) / 2 + 4, {
      size: 11, color: INK, width: left.w - 80, lineGap: 2,
    });
    // Time pill (right)
    rect(right.x, ry + (dRowH - 22) / 2, 56, 22, MOSS, 11);
    text(d.t, right.x, ry + (dRowH - 22) / 2 + 6, { size: 9, color: SAGE_DEEP, weight: "Helvetica-Bold", width: 56, align: "center" });
    text(d.o, right.x + 68, ry + (dRowH - 24) / 2 + 4, {
      size: 11, color: INK, width: right.w - 80, lineGap: 2,
    });
    if (i < day.length - 1) hLine(M, ry + dRowH - 4, CONTENT_W, HAIRLINE);
  });
}
anchor("what changes", "the same family, the same evening — but the conflict simply stops being there.");

// =========================================================================
// 10 — DIFFERENTIATION (2x2)
// 12-col: 4 cards col(6) × 2 rows
// =========================================================================
newSlide("10 · differentiation");
title("differentiation", "why offly wins.", { size: 22 });

{
  const cards = [
    { i: "wifi", n: "01", h: "network-level control", b: "every wi-fi device managed from one point. nothing to install on the child's device.", k: ["covers", "all wi-fi devices"] },
    { i: "shield", n: "02", h: "meaningful friction", b: "mobile data or vpn bypass requires effort most 6–12 year-olds won't attempt.", k: ["typical bypass", "<5% of 6–12s"] },
    { i: "calendar", n: "03", h: "fully automated", b: "zero daily involvement. rules run on schedule, regardless of who's home.", k: ["effort/day", "0 minutes"] },
    { i: "money", n: "04", h: "subscription revenue", b: "hardware is acquisition. subscription is the business. recurring from day one.", k: ["MRR per home", "A$15"] },
  ];
  const cardW = (CONTENT_W - CARD_GAP) / 2;
  const cardH = (CONTENT_H - CARD_GAP) / 2;
  cards.forEach((c, i) => {
    const ccol = i % 2;
    const crow = Math.floor(i / 2);
    const x = M + ccol * (cardW + CARD_GAP);
    const y = CONTENT_TOP_Y + crow * (cardH + CARD_GAP);
    rect(x, y, cardW, cardH, PARCHMENT, 12);
    strokeRect(x, y, cardW, cardH, HAIRLINE, 0.5, 12);
    rect(x, y, cardW, 4, SAGE, 0);
    text(c.n, x + 22, y + 22, { size: 9, color: SAGE, weight: "Helvetica-Bold", tracking: 1.2, width: 30 });
    rect(x + cardW - 22 - 44, y + 18, 44, 44, MOSS, 8);
    icon(c.i, x + cardW - 22 - 44, y + 18, 44, SAGE_DEEP);
    text(c.h, x + 22, y + 44, { size: 18, color: INK, weight: "Helvetica-Bold", width: cardW - 44 - 60 });
    text(c.b, x + 22, y + 80, { size: 11, color: MUTED, width: cardW - 44, lineGap: 3 });
    hLine(x + 22, y + cardH - 36, cardW - 44, HAIRLINE);
    text(c.k[0].toUpperCase(), x + 22, y + cardH - 26, {
      size: 8, color: MUTED, weight: "Helvetica-Bold", tracking: 1, width: cardW / 2 - 22,
    });
    text(c.k[1], x + cardW - 22 - cardW / 2 + 22, y + cardH - 26, {
      size: 11, color: SAGE_DEEP, weight: "Helvetica-Bold", width: cardW / 2 - 22, align: "right",
    });
  });
}
anchor("the structural advantage", "platform tools serve their ecosystem. offly serves the household — across every device.");

// =========================================================================
// 11 — COMPETITIVE MATRIX
// =========================================================================
newSlide("11 · competitive matrix");
title("competitive position", "the only network-level, automated household solution.", { size: 22 });

{
  const headers = ["offly", "apple\nscreen time", "google\nfamily link", "circle home", "isp filters"];
  const features2 = [
    { f: "network-level enforcement", v: ["yes", "no", "no", "yes", "partial"] },
    { f: "all wi-fi devices, not just one ecosystem", v: ["yes", "no", "no", "partial", "yes"] },
    { f: "fully automated · zero daily effort", v: ["yes", "no", "no", "no", "no"] },
    { f: "mobile data / vpn friction", v: ["yes", "no", "no", "partial", "no"] },
    { f: "asset-based retention (hub returns)", v: ["yes", "no", "no", "no", "no"] },
    { f: "subscription business model", v: ["yes", "no", "no", "yes", "no"] },
  ];
  const fCol = COL_W * 4 + GUTTER * 3; // capability label = 4 cols
  const vColTotal = CONTENT_W - fCol;
  const vCol = vColTotal / headers.length;
  const hH = 44;
  const rH = (CONTENT_H - hH - 22) / features2.length; // leave 22 for legend at bottom

  rect(M, CONTENT_TOP_Y, CONTENT_W, hH, FOREST);
  text("CAPABILITY", M + 14, CONTENT_TOP_Y + 16, {
    size: 9, color: PARCHMENT, weight: "Helvetica-Bold", tracking: 1.2, width: fCol - 28,
  });
  headers.forEach((h, i) => {
    const x = M + fCol + i * vCol;
    if (i === 0) rect(x, CONTENT_TOP_Y, vCol, hH, SAGE_DEEP);
    text(h, x, CONTENT_TOP_Y + 8, {
      size: 9, color: PARCHMENT, weight: "Helvetica-Bold", tracking: 0.8, width: vCol, align: "center", lineGap: 1,
    });
  });

  features2.forEach((row, i) => {
    const y = CONTENT_TOP_Y + hH + i * rH;
    if (i % 2 === 0) rect(M, y, CONTENT_W, rH, ROW_ALT);
    rect(M + fCol, y, vCol, rH, "#E6EBE7");
    text(row.f, M + 14, y + (rH - 14) / 2, {
      size: 10, color: INK, weight: "Helvetica-Bold", width: fCol - 28,
    });
    row.v.forEach((v, j) => {
      const x = M + fCol + j * vCol;
      const cx = x + vCol / 2;
      const cy = y + rH / 2;
      const r = j === 0 ? 8 : 7;
      if (v === "yes") {
        doc.save(); doc.circle(cx, cy, r).fill(SAGE_DEEP); doc.restore();
      } else if (v === "partial") {
        doc.save(); doc.circle(cx, cy, r).lineWidth(1.4).stroke(AMBER); doc.restore();
        doc.save(); doc.path(`M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} Z`).fill(AMBER); doc.restore();
      } else {
        doc.save(); doc.circle(cx, cy, r).lineWidth(1.4).stroke("#C8C2B5"); doc.restore();
      }
    });
    hLine(M, y + rH, CONTENT_W, HAIRLINE);
  });

  // Compact legend at bottom of content band
  const lgY = CONTENT_BOTTOM_Y - 14;
  const items = [
    { kind: "yes", c: SAGE_DEEP, l: "fully supported" },
    { kind: "partial", c: AMBER, l: "partial" },
    { kind: "no", c: "#C8C2B5", l: "not supported" },
  ];
  let lgX = M;
  items.forEach((it) => {
    const cx = lgX + 6;
    const cy = lgY + 4;
    if (it.kind === "yes") {
      doc.save(); doc.circle(cx, cy, 6).fill(it.c); doc.restore();
    } else if (it.kind === "partial") {
      doc.save(); doc.circle(cx, cy, 6).lineWidth(1.4).stroke(it.c); doc.restore();
      doc.save(); doc.path(`M ${cx} ${cy - 6} A 6 6 0 0 1 ${cx} ${cy + 6} Z`).fill(it.c); doc.restore();
    } else {
      doc.save(); doc.circle(cx, cy, 6).lineWidth(1.4).stroke(it.c); doc.restore();
    }
    text(it.l, lgX + 18, lgY, { size: 9, color: MUTED, weight: "Helvetica-Bold", tracking: 0.5, width: 120 });
    lgX += 130;
  });
}
anchor("structural moat", "no incumbent solves all six rows. offly is the only product purpose-built for the household, not the device.");

// =========================================================================
// 12 — BUSINESS MODEL
// 12-col: pillars col(6), unit economics col(6)
// =========================================================================
newSlide("12 · business model");
title("business model", "subscription-first. hardware as acquisition.", { size: 22 });

{
  const left = col(6, 0);
  const right = col(6, 6);
  const pillars = [
    { t: "ACQUISITION", h: "hardware is free.", b: "removes the #1 adoption barrier. families opt in without a purchase decision." },
    { t: "RECURRING", h: "A$15 / month, 6-month minimum.", b: "billed monthly from delivery. pause option (A$8) preserves mrr through disruptions." },
    { t: "RETENTION", h: "the hub stays in the home.", b: "cancellation requires returning a physical device — friction most never act on." },
  ];
  const pGap = 8;
  const pH = (CONTENT_H - pGap * (pillars.length - 1)) / pillars.length;
  pillars.forEach((p, i) => {
    const y = CONTENT_TOP_Y + i * (pH + pGap);
    rect(left.x, y, left.w, pH, PARCHMENT, 10);
    strokeRect(left.x, y, left.w, pH, HAIRLINE, 0.5, 10);
    rect(left.x, y, 4, pH, SAGE, 0);
    text(p.t, left.x + 18, y + 14, { size: 8, color: SAGE, weight: "Helvetica-Bold", tracking: 1.4, width: left.w - 36 });
    text(p.h, left.x + 18, y + 28, { size: 14, color: INK, weight: "Helvetica-Bold", width: left.w - 36, lineGap: 2 });
    text(p.b, left.x + 18, y + 56, { size: 10, color: MUTED, width: left.w - 36, lineGap: 2 });
  });

  // Right: unit economics card — fills full content height
  rect(right.x, CONTENT_TOP_Y, right.w, CONTENT_H, FOREST, 10);
  text("UNIT ECONOMICS · BASE CASE", right.x + 18, CONTENT_TOP_Y + 14, {
    size: 8, color: SAGE, weight: "Helvetica-Bold", tracking: 1.4, width: right.w - 36,
  });
  doc.font("Helvetica-Bold").fontSize(48).fillColor(PARCHMENT)
    .text("A$180", right.x + 18, CONTENT_TOP_Y + 32, { width: right.w - 36, characterSpacing: -2 });
  text("12-month customer ltv", right.x + 18, CONTENT_TOP_Y + 86, {
    size: 11, color: MUTED_DARK, width: right.w - 36,
  });
  hLine(right.x + 18, CONTENT_TOP_Y + 108, right.w - 36, HAIRLINE_DARK);
  const ueRows = [
    ["hardware cogs", "A$40"],
    ["monthly subscription", "A$15"],
    ["target cac", "A$75"],
    ["payback", "5 months"],
    ["12-mo retention", "85%"],
    ["ltv : cac", "2.4×"],
  ];
  const ueStY = CONTENT_TOP_Y + 118;
  const ueH = CONTENT_BOTTOM_Y - ueStY;
  const ueRowH = ueH / ueRows.length;
  ueRows.forEach((r, i) => {
    const y = ueStY + i * ueRowH;
    text(r[0], right.x + 18, y + (ueRowH - 12) / 2, {
      size: 11, color: MUTED_DARK, width: right.w - 36,
    });
    text(r[1], right.x + 18, y + (ueRowH - 12) / 2, {
      size: 12, color: PARCHMENT, weight: "Helvetica-Bold", width: right.w - 36, align: "right",
    });
    if (i < ueRows.length - 1) hLine(right.x + 18, y + ueRowH, right.w - 36, HAIRLINE_DARK, 0.4);
  });
}
anchor("the engine", "hardware paid back in roughly three months. every month after is contribution margin.");

// =========================================================================
// 13 — SCENARIO ECONOMICS
// 12-col: top KPI row col(3) × 4, then 3 scenario cards col(4) × 3
// =========================================================================
newSlide("13 · scenario economics");
title("scenario economics", "the numbers work across multiple cases.", { size: 22 });

{
  // Top KPI row
  const kpis = [
    { v: "A$40", l: "hardware cogs" },
    { v: "A$15", l: "monthly sub" },
    { v: "A$75", l: "target cac" },
    { v: "5 mo", l: "payback (base)" },
  ];
  const kpiH = 60;
  kpis.forEach((k, i) => {
    const c = col(3, i * 3);
    rect(c.x, CONTENT_TOP_Y, c.w, kpiH, MOSS, 10);
    rect(c.x, CONTENT_TOP_Y, 3, kpiH, SAGE);
    doc.font("Helvetica-Bold").fontSize(22).fillColor(FOREST)
      .text(k.v, c.x + 14, CONTENT_TOP_Y + 12, { width: c.w - 28, characterSpacing: -0.5 });
    text(k.l.toUpperCase(), c.x + 14, CONTENT_TOP_Y + 40, {
      size: 8, color: SAGE_DEEP, weight: "Helvetica-Bold", tracking: 1.2, width: c.w - 28,
    });
  });

  // Three scenarios
  const scTop = CONTENT_TOP_Y + kpiH + 12;
  const scH = CONTENT_BOTTOM_Y - scTop;
  const scs = [
    { h: "downside", c: RUST, sub: "tougher CAC, weaker retention", rows: [["retention", "72%"], ["cac", "A$110"], ["ltv", "A$144"], ["ltv:cac", "1.3×"], ["payback", "8 mo"]] },
    { h: "base", c: SAGE, sub: "current pilot signal", rows: [["retention", "85%"], ["cac", "A$75"], ["ltv", "A$180"], ["ltv:cac", "2.4×"], ["payback", "5 mo"]] },
    { h: "upside", c: SAGE_DEEP, sub: "channel mix favours organic", rows: [["retention", "90%"], ["cac", "A$60"], ["ltv", "A$210"], ["ltv:cac", "3.5×"], ["payback", "4 mo"]] },
  ];
  scs.forEach((s, i) => {
    const c = col(4, i * 4);
    rect(c.x, scTop, c.w, scH, PARCHMENT, 12);
    strokeRect(c.x, scTop, c.w, scH, HAIRLINE, 0.5, 12);
    rect(c.x, scTop, c.w, 6, s.c, 0);
    text(s.h.toUpperCase(), c.x + 18, scTop + 16, {
      size: 8, color: s.c, weight: "Helvetica-Bold", tracking: 1.4, width: c.w - 36,
    });
    doc.font("Helvetica-Bold").fontSize(22).fillColor(INK)
      .text(s.h, c.x + 18, scTop + 30, { width: c.w - 36, characterSpacing: -0.5 });
    text(s.sub, c.x + 18, scTop + 60, { size: 9, color: MUTED, width: c.w - 36, lineGap: 2 });
    hLine(c.x + 18, scTop + 84, c.w - 36, HAIRLINE);
    const dataTop = scTop + 96;
    const dataH = scH - 96 - 14;
    const drowH = dataH / s.rows.length;
    s.rows.forEach((r, j) => {
      const y = dataTop + j * drowH;
      text(r[0], c.x + 18, y + (drowH - 12) / 2, { size: 10, color: MUTED, width: c.w - 36 });
      text(r[1], c.x + 18, y + (drowH - 12) / 2, {
        size: 12, color: INK, weight: "Helvetica-Bold", width: c.w - 36, align: "right",
      });
      if (j < s.rows.length - 1) hLine(c.x + 18, y + drowH, c.w - 36, HAIRLINE, 0.3);
    });
  });
}
anchor("downside still works", "even at 1.3× ltv:cac and 8-month payback, the model returns capital and remains capital-efficient.");

// =========================================================================
// 14 — RETENTION
// 12-col: top 4 cards col(3) × 4, bottom flow full width
// =========================================================================
newSlide("14 · retention");
title("retention", "families don't cancel what they depend on.", { size: 22 });

{
  const topH = Math.round(CONTENT_H * 0.40);
  const flY = CONTENT_TOP_Y + topH + CARD_GAP;
  const flH = CONTENT_BOTTOM_Y - flY;
  const rt = [
    { i: "home", h: "household norm", b: "the rule isn't a parent — it's the system. arguments stop." },
    { i: "clock", h: "fear of going back", b: "after 3 months, manual enforcement feels exhausting." },
    { i: "lock", h: "physical asset", b: "returning a device is friction most never act on." },
    { i: "chart", h: "trust through visibility", b: "the dashboard becomes the household's source of truth." },
  ];
  rt.forEach((c, i) => {
    const cc = col(3, i * 3);
    rect(cc.x, CONTENT_TOP_Y, cc.w, topH, PARCHMENT, 10);
    strokeRect(cc.x, CONTENT_TOP_Y, cc.w, topH, HAIRLINE, 0.5, 10);
    rect(cc.x + 14, CONTENT_TOP_Y + 14, 32, 32, MOSS, 6);
    icon(c.i, cc.x + 14, CONTENT_TOP_Y + 14, 32, SAGE_DEEP);
    text(`0${i + 1}`, cc.x + 14, CONTENT_TOP_Y + 54, {
      size: 8, color: SAGE, weight: "Helvetica-Bold", tracking: 1.4, width: cc.w - 28,
    });
    text(c.h, cc.x + 14, CONTENT_TOP_Y + 68, {
      size: 13, color: INK, weight: "Helvetica-Bold", width: cc.w - 28,
    });
    text(c.b, cc.x + 14, CONTENT_TOP_Y + 90, {
      size: 9, color: MUTED, width: cc.w - 28, lineGap: 2,
    });
  });

  // Bottom dark flow
  rect(M, flY, CONTENT_W, flH, FOREST, 10);
  text("CANCELLATION IS A PROCESS, NOT A BUTTON", M + 18, flY + 14, {
    size: 9, color: SAGE, weight: "Helvetica-Bold", tracking: 1.4, width: CONTENT_W - 36,
  });
  text("each stage is a chance to retain — or to convert non-return into a replacement-fee event.",
    M + 18, flY + 28, { size: 10, color: MUTED_DARK, width: CONTENT_W - 36 });
  const flow = [
    { n: "01", h: "request", b: "in-app initiation" },
    { n: "02", h: "retention", b: "pause @ A$8 offered" },
    { n: "03", h: "return window", b: "14-day prepaid label" },
    { n: "04", h: "device received", b: "service deactivated" },
    { n: "05", h: "no return", b: "A$80 replacement fee" },
  ];
  const flCardTop = flY + 56;
  const flCardH = flH - 70;
  const flGap = 12;
  const flCardW = (CONTENT_W - 36 - flGap * (flow.length - 1)) / flow.length;
  flow.forEach((f, i) => {
    const x = M + 18 + i * (flCardW + flGap);
    rect(x, flCardTop, flCardW, flCardH, FOREST_2, 8);
    rect(x, flCardTop, 3, flCardH, SAGE);
    text(f.n, x + 12, flCardTop + 12, {
      size: 8, color: SAGE, weight: "Helvetica-Bold", tracking: 1.2, width: flCardW - 24,
    });
    text(f.h, x + 12, flCardTop + 28, {
      size: 13, color: PARCHMENT, weight: "Helvetica-Bold", width: flCardW - 24,
    });
    text(f.b, x + 12, flCardTop + flCardH - 22, {
      size: 9, color: MUTED_DARK, width: flCardW - 24,
    });
    if (i < flow.length - 1) {
      doc.font("Helvetica-Bold").fontSize(14).fillColor(SAGE)
        .text("›", x + flCardW + 1, flCardTop + flCardH / 2 - 8, { width: 10, lineBreak: false });
    }
  });
}
anchor("the compounding effect", "dependence + asset-based exit friction = best-in-class retention without lock-in tactics.");

// =========================================================================
// 15 — WHY NOW & MARKET
// 12-col: why now (2x2) col(6), market sizing col(6)
// =========================================================================
newSlide("15 · why now & market");
title("why now & market", "the timing, and the size of the prize.", { size: 22 });

{
  const left = col(6, 0);
  const right = col(6, 6);
  text("WHY NOW", left.x, CONTENT_TOP_Y, {
    size: 8, color: SAGE, weight: "Helvetica-Bold", tracking: 1.4, width: left.w,
  });
  const wn = [
    { i: "people", h: "households are searching", b: "‘the anxious generation’ + school phone bans." },
    { i: "alert", h: "frustration at peak", b: "68% report daily conflict over time online." },
    { i: "money", h: "model is trusted", b: "ring · nest · starlink normalised free hardware." },
    { i: "school", h: "regulation incoming", b: "au online safety act creates urgency." },
  ];
  const wnW = (left.w - CARD_GAP) / 2;
  const wnTop = CONTENT_TOP_Y + 16;
  const wnH = (CONTENT_H - 16 - CARD_GAP) / 2;
  wn.forEach((w, i) => {
    const c = i % 2;
    const r = Math.floor(i / 2);
    const x = left.x + c * (wnW + CARD_GAP);
    const y = wnTop + r * (wnH + CARD_GAP);
    rect(x, y, wnW, wnH, PARCHMENT, 10);
    strokeRect(x, y, wnW, wnH, HAIRLINE, 0.5, 10);
    rect(x + 14, y + 14, 30, 30, MOSS, 6);
    icon(w.i, x + 14, y + 14, 30, SAGE_DEEP);
    text(w.h, x + 14, y + 52, { size: 12, color: INK, weight: "Helvetica-Bold", width: wnW - 28 });
    text(w.b, x + 14, y + 70, { size: 9, color: MUTED, width: wnW - 28, lineGap: 2 });
  });

  // Right: market sizing
  text("MARKET SIZING", right.x, CONTENT_TOP_Y, {
    size: 8, color: SAGE, weight: "Helvetica-Bold", tracking: 1.4, width: right.w,
  });
  doc.font("Helvetica-Bold").fontSize(28).fillColor(INK)
    .text("A$12B", right.x, CONTENT_TOP_Y + 14, { width: right.w, characterSpacing: -0.5 });
  text("global household internet controls market by 2030", right.x, CONTENT_TOP_Y + 48, {
    size: 10, color: MUTED, width: right.w,
  });
  hLine(right.x, CONTENT_TOP_Y + 72, right.w, HAIRLINE);
  const tiers = [
    { l: "TAM", v: "~120M", n: "households with children 6–16 · english markets", w: 1, c: SAGE },
    { l: "SAM", v: "~18M",  n: "high-internet-use, frustrated households",        w: 0.55, c: SAGE_DEEP },
    { l: "SOM", v: "~240K", n: "3-year target · au · nz · uk",                     w: 0.18, c: FOREST },
  ];
  const tStart = CONTENT_TOP_Y + 86;
  const tEnd = CONTENT_BOTTOM_Y - 4;
  const tH = (tEnd - tStart) / tiers.length;
  tiers.forEach((t, i) => {
    const top = tStart + i * tH;
    text(t.l, right.x, top + 6, {
      size: 9, color: MUTED, weight: "Helvetica-Bold", tracking: 1.2, width: 50,
    });
    doc.font("Helvetica-Bold").fontSize(20).fillColor(INK)
      .text(t.v, right.x + 50, top, { width: right.w - 50, characterSpacing: -0.5 });
    text(t.n, right.x + 50, top + 26, { size: 9, color: MUTED, width: right.w - 50 });
    const barY = top + 50;
    rect(right.x, barY, right.w, 6, STONE, 3);
    rect(right.x, barY, right.w * t.w, 6, t.c, 3);
  });
}
anchor("convergence", "demand, attention, and policy are stacking in the same direction at the same time.");

// =========================================================================
// 16 — GTM & TRACTION
// 12-col: channel cards col(7) (2x2), traction col(5) (3 stats + quote)
// =========================================================================
newSlide("16 · go-to-market & traction");
title("go-to-market & traction", "how we acquire — and the early signal.", { size: 22 });

{
  const gt = [
    { i: "people", n: "01", h: "parent communities", b: "facebook (2M+), reddit, kidspot. pain-driven creative outperforms 3–5×.", k: "low cac" },
    { i: "school", n: "02", h: "school partnerships", b: "schools recommend during digital wellness programs.", k: "zero paid cac" },
    { i: "stethoscope", n: "03", h: "clinical referrals", b: "child psychologists and paediatricians already advising.", k: "high conversion" },
    { i: "megaphone", n: "04", h: "earned media & pr", b: "the hardware story is newsworthy.", k: "5 placements/qtr" },
  ];
  // Top row: 4 equal-width channel cards
  const gtCardH = 168;
  gt.forEach((c, i) => {
    const cc = col(3, i * 3);
    const x = cc.x;
    const y = CONTENT_TOP_Y;
    rect(x, y, cc.w, gtCardH, PARCHMENT, 10);
    strokeRect(x, y, cc.w, gtCardH, HAIRLINE, 0.5, 10);
    rect(x, y, cc.w, 3, SAGE);
    text(c.n, x + 14, y + 16, { size: 9, color: SAGE, weight: "Helvetica-Bold", tracking: 1.2, width: 30 });
    rect(x + cc.w - 14 - 32, y + 14, 32, 32, MOSS, 6);
    icon(c.i, x + cc.w - 14 - 32, y + 14, 32, SAGE_DEEP);
    text(c.h, x + 14, y + 54, { size: 13, color: INK, weight: "Helvetica-Bold", width: cc.w - 28 });
    text(c.b, x + 14, y + 76, { size: 9, color: MUTED, width: cc.w - 28, lineGap: 3 });
    rect(x + 14, y + gtCardH - 22, cc.w - 28, 14, MOSS, 7);
    text(c.k, x + 14, y + gtCardH - 19, {
      size: 8, color: SAGE_DEEP, weight: "Helvetica-Bold", tracking: 1, width: cc.w - 28, align: "center",
    });
  });

  // Bottom row: 3 traction stat pills (left) + pilot quote (right)
  const bottomY = CONTENT_TOP_Y + gtCardH + CARD_GAP;
  const bottomH = CONTENT_BOTTOM_Y - bottomY;
  const trLeft = col(8, 0);
  const trRight = col(4, 8);

  // EARLY TRACTION row — 3 horizontal stat pills
  text("EARLY TRACTION", trLeft.x, bottomY, {
    size: 8, color: SAGE, weight: "Helvetica-Bold", tracking: 1.4, width: trLeft.w,
  });
  const tStats = [
    { v: "5", l: "pilot families", s: "since q1 2026" },
    { v: "850+", l: "waitlist signups", s: "100% organic" },
    { v: "92%", l: "would recommend", s: "pilot feedback" },
  ];
  const tStY = bottomY + 14;
  const tStH = bottomH - 14;
  const tStCount = tStats.length;
  const tStGap = 8;
  const tStW = (trLeft.w - tStGap * (tStCount - 1)) / tStCount;
  tStats.forEach((s, i) => {
    const x = trLeft.x + i * (tStW + tStGap);
    rect(x, tStY, tStW, tStH, MOSS, 8);
    doc.font("Helvetica-Bold").fontSize(28).fillColor(FOREST)
      .text(s.v, x + 14, tStY + 12, { width: tStW - 28, characterSpacing: -0.8 });
    text(s.l, x + 14, tStY + 48, { size: 10, color: INK, weight: "Helvetica-Bold", width: tStW - 28 });
    text(s.s, x + 14, tStY + 62, { size: 8, color: SAGE_DEEP, width: tStW - 28 });
  });

  // Pilot quote — fills the right column of the bottom row
  rect(trRight.x, bottomY, trRight.w, bottomH, FOREST, 8);
  text("\"week three: time on devices just... stopped being an argument.\"",
    trRight.x + 14, bottomY + 14, { size: 10, color: PARCHMENT, weight: "Helvetica-Bold", width: trRight.w - 28, lineGap: 3 });
  text("PILOT PARENT · MELBOURNE", trRight.x + 14, bottomY + bottomH - 18, {
    size: 7, color: SAGE, weight: "Helvetica-Bold", tracking: 1.2, width: trRight.w - 28,
  });
}
anchor("the early signal", "pre-launch demand outpacing supply. four channels with different cost profiles, all pulling.");

// =========================================================================
// 17 — RISKS
// =========================================================================
newSlide("17 · risks & mitigations");
title("risks & mitigations", "we know the risks — and how we handle them.", { size: 22 });

{
  const rks = [
    { r: "hardware supply chain", m: "second manufacturer qualifying q2 2026. 8,000-unit buffer = 90 days.", sev: "MEDIUM", sevC: AMBER },
    { r: "mobile data bypass", m: "sim-level solution on 2027 roadmap. core 6–12 cohort rarely bypasses.", sev: "MEDIUM", sevC: AMBER },
    { r: "low trial conversion", m: "dedicated onboarding for first 500 households. day-7 and day-30 checks.", sev: "LOW", sevC: SAGE },
    { r: "platform intervention", m: "isp-native tools are shallow. per-device setup can't match network-level.", sev: "LOW", sevC: SAGE },
    { r: "slower growth", m: "18-month runway. school + clinical channels = near-zero cac fallback.", sev: "LOW", sevC: SAGE },
  ];
  const cR = col(4, 0);   // risk = 4 cols
  const cM = col(6, 4);   // mitigation = 6 cols
  const cS = col(2, 10);  // severity = 2 cols (room for the pill, stays inside margin)
  const headerH = 30;
  rect(M, CONTENT_TOP_Y, CONTENT_W, headerH, FOREST);
  text("RISK", cR.x + 14, CONTENT_TOP_Y + 11, {
    size: 9, color: PARCHMENT, weight: "Helvetica-Bold", tracking: 1.2, width: cR.w - 28,
  });
  text("MITIGATION", cM.x + 14, CONTENT_TOP_Y + 11, {
    size: 9, color: PARCHMENT, weight: "Helvetica-Bold", tracking: 1.2, width: cM.w - 28,
  });
  text("SEVERITY", cS.x, CONTENT_TOP_Y + 11, {
    size: 9, color: PARCHMENT, weight: "Helvetica-Bold", tracking: 1.2, width: cS.w, align: "center",
  });
  const rkRowH = (CONTENT_H - headerH) / rks.length;
  rks.forEach((r, i) => {
    const y = CONTENT_TOP_Y + headerH + i * rkRowH;
    if (i % 2 === 0) rect(M, y, CONTENT_W, rkRowH, ROW_ALT);
    text(r.r, cR.x + 14, y + (rkRowH - 14) / 2, {
      size: 11, color: INK, weight: "Helvetica-Bold", width: cR.w - 28,
    });
    text(r.m, cM.x + 14, y + (rkRowH - 28) / 2, {
      size: 10, color: MUTED, width: cM.w - 28, lineGap: 2,
    });
    // Centered pill inside the severity column, never crossing the right margin
    const pillW = 70;
    const pillX = cS.x + (cS.w - pillW) / 2;
    rect(pillX, y + (rkRowH - 18) / 2, pillW, 18, r.sev === "LOW" ? MOSS : "#F5E8D5", 9);
    text(r.sev, pillX, y + (rkRowH - 18) / 2 + 4, {
      size: 8, color: r.sevC, weight: "Helvetica-Bold", tracking: 1.2, width: pillW, align: "center",
    });
    hLine(M, y + rkRowH, CONTENT_W, HAIRLINE);
  });
}
anchor("the operating posture", "named risks, owned mitigations, scheduled review. nothing here is left to luck.");

// =========================================================================
// 18 — TEAM
// 12-col: 2 founder cards col(6) × 2
// =========================================================================
newSlide("18 · the team");
title("the team", "product instinct meets hardware craft.", { size: 22 });

{
  const founders = [
    {
      initials: "SL",
      name: "Sam Leverenz",
      role: "co-founder",
      bio: "product-led co-founder building offly, focused on user behaviour and the household system that makes it work.",
      focusText: "user behaviour · system design",
      accent: SAGE,
    },
    {
      initials: "NH",
      name: "Nathan Hall",
      role: "co-founder",
      bio: "co-founder leading hardware development and product engineering. responsible for the physical hub — from prototype to production.",
      focusText: "hardware · product engineering",
      accent: SAGE_DEEP,
    },
  ];
  founders.forEach((f, i) => {
    const c = col(6, i * 6);
    rect(c.x, CONTENT_TOP_Y, c.w, CONTENT_H, PARCHMENT, 12);
    strokeRect(c.x, CONTENT_TOP_Y, c.w, CONTENT_H, HAIRLINE, 0.5, 12);
    rect(c.x, CONTENT_TOP_Y, c.w, 4, f.accent, 0);
    // Avatar
    const avR = 36;
    const avX = c.x + 28 + avR;
    const avY = CONTENT_TOP_Y + 32 + avR;
    doc.save();
    doc.circle(avX, avY, avR).fill(MOSS);
    doc.restore();
    doc.font("Helvetica-Bold").fontSize(24).fillColor(SAGE_DEEP)
      .text(f.initials, avX - avR, avY - 12, {
        width: avR * 2, align: "center", lineBreak: false, characterSpacing: -0.5,
      });
    // Role pill
    const pillW = 116;
    rect(c.x + c.w - 28 - pillW, CONTENT_TOP_Y + 36, pillW, 22, MOSS, 11);
    text(f.role.toUpperCase(), c.x + c.w - 28 - pillW, CONTENT_TOP_Y + 41, {
      size: 8, color: SAGE_DEEP, weight: "Helvetica-Bold", tracking: 1.4, width: pillW, align: "center",
    });
    // Name
    doc.font("Helvetica-Bold").fontSize(24).fillColor(INK)
      .text(f.name, c.x + 28, avY + avR + 22, { width: c.w - 56, characterSpacing: -0.5 });
    // Bio
    text(f.bio, c.x + 28, avY + avR + 56, { size: 11, color: MUTED, width: c.w - 56, lineGap: 5 });
    // Focus footer — pulled up; richer two-row block fills the lower band
    const focusY = CONTENT_TOP_Y + CONTENT_H - 64;
    hLine(c.x + 28, focusY, c.w - 56, HAIRLINE);
    text("FOCUS", c.x + 28, focusY + 12, {
      size: 8, color: SAGE, weight: "Helvetica-Bold", tracking: 1.4, width: c.w - 56,
    });
    text(f.focusText, c.x + 28, focusY + 28, {
      size: 13, color: INK, weight: "Helvetica-Bold", width: c.w - 56,
    });
  });
}
anchor("why this team", "the offly system needs product, behaviour design, and hardware — that's exactly what this team covers, end to end.");

// =========================================================================
// 19 — FINANCIALS & ASK (dark)
// 12-col: chart col(7), ask + use of funds col(5)
// =========================================================================
newSlide("19 · financials & vision", { dark: true });
title("financials & vision", "conservative growth. compelling returns.", { dark: true, size: 22 });

{
  const left = col(7, 0);
  const right = col(5, 7);
  rect(left.x, CONTENT_TOP_Y, left.w, CONTENT_H, FOREST_2, 10);
  text("3-YEAR PROJECTION (AU)", left.x + 18, CONTENT_TOP_Y + 14, {
    size: 8, color: SAGE, weight: "Helvetica-Bold", tracking: 1.4, width: left.w - 36,
  });
  const years = [
    { y: "y1", subs: 5000, rev: 0.9 },
    { y: "y2", subs: 25000, rev: 4.5 },
    { y: "y3", subs: 100000, rev: 18 },
  ];
  const cX2 = left.x + 36;
  const cY2 = CONTENT_TOP_Y + 44;
  const cW2 = left.w - 72;
  const cH2 = CONTENT_H - 72;
  const maxSubs = 100000;
  const chartTop = cY2 + 24;
  const chartBot = cY2 + cH2 - 28;
  const chartRange = chartBot - chartTop;
  const barGroupW = cW2 / years.length;
  const barW = 28;
  years.forEach((yr, i) => {
    const gx = cX2 + i * barGroupW + barGroupW / 2;
    const subH = (yr.subs / maxSubs) * chartRange;
    rect(gx - barW - 4, chartBot - subH, barW, subH, SAGE, 4);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(PARCHMENT)
      .text(`${yr.subs >= 1000 ? `${yr.subs / 1000}k` : yr.subs}`, gx - barW - 4, chartBot - subH - 14, {
        width: barW, align: "center", lineBreak: false,
      });
    const revH = (yr.rev / 18) * chartRange;
    rect(gx + 4, chartBot - revH, barW, revH, SAGE_DEEP, 4);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(PARCHMENT)
      .text(`A$${yr.rev}M`, gx + 4 - 8, chartBot - revH - 14, { width: barW + 16, align: "center", lineBreak: false });
    text(yr.y.toUpperCase(), gx - 30, chartBot + 8, {
      size: 9, color: MUTED_DARK, weight: "Helvetica-Bold", tracking: 0.8, width: 60, align: "center",
    });
  });
  hLine(cX2, chartBot, cW2, HAIRLINE_DARK);
  // Legend
  const lgY2 = CONTENT_BOTTOM_Y - 22;
  rect(left.x + 18, lgY2, 10, 10, SAGE, 2);
  text("subscribers", left.x + 32, lgY2 + 1, { size: 9, color: MUTED_DARK, weight: "Helvetica-Bold", width: 80 });
  rect(left.x + 130, lgY2, 10, 10, SAGE_DEEP, 2);
  text("annual revenue", left.x + 144, lgY2 + 1, { size: 9, color: MUTED_DARK, weight: "Helvetica-Bold", width: 100 });

  // Right: Ask + use of funds
  text("THE ASK", right.x, CONTENT_TOP_Y + 4, {
    size: 8, color: SAGE, weight: "Helvetica-Bold", tracking: 1.4, width: right.w,
  });
  doc.font("Helvetica-Bold").fontSize(52).fillColor(SAGE)
    .text("A$2.5M", right.x, CONTENT_TOP_Y + 18, { width: right.w, characterSpacing: -2 });
  text("seed round · 18-month runway", right.x, CONTENT_TOP_Y + 78, {
    size: 11, color: PARCHMENT, weight: "Helvetica-Bold", width: right.w,
  });
  text("5,000 paying households · pmf validation in au.", right.x, CONTENT_TOP_Y + 94, {
    size: 10, color: MUTED_DARK, width: right.w,
  });
  text("USE OF FUNDS", right.x, CONTENT_TOP_Y + 122, {
    size: 8, color: SAGE, weight: "Helvetica-Bold", tracking: 1.4, width: right.w,
  });
  const funds: [string, number][] = [
    ["hardware manufacturing", 35],
    ["growth & acquisition", 30],
    ["engineering & app", 20],
    ["operations & logistics", 10],
    ["legal · ip · reserve", 5],
  ];
  const fundsTop = CONTENT_TOP_Y + 138;
  const fundsH = CONTENT_BOTTOM_Y - fundsTop;
  const fundRowH = fundsH / funds.length;
  funds.forEach(([label, pct], i) => {
    const fy = fundsTop + i * fundRowH;
    text(label, right.x, fy, { size: 10, color: PARCHMENT, weight: "Helvetica-Bold", width: right.w });
    text(`${pct}%`, right.x, fy, { size: 10, color: SAGE, weight: "Helvetica-Bold", width: right.w, align: "right" });
    rect(right.x, fy + 14, right.w, 4, FOREST_2, 2);
    rect(right.x, fy + 14, right.w * pct / 100, 4, SAGE, 2);
  });
}
anchor("what this funds", "we are not building a parenting app. we are building the system that makes the nightly fight stop.", { dark: true });

// =========================================================================
// 20 — CLOSING (mirrors cover, no chrome)
// =========================================================================
doc.addPage();
slideIdx = 20;
bg(FOREST);
rect(0, 0, 6, PAGE_H, SAGE);
rect(PAGE_W - 6, 0, 6, PAGE_H, SAGE_DEEP);
// Mirror dots top-right
doc.save();
for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
  doc.circle(PAGE_W - M - c * 14, M + r * 14, 1.2).fillOpacity(0.20).fill(SAGE);
}
doc.fillOpacity(1); doc.restore();
// Mirror dots bottom-left
doc.save();
for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
  doc.circle(M + c * 14, PAGE_H - M - r * 14, 1.2).fillOpacity(0.20).fill(SAGE);
}
doc.fillOpacity(1); doc.restore();

text("OFFLY · INVESTOR DECK · 2026", 0, M + 8, {
  size: 9, color: SAGE, weight: "Helvetica-Bold", width: PAGE_W, align: "center", tracking: 3,
});
// Mirror cover composition: wordmark at same Y, divider, then ask pill below
const CLOSE_WORDMARK_Y = 168;
wordmark(PAGE_W / 2, CLOSE_WORDMARK_Y, 110, { onLight: false });
doc.font("Helvetica-Bold").fontSize(30).fillColor(PARCHMENT)
  .text("let's build calm internet — together.", 0, CLOSE_WORDMARK_Y + 56, {
    width: PAGE_W, align: "center", characterSpacing: -0.6,
  });
text("offly stops the nightly fight. we'd love to show you how.", 0, CLOSE_WORDMARK_Y + 96, {
  size: 13, color: MUTED_DARK, width: PAGE_W, align: "center", tracking: 0.3,
});
// Sage divider rule — anchors the cluster
rect(PAGE_W / 2 - 22, CLOSE_WORDMARK_Y + 128, 44, 2, SAGE);
const recapW = 360;
const recapH = 64;
const recapX = (PAGE_W - recapW) / 2;
const recapY = CLOSE_WORDMARK_Y + 152;
rect(recapX, recapY, recapW, recapH, FOREST_2, 8);
rect(recapX, recapY, 3, recapH, SAGE);
doc.font("Helvetica-Bold").fontSize(20).fillColor(PARCHMENT)
  .text("A$2.5M  ·  seed  ·  18 months", recapX, recapY + 12, {
    width: recapW, align: "center", characterSpacing: -0.4, lineBreak: false,
  });
text("5,000 paying households · pmf validation in au", recapX, recapY + 38, {
  size: 9, color: MUTED_DARK, width: recapW, align: "center", tracking: 1.2,
});
const contactY = recapY + recapH + 28;
doc.font("Helvetica-Bold").fontSize(22).fillColor(SAGE)
  .text("hello@offly.com", 0, contactY, {
    width: PAGE_W, align: "center", characterSpacing: -0.3, lineBreak: false,
  });
text("ADELAIDE · SOUTH AUSTRALIA", 0, contactY + 30, {
  size: 9, color: MUTED_DARK, weight: "Helvetica-Bold", tracking: 2.5, width: PAGE_W, align: "center",
});
text("CONFIDENTIAL · DO NOT DISTRIBUTE", 0, PAGE_H - M, {
  size: 8, color: MUTED_DARK, weight: "Helvetica-Bold", width: PAGE_W, align: "center", tracking: 2.5,
});

doc.end();
console.log("Wrote", out);

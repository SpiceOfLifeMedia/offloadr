import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";

// Primary
const SAGE = "#5A8C72";
const FOREST = "#1E2A24";
const PARCHMENT = "#F6F3EC";
const INK = "#141518";
// Secondary
const MOSS = "#E6EEE9";
const MIST = "#F1F4F2";
const STONE = "#DFE3E1";
const LILAC = "#E8E1F2";
const SAND = "#F2ECE1";

const MUTED = "#8A8E83";
const HAIRLINE = "#E5E2D9";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 56;

const out = path.resolve("exports/offly-brand-kit.pdf");
fs.mkdirSync(path.dirname(out), { recursive: true });

const doc = new PDFDocument({ size: [PAGE_W, PAGE_H], margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } });
doc.pipe(fs.createWriteStream(out));

function fill(color: string) {
  return doc.fillColor(color);
}

function pageBg(color: string) {
  doc.save();
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(color);
  doc.restore();
}

function wordmark(cx: number, cy: number, fontSize: number, opts: { onLight?: boolean; on?: boolean } = {}) {
  const onLight = opts.onLight ?? true;
  const on = opts.on ?? true;
  const inkColor = onLight ? INK : PARCHMENT;
  // LOCKED proportions — match exports/logo/offly-logo-*.svg exactly.
  // dot radius = fontSize × 0.33, gap (dot edge → "f") = fontSize × 0.06,
  // dot centre y = ~0.04 × fontSize above cap-mid (~0.40 × fontSize above baseline).
  const dotRadius = fontSize * 0.33;
  const text = "ffly";
  doc.font("Helvetica-Bold").fontSize(fontSize).fillColor(inkColor);
  const textWidth = doc.widthOfString(text);
  const gap = fontSize * 0.06;
  const totalW = dotRadius * 2 + gap + textWidth;
  const left = cx - totalW / 2;
  const dotCx = left + dotRadius;
  // pdfkit places text top-aligned at textY; for Helvetica-Bold cap-mid sits
  // ~0.06 × fontSize ABOVE cy (which is the bbox centre, skewed by descender).
  const dotCy = cy - fontSize * 0.10;
  doc.save();
  if (on) {
    doc.circle(dotCx, dotCy, dotRadius).fill(SAGE);
    if (fontSize >= 40) {
      const ringR = dotRadius * 0.76;
      doc.circle(dotCx, dotCy, ringR).fillOpacity(0.14).fill(PARCHMENT).fillOpacity(1);
    }
  } else {
    doc.circle(dotCx, dotCy, dotRadius).lineWidth(Math.max(1.5, dotRadius * 0.16)).stroke(SAGE);
  }
  doc.restore();
  // Visual gap between dot and "f" should match inter-letter spacing inside
  // "ffly" (≈ l-to-y). The "f" has ~0.05em LSB; we add a touch on top so the
  // optical gap mirrors the inter-letter rhythm.
  const textX = dotCx + dotRadius + fontSize * 0.06;
  const textY = cy - fontSize * 0.42;
  doc.fillColor(inkColor).text(text, textX, textY, { lineBreak: false });
}

function header(label: string) {
  doc.font("Helvetica").fontSize(8).fillColor(MUTED)
    .text("OFFLY — HUSH", MARGIN, MARGIN - 24, { lineBreak: false });
  const w = doc.widthOfString(label);
  doc.text(label, PAGE_W - MARGIN - w, MARGIN - 24, { lineBreak: false });
}

function footer(n: number, total: number) {
  const txt = `${n} / ${total}`;
  doc.font("Helvetica").fontSize(8).fillColor(MUTED);
  const w = doc.widthOfString(txt);
  doc.text(txt, (PAGE_W - w) / 2, PAGE_H - MARGIN + 12, { lineBreak: false });
}

const TOTAL = 10;
const LOGO_DIR = path.resolve(process.cwd(), "..", "exports", "logo");

// --- Page 1: Cover ---
pageBg(PARCHMENT);
wordmark(PAGE_W / 2, PAGE_H / 2 - 40, 96);
doc.font("Helvetica").fontSize(13).fillColor(MUTED);
{
  const t = "Turn it off in one tap.";
  const w = doc.widthOfString(t);
  doc.text(t, (PAGE_W - w) / 2, PAGE_H / 2 + 30, { lineBreak: false });
}
doc.font("Helvetica-Bold").fontSize(11).fillColor(INK);
{
  const t = "Brand Kit";
  const w = doc.widthOfString(t);
  doc.text(t, (PAGE_W - w) / 2, PAGE_H - MARGIN - 60, { lineBreak: false });
}
doc.font("Helvetica").fontSize(8).fillColor(MUTED);
{
  const t = "CONFIDENTIAL · v1.0";
  const w = doc.widthOfString(t);
  doc.text(t, (PAGE_W - w) / 2, PAGE_H - MARGIN - 44, { lineBreak: false });
}

// --- Page 2: Wordmark ---
doc.addPage();
pageBg(PARCHMENT);
header("WORDMARK");
doc.font("Helvetica-Bold").fontSize(11).fillColor(INK)
  .text("02. WORDMARK", MARGIN, MARGIN, { characterSpacing: 0.6 });
doc.save();
doc.moveTo(MARGIN, MARGIN + 20).lineTo(PAGE_W - MARGIN, MARGIN + 20).lineWidth(0.5).stroke(HAIRLINE);
doc.restore();

// Hero — canonical logo on Forest, matches reference
const heroY = MARGIN + 40;
const heroH = 220;
doc.save();
doc.roundedRect(MARGIN, heroY, PAGE_W - MARGIN * 2, heroH, 14).fill(FOREST);
doc.restore();
wordmark(PAGE_W / 2, heroY + heroH / 2, 110, { onLight: false });
doc.font("Helvetica").fontSize(8).fillColor(MUTED)
  .text("PRIMARY · ON FOREST · CANONICAL", MARGIN, heroY + heroH + 10,
    { width: PAGE_W - MARGIN * 2, align: "center", characterSpacing: 0.6 });

// Two small variants side by side
const variantY = heroY + heroH + 50;
const variantH = 110;
const variantW = (PAGE_W - MARGIN * 2 - 16) / 2;

doc.save();
doc.roundedRect(MARGIN, variantY, variantW, variantH, 10).fill(INK);
doc.restore();
wordmark(MARGIN + variantW / 2, variantY + variantH / 2, 40, { onLight: false });
doc.font("Helvetica").fontSize(8).fillColor(MUTED)
  .text("ON INK", MARGIN, variantY + variantH + 8,
    { width: variantW, align: "center", characterSpacing: 0.6 });

const rightX = MARGIN + variantW + 16;
doc.save();
doc.roundedRect(rightX, variantY, variantW, variantH, 10).fill(SAND);
doc.restore();
doc.save();
doc.roundedRect(rightX, variantY, variantW, variantH, 10).lineWidth(0.5).stroke(HAIRLINE);
doc.restore();
wordmark(rightX + variantW / 2, variantY + variantH / 2, 40, { onLight: true });
doc.font("Helvetica").fontSize(8).fillColor(MUTED)
  .text("ON LIGHT", rightX, variantY + variantH + 8,
    { width: variantW, align: "center", characterSpacing: 0.6 });

// Locked rules block
const rulesY = 580;
doc.font("Helvetica-Bold").fontSize(10).fillColor(INK)
  .text("DOT POSITION RULES (LOCKED)", MARGIN, rulesY);
doc.font("Helvetica").fontSize(10).fillColor(INK);
const rules = [
  "Dot radius = font size × 0.33  (dot diameter ≈ cap height)",
  "Dot centre-x = word left edge + dot radius (aligned to word start)",
  "Dot centre-y = ~0.04 × font size above cap-mid (sits clearly above row centre)",
  "Gap dot edge → first f = font size × 0.06  (matches inter-letter rhythm of \"ffly\")",
  "Tracking: −20. Lowercase only. Never capitalise.",
];
let ry = rulesY + 18;
for (const r of rules) {
  doc.text("·  " + r, MARGIN, ry, { width: PAGE_W - MARGIN * 2 });
  ry += 16;
}
footer(2, TOTAL);

// --- Page 3: Logo suite (file inventory) ---
doc.addPage();
pageBg(PARCHMENT);
header("LOGO SUITE");
doc.font("Helvetica-Bold").fontSize(11).fillColor(INK)
  .text("03. LOGO SUITE", MARGIN, MARGIN, { characterSpacing: 0.6 });
doc.save();
doc.moveTo(MARGIN, MARGIN + 20).lineTo(PAGE_W - MARGIN, MARGIN + 20).lineWidth(0.5).stroke(HAIRLINE);
doc.restore();
doc.font("Helvetica").fontSize(10).fillColor(MUTED)
  .text("Every file ships in PNG (4096 / 2048 / 1024 px) and SVG. Use the smallest tier that holds up.",
    MARGIN, MARGIN + 30, { width: PAGE_W - MARGIN * 2 });

const tiles: { file: string; label: string; bg: string; border?: boolean }[] = [
  { file: "offly-logo-forest.png", label: "FOREST · PRIMARY", bg: FOREST },
  { file: "offly-logo-ink.png", label: "INK", bg: INK },
  { file: "offly-logo-light.png", label: "LIGHT (PARCHMENT)", bg: PARCHMENT, border: true },
  { file: "offly-logo-transparent-light.png", label: "TRANSPARENT · LIGHT MARK", bg: FOREST },
  { file: "offly-logo-transparent-dark.png", label: "TRANSPARENT · DARK MARK", bg: PARCHMENT, border: true },
  { file: "offly-mark.png", label: "MARK ONLY (DOT)", bg: PARCHMENT, border: true },
];
const tileW = (PAGE_W - MARGIN * 2 - 16) / 2;
const tileH = 110;
const tileGapY = 30;
const gridY = MARGIN + 70;
tiles.forEach((t, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const x = MARGIN + col * (tileW + 16);
  const y = gridY + row * (tileH + tileGapY);
  doc.save();
  doc.roundedRect(x, y, tileW, tileH, 10).fill(t.bg);
  doc.restore();
  if (t.border) {
    doc.save();
    doc.roundedRect(x, y, tileW, tileH, 10).lineWidth(0.5).stroke(HAIRLINE);
    doc.restore();
  }
  const fp = path.join(LOGO_DIR, t.file);
  if (fs.existsSync(fp)) {
    const innerW = tileW * 0.78;
    const innerH = tileH * 0.62;
    doc.image(fp, x + (tileW - innerW) / 2, y + (tileH - innerH) / 2, { fit: [innerW, innerH], align: "center", valign: "center" });
  }
  doc.font("Helvetica").fontSize(8).fillColor(MUTED)
    .text(t.label, x, y + tileH + 8, { width: tileW, align: "center", characterSpacing: 0.6 });
});

footer(3, TOTAL);

// --- Page 4: App icon ---
doc.addPage();
pageBg(PARCHMENT);
header("APP ICON");
doc.font("Helvetica-Bold").fontSize(11).fillColor(INK)
  .text("04. APP ICON", MARGIN, MARGIN, { characterSpacing: 0.6 });
doc.save();
doc.moveTo(MARGIN, MARGIN + 20).lineTo(PAGE_W - MARGIN, MARGIN + 20).lineWidth(0.5).stroke(HAIRLINE);
doc.restore();
doc.font("Helvetica").fontSize(10).fillColor(MUTED)
  .text("Forest tile, sage dot, centred. Same artwork on iOS, Android, watchOS, and notification badge.",
    MARGIN, MARGIN + 30, { width: PAGE_W - MARGIN * 2 });

// Hero icon — large iOS-style rounded square (radius ≈ 22% of side)
const heroSide = 220;
const heroX = (PAGE_W - heroSide) / 2;
const heroY2 = MARGIN + 70;
const heroR = heroSide * 0.22;
doc.save();
doc.roundedRect(heroX, heroY2, heroSide, heroSide, heroR).fill(FOREST);
doc.restore();
{
  const dr = heroSide * 0.30;
  const cx = heroX + heroSide / 2;
  const cy = heroY2 + heroSide / 2;
  doc.circle(cx, cy, dr).fill(SAGE);
  doc.circle(cx, cy, dr * 0.76).fillOpacity(0.14).fill(PARCHMENT).fillOpacity(1);
}
doc.font("Helvetica").fontSize(8).fillColor(MUTED)
  .text("1024 × 1024 · iOS / ANDROID MASTER", MARGIN, heroY2 + heroSide + 12,
    { width: PAGE_W - MARGIN * 2, align: "center", characterSpacing: 0.6 });

// Size scale row
const scaleY = heroY2 + heroSide + 60;
doc.font("Helvetica-Bold").fontSize(10).fillColor(INK)
  .text("SIZE SCALE", MARGIN, scaleY, { characterSpacing: 0.6 });
const sizes = [
  { side: 80, label: "180 PX" },
  { side: 56, label: "120 PX" },
  { side: 40, label: "76 PX" },
  { side: 28, label: "60 PX" },
  { side: 20, label: "40 PX" },
];
const totalScaleW = sizes.reduce((a, s) => a + s.side, 0) + (sizes.length - 1) * 24;
let sx = MARGIN + ((PAGE_W - MARGIN * 2) - totalScaleW) / 2;
const baseY = scaleY + 30;
sizes.forEach((s) => {
  const r = s.side * 0.22;
  const yy = baseY + (sizes[0].side - s.side); // bottom-aligned
  doc.save();
  doc.roundedRect(sx, yy, s.side, s.side, r).fill(FOREST);
  doc.restore();
  const dr = s.side * 0.30;
  doc.circle(sx + s.side / 2, yy + s.side / 2, dr).fill(SAGE);
  if (s.side >= 56) {
    doc.circle(sx + s.side / 2, yy + s.side / 2, dr * 0.76).fillOpacity(0.14).fill(PARCHMENT).fillOpacity(1);
  }
  doc.font("Helvetica").fontSize(7).fillColor(MUTED)
    .text(s.label, sx, yy + s.side + 6, { width: s.side, align: "center", characterSpacing: 0.5 });
  sx += s.side + 24;
});

footer(4, TOTAL);

// --- Page 5: Clear space & minimum sizes ---
doc.addPage();
pageBg(PARCHMENT);
header("CLEAR SPACE");
doc.font("Helvetica-Bold").fontSize(11).fillColor(INK)
  .text("05. CLEAR SPACE & MINIMUM SIZE", MARGIN, MARGIN, { characterSpacing: 0.6 });
doc.save();
doc.moveTo(MARGIN, MARGIN + 20).lineTo(PAGE_W - MARGIN, MARGIN + 20).lineWidth(0.5).stroke(HAIRLINE);
doc.restore();
doc.font("Helvetica").fontSize(10).fillColor(MUTED)
  .text("Reserve a clear field equal to the dot diameter on all sides. Nothing crosses it — not photography, not type, not other marks.",
    MARGIN, MARGIN + 30, { width: PAGE_W - MARGIN * 2 });

// Diagram: wordmark with dotted clear-space rectangle around it
{
  const fs2 = 84;
  const dr = fs2 * 0.33;
  const padding = dr * 2;
  const cx = PAGE_W / 2;
  const cy = MARGIN + 200;
  // Use widthOfString to size the bounding box accurately
  doc.font("Helvetica-Bold").fontSize(fs2);
  const tw = doc.widthOfString("ffly");
  const totalW = dr * 2 + fs2 * 0.06 + tw;
  const boxW = totalW + padding * 2;
  const boxH = fs2 * 0.78 + padding * 2; // cap height + padding both sides (approx)
  const boxX = cx - boxW / 2;
  const boxY = cy - boxH / 2;
  doc.save();
  doc.dash(4, { space: 4 }).roundedRect(boxX, boxY, boxW, boxH, 6).lineWidth(0.6).stroke(MUTED);
  doc.undash();
  doc.restore();
  wordmark(cx, cy, fs2);

  // Annotate "x = dot diameter"
  doc.font("Helvetica").fontSize(8).fillColor(MUTED)
    .text("x = dot diameter", boxX, boxY - 14, { characterSpacing: 0.5 });
  // Side measure ticks
  doc.save();
  doc.lineWidth(0.5).strokeColor(MUTED);
  // top tick
  doc.moveTo(boxX - 6, boxY).lineTo(boxX - 6, boxY - padding).stroke();
  doc.moveTo(boxX - 9, boxY).lineTo(boxX - 3, boxY).stroke();
  doc.moveTo(boxX - 9, boxY - padding).lineTo(boxX - 3, boxY - padding).stroke();
  doc.restore();
  // hmm — dropped: keep diagram simple, padding label below
  doc.font("Helvetica").fontSize(8).fillColor(MUTED)
    .text(`padding on every side = x  (≈ ${Math.round(padding)} pt at this scale)`,
      boxX, boxY + boxH + 10, { width: boxW, align: "center" });
}

// Minimum-size guidance
const minY = 480;
doc.font("Helvetica-Bold").fontSize(10).fillColor(INK)
  .text("MINIMUM SIZE", MARGIN, minY, { characterSpacing: 0.6 });

const minRows = [
  { label: "Wordmark · digital", value: "20 px tall" },
  { label: "Wordmark · print", value: "8 mm tall" },
  { label: "Mark only · digital", value: "16 px diameter" },
  { label: "App icon · listing", value: "40 px (no inset ring below this size)" },
];
let myy = minY + 22;
minRows.forEach((r) => {
  doc.font("Helvetica").fontSize(11).fillColor(INK).text(r.label, MARGIN, myy);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(SAGE).text(r.value, MARGIN + 220, myy);
  doc.save();
  doc.moveTo(MARGIN, myy + 18).lineTo(PAGE_W - MARGIN, myy + 18).lineWidth(0.4).stroke(HAIRLINE);
  doc.restore();
  myy += 26;
});

footer(5, TOTAL);

// --- Page 6: Colour palette ---
doc.addPage();
pageBg(PARCHMENT);
header("COLOUR");
doc.font("Helvetica-Bold").fontSize(11).fillColor(INK)
  .text("06. COLOUR PALETTE", MARGIN, MARGIN, { characterSpacing: 0.6 });
// Hairline under section title
doc.save();
doc.moveTo(MARGIN, MARGIN + 20).lineTo(PAGE_W - MARGIN, MARGIN + 20).lineWidth(0.5).stroke(HAIRLINE);
doc.restore();

function swatchRow(label: string, items: { name: string; hex: string }[], y: number) {
  doc.font("Helvetica-Bold").fontSize(9).fillColor(INK)
    .text(label, MARGIN, y, { characterSpacing: 0.6 });
  const rowY = y + 22;
  const gap = 12;
  const w = (PAGE_W - MARGIN * 2 - gap * (items.length - 1)) / items.length;
  const h = 96;
  items.forEach((s, i) => {
    const x = MARGIN + i * (w + gap);
    doc.save();
    doc.roundedRect(x, rowY, w, h, 6).fill(s.hex);
    doc.restore();
    // hairline border for very light tones
    const lightBg = ["#F6F3EC", "#F1F4F2", "#F2ECE1", "#FBF9F4"].includes(s.hex.toUpperCase())
      || s.hex.toUpperCase() === "#F1F4F2";
    if (lightBg || s.hex === PARCHMENT || s.hex === MIST || s.hex === SAND) {
      doc.save();
      doc.roundedRect(x, rowY, w, h, 6).lineWidth(0.5).stroke(HAIRLINE);
      doc.restore();
    }
    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK)
      .text(s.name.toUpperCase(), x, rowY + h + 12, { width: w, characterSpacing: 0.4 });
    doc.font("Helvetica").fontSize(9).fillColor(MUTED)
      .text(s.hex.toUpperCase(), x, rowY + h + 25, { width: w });
  });
  return rowY + h + 50;
}

let cy = MARGIN + 50;
cy = swatchRow("PRIMARY", [
  { name: "Sage", hex: SAGE },
  { name: "Forest", hex: FOREST },
  { name: "Parchment", hex: PARCHMENT },
  { name: "Ink", hex: INK },
], cy);

cy += 20;
swatchRow("SECONDARY", [
  { name: "Moss", hex: MOSS },
  { name: "Mist", hex: MIST },
  { name: "Stone", hex: STONE },
  { name: "Lilac", hex: LILAC },
  { name: "Sand", hex: SAND },
], cy);

footer(3, TOTAL);

// --- Page 7: Typography ---
doc.addPage();
pageBg(PARCHMENT);
header("TYPE");
doc.font("Helvetica-Bold").fontSize(22).fillColor(INK).text("07 · Typography", MARGIN, MARGIN);
doc.font("Helvetica").fontSize(11).fillColor(MUTED)
  .text("One face. Two weights. Quiet by default.", { width: PAGE_W - MARGIN * 2 });

doc.font("Helvetica-Bold").fontSize(10).fillColor(MUTED).text("FAMILY", MARGIN, 220);
doc.font("Helvetica-Bold").fontSize(28).fillColor(INK).text("Cera Pro", MARGIN, 236);
doc.font("Helvetica").fontSize(11).fillColor(MUTED).text("Fallback: TT Norms Pro · Inter · system-ui", MARGIN, 274);

const samples = [
  { label: "Display · 36 / Semibold", size: 32, weight: "Helvetica-Bold", text: "Internet is on" },
  { label: "Heading · 22 / Semibold", size: 22, weight: "Helvetica-Bold", text: "Set your first quiet time" },
  { label: "Body · 14 / Regular", size: 14, weight: "Helvetica", text: "Offly runs in the background." },
  { label: "Caption · 11 / Medium · UPPER", size: 11, weight: "Helvetica-Bold", text: "HOUSEHOLD" },
];
let ty = 320;
for (const s of samples) {
  doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(s.label, MARGIN, ty);
  doc.font(s.weight).fontSize(s.size).fillColor(INK).text(s.text, MARGIN, ty + 12);
  ty += 18 + s.size + 14;
}

footer(7, TOTAL);

// --- Page 8: Dot states ---
doc.addPage();
pageBg(PARCHMENT);
header("DOT STATES");
doc.font("Helvetica-Bold").fontSize(22).fillColor(INK).text("08 · Dot states", MARGIN, MARGIN);
doc.font("Helvetica").fontSize(11).fillColor(MUTED)
  .text("ON is solid sage. OFF is outline. Transition is a 300 ms fade. Nothing else.", { width: PAGE_W - MARGIN * 2 });

const stateY = 260;
const stateW = (PAGE_W - MARGIN * 2 - 40) / 3;
const states = [
  { label: "ON", sub: "Solid sage", draw: (cx: number, cy: number) => {
      doc.circle(cx, cy, 50).fill(SAGE);
      doc.circle(cx, cy, 38).fillOpacity(0.14).fill(PARCHMENT).fillOpacity(1);
    } },
  { label: "OFF", sub: "Outline only", draw: (cx: number, cy: number) => {
      doc.circle(cx, cy, 50).lineWidth(6).stroke(SAGE);
    } },
  { label: "TRANSITION", sub: "300 ms fade", draw: (cx: number, cy: number) => {
      doc.save();
      doc.fillOpacity(0.45).circle(cx, cy, 50).fill(SAGE);
      doc.restore();
      doc.circle(cx, cy, 50).lineWidth(2).stroke(SAGE);
    } },
];
states.forEach((s, i) => {
  const cx = MARGIN + stateW / 2 + i * (stateW + 20);
  const cy = stateY + 70;
  doc.save();
  doc.roundedRect(cx - stateW / 2, stateY, stateW, 200, 14).fill("#FFFFFF");
  doc.restore();
  doc.save();
  doc.roundedRect(cx - stateW / 2, stateY, stateW, 200, 14).lineWidth(0.6).stroke("#E5E2D9");
  doc.restore();
  s.draw(cx, cy);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(INK)
    .text(s.label, cx - stateW / 2, stateY + 150, { width: stateW, align: "center" });
  doc.font("Helvetica").fontSize(10).fillColor(MUTED)
    .text(s.sub, cx - stateW / 2, stateY + 168, { width: stateW, align: "center" });
});

footer(8, TOTAL);

// --- Page 9: Voice & vocabulary ---
doc.addPage();
pageBg(PARCHMENT);
header("VOICE");
doc.font("Helvetica-Bold").fontSize(22).fillColor(INK).text("09 · Voice & vocabulary", MARGIN, MARGIN);
doc.font("Helvetica").fontSize(11).fillColor(MUTED)
  .text("Lowercase. Calm. Supportive. Never preachy, never alarming.", { width: PAGE_W - MARGIN * 2 });

// Tagline block
doc.font("Helvetica-Bold").fontSize(10).fillColor(MUTED).text("TAGLINE", MARGIN, 230, { characterSpacing: 0.6 });
doc.font("Helvetica-Bold").fontSize(28).fillColor(INK).text("Turn it off in one tap.", MARGIN, 248);

// Two-column: USE vs NEVER USE
const colY = 340;
const colW = (PAGE_W - MARGIN * 2 - 28) / 2;
const leftX = MARGIN;
const rightX2 = MARGIN + colW + 28;

doc.font("Helvetica-Bold").fontSize(10).fillColor(SAGE).text("USE", leftX, colY, { characterSpacing: 0.8 });
doc.save();
doc.moveTo(leftX, colY + 18).lineTo(leftX + colW, colY + 18).lineWidth(0.5).stroke(HAIRLINE);
doc.restore();
const useWords = [
  ["internet", "the thing being turned off"],
  ["quiet time", "scheduled off windows"],
  ["calm", "the feeling we're after"],
  ["household", "the people on the network"],
  ["off · on", "the only two states that matter"],
];
let uy = colY + 30;
for (const [word, gloss] of useWords) {
  doc.font("Helvetica-Bold").fontSize(13).fillColor(INK).text(word, leftX, uy);
  doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(gloss, leftX, uy + 18, { width: colW });
  uy += 48;
}

doc.font("Helvetica-Bold").fontSize(10).fillColor("#B0524A").text("NEVER USE", rightX2, colY, { characterSpacing: 0.8 });
doc.save();
doc.moveTo(rightX2, colY + 18).lineTo(rightX2 + colW, colY + 18).lineWidth(0.5).stroke(HAIRLINE);
doc.restore();
const avoidWords = [
  ["screen time", "framed as guilt, not calm"],
  ["parental control", "implies surveillance"],
  ["per-child", "we don't slice the home that way"],
  ["per-app", "we work at the network layer"],
  ["pause breaks", "redundant — the dot already says it"],
];
let ay = colY + 30;
for (const [word, why] of avoidWords) {
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#B0524A").text(word, rightX2, ay);
  doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(why, rightX2, ay + 18, { width: colW });
  ay += 48;
}

footer(9, TOTAL);

// --- Page 10: Rendering tiers ---
doc.addPage();
pageBg(PARCHMENT);
header("RENDERING TIERS");
doc.font("Helvetica-Bold").fontSize(22).fillColor(INK).text("10 · Rendering tiers", MARGIN, MARGIN);
doc.font("Helvetica").fontSize(11).fillColor(MUTED)
  .text("Hard cutoff at 40 px. No transitional states.", { width: PAGE_W - MARGIN * 2 });

const tierY = 240;
// Above 40px sample
doc.font("Helvetica-Bold").fontSize(10).fillColor(MUTED).text("≥ 40 PX · DOT + INSET RING", MARGIN, tierY);
const dotR = 46;
const cx1 = MARGIN + 80;
const cy1 = tierY + 90;
doc.circle(cx1, cy1, dotR).fill(SAGE);
doc.circle(cx1, cy1, dotR * 0.76).fillOpacity(0.14).fill(PARCHMENT).fillOpacity(1);
doc.font("Helvetica").fontSize(10).fillColor(INK)
  .text("Inset ring at 14% Parchment, radius 76% of dot. Adds depth at large sizes.",
    MARGIN + 180, cy1 - 18, { width: PAGE_W - MARGIN * 2 - 180 });

// Below 40px sample
doc.font("Helvetica-Bold").fontSize(10).fillColor(MUTED).text("< 40 PX · SOLID DOT ONLY", MARGIN, tierY + 200);
const cx2 = MARGIN + 80;
const cy2 = tierY + 280;
doc.circle(cx2, cy2, 14).fill(SAGE);
doc.font("Helvetica").fontSize(10).fillColor(INK)
  .text("No ring. No glow. No effects. Crispness wins below 40 px.",
    MARGIN + 180, cy2 - 8, { width: PAGE_W - MARGIN * 2 - 180 });

// Footer locked rule
doc.font("Helvetica-Bold").fontSize(9).fillColor(FOREST)
  .text("LOCKED: there is no transitional rendering between tiers.",
    MARGIN, PAGE_H - MARGIN - 20, { width: PAGE_W - MARGIN * 2, align: "center" });

footer(6, TOTAL);

doc.end();
console.log("Wrote", out);

#!/usr/bin/env node
/**
 * Captures every screen of the Offly Expo web build at retina resolution
 * (1170 x 2532, iPhone 14/15 native pixels), composites each one inside a
 * realistic iPhone frame on a light grey background, and bundles the PNGs
 * into screenshots/offly-app-screens.zip.
 *
 * Usage:
 *   REPLIT_EXPO_DEV_DOMAIN=<your-expo-domain> \
 *     node scripts/capture-offly-mobile.cjs
 */

const puppeteer = require("puppeteer");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const BASE_URL = `https://${process.env.REPLIT_EXPO_DEV_DOMAIN}`;
const OUT_DIR = path.join(__dirname, "..", "screenshots", "offly-mobile");
const ZIP_PATH = path.join(
  __dirname,
  "..",
  "screenshots",
  "offly-app-screens.zip",
);

const SCREEN_W = 1170;
const SCREEN_H = 2532;
const BEZEL = 28;
const CORNER_RADIUS = 180;
const CANVAS_PAD_X = 140;
const CANVAS_PAD_Y = 180;
const CANVAS_W = SCREEN_W + BEZEL * 2 + CANVAS_PAD_X * 2;
const CANVAS_H = SCREEN_H + BEZEL * 2 + CANVAS_PAD_Y * 2;
const BG_COLOR = { r: 242, g: 242, b: 242, alpha: 1 };

const DEVICE_W = SCREEN_W + BEZEL * 2;
const DEVICE_H = SCREEN_H + BEZEL * 2;
const DEVICE_X = (CANVAS_W - DEVICE_W) / 2;
const DEVICE_Y = (CANVAS_H - DEVICE_H) / 2;

const ISLAND_W = 360;
const ISLAND_H = 110;
const ISLAND_TOP_INSET = 36;

const SCREENS = [
  {
    filename: "01-onboarding-account.png",
    description: "Onboarding step 1 — Set up your home / sign-in providers",
    url: "/onboarding?step=0",
  },
  {
    filename: "02-onboarding-name-home.png",
    description: "Onboarding step 2 — Name your home",
    url: "/onboarding?step=1",
  },
  {
    filename: "03-onboarding-connect-hub.png",
    description: "Onboarding step 3 — Plug in your Offly Hub",
    url: "/onboarding?step=2",
  },
  {
    filename: "04-onboarding-family.png",
    description: "Onboarding step 4 — Add family members",
    url: "/onboarding?step=3",
  },
  {
    filename: "05-onboarding-quiet-time.png",
    description: "Onboarding step 5 — Set your first quiet time",
    url: "/onboarding?step=4",
  },
  {
    filename: "06-onboarding-done.png",
    description: "Onboarding step 6 — You're all set",
    url: "/onboarding?step=5",
  },
  {
    filename: "07-home.png",
    description: "Home tab — Internet status indicator",
    url: "/?demo=1",
  },
  {
    filename: "08-schedules.png",
    description: "Schedules tab — empty state",
    url: "/schedules?demo=1",
  },
  {
    filename: "09-override.png",
    description: "Override tab — Give more time / quiet time controls",
    url: "/override?demo=1",
  },
  {
    filename: "10-settings.png",
    description: "Settings tab — household, account, family, hub, subscription",
    url: "/settings?demo=1",
  },
];

function frameSvg() {
  // Full canvas SVG: light grey background, drop-shadowed black device
  // body with rounded corners, dynamic island pill on top.
  return Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
  <defs>
    <filter id="deviceShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="40"/>
      <feOffset dx="0" dy="30" result="offsetblur"/>
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.28"/>
      </feComponentTransfer>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="rgb(${BG_COLOR.r},${BG_COLOR.g},${BG_COLOR.b})"/>
  <rect x="${DEVICE_X}" y="${DEVICE_Y}" width="${DEVICE_W}" height="${DEVICE_H}" rx="${CORNER_RADIUS}" ry="${CORNER_RADIUS}" fill="#101113" filter="url(#deviceShadow)"/>
</svg>`,
  );
}

function islandSvg() {
  return Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${ISLAND_W}" height="${ISLAND_H}" viewBox="0 0 ${ISLAND_W} ${ISLAND_H}">
  <rect x="0" y="0" width="${ISLAND_W}" height="${ISLAND_H}" rx="${ISLAND_H / 2}" ry="${ISLAND_H / 2}" fill="#000000"/>
</svg>`,
  );
}

function screenMaskSvg() {
  return Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SCREEN_W}" height="${SCREEN_H}" viewBox="0 0 ${SCREEN_W} ${SCREEN_H}">
  <rect x="0" y="0" width="${SCREEN_W}" height="${SCREEN_H}" rx="${CORNER_RADIUS - BEZEL}" ry="${CORNER_RADIUS - BEZEL}" fill="#ffffff"/>
</svg>`,
  );
}

async function captureOne(page, screen) {
  const url = BASE_URL + screen.url;
  process.stdout.write(`  ${screen.filename} ← ${screen.url} ... `);

  await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
  // Give Expo a moment to settle (fonts, layout, async storage).
  await new Promise((r) => setTimeout(r, 1500));

  // Raw screen capture at 1170x2532 thanks to deviceScaleFactor: 3.
  const rawScreenBuf = await page.screenshot({ type: "png", omitBackground: false });

  // Round the screen corners.
  const roundedScreenBuf = await sharp(rawScreenBuf)
    .resize(SCREEN_W, SCREEN_H, { fit: "cover" })
    .composite([{ input: screenMaskSvg(), blend: "dest-in" }])
    .png()
    .toBuffer();

  // Compose: background + device body, screen on top of device, dynamic
  // island over the screen status-bar area.
  const islandX = Math.round(DEVICE_X + BEZEL + (SCREEN_W - ISLAND_W) / 2);
  const islandY = Math.round(DEVICE_Y + BEZEL + ISLAND_TOP_INSET);

  const finalBuf = await sharp(frameSvg())
    .composite([
      {
        input: roundedScreenBuf,
        top: Math.round(DEVICE_Y + BEZEL),
        left: Math.round(DEVICE_X + BEZEL),
      },
      {
        input: islandSvg(),
        top: islandY,
        left: islandX,
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();

  const outPath = path.join(OUT_DIR, screen.filename);
  await fs.promises.writeFile(outPath, finalBuf);
  const kb = (finalBuf.length / 1024).toFixed(0);
  console.log(`OK (${kb} KB)`);
  return true;
}

async function buildZip(outDir, zipPath, screens) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      const mb = (archive.pointer() / 1024 / 1024).toFixed(2);
      console.log(`ZIP created: ${zipPath} (${mb} MB)`);
      resolve();
    });
    archive.on("error", reject);
    archive.pipe(output);

    for (const s of screens) {
      const filePath = path.join(outDir, s.filename);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: `offly-app-screens/${s.filename}` });
      }
    }

    const readmeLines = [
      "Offly Mobile App — Screen Reference",
      "====================================",
      "",
      "Generated: " + new Date().toISOString(),
      "",
      `Screen size: ${SCREEN_W}x${SCREEN_H} px (iPhone 14/15 native @3x)`,
      `Image size : ${CANVAS_W}x${CANVAS_H} px (screen + iPhone frame + padding)`,
      "Format     : PNG, retina-ready",
      "",
      "Screen inventory:",
      "",
    ];

    for (const s of screens) {
      readmeLines.push(`  ${s.filename}`);
      readmeLines.push(`    ${s.description}`);
      readmeLines.push("");
    }

    archive.append(readmeLines.join("\n"), {
      name: "offly-app-screens/README.txt",
    });
    archive.finalize();
  });
}

async function main() {
  console.log("Offly Mobile — Screen Capture (retina + iPhone frame)");
  console.log("======================================================");
  console.log(`Base URL : ${BASE_URL}`);
  console.log(`Output   : ${OUT_DIR}`);
  console.log(`Screens  : ${SCREENS.length}`);
  console.log("");

  if (!process.env.REPLIT_EXPO_DEV_DOMAIN) {
    console.error("ERROR: REPLIT_EXPO_DEV_DOMAIN is not set.");
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(ZIP_PATH), { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--ignore-certificate-errors",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  await page.setUserAgent(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
      "AppleWebKit/605.1.15 (KHTML, like Gecko) " +
      "Version/17.0 Mobile/15E148 Safari/604.1",
  );

  let captured = 0;
  let failed = 0;
  for (const screen of SCREENS) {
    try {
      const ok = await captureOne(page, screen);
      if (ok) captured++;
      else failed++;
    } catch (e) {
      console.error(`  ERROR ${screen.filename}: ${e.message}`);
      failed++;
    }
  }

  await browser.close();
  console.log(`\nCapture complete: ${captured} succeeded, ${failed} failed\n`);

  console.log("Building ZIP...");
  await buildZip(OUT_DIR, ZIP_PATH, SCREENS);
  console.log("\nDone.");
  console.log(`  PNGs : ${OUT_DIR}`);
  console.log(`  ZIP  : ${ZIP_PATH}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

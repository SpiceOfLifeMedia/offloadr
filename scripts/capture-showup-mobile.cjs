#!/usr/bin/env node
/**
 * Captures screenshots of every screen in the ShowUp Mobile Expo web build.
 * Output: PNG screenshots at 390×844 px organized into 6 flow folders,
 *         bundled into screenshots/showup-mobile-screens.zip
 *
 * Usage:
 *   REPLIT_EXPO_DEV_DOMAIN=<your-expo-domain> node scripts/capture-showup-mobile.cjs
 *
 * Dependencies: puppeteer, archiver, sharp (all at workspace root)
 *
 * Note: Requires puppeteer's bundled Chromium to be downloadable.
 *       Run: npx puppeteer browsers install chrome
 */

const puppeteer = require("puppeteer");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const BASE_URL = `https://${process.env.REPLIT_EXPO_DEV_DOMAIN}`;
const OUT_DIR = path.join(__dirname, "..", "screenshots", "showup-mobile");
const ZIP_PATH = path.join(__dirname, "..", "screenshots", "showup-mobile-screens.zip");

const VIEWPORT = { width: 390, height: 844 };

const SCREENS = [
  // auth
  {
    folder: "auth",
    filename: "01-splash.png",
    description: "Splash screen — ShowUp logo and tagline on dark green background",
    url: "/",
  },
  {
    folder: "auth",
    filename: "02-auth-choose.png",
    description: "Auth screen — join options: Google, Apple, Phone and Email",
    url: "/auth",
  },
  {
    folder: "auth",
    filename: "03-auth-phone.png",
    description: "Auth phone entry — Australian mobile number input with +61 prefix",
    url: "/auth-phone",
  },
  {
    folder: "auth",
    filename: "04-auth-otp.png",
    description: "Auth OTP verification — 6-digit code entry with 30s resend timer",
    url: "/auth-otp",
  },

  // onboarding
  {
    folder: "onboarding",
    filename: "01-onboarding.png",
    description: "Onboarding — Browse/Secure/Meet progress steps with feature overview",
    url: "/onboarding",
  },

  // browse
  {
    folder: "browse",
    filename: "01-browse-home.png",
    description: "Browse screen — near-you listings grid with category pills and bottom tab bar",
    url: "/browse",
  },
  {
    folder: "browse",
    filename: "02-search-empty.png",
    description: "Search screen — empty state with radius pills and price range filters",
    url: "/search",
  },

  // buyer
  {
    folder: "buyer",
    filename: "01-listing-detail.png",
    description: "Listing detail — hero image, price, seller card, AI price insight and CTA footer",
    url: "/buyer/listing",
  },
  {
    folder: "buyer",
    filename: "02-make-offer.png",
    description: "Make an offer — dollar amount input with real-time reserve feedback",
    url: "/buyer/make-offer",
  },
  {
    folder: "buyer",
    filename: "03-commit-to-buy.png",
    description: "Commit to buy — 4-step process explanation, deposit box and seller card",
    url: "/buyer/commit",
  },
  {
    folder: "buyer",
    filename: "04-time-proposal.png",
    description: "Time proposal — buyer selects day and time window for meetup",
    url: "/buyer/time-proposal",
  },
  {
    folder: "buyer",
    filename: "05-different-time.png",
    description: "Different time — seller proposes an alternative meetup time with message",
    url: "/buyer/different-time",
  },
  {
    folder: "buyer",
    filename: "06-inspection.png",
    description: "Inspection checklist — buyer confirms item condition matches listing",
    url: "/buyer/inspection",
  },
  {
    folder: "buyer",
    filename: "07-address-reveal.png",
    description: "Address reveal — meetup address shown after time confirmed, map placeholder",
    url: "/buyer/address-reveal",
  },
  {
    folder: "buyer",
    filename: "08-secured.png",
    description: "Buyer secured — item locked confirmation with deposit paid and price locked",
    url: "/buyer/secured",
  },
  {
    folder: "buyer",
    filename: "09-message.png",
    description: "Message seller — product-questions-only chat with preset conversation",
    url: "/buyer/message",
  },
  {
    folder: "buyer",
    filename: "10-rate.png",
    description: "Rate seller — post-transaction Yes/No rating for three meetup criteria",
    url: "/buyer/rate",
  },
  {
    folder: "buyer",
    filename: "11-win.png",
    description: "Buyer win — savings summary: offer accepted, amount saved vs asking price",
    url: "/buyer/win?asking=120&paid=95&title=Vintage+leather+messenger+bag",
  },

  // seller
  {
    folder: "seller",
    filename: "01-listing-step1.png",
    description: "New listing Step 1 of 4 — add photos area with AI description prompt",
    url: "/listing/step1",
  },
  {
    folder: "seller",
    filename: "02-listing-step2.png",
    description: "New listing Step 2 of 4 — AI analysis in progress: item identified, waiting",
    url: "/listing/step2",
  },
  {
    folder: "seller",
    filename: "03-listing-step3.png",
    description: "New listing Step 3 of 4 — review AI-generated title, category, condition and description",
    url: "/listing/step3",
  },
  {
    folder: "seller",
    filename: "04-listing-step4.png",
    description: "New listing Step 4 of 4 — pricing type and availability days/windows",
    url: "/listing/step4",
  },
  {
    folder: "seller",
    filename: "05-listing-live.png",
    description: "Listing live — success screen with views, radius, earnings stats",
    url: "/listing/live",
  },

  // transaction
  {
    folder: "transaction",
    filename: "01-confirm-sale.png",
    description: "Confirm sale (seller) — agreed price locked, confirm cash payment received",
    url: "/transaction/confirm",
  },
  {
    folder: "transaction",
    filename: "02-meetup.png",
    description: "Meetup request (seller) — buyer's proposed time, confirm or suggest another",
    url: "/transaction/meetup",
  },
  {
    folder: "transaction",
    filename: "03-on-way.png",
    description: "On the way (seller) — buyer in transit, get-ready checklist with locked price",
    url: "/transaction/on-way",
  },
  {
    folder: "transaction",
    filename: "04-secured-transaction.png",
    description: "Transaction secured (seller) — buyer committed, 3-step next steps",
    url: "/transaction/secured",
  },
  {
    folder: "transaction",
    filename: "05-rate-buyer.png",
    description: "Rate buyer — seller rates buyer: showed up, honoured price, completed deal",
    url: "/transaction/rate",
  },
];

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureScreenshot(page, screen, outDir) {
  const folderPath = path.join(outDir, screen.folder);
  fs.mkdirSync(folderPath, { recursive: true });

  const fullUrl = `${BASE_URL}${screen.url}`;
  const tmpJpg = path.join(folderPath, screen.filename.replace(".png", ".tmp.jpg"));
  const filePath = path.join(folderPath, screen.filename);

  console.log(`  → ${screen.folder}/${screen.filename}`);
  console.log(`    URL: ${fullUrl}`);

  try {
    await page.goto(fullUrl, { waitUntil: "networkidle2", timeout: 30000 });
  } catch (e) {
    console.warn(`    Warning: networkidle timed out, trying load...`);
    try {
      await page.goto(fullUrl, { waitUntil: "load", timeout: 15000 });
    } catch (e2) {
      console.error(`    Error loading ${fullUrl}: ${e2.message}`);
      return false;
    }
  }

  await wait(2500);

  await page.screenshot({
    path: tmpJpg,
    type: "jpeg",
    quality: 95,
    clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height },
  });

  await sharp(tmpJpg).png().toFile(filePath);
  fs.unlinkSync(tmpJpg);

  console.log(`    Saved: ${filePath}`);
  return true;
}

async function buildZip(outDir, zipPath, screens) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      const mb = (archive.pointer() / 1024 / 1024).toFixed(1);
      console.log(`ZIP created: ${zipPath} (${mb} MB)`);
      resolve();
    });
    archive.on("error", reject);
    archive.pipe(output);

    const folders = ["auth", "onboarding", "browse", "buyer", "seller", "transaction"];
    for (const folder of folders) {
      const folderPath = path.join(outDir, folder);
      if (fs.existsSync(folderPath)) {
        archive.directory(folderPath, `showup-mobile-screens/${folder}`);
      }
    }

    const readmeLines = [
      "ShowUp Mobile – Screen Reference",
      "=================================",
      "",
      "Generated: " + new Date().toISOString(),
      "Format: PNG screenshots at 390×844 px (iPhone 14 proportions)",
      "",
      "Folder structure:",
      "  auth/        – Splash and authentication screens",
      "  onboarding/  – App intro / onboarding screens",
      "  browse/      – Browse feed and search screens",
      "  buyer/       – Complete buyer flow (listing → offer → commit → meetup → win)",
      "  seller/      – Listing creation flow (4 steps + live confirmation)",
      "  transaction/ – Meetup coordination and transaction completion screens",
      "",
      "Screen inventory:",
      "",
    ];

    let currentFolder = "";
    for (const s of screens) {
      if (s.folder !== currentFolder) {
        currentFolder = s.folder;
        readmeLines.push(`[${s.folder}/]`);
      }
      readmeLines.push(`  ${s.filename}`);
      readmeLines.push(`    ${s.description}`);
      readmeLines.push("");
    }

    archive.append(readmeLines.join("\n"), { name: "showup-mobile-screens/README.txt" });
    archive.finalize();
  });
}

async function main() {
  console.log("ShowUp Mobile — Screenshot Capture");
  console.log("====================================");
  console.log(`Base URL : ${BASE_URL}`);
  console.log(`Output   : ${OUT_DIR}`);
  console.log(`Screens  : ${SCREENS.length}`);
  console.log("");

  if (!process.env.REPLIT_EXPO_DEV_DOMAIN) {
    console.error("ERROR: REPLIT_EXPO_DEV_DOMAIN is not set.");
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-web-security",
      "--ignore-certificate-errors",
      "--allow-insecure-localhost",
    ],
  });

  const page = await browser.newPage();

  await page.setViewport({
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  await page.setUserAgent(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  );

  let captured = 0;
  let failed = 0;

  for (const screen of SCREENS) {
    try {
      const ok = await captureScreenshot(page, screen, OUT_DIR);
      if (ok) captured++;
      else failed++;
    } catch (e) {
      console.error(`  ERROR capturing ${screen.filename}: ${e.message}`);
      failed++;
    }
  }

  await browser.close();

  console.log(`\nCapture complete: ${captured} succeeded, ${failed} failed\n`);

  console.log("Building ZIP...");
  await buildZip(OUT_DIR, ZIP_PATH, SCREENS);

  console.log("\nAll done!");
  console.log(`Output ZIP: ${ZIP_PATH}`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
